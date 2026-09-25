package com.cloudmigration.service;

import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.enums.TransferJobStatus;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.repository.TransferJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * TransferJobExecutor — A SEPARATE Spring bean responsible for running
 * the async part of a transfer job.
 *
 * WHY a separate bean?
 * Spring @Async works via AOP proxies. If you call an @Async method on 'this'
 * inside the same class (self-invocation), the proxy is bypassed and the method
 * runs synchronously. By moving @Async to a different bean, Spring's proxy
 * intercepts the call correctly and runs it on a thread pool thread.
 *
 * This means the HTTP request returns the job ID immediately, the frontend
 * connects to the SSE endpoint, and THEN the async transfer begins — giving
 * the SSE a chance to stream real byte progress.
 */
@Component
public class TransferJobExecutor {

    private static final Logger log = LoggerFactory.getLogger(TransferJobExecutor.class);

    private final TransferJobRepository      transferJobRepository;
    private final DriveTransferService       driveTransferService;
    private final TransferVerificationService transferVerificationService;
    private final SourceCleanupService       sourceCleanupService;
    private final TransferProgressStore      progressStore;
    private final com.cloudmigration.repository.TransferItemRepository transferItemRepository;
    private final com.cloudmigration.service.GoogleAccountService googleAccountService;

    public TransferJobExecutor(TransferJobRepository transferJobRepository,
                               DriveTransferService driveTransferService,
                               TransferVerificationService transferVerificationService,
                               SourceCleanupService sourceCleanupService,
                               TransferProgressStore progressStore,
                               com.cloudmigration.repository.TransferItemRepository transferItemRepository,
                               com.cloudmigration.service.GoogleAccountService googleAccountService) {
        this.transferJobRepository      = transferJobRepository;
        this.driveTransferService       = driveTransferService;
        this.transferVerificationService = transferVerificationService;
        this.sourceCleanupService       = sourceCleanupService;
        this.progressStore              = progressStore;
        this.transferItemRepository     = transferItemRepository;
        this.googleAccountService       = googleAccountService;
    }

    /**
     * Run the full transfer pipeline asynchronously.
     * Called from TransferJobService.createAndStartJob() — the separation
     * from that class ensures Spring's @Async proxy intercepts correctly.
     */
    @Async
    public void executeAsync(UUID jobId, String transferMode) {
        try {
            // The @Async thread may start before the @Transactional in createAndStartJob
            // has committed to the DB. Retry up to 5 times (1 second total) to be safe.
            var jobOpt = transferJobRepository.findById(jobId);
            int retries = 0;
            while (jobOpt.isEmpty() && retries < 5) {
                try { Thread.sleep(200); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                jobOpt = transferJobRepository.findById(jobId);
                retries++;
            }
            // capture for lambda (retries must be effectively final)
            final int finalRetries = retries;
            var job = jobOpt.orElseThrow(() ->
                new IllegalStateException("Job " + jobId + " not found in DB after " + finalRetries + " retries"));

            // 1. Transfer all queued items — CountingInputStream updates progressStore per chunk
            driveTransferService.executeTransferJob(job);

            // 2. Verify transferred items
            transferVerificationService.verifyJobItems(jobId);

            // 3. Finalize items
            if ("CUT".equalsIgnoreCase(transferMode)) {
                sourceCleanupService.performBatchCleanup(jobId);
            } else {
                // COPY mode: mark all VERIFIED items as COMPLETED
                // Copy to plain List to avoid Hibernate ConcurrentModificationException
                var finalJob  = transferJobRepository.findById(jobId).orElseThrow();
                List<TransferItem> itemsCopy = transferItemRepository.findByTransferJobId(jobId);
                int completed = 0;
                for (TransferItem item : itemsCopy) {
                    if (item.getTransferStatus() == TransferStatus.VERIFIED) {
                        item.setTransferStatus(TransferStatus.COMPLETED);
                        item.setCompletedAt(LocalDateTime.now());
                        progressStore.markCompleted(jobId, item.getId());
                        completed++;
                        
                        // Update destination account storage locally
                        try {
                            com.cloudmigration.entity.GoogleAccount destAcc = item.getDestinationAccount();
                            if (destAcc != null && destAcc.getStorageUsed() != null && item.getFileSizeBytes() != null) {
                                long newUsed = destAcc.getStorageUsed() + item.getFileSizeBytes();
                                googleAccountService.updateStorageInfo(destAcc.getId(), destAcc.getStorageTotal(), newUsed);
                            }
                        } catch (Exception e) {
                            log.warn("Failed to update local storage usage for account", e);
                        }
                    }
                }
                transferItemRepository.saveAll(itemsCopy);
                finalJob.setCompletedFiles(completed);
                transferJobRepository.save(finalJob);
            }

            // 4. Mark the job itself as COMPLETED in the database
            var completedJob = transferJobRepository.findById(jobId).orElseThrow();
            long doneCount = transferItemRepository.findByTransferJobId(jobId).stream()
                .filter(i -> i.getTransferStatus() == TransferStatus.COMPLETED
                          || i.getTransferStatus() == TransferStatus.VERIFIED)
                .count();
            completedJob.setStatus(TransferJobStatus.COMPLETED);
            completedJob.setCompletedAt(LocalDateTime.now());
            completedJob.setCompletedFiles((int) doneCount);
            completedJob.setTransferredBytes(completedJob.getTotalBytes());
            transferJobRepository.save(completedJob);

            log.info("Transfer job {} completed successfully: {}/{} files",
                     jobId, doneCount, completedJob.getTotalFiles());

            // SSE controller will detect COMPLETED from DB on next tick and close stream.
            // Clean up in-memory store — DB is source of truth from here.
            progressStore.cleanup(jobId);

        } catch (Exception e) {
            log.error("Transfer job {} failed: {}", jobId, e.getMessage(), e);
            transferJobRepository.findById(jobId).ifPresent(job -> {
                long doneCount = transferItemRepository.findByTransferJobId(jobId).stream()
                    .filter(i -> i.getTransferStatus() == TransferStatus.COMPLETED
                              || i.getTransferStatus() == TransferStatus.VERIFIED)
                    .count();
                job.setStatus(TransferJobStatus.FAILED);
                job.setErrorMessage(e.getMessage());
                job.setCompletedAt(LocalDateTime.now());
                job.setCompletedFiles((int) doneCount);
                transferJobRepository.save(job);
            });
            progressStore.cleanup(jobId);
        }
    }
}
