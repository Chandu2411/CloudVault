package com.cloudmigration.service;

import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.enums.VerificationStatus;
import com.cloudmigration.repository.TransferItemRepository;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * TransferVerificationService — Verifies that a file was correctly transferred.
 *
 * Verification checks (in order):
 *   1. Destination file exists in the destination Drive
 *   2. File size matches expected size
 *   3. MD5 checksum matches (if available — Google Workspace files don't have checksums)
 *
 * Only after ALL checks pass does verificationStatus become VERIFIED.
 * Only VERIFIED items can proceed to source cleanup.
 */
@Service
public class TransferVerificationService {

    private static final Logger log = LoggerFactory.getLogger(TransferVerificationService.class);

    private final TransferItemRepository transferItemRepository;
    private final DriveClientFactory driveClientFactory;

    public TransferVerificationService(TransferItemRepository transferItemRepository,
                                        DriveClientFactory driveClientFactory) {
        this.transferItemRepository = transferItemRepository;
        this.driveClientFactory = driveClientFactory;
    }

    /**
     * Verify a single TransferItem.
     *
     * @param itemId the ID of the item to verify
     */
    @Transactional
    public void verifyTransferItem(UUID itemId) {
        TransferItem item = transferItemRepository.findById(itemId)
            .orElseThrow(() -> new RuntimeException("TransferItem not found: " + itemId));

        if (item.getTransferStatus() != TransferStatus.VERIFYING) {
            log.warn("Item {} is not in VERIFYING state (current: {}), skipping", itemId, item.getTransferStatus());
            return;
        }

        log.info("Verifying transfer for item: {} file: {}", itemId, item.getSourceFileName());

        try {
            Drive destDrive = driveClientFactory.buildDriveClient(item.getDestinationAccount());

            // Step 1: Fetch destination file metadata
            File destFile = destDrive.files()
                .get(item.getDestinationFileId())
                .setFields("id,name,size,md5Checksum")
                .execute();

            if (destFile == null) {
                markVerificationFailed(item, "Destination file not found in Drive");
                return;
            }

            // Step 2: Size check
            if (item.getExpectedSizeBytes() != null && destFile.getSize() != null) {
                if (!item.getExpectedSizeBytes().equals(destFile.getSize())) {
                    markVerificationFailed(item,
                        "Size mismatch: expected " + item.getExpectedSizeBytes() +
                        " bytes but got " + destFile.getSize() + " bytes");
                    return;
                }
            }

            // Step 3: Checksum check (skip for Google Workspace files — no MD5)
            if (item.getSourceMd5Checksum() != null && destFile.getMd5Checksum() != null) {
                if (!Objects.equals(item.getSourceMd5Checksum(), destFile.getMd5Checksum())) {
                    markVerificationFailed(item,
                        "MD5 checksum mismatch: source=" + item.getSourceMd5Checksum() +
                        " destination=" + destFile.getMd5Checksum());
                    return;
                }
            }

            // All checks passed
            item.setVerificationStatus(VerificationStatus.VERIFIED);
            item.setTransferStatus(TransferStatus.VERIFIED);
            item.setDestinationSizeBytes(destFile.getSize());
            item.setDestinationMd5Checksum(destFile.getMd5Checksum());
            transferItemRepository.save(item);

            log.info("Verification PASSED for item {} ({})", itemId, item.getSourceFileName());

        } catch (Exception e) {
            markVerificationFailed(item, "Verification error: " + e.getMessage());
            log.error("Verification error for item {}: {}", itemId, e.getMessage());
        }
    }

    /**
     * Verify all items in VERIFYING state for a given job.
     */
    @Transactional
    public void verifyJobItems(UUID transferJobId) {
        List<TransferItem> items = transferItemRepository
            .findByTransferJobIdAndTransferStatus(transferJobId, TransferStatus.VERIFYING);

        log.info("Starting verification for job {}: {} items to verify", transferJobId, items.size());

        for (TransferItem item : items) {
            try {
                verifyTransferItem(item.getId());
            } catch (Exception e) {
                log.error("Error verifying item {}: {}", item.getId(), e.getMessage());
            }
        }
    }

    private void markVerificationFailed(TransferItem item, String reason) {
        item.setVerificationStatus(VerificationStatus.FAILED);
        item.setTransferStatus(TransferStatus.FAILED);
        item.setErrorMessage(reason);
        transferItemRepository.save(item);
        log.warn("Verification FAILED for item {} ({}): {}", item.getId(), item.getSourceFileName(), reason);
    }
}
