package com.cloudmigration.controller;

import com.cloudmigration.dto.TransferJobDto;
import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.repository.TransferJobRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/jobs")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class TransferJobController {

    private final TransferJobRepository transferJobRepository;

    public TransferJobController(TransferJobRepository transferJobRepository) {
        this.transferJobRepository = transferJobRepository;
    }

    @GetMapping
    public ResponseEntity<List<TransferJobDto>> getAllJobs() {
        List<TransferJobDto> jobs = transferJobRepository.findAll().stream()
                .sorted((j1, j2) -> j2.getCreatedAt().compareTo(j1.getCreatedAt()))
                .map(TransferJobDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(jobs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransferJobDto> getJob(@PathVariable UUID id) {
        return transferJobRepository.findById(id)
                .map(TransferJobDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
