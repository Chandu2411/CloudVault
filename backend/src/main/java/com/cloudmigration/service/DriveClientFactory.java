package com.cloudmigration.service;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.repository.GoogleAccountRepository;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.UUID;

/**
 * Factory that creates authenticated Google Drive API clients.
 * Handles token decryption and credential setup.
 */
@Component
public class DriveClientFactory {

    @Value("${google.oauth.client-id}")
    private String clientId;

    @Value("${google.oauth.client-secret}")
    private String clientSecret;

    private final GoogleAccountRepository googleAccountRepository;
    private final TokenEncryptionService tokenEncryptionService;

    public DriveClientFactory(GoogleAccountRepository googleAccountRepository,
                               TokenEncryptionService tokenEncryptionService) {
        this.googleAccountRepository = googleAccountRepository;
        this.tokenEncryptionService = tokenEncryptionService;
    }

    /**
     * Build a Drive client for the source account of the given transfer job.
     */
    public Drive getSourceDriveClient(TransferJob job) {
        return buildDriveClient(job.getSourceAccount());
    }

    /**
     * Build a Drive client for any GoogleAccount.
     */
    public Drive buildDriveClient(GoogleAccount account) {
        try {
            String accessToken = tokenEncryptionService.decrypt(account.getAccessTokenEncrypted());
            String refreshToken = account.getRefreshTokenEncrypted() != null
                ? tokenEncryptionService.decrypt(account.getRefreshTokenEncrypted())
                : null;

            @SuppressWarnings("deprecation")
            Credential credential = new GoogleCredential.Builder()
                .setTransport(GoogleNetHttpTransport.newTrustedTransport())
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setClientSecrets(clientId, clientSecret)
                .build()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken);

            @SuppressWarnings("deprecation")
            Drive drive = new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                credential
            ).setApplicationName("CloudVault Migrator").build();

            return drive;
        } catch (GeneralSecurityException | IOException e) {
            throw new RuntimeException("Failed to build Drive client for account: " + account.getEmail(), e);
        }
    }

    /**
     * Build a Drive client by account ID.
     */
    public Drive buildDriveClientById(UUID accountId) {
        GoogleAccount account = googleAccountRepository.findById(accountId)
            .orElseThrow(() -> new RuntimeException("Account not found: " + accountId));
        return buildDriveClient(account);
    }
}
