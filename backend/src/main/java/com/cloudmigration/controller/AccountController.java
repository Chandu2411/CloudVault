package com.cloudmigration.controller;

import com.cloudmigration.dto.AccountDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.service.DriveStorageService;
import com.cloudmigration.service.GoogleAccountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST controller for managing Google Drive accounts.
 */
@RestController
@RequestMapping("/api/accounts")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class AccountController {

    private final GoogleAccountService googleAccountService;
    private final DriveStorageService driveStorageService;

    public AccountController(GoogleAccountService googleAccountService, DriveStorageService driveStorageService) {
        this.googleAccountService = googleAccountService;
        this.driveStorageService = driveStorageService;
    }

    @GetMapping
    public ResponseEntity<List<AccountDto>> getAllAccounts() {
        List<AccountDto> accounts = googleAccountService.getAllAccounts().stream()
                .map(AccountDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(accounts);
    }

    @GetMapping("/source")
    public ResponseEntity<AccountDto> getSourceAccount() {
        return googleAccountService.getSourceAccount()
                .map(AccountDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/destination")
    public ResponseEntity<List<AccountDto>> getDestinationAccounts() {
        List<AccountDto> accounts = googleAccountService.getDestinationAccounts().stream()
                .map(AccountDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(accounts);
    }

    @GetMapping("/{accountId}")
    public ResponseEntity<AccountDto> getAccount(@PathVariable UUID accountId) {
        GoogleAccount account = googleAccountService.getAccountById(accountId);
        return ResponseEntity.ok(AccountDto.from(account));
    }

    @DeleteMapping("/{accountId}")
    public ResponseEntity<Void> disconnectAccount(@PathVariable UUID accountId) {
        googleAccountService.disconnectAccount(accountId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{accountId}/refresh-storage")
    public ResponseEntity<AccountDto> refreshStorage(@PathVariable UUID accountId) {
        driveStorageService.refreshAccountStorage(accountId);
        GoogleAccount account = googleAccountService.getAccountById(accountId);
        return ResponseEntity.ok(AccountDto.from(account));
    }
}
