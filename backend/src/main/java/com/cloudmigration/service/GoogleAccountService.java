package com.cloudmigration.service;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.enums.AccountRole;
import com.cloudmigration.exception.AccountNotFoundException;
import com.cloudmigration.repository.GoogleAccountRepository;
import com.cloudmigration.repository.TransferItemRepository;
import com.cloudmigration.repository.TransferJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * GoogleAccountService — Manages connected Google accounts.
 */
@Service
public class GoogleAccountService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAccountService.class);

    private final GoogleAccountRepository googleAccountRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final TransferJobRepository transferJobRepository;
    private final TransferItemRepository transferItemRepository;

    public GoogleAccountService(GoogleAccountRepository googleAccountRepository,
                                 TokenEncryptionService tokenEncryptionService,
                                 TransferJobRepository transferJobRepository,
                                 TransferItemRepository transferItemRepository) {
        this.googleAccountRepository = googleAccountRepository;
        this.tokenEncryptionService = tokenEncryptionService;
        this.transferJobRepository = transferJobRepository;
        this.transferItemRepository = transferItemRepository;
    }

    public List<GoogleAccount> getAllAccounts() {
        return googleAccountRepository.findAll();
    }

    public List<GoogleAccount> getSourceAccounts(com.cloudmigration.entity.AppUser appUser) {
        if (appUser == null) return List.of();
        List<GoogleAccount> accounts = googleAccountRepository.findByAppUserIdAndRole(appUser.getId(), AccountRole.SOURCE);
        System.out.println("Querying for user ID: " + appUser.getId() + " - found accounts: " + accounts.size());
        return accounts;
    }

    public Optional<GoogleAccount> getSourceAccount(com.cloudmigration.entity.AppUser appUser) {
        if (appUser == null) return Optional.empty();
        List<GoogleAccount> sources = getSourceAccounts(appUser);
        return sources.isEmpty() ? Optional.empty() : Optional.of(sources.get(0));
    }

    public List<GoogleAccount> getDestinationAccounts(com.cloudmigration.entity.AppUser appUser) {
        if (appUser == null) return List.of();
        return googleAccountRepository.findByAppUserIdAndRole(appUser.getId(), AccountRole.DESTINATION);
    }

    public GoogleAccount getAccountById(UUID accountId) {
        return googleAccountRepository.findById(accountId)
            .orElseThrow(() -> new AccountNotFoundException("Account not found: " + accountId));
    }

    @Transactional
    public GoogleAccount saveAccount(GoogleAccount account) {
        return googleAccountRepository.save(account);
    }

    /**
     * Upsert: if account with this email already exists, update its tokens + role.
     * If new, create it.
     */
    @Transactional
    public GoogleAccount connectAccount(String email, String displayName, AccountRole role,
                                         String accessToken, String refreshToken,
                                         Long storageTotal, Long storageUsed) {
        Optional<GoogleAccount> existing = googleAccountRepository.findByEmail(email);

        GoogleAccount account = existing.orElseGet(GoogleAccount::new);
        account.setEmail(email);
        account.setDisplayName(displayName);
        account.setRole(role);
        account.setAccessTokenEncrypted(tokenEncryptionService.encrypt(accessToken));
        if (refreshToken != null) {
            account.setRefreshTokenEncrypted(tokenEncryptionService.encrypt(refreshToken));
        }
        if (storageTotal != null) {
            account.setStorageTotal(storageTotal);
        }
        if (storageUsed != null) {
            account.setStorageUsed(storageUsed);
            account.setStorageAvailable(storageTotal != null ? storageTotal - storageUsed : null);
        }
        account.setIsActive(true);
        if (account.getConnectedAt() == null) {
            account.setConnectedAt(LocalDateTime.now());
        }
        account.setLastSyncedAt(LocalDateTime.now());

        GoogleAccount saved = googleAccountRepository.save(account);
        log.info("{} {} account: {}", existing.isPresent() ? "Updated" : "Connected new", role, email);
        return saved;
    }

    @Transactional
    public void disconnectAccount(UUID accountId) {
        GoogleAccount account = getAccountById(accountId);
        
        // Fix for ConstraintViolationException: delete child TransferItems
        List<TransferItem> items = transferItemRepository.findByDestinationAccountId(accountId);
        transferItemRepository.deleteAll(items);
        
        // Fix for ConstraintViolationException: delete child TransferJobs
        List<TransferJob> jobs = transferJobRepository.findBySourceAccountId(accountId);
        transferJobRepository.deleteAll(jobs);
        
        googleAccountRepository.delete(account);
        log.info("Disconnected account: {}", account.getEmail());
    }

    @Transactional
    public void updateStorageInfo(UUID accountId, long storageTotal, long storageUsed) {
        GoogleAccount account = getAccountById(accountId);
        account.setStorageTotal(storageTotal);
        account.setStorageUsed(storageUsed);
        account.setStorageAvailable(storageTotal - storageUsed);
        account.setLastSyncedAt(LocalDateTime.now());
        googleAccountRepository.save(account);
    }
}
