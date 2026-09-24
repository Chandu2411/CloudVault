package com.cloudmigration.repository;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.enums.AccountRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GoogleAccountRepository extends JpaRepository<GoogleAccount, UUID> {
    Optional<GoogleAccount> findByEmail(String email);
    List<GoogleAccount> findByRole(AccountRole role);
    List<GoogleAccount> findByAppUserIdAndRole(UUID appUserId, AccountRole role);
    boolean existsByEmail(String email);
}
