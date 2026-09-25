package com.cloudmigration.controller;

import com.cloudmigration.entity.AppUser;
import com.cloudmigration.repository.AppUserRepository;
import com.cloudmigration.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final JwtUtil jwtUtil;

    public AuthController(AppUserRepository appUserRepository, JwtUtil jwtUtil) {
        this.appUserRepository = appUserRepository;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");
        String name = payload.get("name");
        String phone = payload.get("phone");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        }

        if (appUserRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already exists"));
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(name);
        user.setPassword(password); // In a real app, hash this!
        user.setPhoneNumber(phone);
        user.setCreatedAt(LocalDateTime.now());
        user.setLastLoginAt(LocalDateTime.now());
        
        AppUser savedUser = appUserRepository.save(user);
        String token = jwtUtil.generateToken(savedUser.getEmail(), savedUser.getId().toString());

        return ResponseEntity.ok(Map.of(
            "id", savedUser.getId(),
            "email", savedUser.getEmail(),
            "name", savedUser.getDisplayName(),
            "token", token
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        }

        Optional<AppUser> userOpt = appUserRepository.findByEmail(email);
        if (userOpt.isEmpty() || userOpt.get().getPassword() == null || !userOpt.get().getPassword().equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid credentials"));
        }

        AppUser user = userOpt.get();
        user.setLastLoginAt(LocalDateTime.now());
        appUserRepository.save(user);
        
        String token = jwtUtil.generateToken(user.getEmail(), user.getId().toString());

        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "email", user.getEmail(),
            "name", user.getDisplayName(),
            "token", token
        ));
    }
}
