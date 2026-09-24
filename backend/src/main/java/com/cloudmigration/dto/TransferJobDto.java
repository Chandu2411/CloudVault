package com.cloudmigration.dto;

import com.cloudmigration.enums.TransferJobStatus;
import com.cloudmigration.enums.TransferStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * DTO representing a transfer job and its items for the frontend.
 */
public class TransferJobDto {
    private UUID id;
    private String jobName;
    private TransferJobStatus status;
    private Integer totalFiles;
    private Integer completedFiles;
    private Integer failedFiles;
    private Long totalBytes;
    private Long transferredBytes;
    private String sourceEmail;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private List<TransferItemSummary> items;

    public static TransferJobDto from(com.cloudmigration.entity.TransferJob job) {
        TransferJobDto dto = new TransferJobDto();
        dto.id = job.getId();
        dto.jobName = job.getJobName();
        dto.status = job.getStatus();
        dto.totalFiles = job.getTotalFiles();
        dto.completedFiles = job.getCompletedFiles();
        dto.failedFiles = job.getFailedFiles();
        dto.totalBytes = job.getTotalBytes();
        dto.transferredBytes = job.getTransferredBytes();
        dto.sourceEmail = job.getSourceAccount() != null ? job.getSourceAccount().getEmail() : null;
        dto.createdAt = job.getCreatedAt();
        dto.startedAt = job.getStartedAt();
        dto.completedAt = job.getCompletedAt();
        if (job.getItems() != null) {
            dto.items = job.getItems().stream().map(item -> {
                TransferItemSummary s = new TransferItemSummary();
                s.id = item.getId();
                s.fileName = item.getSourceFileName();
                s.fileSizeBytes = item.getFileSizeBytes();
                s.status = item.getTransferStatus();
                s.progressPercent = item.getProgressPercent();
                s.errorMessage = item.getErrorMessage();
                s.destinationEmail = item.getDestinationAccount() != null ? item.getDestinationAccount().getEmail() : null;
                return s;
            }).collect(Collectors.toList());
        }
        return dto;
    }

    public static class TransferItemSummary {
        public UUID id;
        public String fileName;
        public Long fileSizeBytes;
        public TransferStatus status;
        public Integer progressPercent;
        public String errorMessage;
        public String destinationEmail;
    }

    public UUID getId() { return id; }
    public String getJobName() { return jobName; }
    public TransferJobStatus getStatus() { return status; }
    public Integer getTotalFiles() { return totalFiles; }
    public Integer getCompletedFiles() { return completedFiles; }
    public Integer getFailedFiles() { return failedFiles; }
    public Long getTotalBytes() { return totalBytes; }
    public Long getTransferredBytes() { return transferredBytes; }
    public String getSourceEmail() { return sourceEmail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public List<TransferItemSummary> getItems() { return items; }
}
