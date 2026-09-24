package com.cloudmigration.repository;

import com.cloudmigration.entity.TransferJob;
import com.cloudmigration.enums.TransferJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TransferJobRepository extends JpaRepository<TransferJob, UUID> {
    List<TransferJob> findByAppUserIdOrderByCreatedAtDesc(UUID appUserId);
    List<TransferJob> findByStatus(TransferJobStatus status);
}
