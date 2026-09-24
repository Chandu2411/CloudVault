package com.cloudmigration.dto;

/**
 * Represents a single file retrieved from Google Drive.
 */
public class DriveFileDto {

    private String id;
    private String name;
    private String mimeType;
    private Long sizeBytes;
    private Boolean isGoogleWorkspace;
    private String md5Checksum;
    private String webViewLink;

    public DriveFileDto() {}

    private DriveFileDto(Builder builder) {
        this.id = builder.id;
        this.name = builder.name;
        this.mimeType = builder.mimeType;
        this.sizeBytes = builder.sizeBytes;
        this.isGoogleWorkspace = builder.isGoogleWorkspace;
        this.md5Checksum = builder.md5Checksum;
        this.webViewLink = builder.webViewLink;
    }

    public static Builder builder() { return new Builder(); }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long sizeBytes) { this.sizeBytes = sizeBytes; }
    public Boolean isGoogleWorkspace() { return Boolean.TRUE.equals(isGoogleWorkspace); }
    public void setIsGoogleWorkspace(Boolean isGoogleWorkspace) { this.isGoogleWorkspace = isGoogleWorkspace; }
    public String getMd5Checksum() { return md5Checksum; }
    public void setMd5Checksum(String md5Checksum) { this.md5Checksum = md5Checksum; }
    public String getWebViewLink() { return webViewLink; }
    public void setWebViewLink(String webViewLink) { this.webViewLink = webViewLink; }

    public static class Builder {
        private String id;
        private String name;
        private String mimeType;
        private Long sizeBytes;
        private Boolean isGoogleWorkspace;
        private String md5Checksum;
        private String webViewLink;

        public Builder id(String id) { this.id = id; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder mimeType(String mimeType) { this.mimeType = mimeType; return this; }
        public Builder sizeBytes(Long sizeBytes) { this.sizeBytes = sizeBytes; return this; }
        public Builder isGoogleWorkspace(Boolean isGoogleWorkspace) { this.isGoogleWorkspace = isGoogleWorkspace; return this; }
        public Builder md5Checksum(String md5Checksum) { this.md5Checksum = md5Checksum; return this; }
        public Builder webViewLink(String webViewLink) { this.webViewLink = webViewLink; return this; }
        public DriveFileDto build() { return new DriveFileDto(this); }
    }
}
