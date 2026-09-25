package com.cloudmigration.entity;

import com.cloudmigration.enums.CleanupStatus;
import com.cloudmigration.enums.TransferStatus;
import com.cloudmigration.enums.VerificationStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A TransferItem represents the migration of ONE file within a TransferJob.
 *
 * Lifecycle: QUEUED → TRANSFERRING → VERIFYING → VERIFIED → TRASHING_SOURCE → COMPLETED
 *
 * SAFETY RULE: cleanupStatus can only become SOURCE_TRASHED when
 * verificationStatus == VERIFIED.
 * This invariant is enforced in SourceCleanupService.
 */
@Entity
@Table(name = "transfer_items", indexes = {
    @Index(name = "idx_transfer_items_job", columnList = "transfer_job_id"),
    @Index(name = "idx_transfer_items_status", columnList = "transfer_status"),
    @Index(name = "idx_transfer_items_source_file", columnList = "source_file_id")
})
public class TransferItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_job_id", nullable = false)
    private TransferJob transferJob;

    // Source file information
    @Column(name = "source_file_id", nullable = false)
    private String sourceFileId;

    @Column(name = "source_file_name", nullable = false)
    private String sourceFileName;

    @Column(name = "source_mime_type")
    private String sourceMimeType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "is_google_workspace")
    private Boolean isGoogleWorkspace = false;

    // Destination information
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "destination_account_id", nullable = false)
    private GoogleAccount destinationAccount;

    // Set after successful upload to destination
    @Column(name = "destination_file_id")
    private String destinationFileId;

    // Transfer state - follows the safe workflow
    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_status", nullable = false)
    private TransferStatus transferStatus = TransferStatus.QUEUED;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    /**
     * SOURCE_ACTIVE = source file is still in Drive (untouched)
     * SOURCE_TRASHED = source file has been moved to Trash
     *
     * CRITICAL: This can ONLY be SOURCE_TRASHED if verificationStatus == VERIFIED.
     * Enforced in SourceCleanupService.performCleanup()
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "cleanup_status", nullable = false)
    private CleanupStatus cleanupStatus = CleanupStatus.SOURCE_ACTIVE;

    @Column(name = "progress_percent")
    private Integer progressPercent = 0;

    @Column(name = "retry_count")
    private Integer retryCount = 0;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    // Verification details
    @Column(name = "expected_size_bytes")
    private Long expectedSizeBytes;

    @Column(name = "destination_size_bytes")
    private Long destinationSizeBytes;

    @Column(name = "source_md5_checksum", length = 64)
    private String sourceMd5Checksum;

    @Column(name = "destination_md5_checksum", length = 64)
    private String destinationMd5Checksum;

    @OneToMany(mappedBy = "transferItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TransferEvent> events = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public TransferItem() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public TransferJob getTransferJob() { return transferJob; }
    public void setTransferJob(TransferJob transferJob) { this.transferJob = transferJob; }
    public String getSourceFileId() { return sourceFileId; }
    public void setSourceFileId(String sourceFileId) { this.sourceFileId = sourceFileId; }
    public String getSourceFileName() { return sourceFileName; }
    public void setSourceFileName(String sourceFileName) { this.sourceFileName = sourceFileName; }
    public String getSourceMimeType() { return sourceMimeType; }
    public void setSourceMimeType(String sourceMimeType) { this.sourceMimeType = sourceMimeType; }
    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
    public Boolean getIsGoogleWorkspace() { return isGoogleWorkspace; }
    public void setIsGoogleWorkspace(Boolean isGoogleWorkspace) { this.isGoogleWorkspace = isGoogleWorkspace; }
    public GoogleAccount getDestinationAccount() { return destinationAccount; }
    public void setDestinationAccount(GoogleAccount destinationAccount) { this.destinationAccount = destinationAccount; }
    public String getDestinationFileId() { return destinationFileId; }
    public void setDestinationFileId(String destinationFileId) { this.destinationFileId = destinationFileId; }
    public TransferStatus getTransferStatus() { return transferStatus; }
    public void setTransferStatus(TransferStatus transferStatus) { this.transferStatus = transferStatus; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public CleanupStatus getCleanupStatus() { return cleanupStatus; }
    public void setCleanupStatus(CleanupStatus cleanupStatus) { this.cleanupStatus = cleanupStatus; }
    public Integer getProgressPercent() { return progressPercent; }
    public void setProgressPercent(Integer progressPercent) { this.progressPercent = progressPercent; }
    public Integer getRetryCount() { return retryCount; }
    public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Long getExpectedSizeBytes() { return expectedSizeBytes; }
    public void setExpectedSizeBytes(Long expectedSizeBytes) { this.expectedSizeBytes = expectedSizeBytes; }
    public Long getDestinationSizeBytes() { return destinationSizeBytes; }
    public void setDestinationSizeBytes(Long destinationSizeBytes) { this.destinationSizeBytes = destinationSizeBytes; }
    public String getSourceMd5Checksum() { return sourceMd5Checksum; }
    public void setSourceMd5Checksum(String sourceMd5Checksum) { this.sourceMd5Checksum = sourceMd5Checksum; }
    public String getDestinationMd5Checksum() { return destinationMd5Checksum; }
    public void setDestinationMd5Checksum(String destinationMd5Checksum) { this.destinationMd5Checksum = destinationMd5Checksum; }
    public List<TransferEvent> getEvents() { return events; }
    public void setEvents(List<TransferEvent> events) { this.events = events; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
