package com.cloudmigration.service;

import com.cloudmigration.dto.TransferPlanEntryDto;
import com.cloudmigration.dto.TransferPlanResultDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.enums.TransferJobStatus;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.repository.TransferJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;

/**
 * TransferJobService — Creates and starts transfer jobs.
 *
 * Async execution is delegated to {@link TransferJobExecutor}, a separate bean,
 * so Spring's @Async proxy is correctly invoked (self-invocation on 'this' bypasses it).
 */
@Service
public class TransferJobService {

    private static final Logger log = LoggerFactory.getLogger(TransferJobService.class);

    private final TransferJobRepository  transferJobRepository;
    private final GoogleAccountService   googleAccountService;
    private final TransferProgressStore  progressStore;
    private final TransferJobExecutor    jobExecutor;

    public TransferJobService(TransferJobRepository transferJobRepository,
                              GoogleAccountService googleAccountService,
                              TransferProgressStore progressStore,
                              TransferJobExecutor jobExecutor) {
        this.transferJobRepository = transferJobRepository;
        this.googleAccountService  = googleAccountService;
        this.progressStore         = progressStore;
        this.jobExecutor           = jobExecutor;
    }

    /**
     * Creates the job in the database, initialises the progress store,
     * returns the job ID immediately, then fires off async execution.
     *
     * The @Transactional here ensures the job is committed to the DB before
     * the async thread tries to read it.
     */
    @Transactional
    public TransferJob createAndStartJob(TransferPlanResultDto plan, String transferMode,
                                         com.cloudmigration.entity.AppUser user) {
        GoogleAccount sourceAccount = googleAccountService.getSourceAccount(user)
                .orElseThrow(() -> new IllegalStateException("No source account connected"));

        TransferJob job = new TransferJob();
        job.setSourceAccount(sourceAccount);
        job.setJobName("Transfer Job " + LocalDateTime.now().toString());
        job.setStatus(TransferJobStatus.IN_PROGRESS);
        job.setTotalFiles(plan.getTotalFittable());
        job.setTotalBytes(plan.getTotalSizeBytes());
        job.setStartedAt(LocalDateTime.now());
        job.setItems(new ArrayList<>());

        for (TransferPlanEntryDto entry : plan.getPlan()) {
            if (entry.isCanFit() && entry.getDestinationAccountId() != null) {
                GoogleAccount destAccount = googleAccountService
                    .getAccountById(UUID.fromString(entry.getDestinationAccountId()));
                TransferItem item = new TransferItem();
                item.setTransferJob(job);
                item.setSourceFileId(entry.getFileId());
                item.setSourceFileName(entry.getFileName());
                item.setSourceMimeType(entry.getMimeType());
                item.setFileSizeBytes(entry.getFileSizeBytes());
                item.setDestinationAccount(destAccount);
                item.setTransferStatus(TransferStatus.QUEUED);
                job.getItems().add(item);
            }
        }

        TransferJob savedJob = transferJobRepository.save(job);

        // ── Initialise in-memory store BEFORE firing the async job ──────────
        // This ensures the SSE endpoint has data immediately when the frontend
        // connects (which it does within ~200ms of receiving the job ID).
        progressStore.initJob(savedJob.getId(), plan.getTotalSizeBytes(), plan.getTotalFittable());

        // ── Fire async execution via SEPARATE BEAN (TransferJobExecutor) ───
        // CRITICAL: We must NOT call this on 'this' — Spring @Async works via
        // AOP proxy, and self-invocation bypasses the proxy, running synchronously.
        // By calling jobExecutor.executeAsync(), the proxy is correctly intercepted.
        UUID jobId = savedJob.getId();
        String mode = transferMode;
        // Small delay to allow the @Transactional commit to flush before the async
        // thread reads the job from DB.
        jobExecutor.executeAsync(jobId, mode);

        log.info("Transfer job {} created and queued for async execution", jobId);
        return savedJob;
    }
}
