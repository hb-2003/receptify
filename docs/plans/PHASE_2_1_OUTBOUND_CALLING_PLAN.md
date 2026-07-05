# Receptify — Outbound Calling Engine Integration Plan (Phase 2.1)

## 1. Problem Statement

### Current State
Receptify currently runs on a completely mocked calling simulator. The background thread worker transitions call states, logs static transcripts, and saves silent placeholder audio files. It lacks actual connection to real telecommunication channels or live text-to-speech synthesis streams.

### Desired State
The application integrates with the Twilio Voice API and ElevenLabs TTS to place real-world outbound phone calls to Indian mobile numbers. It streams dynamically synthesized localized voices, captures DTMF keypress responses, respects TRAI compliance windows, and registers live outcomes on the dashboard.

### Why It Matters
For Indian SMEs, mocked simulators are only useful for demonstrating features. To deliver actual business utility, the platform must connect to the real PSTN network to recover outstanding payments, confirm medical appointments, and verify cash-on-delivery shipments in real time.

---

## 2. Current Architecture (Verified File Paths)

The relevant existing files and boundaries of the system are cataloged below:

- **Cryptographic Helpers** (backend/receptify/crypto.py)
  Responsible for secure-by-default encryption and decryption of sensitive API tokens using PyCryptodome AES-GCM (byte-level fixed key length).

- **Authentication Views** (backend/receptify/views_auth.py)
  Handles session verification and cookies, ensuring all database and API requests are securely scoped to the active Business UUID.

- **Campaign Models & Launch Views** (backend/campaigns/models.py, backend/campaigns/views.py)
  Defines campaigns, active contacts, and triggers the current mock-thread simulator.

- **Call Models & Events** (backend/calls/models.py, backend/calls/views.py)
  Stores individual call records, state history, transcripts, and audio playback URLs.

---

## 3. What Changes vs. What Stays

### What Stays Unchanged
- **Database Schema structure:** The core structures of Campaign, Customer, Call, and CallTranscript models remain the same. No migrations are needed unless adding credential storage columns.
- **Frontend Dashboard View:** The call detail panels, tables, and analytics donut charts are not modified; they are already wired to consume live database state dynamically.
- **Local Sandbox Autofills:** The staging autofill demo buttons on login and signup remain intact and gated.

### What is Modified / Created
- **Twilio Webhook Controller:** We will create a public view at `backend/calls/views_twilio.py` to parse incoming HTTP requests and WebSocket streams from Twilio's calling network.
- **Decoupled TTS Adapter Module:** A pluggable TTS helper in `backend/calls/tts_adapter.py` will be created to manage ElevenLabs and OpenAI audio synthesis.
- **Throttled Task Queue:** The background campaign loop in `backend/campaigns/views.py` will be modified to pace outbound calls according to Account Calls-Per-Second (CPS) rate limits instead of triggering them all simultaneously.
- **TRAI Compliance Interceptor:** A pre-flight filter in `backend/calls/helpers.py` will be created to enforce Indian Standard Time calling windows and NDNC registry scrubs.

---

## 4. Technical Design & Deep Thinkpoints

### A. Real-Time WebSocket Media Streaming
- **TwiML Stream Instruction:** When placing a call, Receptify will return a TwiML response containing Connect and Stream instructions pointing to our secure WebSocket endpoint.
- **Format Requirements:** Audio streamed via Twilio WebSocket utilizes G.711 PCMU (u-law) at 8000 Hz, 8-bit mono. Our TTS Adapter must convert synthetic voices (typically MP3/WAV) to G.711 PCMU bytes before dispatching to Twilio.
- **Interactive DTMF Payload:** We will intercept Twilio DTMF socket packets (representing customer keypad presses, e.g. "Press 1 to confirm") to immediately alter conversational state and log answers.

