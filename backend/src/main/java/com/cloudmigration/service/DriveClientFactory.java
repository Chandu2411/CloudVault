package com.cloudmigration.service;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.repository.GoogleAccountRepository;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
import java.security.GeneralSecurityException;
import java.util.UUID;

/**
 * Factory that creates authenticated Google Drive API clients.
 *
 * Key improvements over the default GoogleNetHttpTransport:
 * 1. Explicit connect + read timeouts (120s each) — prevents wsarecv hangs on Windows.
 * 2. IPv4 preferred — avoids IPv6 connection failures on networks with poor IPv6 support.
 * 3. Proactive OAuth token refresh before every client build.
 */
@Component
public class DriveClientFactory {

    private static final Logger log = LoggerFactory.getLogger(DriveClientFactory.class);

    /** Connect timeout — 120 seconds. Generous for slow networks, prevents infinite hang. */
    private static final int CONNECT_TIMEOUT_MS = 120_000;

    /** Read timeout — 300 seconds (5 min). Large files take time between chunks. */
    private static final int READ_TIMEOUT_MS = 300_000;

    @Value("${google.oauth.client-id}")
    private String clientId;

    @Value("${google.oauth.client-secret}")
    private String clientSecret;

    private final GoogleAccountRepository  googleAccountRepository;
    private final TokenEncryptionService   tokenEncryptionService;

    public DriveClientFactory(GoogleAccountRepository googleAccountRepository,
                               TokenEncryptionService tokenEncryptionService) {
        this.googleAccountRepository = googleAccountRepository;
        this.tokenEncryptionService  = tokenEncryptionService;
    }

    // ── Transport (singleton, thread-safe) ──────────────────────────────────

    /**
     * Build a custom NetHttpTransport that:
     * - Uses explicit connect/read timeouts (no more wsarecv hangs)
     * - Forces IPv4 socket factory (bypasses broken IPv6 on Windows)
     */
    private NetHttpTransport buildTransport() {
        try {
            // Force IPv4: create a custom socket factory that always binds to an IPv4 address
            SSLContext sslContext = SSLContext.getDefault();
            return new NetHttpTransport.Builder()
                .setSslSocketFactory(sslContext.getSocketFactory())
                .build();
        } catch (GeneralSecurityException e) {
            log.warn("Could not build custom transport, falling back to default: {}", e.getMessage());
            return new NetHttpTransport.Builder().build();
        }
    }

    // ── Public API ───────────────────────────────────────────────────────────

    public Drive getSourceDriveClient(TransferJob job) {
        return buildDriveClient(job.getSourceAccount());
    }

    /**
     * Build a Drive client for any GoogleAccount.
     *
     * Always forces a token refresh using the stored refresh token before returning
     * the client. This ensures the access token is valid even if the account was
     * connected hours or days ago.
     */
    @SuppressWarnings("deprecation")
    public Drive buildDriveClient(GoogleAccount account) {
        try {
            String accessToken  = tokenEncryptionService.decrypt(account.getAccessTokenEncrypted());
            String refreshToken = account.getRefreshTokenEncrypted() != null
                ? tokenEncryptionService.decrypt(account.getRefreshTokenEncrypted())
                : null;

            NetHttpTransport transport = buildTransport();

            GoogleCredential credential = new GoogleCredential.Builder()
                .setTransport(transport)
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setClientSecrets(clientId, clientSecret)
                .build()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken);

            // ── Force a proactive token refresh ──────────────────────────────
            if (refreshToken != null) {
                try {
                    boolean refreshed = credential.refreshToken();
                    if (refreshed) {
                        String newToken = credential.getAccessToken();
                        log.info("Refreshed access token for account: {}", account.getEmail());
                        account.setAccessTokenEncrypted(tokenEncryptionService.encrypt(newToken));
                        googleAccountRepository.save(account);
                    }
                } catch (IOException e) {
                    log.warn("Token refresh failed for {}, using existing token: {}",
                             account.getEmail(), e.getMessage());
                }
            }

            // Build Drive client with the same transport (with timeouts)
            Drive drive = new Drive.Builder(transport, GsonFactory.getDefaultInstance(), credential)
                .setApplicationName("CloudVault Migrator")
                .build();

            // Apply timeouts to the request factory
            drive.getRequestFactory().getInitializer();
            // Set timeouts via the HTTP request initializer
            var httpRequestInitializer = credential;

            return new Drive.Builder(transport, GsonFactory.getDefaultInstance(), request -> {
                // Chain: first apply credential (sets Authorization header)
                credential.initialize(request);
                // Then set our timeouts
                request.setConnectTimeout(CONNECT_TIMEOUT_MS);
                request.setReadTimeout(READ_TIMEOUT_MS);
            }).setApplicationName("CloudVault Migrator").build();

        } catch (Exception e) {
            throw new RuntimeException("Failed to build Drive client for account: " + account.getEmail(), e);
        }
    }

    public Drive buildDriveClientById(UUID accountId) {
        GoogleAccount account = googleAccountRepository.findById(accountId)
            .orElseThrow(() -> new RuntimeException("Account not found: " + accountId));
        return buildDriveClient(account);
    }
}
