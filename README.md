# CloudVault Migrator

### Intelligent Multi-Account Google Drive Storage Migration and Safe Backup Allocation System

---

## Problem Statement

Google accounts include 15 GB of shared free storage across Gmail, Google Photos, and Drive. When storage fills up, users cannot receive emails or store new files. Existing solutions — buying more storage, manually downloading files, or using Google Takeout — are costly, tedious, or lack intelligent distribution logic across multiple backup accounts.

---

## Proposed Solution

CloudVault Migrator is a full-stack web application that:
- Connects multiple Google accounts simultaneously via OAuth 2.0
- Displays a Drive file explorer to browse and select files
- Applies the **Best Fit** algorithm to automatically distribute files across backup accounts
- Executes transfers with a strict **Transfer → Verify → Safe Cleanup** protocol
- **Never deletes source files** until destination transfer is fully verified

---

## Key Features

- Multi-account Google OAuth 2.0 (1 source + unlimited destinations)
- Google Drive-style file explorer with folder navigation, breadcrumbs, multi-select
- Best Fit storage allocation engine (intelligent file distribution)
- Pre-transfer plan preview before any action begins
- Streaming file transfer (avoids full in-memory file loading)
- Google Workspace file export (Docs → DOCX, Sheets → XLSX, Slides → PPTX)
- 4-level transfer verification (existence, metadata, size, optional MD5 checksum)
- Safe source cleanup — files move to Trash only after verification
- Complete transfer lifecycle audit log
- Real-time transfer progress via polling
- Transfer history with filtering and search

---

## System Architecture

```
React Frontend (Vite, port 5173)
        ↕ REST API (Axios)
Spring Boot Backend (port 8080)
        ↕ Google Drive API v3
        ↕ PostgreSQL (or H2 for dev)

Transfer Flow:
SOURCE DRIVE → [Stream Download] → BACKEND → [Stream Upload] → DESTINATION DRIVE
                                       ↕
                              VERIFICATION SERVICE
                                       ↕ (only if VERIFIED)
                              SOURCE CLEANUP SERVICE
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Java 17, Spring Boot 3.x, Spring Security, Spring Data JPA |
| Database | H2 (dev) / PostgreSQL (production) |
| Auth | Google OAuth 2.0 (Authorization Code Flow) |
| Drive API | Google Drive API v3 |
| Build | Maven (backend), npm/Vite (frontend) |

---

## OAuth Workflow

```
1. User clicks "Connect Source Account"
2. React → GET /api/oauth/google/source
3. Backend builds Google auth URL with state parameter
4. Browser redirects to Google's OAuth consent page
5. User grants Drive permissions
6. Google redirects to → /api/oauth/callback?code=AUTH_CODE&state=source
7. Backend exchanges auth code for access_token + refresh_token
8. Tokens encrypted (AES-256-GCM) and stored in database
9. Backend redirects React to /source
10. React loads source Drive with files displayed
```

---

## OAuth Scopes Required

| Scope | Reason |
|---|---|
| `https://www.googleapis.com/auth/drive` | List, download, upload, and trash files |
| `https://www.googleapis.com/auth/userinfo.email` | Identify connected account email |
| `https://www.googleapis.com/auth/userinfo.profile` | Show name and profile photo in UI |

---

## Safe Transfer Protocol

```
SOURCE FILE
↓ Transfer (streaming)
DESTINATION FILE CREATED
↓ LEVEL 1: File exists in destination Drive
↓ LEVEL 2: File name and metadata match
↓ LEVEL 3: File size verified (binary files)
↓ LEVEL 4: MD5 checksum verified (when available)
↓ All levels PASSED
SOURCE FILE → MOVED TO TRASH
↓
TRANSFER COMPLETE
```

**If ANY level fails → Source file remains untouched → SOURCE_ACTIVE**

---

## Best Fit Storage Allocation Algorithm

**Time Complexity:** O(n log n + n × m) where n = files, m = accounts

```
For each file (sorted largest first):
  1. Find accounts where availableStorage >= fileSize
  2. Pick account with minimum (availableStorage - fileSize)
  3. Update that account's available storage
  4. If no account fits → mark INSUFFICIENT_STORAGE
```

**Example:**
```
Files: A=4GB, B=3GB, C=2GB
Accounts: Acc1=5GB, Acc2=8GB, Acc3=3GB

File A (4GB): Acc1 fits (1GB left), Acc2 fits (4GB left) → Acc1 (least waste)
File B (3GB): Acc1=1GB (no fit), Acc3=3GB (0 left), Acc2=8GB (5 left) → Acc3
File C (2GB): Acc1=1GB (no fit), Acc3=0GB (no fit), Acc2=8GB (6 left) → Acc2
```

---

## Database Design

| Table | Purpose |
|---|---|
| `app_users` | Application user (identified by session ID) |
| `google_accounts` | Connected Google accounts (source + destinations) |
| `transfer_jobs` | One migration session (batch of files) |
| `transfer_items` | One file's complete transfer lifecycle |
| `transfer_events` | Audit log events for each transfer item |

**Encrypted columns:** `encrypted_access_token`, `encrypted_refresh_token` (AES-256-GCM)

---

## Backend Package Structure

