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

    public TransferJobExecutor(TransferJobRepository transferJobRepository,
                               DriveTransferService driveTransferService,
                               TransferVerificationService transferVerificationService,
                               SourceCleanupService sourceCleanupService,
                               TransferProgressStore progressStore) {
        this.transferJobRepository      = transferJobRepository;
        this.driveTransferService       = driveTransferService;
        this.transferVerificationService = transferVerificationService;
        this.sourceCleanupService       = sourceCleanupService;
        this.progressStore              = progressStore;
    }

    /**
     * Run the full transfer pipeline asynchronously.
     * Called from TransferJobService.createAndStartJob() — the separation
     * from that class ensures Spring's @Async proxy intercepts correctly.
     */
    @Async
    public void executeAsync(UUID jobId, String transferMode) {
        try {
            var job = transferJobRepository.findById(jobId).orElseThrow();

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
                List<TransferItem> itemsCopy = new ArrayList<>(finalJob.getItems());
                int completed = 0;
                for (TransferItem item : itemsCopy) {
                    if (item.getTransferStatus() == TransferStatus.VERIFIED) {
                        item.setTransferStatus(TransferStatus.COMPLETED);
                        item.setCompletedAt(LocalDateTime.now());
                        progressStore.markCompleted(jobId, item.getId());
                        completed++;
                    }
                }
                finalJob.setCompletedFiles(completed);
                transferJobRepository.save(finalJob);
            }

            // 4. Mark the job itself as COMPLETED in the database
            var completedJob = transferJobRepository.findById(jobId).orElseThrow();
            long doneCount = completedJob.getItems().stream()
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
                long doneCount = job.getItems().stream()
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
