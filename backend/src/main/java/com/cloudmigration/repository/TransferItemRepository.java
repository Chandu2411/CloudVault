package com.cloudmigration.repository;

import com.cloudmigration.entity.TransferItem;
import com.cloudmigration.enums.TransferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TransferItemRepository extends JpaRepository<TransferItem, UUID> {
    List<TransferItem> findByTransferJobId(UUID transferJobId);
    List<TransferItem> findByTransferStatus(TransferStatus status);
    List<TransferItem> findByTransferJobIdAndTransferStatus(UUID transferJobId, TransferStatus status);
}
