package com.cloudmigration.controller;

import com.cloudmigration.dto.AccountDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.service.DriveStorageService;
import com.cloudmigration.service.GoogleAccountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
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
    private final com.cloudmigration.util.JwtUtil jwtUtil;
    private final com.cloudmigration.repository.AppUserRepository appUserRepository;

    public AccountController(GoogleAccountService googleAccountService, DriveStorageService driveStorageService, com.cloudmigration.util.JwtUtil jwtUtil, com.cloudmigration.repository.AppUserRepository appUserRepository) {
        this.googleAccountService = googleAccountService;
        this.driveStorageService = driveStorageService;
        this.jwtUtil = jwtUtil;
        this.appUserRepository = appUserRepository;
    }

    private com.cloudmigration.entity.AppUser getAuthenticatedUser(jakarta.servlet.http.HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        System.out.println("Auth header: " + authHeader);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                String email = jwtUtil.extractUsername(token);
                System.out.println("Extracted email: " + email);
                com.cloudmigration.entity.AppUser user = appUserRepository.findByEmail(email).orElse(null);
                System.out.println("Found user: " + (user != null ? user.getEmail() : "null"));
                return user;
            } catch (Exception e) {
                System.out.println("JWT Exception: " + e.getMessage());
                return null;
            }
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<List<AccountDto>> getAllAccounts() {
        List<AccountDto> accounts = googleAccountService.getAllAccounts().stream()
                .map(AccountDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(accounts);
    }

    @GetMapping("/source")
    public ResponseEntity<AccountDto> getSourceAccount(jakarta.servlet.http.HttpServletRequest request) {
        com.cloudmigration.entity.AppUser user = getAuthenticatedUser(request);
        System.out.println("Source account requested for user: " + (user != null ? user.getEmail() : "null"));
        Optional<GoogleAccount> sourceOpt = googleAccountService.getSourceAccount(user);
        
        if (sourceOpt.isPresent()) {
            // Auto-refresh the source account storage so it reflects the present condition (e.g. after a CUT operation)
            driveStorageService.refreshAccountStorage(sourceOpt.get().getId());
            sourceOpt = googleAccountService.getSourceAccount(user);
        }
        
        System.out.println("Found source account: " + sourceOpt.isPresent());
        return sourceOpt
                .map(AccountDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/destination")
    public ResponseEntity<List<AccountDto>> getDestinationAccounts(jakarta.servlet.http.HttpServletRequest request) {
        com.cloudmigration.entity.AppUser user = getAuthenticatedUser(request);
        List<AccountDto> accounts = googleAccountService.getDestinationAccounts(user).stream()
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
