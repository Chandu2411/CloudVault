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

    private static final List<String> SCOPES = Arrays.asList(
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    );

    private final GoogleAccountService googleAccountService;
    private final DriveStorageService driveStorageService;

    public OAuthController(GoogleAccountService googleAccountService, DriveStorageService driveStorageService) {
        this.googleAccountService = googleAccountService;
        this.driveStorageService = driveStorageService;
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
    public ResponseEntity<Void> authorize(@PathVariable String role) {
        String authorizationUrl = getFlow().newAuthorizationUrl()
                .setRedirectUri(redirectUri)
                .setState(role.toUpperCase())
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
            headers.setLocation(URI.create("http://localhost:5173/?error=access_denied"));
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
            AccountRole role = AccountRole.valueOf(state);

            com.cloudmigration.entity.GoogleAccount account = googleAccountService.connectAccount(
                    (String) userInfo.get("email"),
                    (String) userInfo.get("name"),
                    role,
                    accessToken,
                    refreshToken,
                    null, // fetched via drive service below
                    null  // fetched via drive service below
            );
            
            driveStorageService.refreshAccountStorage(account.getId());

            // Redirect back to frontend
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create("http://localhost:5173/"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);

        } catch (Exception e) {
            e.printStackTrace();
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create("http://localhost:5173/?error=oauth_failed"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        }
    }
}
