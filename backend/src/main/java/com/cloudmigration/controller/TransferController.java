package com.cloudmigration.controller;

import com.cloudmigration.dto.DriveFileDto;
import com.cloudmigration.dto.TransferPlanResultDto;
import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.service.DriveTransferService;
import com.cloudmigration.service.GoogleAccountService;
import com.cloudmigration.service.StorageAllocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for transfer planning and Drive file listing.
 */
@RestController
@RequestMapping("/api/transfer")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class TransferController {

    private final StorageAllocationService storageAllocationService;
    private final DriveTransferService driveTransferService;
    private final GoogleAccountService googleAccountService;
    private final com.cloudmigration.service.TransferJobService transferJobService;
    private final com.cloudmigration.util.JwtUtil jwtUtil;
    private final com.cloudmigration.repository.AppUserRepository appUserRepository;

    public TransferController(StorageAllocationService storageAllocationService,
                               DriveTransferService driveTransferService,
                               GoogleAccountService googleAccountService,
                               com.cloudmigration.service.TransferJobService transferJobService,
                               com.cloudmigration.util.JwtUtil jwtUtil,
                               com.cloudmigration.repository.AppUserRepository appUserRepository) {
        this.storageAllocationService = storageAllocationService;
        this.driveTransferService = driveTransferService;
        this.googleAccountService = googleAccountService;
        this.transferJobService = transferJobService;
        this.jwtUtil = jwtUtil;
        this.appUserRepository = appUserRepository;
    }

    private com.cloudmigration.entity.AppUser getAuthenticatedUser(jakarta.servlet.http.HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                String email = jwtUtil.extractUsername(token);
                return appUserRepository.findByEmail(email).orElse(null);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    /**
     * List files in the source Drive account.
     */
    @GetMapping("/files/{accountId}")
    public ResponseEntity<List<DriveFileDto>> listFiles(@PathVariable UUID accountId) {
        GoogleAccount account = googleAccountService.getAccountById(accountId);
        List<DriveFileDto> files = driveTransferService.listDriveFiles(account);
        return ResponseEntity.ok(files);
    }

    /**
     * Generate a transfer plan for selected files.
     * Uses the Best Fit algorithm to optimally distribute files across destination accounts.
     */
    @PostMapping("/plan")
    public ResponseEntity<TransferPlanResultDto> generatePlan(
            @RequestBody com.cloudmigration.dto.StartTransferRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        com.cloudmigration.entity.AppUser user = getAuthenticatedUser(httpRequest);
        List<GoogleAccount> destAccounts = googleAccountService.getDestinationAccounts(user);
        if (request.getDestinationAccountIds() != null && !request.getDestinationAccountIds().isEmpty()) {
            destAccounts = destAccounts.stream()
                .filter(a -> request.getDestinationAccountIds().contains(a.getId()))
                .toList();
        }
        
        TransferPlanResultDto plan = storageAllocationService.generateTransferPlan(request.getFiles(), destAccounts);
        return ResponseEntity.ok(plan);
    }

    /**
     * Start a transfer job.
     */
    @PostMapping("/start")
    public ResponseEntity<com.cloudmigration.dto.TransferJobDto> startTransfer(
            @RequestBody com.cloudmigration.dto.StartTransferRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        com.cloudmigration.entity.AppUser user = getAuthenticatedUser(httpRequest);
        List<GoogleAccount> destAccounts = googleAccountService.getDestinationAccounts(user);
        if (request.getDestinationAccountIds() != null && !request.getDestinationAccountIds().isEmpty()) {
            destAccounts = destAccounts.stream()
                .filter(a -> request.getDestinationAccountIds().contains(a.getId()))
                .toList();
        }
        
        TransferPlanResultDto plan = storageAllocationService.generateTransferPlan(request.getFiles(), destAccounts);
        
        com.cloudmigration.entity.TransferJob savedJob = transferJobService.createAndStartJob(plan, request.getTransferMode(), user);
        return ResponseEntity.ok(com.cloudmigration.dto.TransferJobDto.from(savedJob));
    }
}
