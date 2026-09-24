package com.cloudmigration.entity;

import com.cloudmigration.enums.TransferJobStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "transfer_jobs", indexes = {
    @Index(name = "idx_transfer_jobs_user", columnList = "app_user_id"),
    @Index(name = "idx_transfer_jobs_status", columnList = "status")
})
public class TransferJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "app_user_id")
    private AppUser appUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_account_id", nullable = false)
    private GoogleAccount sourceAccount;

    @Column(name = "job_name")
    private String jobName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TransferJobStatus status = TransferJobStatus.PLANNING;

    @Column(name = "total_files")
    private Integer totalFiles = 0;

    @Column(name = "completed_files")
    private Integer completedFiles = 0;

    @Column(name = "failed_files")
    private Integer failedFiles = 0;

    @Column(name = "total_bytes")
    private Long totalBytes = 0L;

    @Column(name = "transferred_bytes")
    private Long transferredBytes = 0L;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @OneToMany(mappedBy = "transferJob", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TransferItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public TransferJob() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public AppUser getAppUser() { return appUser; }
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }
    public GoogleAccount getSourceAccount() { return sourceAccount; }
    public void setSourceAccount(GoogleAccount sourceAccount) { this.sourceAccount = sourceAccount; }
    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public TransferJobStatus getStatus() { return status; }
    public void setStatus(TransferJobStatus status) { this.status = status; }
    public Integer getTotalFiles() { return totalFiles; }
    public void setTotalFiles(Integer totalFiles) { this.totalFiles = totalFiles; }
    public Integer getCompletedFiles() { return completedFiles; }
    public void setCompletedFiles(Integer completedFiles) { this.completedFiles = completedFiles; }
    public Integer getFailedFiles() { return failedFiles; }
    public void setFailedFiles(Integer failedFiles) { this.failedFiles = failedFiles; }
    public Long getTotalBytes() { return totalBytes; }
    public void setTotalBytes(Long totalBytes) { this.totalBytes = totalBytes; }
    public Long getTransferredBytes() { return transferredBytes; }
    public void setTransferredBytes(Long transferredBytes) { this.transferredBytes = transferredBytes; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public List<TransferItem> getItems() { return items; }
    public void setItems(List<TransferItem> items) { this.items = items; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
