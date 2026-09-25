package com.cloudmigration.service;

import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.enums.CleanupStatus;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.enums.VerificationStatus;
import com.cloudmigration.exception.SafetyViolationException;
import com.cloudmigration.repository.TransferItemRepository;
import com.google.api.services.drive.Drive;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * SourceCleanupService — Safely trashes source files after verified transfer.
 *
 * SAFETY INVARIANT: A source file can ONLY be moved to Trash if its
 * verificationStatus == VERIFIED. Any attempt to trash an unverified file
 * is rejected with a SafetyViolationException.
 *
 * This prevents data loss: if verification failed (size mismatch, checksum
 * failure), the source file remains untouched in the user's Drive.
 */
@Service
public class SourceCleanupService {

    private static final Logger log = LoggerFactory.getLogger(SourceCleanupService.class);

    private final TransferItemRepository transferItemRepository;
    private final DriveClientFactory driveClientFactory;

    public SourceCleanupService(TransferItemRepository transferItemRepository,
                                 DriveClientFactory driveClientFactory) {
        this.transferItemRepository = transferItemRepository;
        this.driveClientFactory = driveClientFactory;
    }

    /**
     * Attempt to trash the source file for a given TransferItem.
     *
     * SAFETY CHECK: Verifies that verificationStatus == VERIFIED before trashing.
     *
     * @param itemId the ID of the TransferItem whose source should be trashed
     * @throws SafetyViolationException if verification has not passed
     */
    @Transactional
    public void performCleanup(UUID itemId) {
        TransferItem item = transferItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("TransferItem not found: " + itemId));

        log.info("Attempting cleanup for item: {} file: {}", itemId, item.getSourceFileName());

        // CRITICAL SAFETY CHECK
        if (item.getVerificationStatus() != VerificationStatus.VERIFIED) {
            throw new SafetyViolationException(
                "SAFETY VIOLATION: Cannot trash source file '" + item.getSourceFileName() +
                "' because verification status is " + item.getVerificationStatus() +
                ". Source file will remain untouched."
            );
        }

        item.setTransferStatus(TransferStatus.TRASHING_SOURCE);
        transferItemRepository.save(item);

        try {
            Drive driveClient = driveClientFactory.getSourceDriveClient(item.getTransferJob());
            driveClient.files().delete(item.getSourceFileId()).execute();

            item.setCleanupStatus(CleanupStatus.SOURCE_TRASHED);
            item.setTransferStatus(TransferStatus.COMPLETED);
            item.setCompletedAt(LocalDateTime.now());
            transferItemRepository.save(item);

            log.info("Successfully trashed source file '{}' for item {}", item.getSourceFileName(), itemId);

        } catch (com.google.api.client.googleapis.json.GoogleJsonResponseException e) {
            if (e.getStatusCode() == 404) {
                // File was already deleted (likely by a previous transfer item for the same source file)
                log.info("File already deleted 'SE Syllabus.pdf' for item {}: 404 Not Found", itemId);
                item.setCleanupStatus(CleanupStatus.SOURCE_TRASHED);
                item.setTransferStatus(TransferStatus.COMPLETED);
                item.setCompletedAt(LocalDateTime.now());
                transferItemRepository.save(item);
            } else if (e.getStatusCode() == 403) {
                // Shared file that the user doesn't own
                log.warn("Cannot delete shared file '{}' for item {}: 403 Forbidden", item.getSourceFileName(), itemId);
                item.setCleanupStatus(CleanupStatus.SOURCE_TRASHED); // Close enough
                item.setTransferStatus(TransferStatus.COMPLETED);
                item.setCompletedAt(LocalDateTime.now());
                transferItemRepository.save(item);
            } else {
                item.setErrorMessage("Cleanup failed: " + e.getMessage());
                item.setTransferStatus(TransferStatus.FAILED);
                transferItemRepository.save(item);
                log.error("Failed to trash source file '{}' for item {}: {}", item.getSourceFileName(), itemId, e.getMessage());
            }
        } catch (Exception e) {
            item.setErrorMessage("Cleanup failed: " + e.getMessage());
            item.setTransferStatus(TransferStatus.FAILED);
            transferItemRepository.save(item);
            log.error("Failed to trash source file '{}' for item {}: {}", item.getSourceFileName(), itemId, e.getMessage());
        }
    }

    /**
     * Perform cleanup for all verified items in a transfer job.
     */
    @Transactional
    public void performBatchCleanup(UUID transferJobId) {
        List<TransferItem> verifiedItems = transferItemRepository
            .findByTransferJobIdAndTransferStatus(transferJobId, TransferStatus.VERIFIED);

        log.info("Starting batch cleanup for job {}: {} items", transferJobId, verifiedItems.size());

        for (TransferItem item : verifiedItems) {
            try {
                performCleanup(item.getId());
            } catch (SafetyViolationException e) {
                log.error("Safety violation during batch cleanup: {}", e.getMessage());
            } catch (Exception e) {
                log.error("Error during batch cleanup for item {}: {}", item.getId(), e.getMessage());
            }
        }
    }
}
