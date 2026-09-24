package com.cloudmigration.service;

import com.cloudmigration.dto.DriveFileDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.enums.VerificationStatus;
import com.cloudmigration.exception.TransferException;
import com.cloudmigration.repository.TransferItemRepository;
import com.google.api.client.http.InputStreamContent;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DriveTransferService — Handles the actual file transfer between Google Drive accounts.
 *
 * Transfer flow for each file:
 *   1. Download file bytes from source Drive using source account credentials
 *   2. Upload file bytes to destination Drive using destination account credentials
 *   3. Record destination file ID and size for verification
 *
 * IMPORTANT: This service does NOT handle verification or cleanup.
 * Those are delegated to TransferVerificationService and SourceCleanupService.
 */
@Service
public class DriveTransferService {

    private static final Logger log = LoggerFactory.getLogger(DriveTransferService.class);

    /**
     * Maps Google Workspace MIME types → export MIME type + file extension.
     * Google Docs editors files cannot be downloaded directly; they must be exported.
     * See: https://developers.google.com/drive/api/guides/manage-downloads#export-content
     */
    private static final Map<String, String[]> WORKSPACE_EXPORT_FORMATS = Map.of(
        "application/vnd.google-apps.document",      new String[]{"application/vnd.openxmlformats-officedocument.wordprocessingml.document",   ".docx"},
        "application/vnd.google-apps.spreadsheet",   new String[]{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         ".xlsx"},
        "application/vnd.google-apps.presentation",  new String[]{"application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"},
        "application/vnd.google-apps.drawing",       new String[]{"image/png",                                                                 ".png"},
        "application/vnd.google-apps.script",        new String[]{"application/vnd.google-apps.script+json",                                  ".json"},
        "application/vnd.google-apps.form",          new String[]{"application/zip",                                                           ".zip"}
    );

    private final TransferItemRepository transferItemRepository;
    private final DriveClientFactory driveClientFactory;

    public DriveTransferService(TransferItemRepository transferItemRepository,
                                 DriveClientFactory driveClientFactory) {
        this.transferItemRepository = transferItemRepository;
        this.driveClientFactory = driveClientFactory;
    }

    /**
     * Execute transfer for all queued items in a TransferJob.
     *
     * @param job the TransferJob to process
     */
    @Transactional
    public void executeTransferJob(TransferJob job) {
        List<TransferItem> queuedItems = transferItemRepository
            .findByTransferJobIdAndTransferStatus(job.getId(), TransferStatus.QUEUED);

        log.info("Starting transfer job {}: {} files to transfer", job.getId(), queuedItems.size());

        Drive sourceDrive = driveClientFactory.getSourceDriveClient(job);

        for (TransferItem item : queuedItems) {
            try {
                transferSingleItem(item, sourceDrive);
            } catch (Exception e) {
                log.error("Failed to transfer item {}: {}", item.getId(), e.getMessage());
                item.setTransferStatus(TransferStatus.FAILED);
                item.setErrorMessage(e.getMessage());
                transferItemRepository.save(item);
            }
        }
    }

    /**
     * Transfer a single file from source to destination Drive.
     */
    @Transactional
    public void transferSingleItem(TransferItem item, Drive sourceDrive) {
        item.setTransferStatus(TransferStatus.TRANSFERRING);
        transferItemRepository.save(item);

        try {
            String mimeType = item.getSourceMimeType();
            String[] exportFormat = WORKSPACE_EXPORT_FORMATS.get(mimeType);
            boolean isWorkspaceFile = exportFormat != null;

            // Step 1: Download (or export) from source
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            String uploadMimeType;
            String uploadFileName;

            if (isWorkspaceFile) {
                // Google Workspace files (Docs/Sheets/Slides) must be exported, not downloaded
                uploadMimeType = exportFormat[0];
                String extension = exportFormat[1];
                // Avoid double extension (e.g. file.docx.docx)
                uploadFileName = item.getSourceFileName().endsWith(extension)
                    ? item.getSourceFileName()
                    : item.getSourceFileName() + extension;
                log.info("Exporting Google Workspace file '{}' as '{}'", item.getSourceFileName(), uploadMimeType);
                sourceDrive.files()
                    .export(item.getSourceFileId(), uploadMimeType)
                    .executeMediaAndDownloadTo(outputStream);
            } else {
                // Regular binary file — direct download
                uploadMimeType = mimeType;
                uploadFileName = item.getSourceFileName();
                log.info("Downloading file '{}' from source Drive", item.getSourceFileName());
                sourceDrive.files()
                    .get(item.getSourceFileId())
                    .executeMediaAndDownloadTo(outputStream);
            }

            byte[] fileBytes = outputStream.toByteArray();

            // Step 2: Upload to destination
            GoogleAccount destAccount = item.getDestinationAccount();
            Drive destDrive = driveClientFactory.buildDriveClient(destAccount);

            log.info("Uploading file '{}' to destination account {}", uploadFileName, destAccount.getEmail());

            File fileMetadata = new File();
            fileMetadata.setName(uploadFileName);

            InputStreamContent mediaContent = new InputStreamContent(
                uploadMimeType,
                new ByteArrayInputStream(fileBytes)
            );

            File uploadedFile = destDrive.files()
                .create(fileMetadata, mediaContent)
                .setFields("id,size,md5Checksum")
                .execute();

            // Step 3: Record result
            item.setDestinationFileId(uploadedFile.getId());
            item.setDestinationSizeBytes(uploadedFile.getSize());
            item.setDestinationMd5Checksum(uploadedFile.getMd5Checksum());
            item.setExpectedSizeBytes(item.getFileSizeBytes());
            item.setTransferStatus(TransferStatus.VERIFYING);
            item.setProgressPercent(100);
            transferItemRepository.save(item);

            log.info("Transfer complete for '{}', destination file ID: {}", uploadFileName, uploadedFile.getId());

        } catch (Exception e) {
            throw new TransferException("Transfer failed for file '" + item.getSourceFileName() + "': " + e.getMessage(), e);
        }
    }

    /**
     * List all files in a Drive account's root (for browsing source files).
     */
    public List<DriveFileDto> listDriveFiles(GoogleAccount account) {
        try {
            Drive drive = driveClientFactory.buildDriveClient(account);
            var result = drive.files().list()
                .setFields("files(id,name,mimeType,size,md5Checksum,webViewLink)")
                .setPageSize(100)
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
                    .build())
                .toList();
        } catch (Exception e) {
            throw new TransferException("Failed to list files for account " + account.getEmail(), e);
        }
    }

    private boolean isGoogleWorkspaceMimeType(String mimeType) {
        return mimeType != null && mimeType.startsWith("application/vnd.google-apps.");
    }
}
