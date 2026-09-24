package com.cloudmigration.dto;

import java.util.List;

/**
 * The full result of generating a transfer plan.
 */
public class TransferPlanResultDto {

    private List<TransferPlanEntryDto> plan;
    private int totalFittable;
    private int totalUnfittable;
    private long totalSizeBytes;

    public TransferPlanResultDto() {}

    private TransferPlanResultDto(Builder builder) {
        this.plan = builder.plan;
        this.totalFittable = builder.totalFittable;
        this.totalUnfittable = builder.totalUnfittable;
        this.totalSizeBytes = builder.totalSizeBytes;
    }

    public static Builder builder() { return new Builder(); }

    public List<TransferPlanEntryDto> getPlan() { return plan; }
    public void setPlan(List<TransferPlanEntryDto> plan) { this.plan = plan; }
    public int getTotalFittable() { return totalFittable; }
    public void setTotalFittable(int totalFittable) { this.totalFittable = totalFittable; }
    public int getTotalUnfittable() { return totalUnfittable; }
    public void setTotalUnfittable(int totalUnfittable) { this.totalUnfittable = totalUnfittable; }
    public long getTotalSizeBytes() { return totalSizeBytes; }
    public void setTotalSizeBytes(long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; }

    public static class Builder {
        private List<TransferPlanEntryDto> plan;
        private int totalFittable;
        private int totalUnfittable;
        private long totalSizeBytes;

        public Builder plan(List<TransferPlanEntryDto> plan) { this.plan = plan; return this; }
        public Builder totalFittable(int totalFittable) { this.totalFittable = totalFittable; return this; }
        public Builder totalUnfittable(int totalUnfittable) { this.totalUnfittable = totalUnfittable; return this; }
        public Builder totalSizeBytes(long totalSizeBytes) { this.totalSizeBytes = totalSizeBytes; return this; }
        public TransferPlanResultDto build() { return new TransferPlanResultDto(this); }
    }
}
