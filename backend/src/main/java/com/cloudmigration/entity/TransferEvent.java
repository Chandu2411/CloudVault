package com.cloudmigration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transfer_events", indexes = {
    @Index(name = "idx_transfer_events_item", columnList = "transfer_item_id"),
    @Index(name = "idx_transfer_events_job", columnList = "transfer_job_id")
})
public class TransferEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_item_id", nullable = false)
    private TransferItem transferItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transfer_job_id")
    private TransferJob transferJob;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "message", length = 2048)
    private String message;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt = LocalDateTime.now();

    public TransferEvent() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public TransferItem getTransferItem() { return transferItem; }
    public void setTransferItem(TransferItem transferItem) { this.transferItem = transferItem; }
    public TransferJob getTransferJob() { return transferJob; }
    public void setTransferJob(TransferJob transferJob) { this.transferJob = transferJob; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
}
