package com.cloudmigration.dto;

/**
 * Represents one file-to-account assignment in a transfer plan.
 */
public class TransferPlanEntryDto {

    private String fileId;
    private String fileName;
    private Long fileSizeBytes;
    private String mimeType;
    private boolean canFit;
    private String destinationAccountId;
    private String destinationEmail;
    private Long remainingStorageAfterFit;
    private String reason;

    public TransferPlanEntryDto() {}

    private TransferPlanEntryDto(Builder builder) {
        this.fileId = builder.fileId;
        this.fileName = builder.fileName;
        this.fileSizeBytes = builder.fileSizeBytes;
        this.mimeType = builder.mimeType;
        this.canFit = builder.canFit;
        this.destinationAccountId = builder.destinationAccountId;
        this.destinationEmail = builder.destinationEmail;
        this.remainingStorageAfterFit = builder.remainingStorageAfterFit;
        this.reason = builder.reason;
    }

    public static Builder builder() { return new Builder(); }

    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public boolean isCanFit() { return canFit; }
    public void setCanFit(boolean canFit) { this.canFit = canFit; }
    public String getDestinationAccountId() { return destinationAccountId; }
    public void setDestinationAccountId(String destinationAccountId) { this.destinationAccountId = destinationAccountId; }
    public String getDestinationEmail() { return destinationEmail; }
    public void setDestinationEmail(String destinationEmail) { this.destinationEmail = destinationEmail; }
    public Long getRemainingStorageAfterFit() { return remainingStorageAfterFit; }
    public void setRemainingStorageAfterFit(Long remainingStorageAfterFit) { this.remainingStorageAfterFit = remainingStorageAfterFit; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public static class Builder {
        private String fileId;
        private String fileName;
        private Long fileSizeBytes;
        private String mimeType;
        private boolean canFit;
        private String destinationAccountId;
        private String destinationEmail;
        private Long remainingStorageAfterFit;
        private String reason;

        public Builder fileId(String fileId) { this.fileId = fileId; return this; }
        public Builder fileName(String fileName) { this.fileName = fileName; return this; }
        public Builder fileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; return this; }
        public Builder mimeType(String mimeType) { this.mimeType = mimeType; return this; }
        public Builder canFit(boolean canFit) { this.canFit = canFit; return this; }
        public Builder destinationAccountId(String destinationAccountId) { this.destinationAccountId = destinationAccountId; return this; }
        public Builder destinationEmail(String destinationEmail) { this.destinationEmail = destinationEmail; return this; }
        public Builder remainingStorageAfterFit(Long remainingStorageAfterFit) { this.remainingStorageAfterFit = remainingStorageAfterFit; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public TransferPlanEntryDto build() { return new TransferPlanEntryDto(this); }
    }
}
