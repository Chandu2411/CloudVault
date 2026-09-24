package com.cloudmigration.service;

import com.cloudmigration.entity.GoogleAccount;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.About;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.UUID;

@Service
public class DriveStorageService {

    private static final Logger log = LoggerFactory.getLogger(DriveStorageService.class);

    private final DriveClientFactory driveClientFactory;
    private final GoogleAccountService googleAccountService;

    public DriveStorageService(DriveClientFactory driveClientFactory, GoogleAccountService googleAccountService) {
        this.driveClientFactory = driveClientFactory;
        this.googleAccountService = googleAccountService;
    }

    public StorageInfo getStorageInfo(GoogleAccount account) {
        try {
            Drive drive = driveClientFactory.buildDriveClient(account);
            About about = drive.about().get().setFields("storageQuota").execute();
            About.StorageQuota quota = about.getStorageQuota();

            if (quota != null) {
                Long total = quota.getLimit();
                Long used = quota.getUsage();
                return new StorageInfo(total, used);
            }
        } catch (IOException e) {
            log.error("Failed to fetch storage info for account: {}", account.getEmail(), e);
        }
        return new StorageInfo(null, null);
    }

    public void refreshAccountStorage(UUID accountId) {
        GoogleAccount account = googleAccountService.getAccountById(accountId);
        StorageInfo info = getStorageInfo(account);
        if (info.total != null && info.used != null) {
            googleAccountService.updateStorageInfo(accountId, info.total, info.used);
        }
    }

    public record StorageInfo(Long total, Long used) {}
}
