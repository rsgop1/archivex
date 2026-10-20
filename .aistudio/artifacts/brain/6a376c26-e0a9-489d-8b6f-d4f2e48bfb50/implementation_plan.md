# ARCHIVEX: Telegram Userbot Session, Secure Settings UI & Post-Upload Cleanup Integration

ARCHIVEX is an advanced personal media archive and relay platform. This update directly integrates the user's specific Telegram user session string credentials (for scraping and streaming restricted private channels where bots cannot be invited), secure credential management in the web dashboard, and automated local file purging after successful channel upload to preserve computer storage.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were explicitly selected during clarification and govern this implementation plan:

- **Confirmed Decision 1 (Credential Management)**: Credentials (Telegram Bot Token, Owner User ID, and Userbot Session String) will be securely managed and updated directly through an enhanced **Settings UI** and an interactive **Credential Setup Modal** with masked inputs, input validation, and connection testing.
- **Confirmed Decision 2 (Channel Access Engine)**: The pipeline will support **Telegram Userbot StringSession** credentials (`api_id`, `api_hash`, `session_string`) to access restricted private channels where bot accounts are prohibited or lack reading privileges.
- **Confirmed Decision 3 (Storage Retention Policy)**: A configurable **"Purge Local Copy After Relay"** policy will be activated by default, ensuring that once a video or PDF is safely verified and uploaded to the destination channel, the local disk copy is purged, saving laptop drive space while keeping the database record and Telegram message reference intact.

---

### 1. Overview & Core Concept

- **What It Does**: Provides a direct, self-hosted conduit that connects to the user's Telegram user session, reads media from restricted private channels (bypassing disabled "Save & Forward" restrictions), streams videos and PDFs into local memory/staging, verifies SHA-256 integrity, uploads each file sequentially into the target destination channel, and immediately frees local disk space.
- **Target Audience**: Single-user personal deployment running on the owner's laptop or workstation.
- **Key Value**: Guarantees zero data loss, prevents laptop disk exhaustion, and eliminates the limitation of protected Telegram channels without requiring external cloud servers or unauthorized bypasses.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Credential Setup**: User opens the *Settings* tab or clicks *Configure Credentials* banner. An encrypted-style credential drawer lets them input their `TG_BOT_TOKEN`, `TG_OWNER_ID`, and Userbot `SESSION_STRING` (or generate/paste Telethon `StringSession`), with a live "Test Connection" button.
  2. **Relay Pipeline Execution**: User inputs or selects the private source channel and target destination channel, verifies the toggle *"Delete local file after successful upload"*, and clicks **Start Sequential Relay**.
  3. **Real-Time Step Inspection**: The dashboard displays the 4-phase sequential transfer:
     `Fetching from Source -> Staging & Checksum -> Uploading to Destination -> Local Disk Cleanup`.
  4. **Media & Relay History**: The history log displays the forwarded file with its Telegram message ID, size, transfer speed, and status tag `Relayed & Disk Purged`.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dark slate technical workstation theme (`#030712` base, `#0B132B` cards).
  - *Color Palette & Mood*: Dominant slate-950, structural surfaces slate-900, emerald-500 for active/healthy pipeline steps, indigo-500 for primary actions, amber-400 for rate-limit timers.
  - *Typography*: `Plus Jakarta Sans` for clean titles, `JetBrains Mono` with `tabular-nums` for hashes, message IDs, and byte counts.
  - *Component Styling*: Single-elevation flat panels, subtle 1px hairline borders (`border-slate-800`), unboxed metadata with bullet separators (`·`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Telethon Userbot StringSession Storage**
  - *Chosen Approach*: Store the user's Telegram StringSession in the application settings configuration with masking and environment override options.
  - *Why*: Allows headless, browser-free execution on the laptop without prompting for SMS codes on every restart.
  - *Alternatives Considered*: QR code login flow on every launch (tedious and breaks unattended background jobs).

- **Decision 2: Safe Post-Upload File Cleanup Lifecycle**
  - *Chosen Approach*: File is only deleted from `archive/temporary` or category folders **after** the Telegram Bot API or Userbot client returns an affirmative HTTP 200 with a valid `message_id`. If the upload fails, the file is retained for retry.
  - *Why*: Prevents catastrophic file loss during network disruptions.
  - *Alternatives Considered*: Deleting immediately on stream completion before upload confirmation (rejected due to risk of silent upload failure).

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARCHIVEX WORKSPACE ARCHITECTURE                 │
└────────────────────────────────────────────────────────────────────────┘

 [Settings UI: Bot Token & StringSession] ──> [Server Config Store]
                      │                                │
                      ▼                                ▼
       ┌──────────────────────────────┐ ┌──────────────────────────────┐
       │     Relay Pipeline Engine    │ │     Local Storage Manager    │
       │  - Reads Source via Userbot  │ │  - Staging in temp/          │
       │  - Computes SHA-256 Stream   │ │  - Computes Checksum         │
       │  - Uploads to Target Channel │ │  - Purges on Success         │
       └──────────────┬───────────────┘ └──────────────┬───────────────┘
                      │                                │
                      ▼                                ▼
       ┌───────────────────────────────────────────────────────────────┐
       │                      Database & Audit Engine                  │
       │  - Retains File metadata, SHA-256 hash & Telegram Message ID  │
       │  - Updates Job State: QUEUED -> PROCESSING -> COMPLETED       │
       │  - Records Audit Trail: PURGED_AFTER_RELAY                    │
       └───────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `SettingsView.tsx`: Adds explicit fields for `telethon_api_id`, `telethon_api_hash`, `telethon_session_string`, and toggle `delete_local_after_upload`.
  - `RelayPipelineView.tsx`: Adds live status indicator showing "Storage Auto-Clean: ACTIVE", displaying freed disk space after each item finishes.
  - `server/relayService.ts`: Extends `processSingleFile` to remove the staged physical file once the destination channel message ID is received and logged.
  - `server/db.ts`: Stores the enhanced settings and marks files as `relayed_remote_only` when local cleanup is enabled.
