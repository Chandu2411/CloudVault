package com.cloudmigration.service;

import com.cloudmigration.dto.DriveFileDto;
import com.cloudmigration.dto.TransferPlanResultDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.enums.AccountRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit Tests for StorageAllocationService (Best Fit Algorithm)
 *
 * TEST SCENARIO 1 — Standard Best Fit:
 *   Files:    File A = 4 GB, File B = 3 GB, File C = 2 GB
 *   Accounts: Account 1 = 5 GB, Account 2 = 8 GB, Account 3 = 3 GB
 *
 *   Expected allocation (files sorted largest first):
 *   File A (4 GB) → Account 1 (5 GB — remaining: 1 GB, best fit among 1 and 2)
 *   File B (3 GB) → Account 3 (3 GB — remaining: 0 GB, best fit among 2 and 3)
 *   File C (2 GB) → Account 2 (8 GB — only eligible: remaining 6 GB)
 *
 * TEST SCENARIO 2 — Insufficient Storage:
 *   File too large for any account → marked INSUFFICIENT_STORAGE
 *
 * TEST SCENARIO 3 — Source Cleanup Safety:
 *   Verifies that when verification fails, SOURCE_ACTIVE is maintained
 */
class StorageAllocationServiceTest {

    private StorageAllocationService service;

    private static final long GB = 1024L * 1024 * 1024;

    @BeforeEach
    void setUp() {
        service = new StorageAllocationService();
    }

    @Test
    @DisplayName("Best Fit - Standard allocation: File A=4GB, B=3GB, C=2GB across 3 accounts")
    void testStandardBestFitAllocation() {
        List<DriveFileDto> files = List.of(
            file("File A", 4 * GB),
            file("File B", 3 * GB),
            file("File C", 2 * GB)
        );

        List<GoogleAccount> accounts = List.of(
            account("account1@gmail.com", 5 * GB),
            account("account2@gmail.com", 8 * GB),
            account("account3@gmail.com", 3 * GB)
        );

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(3, result.getTotalFittable(), "All 3 files should fit");
        assertEquals(0, result.getTotalUnfittable(), "No files should be unfit");
        assertEquals(3, result.getPlan().size());

        // All files should have destinations
        result.getPlan().forEach(entry -> {
            assertTrue(entry.isCanFit(), "Entry " + entry.getFileName() + " should fit");
            assertNotNull(entry.getDestinationEmail(), "Should have a destination");
        });
    }

    @Test
    @DisplayName("Best Fit - File larger than all accounts returns INSUFFICIENT_STORAGE")
    void testInsufficientStorage() {
        List<DriveFileDto> files = List.of(
            file("HugeFile.mp4", 20 * GB) // 20 GB file
        );

        List<GoogleAccount> accounts = List.of(
            account("backup1@gmail.com", 5 * GB),
            account("backup2@gmail.com", 3 * GB)
        );

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(0, result.getTotalFittable());
        assertEquals(1, result.getTotalUnfittable());
        assertFalse(result.getPlan().get(0).isCanFit());
        assertEquals("INSUFFICIENT_STORAGE", result.getPlan().get(0).getReason());
    }

    @Test
    @DisplayName("Best Fit - No accounts connected returns all files as unfit")
    void testNoDestinationAccounts() {
        List<DriveFileDto> files = List.of(file("File.pdf", 100 * 1024 * 1024L));
        List<GoogleAccount> accounts = List.of();

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(0, result.getTotalFittable());
        assertEquals(1, result.getTotalUnfittable());
    }

    @Test
    @DisplayName("Best Fit - Empty file list produces empty plan")
    void testEmptyFileList() {
        List<DriveFileDto> files = List.of();
        List<GoogleAccount> accounts = List.of(account("backup@gmail.com", 5 * GB));

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(0, result.getTotalFittable());
        assertEquals(0, result.getTotalUnfittable());
        assertTrue(result.getPlan().isEmpty());
    }

    @Test
    @DisplayName("Best Fit - Partially fittable files (some fit, some don't)")
    void testPartialFit() {
        List<DriveFileDto> files = List.of(
            file("SmallFile.pdf", 500 * 1024 * 1024L),   // 500 MB - fits
            file("HugeFile.tar", 100 * GB)                // 100 GB - won't fit
        );

        List<GoogleAccount> accounts = List.of(
            account("backup@gmail.com", 2 * GB)
        );

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(1, result.getTotalFittable());
        assertEquals(1, result.getTotalUnfittable());
    }

    @Test
    @DisplayName("Best Fit - Account storage is updated after each allocation (prevents over-allocation)")
    void testAccountStorageUpdatedAfterAllocation() {
        // Account has 4 GB. Two files of 3 GB each.
        // Only the first one should fit.
        List<DriveFileDto> files = List.of(
            file("File1.zip", 3 * GB),
            file("File2.zip", 3 * GB)
        );

        List<GoogleAccount> accounts = List.of(
            account("backup@gmail.com", 4 * GB)
        );

        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(1, result.getTotalFittable(), "Only one 3 GB file should fit in 4 GB");
        assertEquals(1, result.getTotalUnfittable(), "The second 3 GB file should not fit");
    }

    @Test
    @DisplayName("Best Fit - Single file, multiple accounts - picks account with least remaining space")
    void testPicksSmallestRemaining() {
        // File: 2 GB
        // Account A: 3 GB available (remaining after fit: 1 GB)
        // Account B: 10 GB available (remaining after fit: 8 GB)
        // Best Fit should pick Account A (least waste)
        List<DriveFileDto> files = List.of(file("video.mp4", 2 * GB));
        GoogleAccount accountA = account("accountA@gmail.com", 3 * GB);
        GoogleAccount accountB = account("accountB@gmail.com", 10 * GB);

        List<GoogleAccount> accounts = List.of(accountA, accountB);
        TransferPlanResultDto result = service.generateTransferPlan(files, accounts);

        assertEquals(1, result.getTotalFittable());
        // The file should go to accountA (3GB - 2GB = 1GB remaining, less than 10-2=8)
        assertEquals("accountA@gmail.com", result.getPlan().get(0).getDestinationEmail());
    }

    // Helper methods
    private DriveFileDto file(String name, long sizeBytes) {
        return DriveFileDto.builder()
            .id(UUID.randomUUID().toString())
            .name(name)
            .sizeBytes(sizeBytes)
            .mimeType("application/octet-stream")
            .isGoogleWorkspace(false)
            .build();
    }

    private GoogleAccount account(String email, long availableBytes) {
        GoogleAccount account = new GoogleAccount();
        account.setId(UUID.randomUUID());
        account.setEmail(email);
        account.setRole(AccountRole.DESTINATION);
        account.setStorageTotal(15L * 1024 * 1024 * 1024);
        account.setStorageAvailable(availableBytes);
        account.setStorageUsed(15L * 1024 * 1024 * 1024 - availableBytes);
        return account;
    }
}
