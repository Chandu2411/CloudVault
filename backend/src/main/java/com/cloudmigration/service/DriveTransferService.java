package com.cloudmigration.service;

import com.cloudmigration.dto.DriveFileDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.exception.TransferException;
import com.cloudmigration.repository.TransferItemRepository;
import com.cloudmigration.util.CountingInputStream;
import com.google.api.client.googleapis.media.MediaHttpUploader;
import com.google.api.client.http.InputStreamContent;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;

/**
 * DriveTransferService — Handles the actual file transfer between Google Drive accounts.
 *
 * Transfer flow for each file:
 *   1. Stream file bytes from source Drive → piped directly into upload stream
 *   2. CountingInputStream wraps the pipe to count bytes in real-time
 *   3. Upload to destination Drive using resumable upload (handles any file size)
 *   4. Record destination file ID and size for verification
 *
 * Progress is 100% real — no timers, no random numbers.
 * Every byte read by the upload API increments TransferProgressStore.
 */
@Service
public class DriveTransferService {

    private static final Logger log = LoggerFactory.getLogger(DriveTransferService.class);

    /** Files larger than this use resumable upload (Google recommends 5 MB threshold). */
    private static final long RESUMABLE_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024L; // 5 MB

    /** Pipe buffer size — 256 KB keeps both sides busy without wasting heap. */
    private static final int PIPE_BUFFER_SIZE = 256 * 1024; // 256 KB

    /**
     * Maps Google Workspace MIME types → export MIME type + file extension.
     * Google Docs editor files cannot be downloaded directly; they must be exported.
     */
    private static final Map<String, String[]> WORKSPACE_EXPORT_FORMATS = Map.of(
        "application/vnd.google-apps.document",      new String[]{"application/vnd.openxmlformats-officedocument.wordprocessingml.document",   ".docx"},
        "application/vnd.google-apps.spreadsheet",   new String[]{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         ".xlsx"},
        "application/vnd.google-apps.presentation",  new String[]{"application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"},
        "application/vnd.google-apps.drawing",       new String[]{"image/png",                                                                 ".png"},
        "application/vnd.google-apps.script",        new String[]{"application/vnd.google-apps.script+json",                                  ".json"},
        "application/vnd.google-apps.form",          new String[]{"application/zip",                                                           ".zip"}
    );

    private final TransferItemRepository  transferItemRepository;
    private final DriveClientFactory      driveClientFactory;
    private final TransferProgressStore   progressStore;

