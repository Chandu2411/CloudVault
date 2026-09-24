package com.cloudmigration.entity;

import com.cloudmigration.enums.AccountRole;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "google_accounts", indexes = {
    @Index(name = "idx_google_accounts_email", columnList = "email"),
    @Index(name = "idx_google_accounts_user", columnList = "app_user_id")
})
public class GoogleAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_user_id")
    private AppUser appUser;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "display_name")
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private AccountRole role;

    /** Encrypted OAuth2 access token */
    @Column(name = "access_token_encrypted", length = 2048)
    private String accessTokenEncrypted;

    /** Encrypted OAuth2 refresh token */
    @Column(name = "refresh_token_encrypted", length = 2048)
    private String refreshTokenEncrypted;

    @Column(name = "token_expiry")
    private LocalDateTime tokenExpiry;

    /** Total Drive storage in bytes (from Google API) */
    @Column(name = "storage_total")
    private Long storageTotal;

    /** Used Drive storage in bytes (from Google API) */
    @Column(name = "storage_used")
    private Long storageUsed;

    /** Available storage = storageTotal - storageUsed */
    @Column(name = "storage_available")
    private Long storageAvailable;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "connected_at", updatable = false)
    private LocalDateTime connectedAt;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    public GoogleAccount() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public AppUser getAppUser() { return appUser; }
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public AccountRole getRole() { return role; }
    public void setRole(AccountRole role) { this.role = role; }
    public String getAccessTokenEncrypted() { return accessTokenEncrypted; }
    public void setAccessTokenEncrypted(String accessTokenEncrypted) { this.accessTokenEncrypted = accessTokenEncrypted; }
    public String getRefreshTokenEncrypted() { return refreshTokenEncrypted; }
    public void setRefreshTokenEncrypted(String refreshTokenEncrypted) { this.refreshTokenEncrypted = refreshTokenEncrypted; }
    public LocalDateTime getTokenExpiry() { return tokenExpiry; }
    public void setTokenExpiry(LocalDateTime tokenExpiry) { this.tokenExpiry = tokenExpiry; }
    public Long getStorageTotal() { return storageTotal; }
    public void setStorageTotal(Long storageTotal) { this.storageTotal = storageTotal; }
    public Long getStorageUsed() { return storageUsed; }
    public void setStorageUsed(Long storageUsed) { this.storageUsed = storageUsed; }
    public Long getStorageAvailable() { return storageAvailable; }
    public void setStorageAvailable(Long storageAvailable) { this.storageAvailable = storageAvailable; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getConnectedAt() { return connectedAt; }
    public void setConnectedAt(LocalDateTime connectedAt) { this.connectedAt = connectedAt; }
    public LocalDateTime getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(LocalDateTime lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }
}
