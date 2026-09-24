package com.cloudmigration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * CloudVault Migrator - Intelligent Multi-Account Google Drive Storage Migration System
 *
 * This application helps users migrate files from one Google Drive account
 * to multiple destination accounts using an optimized Best Fit allocation algorithm.
 *
 * Key features:
 * - OAuth2 integration with Google Drive API v3
 * - Best Fit bin-packing algorithm for optimal storage distribution
 * - Safe transfer workflow: Transfer → Verify → Cleanup (never deletes without verification)
 * - AES-256 encryption for stored OAuth tokens
 */
@SpringBootApplication
@EnableAsync
public class CloudVaultMigratorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CloudVaultMigratorApplication.class, args);
    }
}