    /** Cached thread pool for the download side of each pipe. */
    private final ExecutorService downloadExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "drive-download");
        t.setDaemon(true);
        return t;
    });

    public DriveTransferService(TransferItemRepository transferItemRepository,
                                DriveClientFactory driveClientFactory,
                                TransferProgressStore progressStore) {
        this.transferItemRepository = transferItemRepository;
        this.driveClientFactory     = driveClientFactory;
        this.progressStore          = progressStore;
    }

    /**
     * Execute transfer for all queued items in a TransferJob.
     * Initialises the progress store for the job before starting.
     */
    public void executeTransferJob(TransferJob job) {
        List<TransferItem> queuedItems = transferItemRepository
            .findByTransferJobIdAndTransferStatus(job.getId(), TransferStatus.QUEUED);

        log.info("Starting transfer job {}: {} files to transfer", job.getId(), queuedItems.size());

        // ── Register all items in the store BEFORE any transfer begins ──────
        // This gives the frontend the full file list immediately.
        for (TransferItem item : queuedItems) {
            String destEmail = item.getDestinationAccount() != null
                ? item.getDestinationAccount().getEmail() : null;
            progressStore.addItem(
                job.getId(), item.getId(),
                item.getSourceFileName(),
                item.getFileSizeBytes() != null ? item.getFileSizeBytes() : 0,
                item.getSourceMimeType(),
                destEmail
            );
        }

        Drive sourceDrive = driveClientFactory.getSourceDriveClient(job);

        for (TransferItem item : queuedItems) {
            try {
                transferSingleItem(item, sourceDrive, job.getId());
            } catch (Exception e) {
                log.error("Failed to transfer item {}: {}", item.getId(), e.getMessage());
                item.setTransferStatus(TransferStatus.FAILED);
                item.setErrorMessage(e.getMessage());
                transferItemRepository.save(item);
                progressStore.markFailed(job.getId(), item.getId(), e.getMessage());
            }
        }
    }

    /**
     * Transfer a single file from source to destination Drive using streaming.
     *
     * <p>A background thread downloads from the source Drive and writes into a
     * {@link PipedOutputStream}. The main thread reads from the paired
     * {@link PipedInputStream}, wrapped in a {@link CountingInputStream} that
     * reports every byte to {@link TransferProgressStore}.
     *
     * <p>The entire file never lives in memory at once — heap pressure is O(pipe buffer).
     * <p>
     * NOTE: Not @Transactional — cannot hold a DB transaction open across
     * piped stream threads (causes Hibernate session conflicts).
     */
    public void transferSingleItem(TransferItem item, Drive sourceDrive, UUID jobId) throws IOException {
        // ── Update DB + progress store: TRANSFERRING ──────────────────────
        item.setTransferStatus(TransferStatus.TRANSFERRING);
        transferItemRepository.save(item);
        progressStore.markTransferring(jobId, item.getId());

        String   mimeType     = item.getSourceMimeType();
        String[] exportFormat = WORKSPACE_EXPORT_FORMATS.get(mimeType);
        boolean  isWorkspace  = exportFormat != null;

        String uploadMimeType;
        String uploadFileName;

        if (isWorkspace) {
            uploadMimeType = exportFormat[0];
            String extension = exportFormat[1];
            uploadFileName = item.getSourceFileName().endsWith(extension)
                ? item.getSourceFileName()
                : item.getSourceFileName() + extension;
        } else {
            uploadMimeType = mimeType;
            uploadFileName = item.getSourceFileName();
        }

        long fileSizeBytes = item.getFileSizeBytes() != null ? item.getFileSizeBytes() : -1;

        log.info("Streaming transfer of '{}' ({} bytes) → {}",
                 uploadFileName, fileSizeBytes, item.getDestinationAccount().getEmail());

        // ── Piped stream: download thread writes, upload reads ────────────
        PipedOutputStream pipedOut = new PipedOutputStream();
        PipedInputStream  pipedIn  = new PipedInputStream(pipedOut, PIPE_BUFFER_SIZE);

        // Capture any exception thrown by the download thread
        AtomicReference<Exception> downloadError = new AtomicReference<>();

        Future<?> downloadFuture = downloadExecutor.submit(() -> {
            try (PipedOutputStream out = pipedOut) {
                if (isWorkspace) {
                    log.info("Exporting Google Workspace file '{}' as '{}'",
                             item.getSourceFileName(), uploadMimeType);
                    sourceDrive.files()
                        .export(item.getSourceFileId(), uploadMimeType)
                        .executeMediaAndDownloadTo(out);
                } else {
                    log.info("Streaming download of '{}' from source Drive", item.getSourceFileName());
                    sourceDrive.files()
                        .get(item.getSourceFileId())
                        .executeMediaAndDownloadTo(out);
                }
            } catch (Exception e) {
                downloadError.set(e);
                try { pipedOut.close(); } catch (IOException ignored) {}
            }
        });

        // ── Upload side: CountingInputStream wraps pipedIn ───────────────
        // CRITICAL: Every byte read by the upload API passes through CountingInputStream,
        // which increments TransferProgressStore atomically. This is the ONLY source
        // of truth for progress — no timers, no faking.
        CountingInputStream countingIn = new CountingInputStream(
            pipedIn, progressStore, jobId, item.getId()
        );

        try {
            GoogleAccount destAccount = item.getDestinationAccount();
            Drive destDrive = driveClientFactory.buildDriveClient(destAccount);

            File fileMetadata = new File();
            fileMetadata.setName(uploadFileName);

            InputStreamContent mediaContent = new InputStreamContent(uploadMimeType, countingIn);
            // Set length hint so the API can choose resumable vs simple upload automatically.
            // Use -1 if unknown (streaming export from Workspace files).
            mediaContent.setLength(isWorkspace ? -1 : fileSizeBytes);

            Drive.Files.Create createRequest = destDrive.files()
                .create(fileMetadata, mediaContent)
                .setFields("id,size,md5Checksum");

            // Use resumable upload for large files (keeps the connection alive and
            // allows progress tracking; avoids timeouts on multi-GB transfers).
            if (!isWorkspace && fileSizeBytes > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
                log.info("Using resumable upload for large file '{}' ({} MB)",
                         uploadFileName, fileSizeBytes / (1024 * 1024));
                createRequest.getMediaHttpUploader()
                    .setDirectUploadEnabled(false)  // false = resumable
                    .setChunkSize(MediaHttpUploader.MINIMUM_CHUNK_SIZE * 4); // 1 MB chunks
            } else {
                createRequest.getMediaHttpUploader().setDirectUploadEnabled(true);
            }

            File uploadedFile = createRequest.execute();

            // Wait for download thread to finish cleanly
            try { downloadFuture.get(); } catch (Exception ignored) {}

            // Check if download failed
            if (downloadError.get() != null) {
                throw new TransferException(
                    "Download failed for '" + item.getSourceFileName() + "': " + downloadError.get().getMessage(),
                    downloadError.get());
            }

            // ── Record result ─────────────────────────────────────────────
            item.setDestinationFileId(uploadedFile.getId());
            item.setDestinationSizeBytes(uploadedFile.getSize());
            item.setDestinationMd5Checksum(uploadedFile.getMd5Checksum());
            item.setExpectedSizeBytes(item.getFileSizeBytes());
            item.setTransferStatus(TransferStatus.VERIFYING);
            item.setProgressPercent(100);
            transferItemRepository.save(item);

            // Update progress store: VERIFYING
            progressStore.markVerifying(jobId, item.getId());

            log.info("Transfer complete for '{}', destination file ID: {}", uploadFileName, uploadedFile.getId());

        } catch (TransferException te) {
            throw te;
        } catch (Exception e) {
            downloadFuture.cancel(true);
            throw new TransferException(
                "Transfer failed for file '" + item.getSourceFileName() + "': " + e.getMessage(), e);
        } finally {
            // Always close so the download thread doesn't block forever
            try { countingIn.close(); } catch (IOException ignored) {}
        }
    }

    /**
     * List all files in a Drive account's root (for browsing source files).
     */
    public List<DriveFileDto> listDriveFiles(GoogleAccount account) {
        try {
            Drive drive = driveClientFactory.buildDriveClient(account);
            var result = drive.files().list()
                .setFields("files(id,name,mimeType,size,md5Checksum,webViewLink,parents)")
                .setPageSize(1000)
                .execute();

            return result.getFiles().stream()
                .map(f -> DriveFileDto.builder()
                    .id(f.getId())
                    .name(f.getName())
                    .mimeType(f.getMimeType())
                    .sizeBytes(f.getSize())
                    .isGoogleWorkspace(isGoogleWorkspaceMimeType(f.getMimeType()))
                    .md5Checksum(f.getMd5Checksum())
                    .webViewLink(f.getWebViewLink())
                    .parents(f.getParents())
                    .build())
                .toList();
        } catch (Exception e) {
            log.error("Error listing files", e);
            throw new TransferException("Failed to list files for account " + account.getEmail(), e);
        }
    }

    private boolean isGoogleWorkspaceMimeType(String mimeType) {
        return mimeType != null && mimeType.startsWith("application/vnd.google-apps.");
    }
}
