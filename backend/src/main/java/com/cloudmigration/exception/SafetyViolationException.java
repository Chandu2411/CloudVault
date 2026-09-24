package com.cloudmigration.exception;

public class SafetyViolationException extends RuntimeException {
    public SafetyViolationException(String message) {
        super(message);
    }
    public SafetyViolationException(String message, Throwable cause) {
        super(message, cause);
    }
}
