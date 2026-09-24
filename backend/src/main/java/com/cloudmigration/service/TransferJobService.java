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
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;

@Service
public class TransferJobService {

    private static final Logger log = LoggerFactory.getLogger(TransferJobService.class);

    private final TransferJobRepository transferJobRepository;
    private final DriveTransferService driveTransferService;
    private final GoogleAccountService googleAccountService;

    public TransferJobService(TransferJobRepository transferJobRepository,
                              DriveTransferService driveTransferService,
                              GoogleAccountService googleAccountService) {
        this.transferJobRepository = transferJobRepository;
        this.driveTransferService = driveTransferService;
        this.googleAccountService = googleAccountService;
    }

    @Transactional
    public TransferJob createAndStartJob(TransferPlanResultDto plan) {
        GoogleAccount sourceAccount = googleAccountService.getSourceAccount()
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
                GoogleAccount destAccount = googleAccountService.getAccountById(UUID.fromString(entry.getDestinationAccountId()));
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
        
        // Start async execution
        executeJobAsync(savedJob.getId());

        return savedJob;
    }

    @Async
    public void executeJobAsync(UUID jobId) {
        try {
            TransferJob job = transferJobRepository.findById(jobId).orElseThrow();
            driveTransferService.executeTransferJob(job);
            
            job.setStatus(TransferJobStatus.COMPLETED);
            job.setCompletedAt(LocalDateTime.now());
            transferJobRepository.save(job);
        } catch (Exception e) {
            log.error("Failed to execute transfer job {}", jobId, e);
            transferJobRepository.findById(jobId).ifPresent(job -> {
                job.setStatus(TransferJobStatus.FAILED);
                job.setErrorMessage(e.getMessage());
                job.setCompletedAt(LocalDateTime.now());
                transferJobRepository.save(job);
            });
        }
    }
}
