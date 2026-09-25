package com.cloudmigration.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory store for real-time transfer progress.
 *
 * <p>Updated by CountingInputStream on every chunk read during upload.
 * The SSE endpoint reads this store on each tick to push live data to the frontend.
 *
 * <p>Uses AtomicLong for thread-safe, lock-free updates.
 * All fields are thread-safe — concurrent file transfers update independently.
 */
@Component
public class TransferProgressStore {

    /**
     * Per-item live progress snapshot.
     */
    public static class ItemProgress {
        public final UUID   itemId;
        public final String fileName;
        public final long   fileSizeBytes;
        public final String mimeType;
        public final String destinationEmail;

        /** Bytes actually transferred so far (updated every chunk). */
        public final AtomicLong transferredBytes = new AtomicLong(0);

        /** Status string: QUEUED | TRANSFERRING | VERIFYING | COMPLETED | FAILED */
        public volatile String status = "QUEUED";

        /** Error message if failed. */
        public volatile String errorMessage;

        /** Timestamp when this item started transferring (ms). */
        public volatile long startedAtMs;

        public ItemProgress(UUID itemId, String fileName, long fileSizeBytes,
                            String mimeType, String destinationEmail) {
            this.itemId           = itemId;
            this.fileName         = fileName;
            this.fileSizeBytes    = fileSizeBytes;
            this.mimeType         = mimeType;
            this.destinationEmail = destinationEmail;
        }

        /** Progress 0..100, calculated from actual bytes. */
        public int progressPercent() {
            if (fileSizeBytes <= 0) return 0;
            long xferred = transferredBytes.get();
            return (int) Math.min(100, (xferred * 100L) / fileSizeBytes);
        }
    }

    /**
     * Per-job live progress aggregate.
     */
    public static class JobProgress {
        public final UUID jobId;
        public final long totalBytes;
        public final int  totalFiles;

        /** Sum of bytes across ALL items (updated atomically per chunk). */
        public final AtomicLong transferredBytes = new AtomicLong(0);

        /** How many items completed successfully. */
        public volatile int  completedFiles = 0;
        public volatile int  failedFiles    = 0;

        /** Name of the file currently being transferred. */
        public volatile String currentFileName = "";

        /** Timestamp when job started (ms) — for speed / ETA calculation. */
        public final long startedAtMs = System.currentTimeMillis();

        /** Items keyed by item UUID. */
        public final Map<UUID, ItemProgress> items = new ConcurrentHashMap<>();

        public JobProgress(UUID jobId, long totalBytes, int totalFiles) {
            this.jobId      = jobId;
            this.totalBytes = totalBytes;
            this.totalFiles = totalFiles;
        }

        /** Overall progress 0..100, from actual bytes. */
        public int overallProgress() {
            if (totalBytes <= 0) return 0;
            long xferred = transferredBytes.get();
            return (int) Math.min(99, (xferred * 100L) / totalBytes);
            // Never return 100 here — set to 100 only when COMPLETED is written to DB
        }

        /** Transfer speed in bytes/sec, calculated from elapsed time + transferred bytes. */
        public long speedBytesPerSec() {
            long elapsedMs = System.currentTimeMillis() - startedAtMs;
            if (elapsedMs <= 0) return 0;
            return (transferredBytes.get() * 1000L) / elapsedMs;
        }

        /** Estimated remaining seconds. Returns -1 if not yet computable. */
        public long etaSeconds() {
            long speed = speedBytesPerSec();
            if (speed <= 0) return -1;
            long remaining = totalBytes - transferredBytes.get();
            return remaining / speed;
        }
    }

    /** Map of jobId → live progress for active/recent jobs. */
    private final Map<UUID, JobProgress> jobs = new ConcurrentHashMap<>();

    // ── Job lifecycle ───────────────────────────────────────────────────────

    public void initJob(UUID jobId, long totalBytes, int totalFiles) {
        jobs.put(jobId, new JobProgress(jobId, totalBytes, totalFiles));
    }

    public void addItem(UUID jobId, UUID itemId, String fileName, long fileSizeBytes,
                        String mimeType, String destinationEmail) {
        JobProgress job = jobs.get(jobId);
        if (job == null) return;
        job.items.put(itemId, new ItemProgress(itemId, fileName, fileSizeBytes, mimeType, destinationEmail));
    }

    /** Called by CountingInputStream every chunk — NO locking needed (AtomicLong). */
    public void addBytes(UUID jobId, UUID itemId, long chunkBytes) {
        JobProgress job = jobs.get(jobId);
        if (job == null) return;
        job.transferredBytes.addAndGet(chunkBytes);
        ItemProgress item = job.items.get(itemId);
        if (item != null) item.transferredBytes.addAndGet(chunkBytes);
    }

    public void markTransferring(UUID jobId, UUID itemId) {
        JobProgress job = jobs.get(jobId);
        if (job == null) return;
        job.currentFileName = job.items.getOrDefault(itemId, new ItemProgress(itemId,"",0,null,null)).fileName;
        ItemProgress item = job.items.get(itemId);
        if (item != null) {
            item.status = "TRANSFERRING";
            item.startedAtMs = System.currentTimeMillis();
        }
    }

    public void markVerifying(UUID jobId, UUID itemId) {
        ItemProgress item = getItem(jobId, itemId);
        if (item != null) {
            // Mark 100% transferred (piped stream finished)
            item.transferredBytes.set(item.fileSizeBytes > 0 ? item.fileSizeBytes : item.transferredBytes.get());
            item.status = "VERIFYING";
        }
    }

    public void markCompleted(UUID jobId, UUID itemId) {
        ItemProgress item = getItem(jobId, itemId);
        if (item != null) {
            item.transferredBytes.set(item.fileSizeBytes > 0 ? item.fileSizeBytes : item.transferredBytes.get());
            item.status = "COMPLETED";
        }
        JobProgress job = jobs.get(jobId);
        if (job != null) job.completedFiles++;
    }

    public void markFailed(UUID jobId, UUID itemId, String error) {
        ItemProgress item = getItem(jobId, itemId);
        if (item != null) {
            item.status = "FAILED";
            item.errorMessage = error;
        }
        JobProgress job = jobs.get(jobId);
        if (job != null) job.failedFiles++;
    }

    public void cleanup(UUID jobId) {
        jobs.remove(jobId);
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    public JobProgress getJob(UUID jobId) {
        return jobs.get(jobId);
    }

    private ItemProgress getItem(UUID jobId, UUID itemId) {
        JobProgress job = jobs.get(jobId);
        return job == null ? null : job.items.get(itemId);
    }
}
