package com.cloudmigration.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(SafetyViolationException.class)
    public ResponseEntity<Map<String, Object>> handleSafetyViolation(SafetyViolationException e) {
        return buildError(HttpStatus.FORBIDDEN, e.getMessage(), "SAFETY_VIOLATION");
    }

    @ExceptionHandler(TransferException.class)
    public ResponseEntity<Map<String, Object>> handleTransferError(TransferException e) {
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage(), "TRANSFER_ERROR");
    }

    @ExceptionHandler(InsufficientStorageException.class)
    public ResponseEntity<Map<String, Object>> handleInsufficientStorage(InsufficientStorageException e) {
        return buildError(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage(), "INSUFFICIENT_STORAGE");
    }

    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleAccountNotFound(AccountNotFoundException e) {
        return buildError(HttpStatus.NOT_FOUND, e.getMessage(), "ACCOUNT_NOT_FOUND");
    }

    @ExceptionHandler(OAuthException.class)
    public ResponseEntity<Map<String, Object>> handleOAuthError(OAuthException e) {
        return buildError(HttpStatus.UNAUTHORIZED, e.getMessage(), "OAUTH_ERROR");
    }

    @ExceptionHandler(DuplicateAccountException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateAccount(DuplicateAccountException e) {
        return buildError(HttpStatus.CONFLICT, e.getMessage(), "DUPLICATE_ACCOUNT");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneral(Exception e) {
        e.printStackTrace();
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred: " + e.getMessage(), "INTERNAL_ERROR");
    }

    private ResponseEntity<Map<String, Object>> buildError(HttpStatus status, String message, String code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", code);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
