package com.cloudmigration.service;

import com.cloudmigration.dto.DriveFileDto;
import com.cloudmigration.dto.TransferPlanEntryDto;
import com.cloudmigration.dto.TransferPlanResultDto;
import com.cloudmigration.entity.GoogleAccount;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * StorageAllocationService — Best Fit Allocation Algorithm
 *
 * REAL-WORLD PROBLEM:
 * When migrating files to multiple backup accounts, how do we decide
 * which file goes to which account? A naive approach would be to fill
 * Account A first, then B, then C. But this wastes large accounts on
 * small files. Best Fit solves this by minimizing wasted space.
 *
 * BEST FIT ALGORITHM:
 * For each file (sorted largest first):
 *   1. Find all accounts where: availableStorage >= fileSize
 *   2. Among eligible accounts, pick the one with the SMALLEST remaining storage after fit
 *   3. Update that account's available storage for the next iteration
 *
 * TIME COMPLEXITY:
 * - Sorting files: O(n log n)
 * - For each file, checking all accounts: O(m) where m = number of accounts
 * - Total: O(n log n + n*m) — efficient for typical use (n < 1000 files, m < 20 accounts)
 *
 * SPACE COMPLEXITY: O(n + m)
 *
 * FUTURE OPTIMIZATIONS:
 * - Use a balanced BST or TreeMap keyed by available storage for O(log m) best-fit selection
 * - Add file priority weighting (large files first vs. important files first)
 * - Implement First Fit Decreasing (FFD) as an alternative
 * - AI-based prediction of future transfers to optimize long-term bin packing
 */
@Service
public class StorageAllocationService {

    /**
     * Main entry point: generate a transfer plan for the selected files.
     *
     * @param selectedFiles    files selected by the user in the source Drive
     * @param destAccounts     all connected destination accounts
     * @return TransferPlanResultDto containing the allocation plan
     */
    public TransferPlanResultDto generateTransferPlan(
            List<DriveFileDto> selectedFiles,
            List<GoogleAccount> destAccounts) {

        List<TransferPlanEntryDto> plan = new ArrayList<>();
        long totalFittable = 0;
        long totalUnfittable = 0;

        for (DriveFileDto file : selectedFiles) {
            long fileSize = file.isGoogleWorkspace() ? 1_048_576L : file.getSizeBytes();

            if (destAccounts.isEmpty()) {
                plan.add(TransferPlanEntryDto.builder()
                    .fileId(file.getId())
                    .fileName(file.getName())
                    .fileSizeBytes(fileSize)
                    .mimeType(file.getMimeType())
                    .canFit(false)
                    .reason("NO_ACCOUNTS_SELECTED")
                    .build());
                totalUnfittable++;
            } else {
                // REPLICATION MODE: Copy file to ALL selected destination accounts
                for (GoogleAccount destAccount : destAccounts) {
                    plan.add(TransferPlanEntryDto.builder()
                        .fileId(file.getId())
                        .fileName(file.getName())
                        .fileSizeBytes(fileSize)
                        .mimeType(file.getMimeType())
                        .destinationAccountId(destAccount.getId().toString())
                        .destinationEmail(destAccount.getEmail())
                        .canFit(true)
                        .remainingStorageAfterFit(0L) // UI doesn't need to know remaining storage for replication
                        .build());
                    totalFittable++;
                }
            }
        }

        long totalBytes = plan.stream().filter(TransferPlanEntryDto::isCanFit).mapToLong(TransferPlanEntryDto::getFileSizeBytes).sum();

        return TransferPlanResultDto.builder()
            .plan(plan)
            .totalFittable((int) totalFittable)
            .totalUnfittable((int) totalUnfittable)
            .totalSizeBytes(totalBytes)
            .build();
    }

    /**
     * BEST FIT EXAMPLE TRACE:
     *
     * Files:    File A = 4 GB, File B = 3 GB, File C = 2 GB (sorted: A, B, C)
     * Accounts: Account 1 = 5 GB, Account 2 = 8 GB, Account 3 = 3 GB
     *
     * File A (4 GB):
     *   - Account 1: available=5 GB, remaining after fit = 1 GB  ← BEST FIT
     *   - Account 2: available=8 GB, remaining after fit = 4 GB
     *   - Account 3: available=3 GB, CANNOT FIT
     *   → Assign to Account 1. Account 1 now has 1 GB available.
     *
     * File B (3 GB):
     *   - Account 1: available=1 GB, CANNOT FIT
     *   - Account 2: available=8 GB, remaining = 5 GB  ← BEST FIT (only eligible)
     *   - Account 3: available=3 GB, remaining = 0 GB  ← BETTER FIT
     *   → Assign to Account 3. Account 3 now has 0 GB available.
     *
     * File C (2 GB):
     *   - Account 1: available=1 GB, CANNOT FIT
     *   - Account 2: available=8 GB, remaining = 6 GB  ← ONLY ELIGIBLE
     *   - Account 3: available=0 GB, CANNOT FIT
     *   → Assign to Account 2.
     *
     * Result:
     *   File A → Account 1
     *   File B → Account 3
     *   File C → Account 2
     */
}