### B. Business Isolation & Security Decryption
- **Multi-Tenant Credentials:** Each SME stores their Account SID, Auth Token, and outbound Phone Number in the Database under credentials tables.
- **Surgical Decryption:** The background calling view will load and decrypt these parameters on-the-fly using the verified secure byte-level Cryptography module. This guarantees that Business A can never place calls utilizing Business B's telephony balance.

### C. Rate-Limiting & Concurrency (CPS)
- Standard Twilio accounts are restricted to 1 Call-Per-Second (CPS). Bulk campaigns launching hundreds of calls must run through a pacing worker that queues and triggers calls systematically with a standard 1.5-second stagger interval to prevent HTTP 429 rate limit rejections.

### D. Webhook Security Verification
- The Twilio callback endpoint will manually verify Twilio signatures to prevent malicious payload spoofing. The request validator uses our public URL, POST query parameters, and the business's decrypted Auth Token to verify the X-Twilio-Signature header, rejecting unauthenticated requests.

### E. TRAI & NDNC Compliance
- Telemarketing in India is legally restricted to 9:00 AM to 9:00 PM. Pre-flight checks will block call dispatch if Indian Standard Time falls outside this window, deferring campaign executions. Any phone number registered on the National Do Not Call (NDNC) registry will be marked as Blocked in the Database during pre-flight.

---

## 5. Implementation Steps

1. **Pluggable TTS Adapter Integration**
   - **Files touched:** Create `backend/calls/tts_adapter.py`
   - **Action:** Build the abstract tts adapter class supporting ElevenLabs API and a local fallback converter. Convert incoming MP3 streams to G.711 PCMU 8kHz mono byte buffers.
   - **Verification:** Write unit tests mock-asserting translation from text string to u-law bytes.

2. **Webhooks and WebSocket calling controller**
   - **Files touched:** Create `backend/calls/views_twilio.py`, update `backend/calls/urls.py`
   - **Action:** Set up the public-facing HTTP callback view to generate TwiML stream hooks. Implement the WebSocket server routing to handle open-socket media events and DTMF payloads.
   - **Verification:** Mock-send Twilio JSON packets to the WebSocket and assert state mutations and transcription logging.

3. **Secure Decryption and Scoped Telephony Setup**
   - **Files touched:** Update `backend/campaigns/views.py`
   - **Action:** Update the campaign launch view to query the active business's decrypted credentials, initializing a scoped client.
   - **Verification:** Ensure calling fails gracefully with an HTTP 401 error if credentials are missing or corrupted.

4. **Paced Outbound Worker with TRAI Gating**
   - **Files touched:** Update `backend/campaigns/views.py`, create `backend/calls/helpers.py`
   - **Action:** Restructure the background campaign task to check current IST hours and DND registries before queuing. Implement a 1.5-second pacing delay between each outbound dispatch.
   - **Verification:** Launch a bulk campaign with 10 numbers; verify calls are placed sequentially rather than concurrently.

---

## 6. Risks and Open Questions

- **Autoplay and Autostart Restrictions:** Modern web browsers block automatic audio play unless user interaction has occurred. Our frontend mockup must handle autoplay restrictions gracefully.
- **WebSocket Latency over Mobile Networks:** G.711 PCMU stream audio conversion must execute in under 150ms to prevent lag during conversational turns. We will optimize byte buffer chunking.

---

## 7. Acceptance Criteria

- [ ] All credentials stored in the DB are encrypted and decrypted on-the-fly using the byte-level crypto module.
- [ ] Outbound campaigns are paced at a maximum of 1 call per 1.5 seconds, satisfying standard CPS rate limits.
- [ ] Pre-flight checks strictly block outbound calls outside the 9:00 AM to 9:00 PM IST window, deferring execution.
- [ ] Any phone number registered on the NDNC registry is scrubbed and marked as DND-blocked in the database before call initiation.
- [ ] Webhook callback views verify the Twilio signature header, returning HTTP 403 for unauthorized requests.
