package com.cloudmigration.dto;

import java.util.UUID;

/**
 * Request body for starting a transfer.
 */
public class StartTransferRequest {
    private java.util.List<DriveFileDto> files;
    private java.util.List<UUID> destinationAccountIds;

    public java.util.List<DriveFileDto> getFiles() { return files; }
    public void setFiles(java.util.List<DriveFileDto> files) { this.files = files; }
    public java.util.List<UUID> getDestinationAccountIds() { return destinationAccountIds; }
    public void setDestinationAccountIds(java.util.List<UUID> destinationAccountIds) { this.destinationAccountIds = destinationAccountIds; }
}
