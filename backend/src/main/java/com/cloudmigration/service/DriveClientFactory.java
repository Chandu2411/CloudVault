package com.cloudmigration.service;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.repository.GoogleAccountRepository;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.UUID;

/**
 * Factory that creates authenticated Google Drive API clients.
 * Handles token decryption, automatic token refresh, and saving refreshed tokens back to DB.
 */
@Component
public class DriveClientFactory {

    private static final Logger log = LoggerFactory.getLogger(DriveClientFactory.class);

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
     *
     * <p>Always forces a token refresh using the stored refresh token before returning
     * the client. This ensures the access token is valid even if the account was
     * connected hours or days ago. The refreshed access token is saved back to DB
     * so subsequent calls also benefit.
     */
    public Drive buildDriveClient(GoogleAccount account) {
        try {
            String accessToken  = tokenEncryptionService.decrypt(account.getAccessTokenEncrypted());
            String refreshToken = account.getRefreshTokenEncrypted() != null
                ? tokenEncryptionService.decrypt(account.getRefreshTokenEncrypted())
                : null;

            @SuppressWarnings("deprecation")
            GoogleCredential credential = new GoogleCredential.Builder()
                .setTransport(GoogleNetHttpTransport.newTrustedTransport())
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setClientSecrets(clientId, clientSecret)
                .build()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken);

            // ── Force a proactive token refresh if we have a refresh token ──────
            // This prevents 401 Unauthorized errors when the stored access token
            // has already expired (tokens last ~1 hour; long transfers exceed this).
            if (refreshToken != null) {
                try {
                    boolean refreshed = credential.refreshToken();
                    if (refreshed) {
                        String newAccessToken = credential.getAccessToken();
                        log.info("Refreshed access token for account: {}", account.getEmail());
                        // Persist the new token so the next call is also fresh
                        account.setAccessTokenEncrypted(tokenEncryptionService.encrypt(newAccessToken));
                        googleAccountRepository.save(account);
                    }
                } catch (IOException e) {
                    // If refresh fails, try with the existing token (may still be valid)
                    log.warn("Token refresh failed for account {}, using existing token: {}",
                             account.getEmail(), e.getMessage());
                }
            }

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
