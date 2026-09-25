package com.cloudmigration.controller;

import com.cloudmigration.dto.TransferJobDto;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.repository.TransferJobRepository;
import com.cloudmigration.service.TransferProgressStore;
import com.cloudmigration.service.TransferProgressStore.ItemProgress;
import com.cloudmigration.service.TransferProgressStore.JobProgress;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * TransferJobController — REST + SSE endpoints for transfer job data.
 *
 * GET /api/jobs              → list all jobs (poll-based, for history)
 * GET /api/jobs/{id}         → single job snapshot (for polling fallback)
 * GET /api/jobs/{id}/progress → SSE stream of real-time progress
 *
 * The SSE endpoint pushes a JSON snapshot every 300ms while the job is active.
 * When the job completes/fails, a final event is pushed and the stream closes.
 *
 * Progress data comes from TransferProgressStore (updated by CountingInputStream
 * on every byte transferred). When the job is no longer in the store (finished),
 * falls back to reading the DB for the final state.
 */
@RestController
@RequestMapping("/api/jobs")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class TransferJobController {

    private final TransferJobRepository  transferJobRepository;
    private final TransferProgressStore  progressStore;
    private final com.cloudmigration.repository.TransferItemRepository transferItemRepository;

    /** Shared scheduler for SSE heartbeat ticks. */
    private final ScheduledExecutorService scheduler =
        Executors.newScheduledThreadPool(4, r -> {
            Thread t = new Thread(r, "sse-scheduler");
            t.setDaemon(true);
            return t;
        });

    public TransferJobController(TransferJobRepository transferJobRepository,
                                  TransferProgressStore progressStore,
                                  com.cloudmigration.repository.TransferItemRepository transferItemRepository) {
        this.transferJobRepository = transferJobRepository;
        this.progressStore         = progressStore;
        this.transferItemRepository = transferItemRepository;
    }

    // ── REST endpoints ───────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<TransferJobDto>> getAllJobs() {
        List<TransferJobDto> jobs = transferJobRepository.findAll().stream()
                .sorted((j1, j2) -> j2.getCreatedAt().compareTo(j1.getCreatedAt()))
                .map(TransferJobDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(jobs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransferJobDto> getJob(@PathVariable UUID id) {
        return transferJobRepository.findById(id)
                .map(TransferJobDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── SSE progress stream ──────────────────────────────────────────────────

    /**
     * Server-Sent Events endpoint for real-time transfer progress.
     *
     * <p>The client connects once; the server pushes JSON snapshots every 300ms.
     * When the job finishes, a final "done" event is pushed and the connection closes.
     *
     * <p>Data priority:
     *  - If job is in TransferProgressStore → live in-memory data (real bytes).
     *  - If not in store (job finished) → read from DB for final state.
     */
    @GetMapping(value = "/{id}/progress", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamProgress(@PathVariable UUID id) {
        // 2-hour timeout — matches the max transfer timeout in application.properties
        SseEmitter emitter = new SseEmitter(2 * 60 * 60 * 1000L);

        ScheduledFuture<?>[] futureHolder = new ScheduledFuture<?>[1];

        Runnable tick = () -> {
            try {
                ProgressSnapshot snapshot = buildSnapshot(id);
                emitter.send(SseEmitter.event()
                    .name("progress")
                    .data(snapshot));

                // If job is done, send a final event and close
                if ("COMPLETED".equals(snapshot.status) || "FAILED".equals(snapshot.status)
                        || "CANCELLED".equals(snapshot.status)) {
                    emitter.send(SseEmitter.event().name("done").data(snapshot));
                    emitter.complete();
                    if (futureHolder[0] != null) futureHolder[0].cancel(false);
                }
            } catch (IOException e) {
                // Client disconnected
                emitter.completeWithError(e);
                if (futureHolder[0] != null) futureHolder[0].cancel(false);
            }
        };

        // Push first event immediately, then every 300ms
        futureHolder[0] = scheduler.scheduleAtFixedRate(tick, 0, 300, TimeUnit.MILLISECONDS);

        emitter.onCompletion(() -> { if (futureHolder[0] != null) futureHolder[0].cancel(false); });
        emitter.onTimeout(()    -> { if (futureHolder[0] != null) futureHolder[0].cancel(false); });
        emitter.onError(e     -> { if (futureHolder[0] != null) futureHolder[0].cancel(false); });

        return emitter;
    }

    // ── Snapshot builder ─────────────────────────────────────────────────────

    private ProgressSnapshot buildSnapshot(UUID jobId) {
        JobProgress live = progressStore.getJob(jobId);

        if (live != null) {
            // ── LIVE: job is currently running — use in-memory data ──────────
            ProgressSnapshot snap = new ProgressSnapshot();
            snap.jobId           = jobId.toString();
            snap.status          = "IN_PROGRESS";
            snap.overallProgress = live.overallProgress();
            snap.totalFiles      = live.totalFiles;
            snap.completedFiles  = live.completedFiles;
            snap.failedFiles     = live.failedFiles;
            snap.totalBytes      = live.totalBytes;
            snap.transferredBytes = live.transferredBytes.get();
            snap.currentFileName = live.currentFileName;
            snap.speedBytesPerSec        = live.speedBytesPerSec();
            snap.estimatedRemainingSeconds = live.etaSeconds();

            snap.items = live.items.values().stream()
                .sorted(Comparator.comparing(i -> i.fileName))
                .map(item -> {
                    ItemSnapshot is = new ItemSnapshot();
                    is.itemId           = item.itemId.toString();
                    is.fileName         = item.fileName;
                    is.fileSizeBytes    = item.fileSizeBytes;
                    is.transferredBytes = item.transferredBytes.get();
                    is.progressPercent  = item.progressPercent();
                    is.status           = item.status;
                    is.mimeType         = item.mimeType;
                    is.destinationEmail = item.destinationEmail;
                    is.errorMessage     = item.errorMessage;
                    return is;
                })
                .collect(Collectors.toList());

            return snap;
        }

        // ── FALLBACK: job not in store → read from DB ────────────────────
        Optional<TransferJob> jobOpt = transferJobRepository.findById(jobId);
        if (jobOpt.isEmpty()) {
            ProgressSnapshot snap = new ProgressSnapshot();
            snap.jobId  = jobId.toString();
            snap.status = "NOT_FOUND";
            return snap;
        }

        TransferJob job = jobOpt.get();
        ProgressSnapshot snap = new ProgressSnapshot();
        snap.jobId            = jobId.toString();
        snap.status           = job.getStatus().name();
        snap.overallProgress  = "COMPLETED".equals(snap.status) ? 100
            : (job.getTotalFiles() > 0
               ? (int) ((long)(job.getCompletedFiles() != null ? job.getCompletedFiles() : 0) * 100 / job.getTotalFiles())
               : 0);
        snap.totalFiles       = job.getTotalFiles() != null ? job.getTotalFiles() : 0;
        snap.completedFiles   = job.getCompletedFiles() != null ? job.getCompletedFiles() : 0;
        snap.failedFiles      = job.getFailedFiles() != null ? job.getFailedFiles() : 0;
        snap.totalBytes       = job.getTotalBytes() != null ? job.getTotalBytes() : 0;
        snap.transferredBytes = "COMPLETED".equals(snap.status)
            ? snap.totalBytes
            : (job.getTransferredBytes() != null ? job.getTransferredBytes() : 0);
        snap.speedBytesPerSec         = 0;
        snap.estimatedRemainingSeconds = 0;

        List<com.cloudmigration.entity.TransferItem> items = transferItemRepository.findByTransferJobId(jobId);
        if (items != null && !items.isEmpty()) {
            snap.items = items.stream()
                .sorted(Comparator.comparing(i -> i.getSourceFileName()))
                .map(item -> {
                    ItemSnapshot is = new ItemSnapshot();
                    is.itemId           = item.getId().toString();
                    is.fileName         = item.getSourceFileName();
                    is.fileSizeBytes    = item.getFileSizeBytes() != null ? item.getFileSizeBytes() : 0;
                    is.transferredBytes = "COMPLETED".equals(snap.status) || "COMPLETED".equals(item.getTransferStatus().name())
                        ? is.fileSizeBytes : 0;
                    is.progressPercent  = item.getProgressPercent() != null ? item.getProgressPercent() : 0;
                    if ("COMPLETED".equals(snap.status)) is.progressPercent = 100;
                    is.status           = item.getTransferStatus().name();
                    is.mimeType         = item.getSourceMimeType();
                    is.destinationEmail = item.getDestinationAccount() != null
                        ? item.getDestinationAccount().getEmail() : null;
                    is.errorMessage     = item.getErrorMessage();
                    return is;
                })
                .collect(Collectors.toList());
        }

        return snap;
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    /** JSON snapshot pushed to frontend via SSE. */
    public static class ProgressSnapshot {
        public String jobId;
        public String status;          // IN_PROGRESS | COMPLETED | FAILED | CANCELLED
        public int    overallProgress; // 0-100 (real bytes)
        public int    totalFiles;
        public int    completedFiles;
        public int    failedFiles;
        public long   totalBytes;
        public long   transferredBytes;
        public String currentFileName;
        public long   speedBytesPerSec;
        public long   estimatedRemainingSeconds; // -1 = not yet computable
        public List<ItemSnapshot> items = new ArrayList<>();
    }

    public static class ItemSnapshot {
        public String itemId;
        public String fileName;
        public long   fileSizeBytes;
        public long   transferredBytes;
        public int    progressPercent;  // (transferredBytes / fileSizeBytes) * 100
        public String status;           // QUEUED | TRANSFERRING | VERIFYING | COMPLETED | FAILED
        public String mimeType;
        public String destinationEmail;
        public String errorMessage;
    }
}
