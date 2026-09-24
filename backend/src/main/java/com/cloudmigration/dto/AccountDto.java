package com.cloudmigration.dto;

import com.cloudmigration.enums.AccountRole;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Safe DTO for sending account data to the frontend.
 * Never exposes encrypted tokens.
 */
public class AccountDto {
    private UUID id;
    private String email;
    private String displayName;
    private AccountRole role;
    private Long storageTotal;
    private Long storageUsed;
    private Long storageAvailable;
    private Boolean isActive;
    private LocalDateTime connectedAt;
    private LocalDateTime lastSyncedAt;

    public AccountDto() {}

    public static AccountDto from(com.cloudmigration.entity.GoogleAccount account) {
        AccountDto dto = new AccountDto();
        dto.id = account.getId();
        dto.email = account.getEmail();
        dto.displayName = account.getDisplayName();
        dto.role = account.getRole();
        dto.storageTotal = account.getStorageTotal();
        dto.storageUsed = account.getStorageUsed();
        dto.storageAvailable = account.getStorageAvailable();
        dto.isActive = account.getIsActive();
        dto.connectedAt = account.getConnectedAt();
        dto.lastSyncedAt = account.getLastSyncedAt();
        return dto;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public AccountRole getRole() { return role; }
    public void setRole(AccountRole role) { this.role = role; }
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
