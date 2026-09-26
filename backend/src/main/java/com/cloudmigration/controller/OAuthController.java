package com.cloudmigration.controller;

import com.cloudmigration.entity.GoogleAccount;
import com.cloudmigration.enums.AccountRole;
import com.cloudmigration.service.GoogleAccountService;
import com.cloudmigration.service.DriveStorageService;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/oauth")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:5173}")
public class OAuthController {

    @Value("${google.oauth.client-id}")
    private String clientId;

    @Value("${google.oauth.client-secret}")
    private String clientSecret;

    @Value("${google.oauth.redirect-uri}")
    private String redirectUri;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    private static final List<String> SCOPES = Arrays.asList(
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    );

    private final GoogleAccountService googleAccountService;
    private final DriveStorageService driveStorageService;
    private final com.cloudmigration.repository.AppUserRepository appUserRepository;
    private final com.cloudmigration.util.JwtUtil jwtUtil;

    public OAuthController(GoogleAccountService googleAccountService, DriveStorageService driveStorageService, com.cloudmigration.repository.AppUserRepository appUserRepository, com.cloudmigration.util.JwtUtil jwtUtil) {
        this.googleAccountService = googleAccountService;
        this.driveStorageService = driveStorageService;
        this.appUserRepository = appUserRepository;
        this.jwtUtil = jwtUtil;
    }

    private GoogleAuthorizationCodeFlow getFlow() {
        return new GoogleAuthorizationCodeFlow.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                clientId,
                clientSecret,
                SCOPES)
                .setAccessType("offline")
                .setApprovalPrompt("force")
                .build();
    }

    @GetMapping("/google/{role}")
    public ResponseEntity<Void> authorize(@PathVariable String role, @RequestParam(value = "userId", required = false) String userId) {
        String finalState = role.toUpperCase();
        if (userId != null && !userId.isEmpty()) {
            finalState += "_" + userId;
        }

        String authorizationUrl = getFlow().newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setState(finalState)
                .build();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(authorizationUrl));
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(value = "code", required = false) String code,
                                         @RequestParam(value = "error", required = false) String error,
                                         @RequestParam("state") String state) {
        if (error != null || code == null) {
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create(frontendUrl + "/?error=access_denied"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        }
        try {
            GoogleTokenResponse response = getFlow().newTokenRequest(code)
                    .setRedirectUri(redirectUri)
                    .execute();

            String accessToken = response.getAccessToken();
            String refreshToken = response.getRefreshToken();

            // Fetch user info using RestTemplate
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders authHeaders = new HttpHeaders();
            authHeaders.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>("parameters", authHeaders);

            ResponseEntity<Map> userInfoResponse = restTemplate.exchange(
                    "https://www.googleapis.com/oauth2/v2/userinfo", 
                    HttpMethod.GET, 
                    entity, 
                    Map.class
            );

            Map<String, Object> userInfo = userInfoResponse.getBody();
            String email = (String) userInfo.get("email");
            String name = (String) userInfo.get("name");
            String googleId = (String) userInfo.get("id");
            
            if ("LOGIN".equals(state)) {
                // Find or create AppUser
                com.cloudmigration.entity.AppUser appUser = appUserRepository.findByEmail(email).orElseGet(() -> {
                    com.cloudmigration.entity.AppUser newUser = new com.cloudmigration.entity.AppUser();
                    newUser.setEmail(email);
                    newUser.setDisplayName(name);
                    newUser.setGoogleSub(googleId);
                    newUser.setCreatedAt(java.time.LocalDateTime.now());
                    return newUser;
                });
                appUser.setLastLoginAt(java.time.LocalDateTime.now());
                appUserRepository.save(appUser);
                
                String token = jwtUtil.generateToken(appUser.getEmail(), appUser.getId().toString());
                
                // ALSO create/update the SOURCE account and link it
                com.cloudmigration.entity.GoogleAccount account = googleAccountService.connectAccount(
                        email, name, AccountRole.SOURCE, accessToken, refreshToken, null, null
                );
                account.setAppUser(appUser);
                // Need to save again to update appUser
                googleAccountService.saveAccount(account);
                
                driveStorageService.refreshAccountStorage(account.getId());
                
                HttpHeaders headers = new HttpHeaders();
                headers.setLocation(URI.create(frontendUrl + "/dashboard?token=" + token));
                return new ResponseEntity<>(headers, HttpStatus.FOUND);
            }

            // For DESTINATION, state will be DESTINATION_<jwtToken>
            String roleStr = state;
            String jwtToken = null;
            if (state.contains("_")) {
                String[] parts = state.split("_", 2);
                roleStr = parts[0];
                jwtToken = parts[1];
            }

            AccountRole role = AccountRole.valueOf(roleStr);

            com.cloudmigration.entity.GoogleAccount account = googleAccountService.connectAccount(
                    email,
                    name,
                    role,
                    accessToken,
                    refreshToken,
                    null,
                    null
            );
            
            if (jwtToken != null) {
                String userEmail = jwtUtil.extractUsername(jwtToken);
                appUserRepository.findByEmail(userEmail).ifPresent(appUser -> {
                    account.setAppUser(appUser);
                    googleAccountService.saveAccount(account);
                });
            }
            
            driveStorageService.refreshAccountStorage(account.getId());

            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create(frontendUrl + "/backups"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);

        } catch (Exception e) {
            e.printStackTrace();
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create(frontendUrl + "/?error=oauth_failed"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        }
    }
}
