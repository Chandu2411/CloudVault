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

    public TransferController(StorageAllocationService storageAllocationService,
                               DriveTransferService driveTransferService,
                               GoogleAccountService googleAccountService,
                               com.cloudmigration.service.TransferJobService transferJobService) {
        this.storageAllocationService = storageAllocationService;
        this.driveTransferService = driveTransferService;
        this.googleAccountService = googleAccountService;
        this.transferJobService = transferJobService;
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
    public ResponseEntity<TransferPlanResultDto> generatePlan(@RequestBody List<DriveFileDto> selectedFiles) {
        List<GoogleAccount> destAccounts = googleAccountService.getDestinationAccounts();
        TransferPlanResultDto plan = storageAllocationService.generateTransferPlan(selectedFiles, destAccounts);
        return ResponseEntity.ok(plan);
    }

    /**
     * Start a transfer job.
     */
    @PostMapping("/start")
    public ResponseEntity<com.cloudmigration.dto.TransferJobDto> startTransfer(
            @RequestBody com.cloudmigration.dto.StartTransferRequest request) {
        
        List<GoogleAccount> destAccounts = googleAccountService.getDestinationAccounts();
        if (request.getDestinationAccountIds() != null && !request.getDestinationAccountIds().isEmpty()) {
            destAccounts = destAccounts.stream()
                .filter(a -> request.getDestinationAccountIds().contains(a.getId()))
                .toList();
        }
        
        TransferPlanResultDto plan = storageAllocationService.generateTransferPlan(request.getFiles(), destAccounts);
        
        com.cloudmigration.entity.TransferJob savedJob = transferJobService.createAndStartJob(plan);
        return ResponseEntity.ok(com.cloudmigration.dto.TransferJobDto.from(savedJob));
    }
}