```
com.cloudmigration/
├── config/          SecurityConfig, CorsConfig, AsyncConfig
├── controller/      OAuthController, SourceController, DestinationController, TransferController
├── dto/             AccountDto, DriveFileDto, TransferJobDto, TransferPlanResultDto, ...
├── entity/          AppUser, GoogleAccount, TransferJob, TransferItem, TransferEvent
├── enums/           AccountRole, TransferStatus, VerificationStatus, CleanupStatus, EventLevel
├── exception/       GlobalExceptionHandler, custom exception classes
├── repository/      JPA repositories for all entities
├── service/         StorageAllocationService, DriveTransferService, ...
│   ├── oauth/       GoogleOAuthService
│   ├── drive/       DriveFileService, DriveStorageService
│   ├── transfer/    TransferJobService, TransferEventService
│   ├── verification/ TransferVerificationService
│   ├── allocation/  StorageAllocationService
│   └── cleanup/     SourceCleanupService
└── util/            TokenEncryptionUtil, ByteFormatter
```

---

## Google Cloud Setup (Beginner Guide)

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Click the project dropdown → "New Project"
3. Name it `cloudvault-migrator` → Create

### Step 2: Enable Google Drive API
1. Navigate to "APIs & Services" → "Library"
2. Search for "Google Drive API" → Enable it

### Step 3: Configure OAuth Consent Screen
1. "APIs & Services" → "OAuth consent screen"
2. Select **External** (for testing with any Gmail account)
3. Fill in App name: `CloudVault Migrator`, support email
4. Add scopes: `drive`, `userinfo.email`, `userinfo.profile`
5. Add test users: your Gmail accounts that will be used in testing
   - **Important:** In Testing mode, only accounts listed as test users can authenticate

### Step 4: Create OAuth Client ID
1. "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth Client ID"
2. Application type: **Web Application**
3. Name: `CloudVault Web Client`
4. Authorized redirect URIs: `http://localhost:8080/api/oauth/callback`
5. Click Create → Copy Client ID and Client Secret

### Step 5: Configure Environment Variables
```bash
# backend/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
TOKEN_ENCRYPTION_KEY=your-32-character-secret-key!!!!!
```

### Testing Mode Limitations
- Only accounts listed as "Test Users" in the OAuth consent screen can sign in
- Maximum 100 test users
- To allow any Gmail user: publish the app (requires Google verification for sensitive scopes)

---

## Project Setup

### Prerequisites
- Java 17+
- Maven 3.8+
- Node.js 18+
- PostgreSQL (optional — H2 used by default)

### Run Backend
```bash
cd backend
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
mvn spring-boot:run
# Backend runs at http://localhost:8080
# H2 Console available at http://localhost:8080/h2-console
```

### Run Frontend
```bash
cd frontend  # (project root in this Bolt project)
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

### Run Tests
```bash
cd backend
mvn test
```

---

## REST API Reference

### OAuth
```
GET  /api/oauth/google/source        → Redirect to Google OAuth for source account
GET  /api/oauth/google/destination   → Redirect to Google OAuth for destination account
GET  /api/oauth/callback             → Google redirects here after auth
DELETE /api/oauth/accounts/{id}      → Disconnect an account
```

### Source Drive
```
GET  /api/source/account             → Get source account info
GET  /api/source/storage             → Get storage usage
GET  /api/source/files               → List root files
GET  /api/source/files/{folderId}    → List folder contents
```

### Destination Accounts
```
GET  /api/destinations               → List all destination accounts
POST /api/destinations/connect       → Add a destination account
DELETE /api/destinations/{id}        → Remove destination account
POST /api/destinations/{id}/refresh  → Refresh storage info
```

### Transfers
```
POST /api/transfers/plan             → Generate Best Fit transfer plan
POST /api/transfers/start            → Start a transfer job
GET  /api/transfers/{id}             → Get transfer job details
GET  /api/transfers/{id}/progress    → Poll for live progress
POST /api/transfers/{id}/cancel      → Cancel transfer
GET  /api/transfers/history          → Get transfer history
```

---

## Known Limitations

1. **Google Workspace files** cannot be natively copied between accounts — they are exported to Office formats (DOCX, XLSX, PPTX)
2. **Drive storage API** may return cached values — storage is refreshed before each transfer plan
3. **Large file streaming** — very large files (>10 GB) may encounter timeout issues on slow connections; resumable uploads mitigate this
4. **OAuth rate limits** — the Drive API has daily quotas per project; heavy use may hit limits
5. **No file splitting** — a single file cannot be split across multiple destination accounts
6. **Testing mode** — only listed test users can authenticate until the app is verified by Google

---

## Future Enhancements

- AI-based storage optimization and file priority prediction
- Duplicate file detection before migration
- File compression before transfer (reduce storage usage)
- Multi-cloud support (Google Drive → OneDrive, Dropbox, S3)
- Scheduled automatic migration based on storage thresholds
- Storage threshold alerts (email/push notifications)
- Real-time progress via Server-Sent Events (replace polling)
- Transfer analytics dashboard with charts
- Bulk account management
- Transfer bandwidth throttling

---

## Project Novelty (College Presentation Points)

1. **Safety-First Architecture** — A 4-level verification protocol before source cleanup. No comparable free tool does this.
2. **Best Fit Algorithm Applied to Cloud Storage** — Classic bin-packing algorithm applied to a real-world storage problem.
3. **Streaming Transfer** — Files are never fully stored on the backend server; piped streams conserve memory.
4. **Google Workspace Awareness** — Correctly identifies and exports Docs/Sheets/Slides vs binary files.
5. **Multi-Account OAuth** — Multiple independent Google OAuth sessions managed simultaneously.
6. **Complete Audit Trail** — Every second of a file's transfer lifecycle is logged with timestamps.
7. **Token Encryption at Rest** — AES-256-GCM encryption for all stored OAuth tokens.
8. **Idempotent Transfer Engine** — Prevents duplicate transfers from repeated button clicks.
