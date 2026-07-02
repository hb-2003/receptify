#!/usr/bin/env python3
import urllib.request
import base64
import json
import re
import os

# Jira configuration
JIRA_URL = 'https://bhanderihardik11-1783017478652.atlassian.net'
EMAIL = 'bhanderihardik11@gmail.com'
TOKEN = os.environ.get('JIRA_API_TOKEN', 'mock_token_to_avoid_push_protection')
PROJECT_KEY = 'KAN'

# Build basic authentication headers
auth_str = f'{EMAIL}:{TOKEN}'
auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': f'Basic {auth_b64}'
}

# Detailed technical explanations for each task item
TECHNICAL_DETAILS = {
    "db migration": """### Technical Implementation: DB Schema Extension
* **Goal**: Extend the Postgres schema to store outbound Twilio parameters, events, and credentials.
* **Schema Additions**:
  1. **Table `calls`**: Add `channel_type` column (INTEGER, default `0`). `0` indicates standard mock, `1` indicates live Twilio.
  2. **Table `campaigns`**: Add `channel_type` column (INTEGER, default `0`).
  3. **Table `twilio_credentials`**:
     * `id`: UUID Primary Key.
     * `business_id`: UUID Foreign Key referencing `businesses.id` (Unique/One-To-One).
     * `account_sid`: VARCHAR (Unencrypted, used to identify account).
     * `auth_token`: VARCHAR (AES-256-GCM Encrypted).
     * `phone_number`: VARCHAR (e.g., +1234567890).
     * `created_at` / `updated_at`: TIMESTAMPTZ.
  4. **Table `call_events`**:
     * `id`: UUID Primary Key.
     * `call_id`: UUID Foreign Key referencing `calls.id`.
     * `event_type`: VARCHAR (e.g., `initiated`, `ringing`, `answered`, `completed`, `failed`).
     * `payload`: JSONB (contains full raw event metadata).
     * `created_at`: TIMESTAMPTZ.
* **Engineering Standards**:
  * Adhere to naming standards (plural snake_case table names, kebab-case file names, lowercase column names).
  * Use TypeORM decorators inside `src/lib/db/entities/*` to define types.
  * Update `data-source.ts` to include the new entities.""",

    "crypto.ts": """### Technical Implementation: AES-256-GCM Encryption Utility
* **Goal**: Safeguard credentials like the Twilio Auth Token in the database.
* **Implementation Details (`crypto.ts`)**:
  * **Algorithm**: `aes-256-gcm` (standard authenticated encryption).
  * **IV**: 12-byte cryptographically secure random bytes generated using `crypto.randomBytes(12)`.
  * **Key Derivation**: Derive a 32-byte key from the `ENCRYPTION_KEY` environment variable. In Node, use `crypto.createHash('sha256').update(secret).digest()` to ensure it is exactly 32 bytes.
  * **Encryption Output Format**: `ivHex:authTagHex:encryptedTextHex`. This format is highly portable and includes all parts needed for decryption.
  * **Decryption Verification**: Parse the colon-separated parts, set the authentication tag using `decipher.setAuthTag()`, and decrypt.
  * **Security Guards**: Throw an explicit error in production if the `ENCRYPTION_KEY` is missing or less than 32 characters long.""",

    "database seed update": """### Technical Implementation: Database Seed Update
* **Goal**: Ensure that local development, container tests, and demo setups can boot with encrypted credentials automatically.
* **Implementation Details (`seed.ts`)**:
  * Update `src/lib/db/seed.ts` to populate the `twilio_credentials` table with pre-seeded mock credentials.
  * Encrypt the mock Twilio Auth Token using `crypto.encrypt` before writing to the database.
  * Verify that running `npm run db:seed` executes cleanly without duplicates.""",

    "fastapi initialization": """### Technical Implementation: FastAPI Server Setup
* **Goal**: Create the foundation for the real-time calling and LLM services in Python.
* **Requirements**:
  * Lightweight ASGI FastAPI service running on port `8001` (managed via `uvicorn`).
  * Integrate direct endpoints for LLM interaction:
    1. `POST /api/llm/generate-script`: Generate natural-sounding receptionist scripts using Claude 3.5 Sonnet.
    2. `POST /api/llm/generate-summary`: Provide sentiment and transaction summaries of call transcripts.
  * Handle reverse-proxy requirements: forward other requests back to Next.js on port `3000` as needed in container settings.""",

    "database connection": """### Technical Implementation: Python Database Connection
* **Goal**: Establish connection from the FastAPI backend to the shared PostgreSQL local cluster (`receptify`).
* **Implementation Details**:
  * Use `SQLAlchemy` or `asyncpg` / `psycopg2-binary` to connect to Postgres.
  * Load credentials from `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
  * Verify database pool setup works under parallel requests, cleanly releasing connections.""",

    "settings twilio form ui": """### Technical Implementation: Next.js Settings Twilio Form
* **Goal**: Build an elegant settings panel in Next.js where SME users configure their custom Twilio account details.
* **Component Path**: `src/app/(app)/settings/page.tsx`
* **Features**:
  * Input fields for **Account SID**, **Auth Token**, and **Twilio Phone Number**.
  * Use a secure toggle to hide/show the Auth Token (password field type).
  * Display a clear status badge: `Not Connected`, `Verifying`, or `Connected`.
  * Display meaningful error responses (e.g. invalid SID format, incorrect token) with Sonner toast feedback.""",

    "post /api/v1/business/twilio": """### Technical Implementation: Save and Validate Credentials API
* **Goal**: Endpoint to accept, validate, encrypt, and store a business's Twilio credentials.
* **Route Path**: `POST /api/v1/business/twilio`
* **Workflow**:
  1. **Authorize**: Verify JWT authorization.
  2. **Validate via SDK**: Before saving, initialize a temporary Twilio Client using the incoming SID & Auth Token and request the account details. If Twilio returns 401/403, reject the request with a detailed error.
  3. **Encrypt**: Use `crypto.encrypt` to secure the Auth Token.
  4. **Save**: Upsert credentials into `twilio_credentials` for this business.
  5. **Audit**: Create a trace event in `call_events`.""",

    "secure credentials retrieval": """### Technical Implementation: Secure Credentials Retrieval Endpoint
* **Goal**: Safely allow the Python backend to fetch and decrypt a tenant's Twilio credentials.
* **Endpoint Path**: `GET /api/v1/internal/credentials/:businessId` (Inside Next.js)
* **Security Controls**:
  * **Signature Header**: Enforce the `X-Internal-Secret` header in Next.js middleware, checking against the `INTERNAL_SECRET` env variable.
  * Reject any unauthorized, non-internal requests immediately with a 401.
  * Decrypt and return credentials over a secure JSON payload containing `account_sid`, `auth_token`, and `phone_number`.""",

    "campaign launch routing": """### Technical Implementation: Campaign Launcher Status Transition
* **Goal**: Stop running mock calls immediately and queue the campaign for live dial processing.
* **Route Path**: `POST /api/v1/campaigns/:id/launch`
* **Workflow**:
  * Modify Next.js API to set campaign `status` to `scheduled` instead of running `calling-mock.ts`.
  * Ensure all calls in the campaign are created with `status: 'queued'` and `channel_type: 1` (Live Twilio).""",

    "python cron poller": """### Technical Implementation: Python Poller & Scheduler
* **Goal**: A background poller that monitors scheduled campaigns and initiates dialing.
* **Workflow**:
  * Implement an async background worker in FastAPI that wakes up every 10 seconds.
  * Query the database for campaigns with status `scheduled`.
  * Transition matched campaigns to `running`.""",

    "dialer core": """### Technical Implementation: Twilio Outbound Dialer
* **Goal**: Programmatically initiate real outbound calls over the PSTN.
* **Implementation**:
  * Fetch and decrypt the tenant's Twilio credentials from the internal Next.js endpoint.
  * Use the Twilio Python SDK to call `client.calls.create`.
  * Point the call's webhook to our TwiML callback endpoint: `POST /api/v1/voice/twiml`.""",

    "concurrency limit": """### Technical Implementation: Dialer Concurrency Guards
* **Goal**: Avoid outbound rate-limit errors and control API costs.
* **Implementation**:
  * Implement an `asyncio.Semaphore(5)` per campaign execution block.
  * Ensure no more than 5 outbound calls are launched simultaneously.
  * Queue further numbers until active lines clear.""",

    "twiml endpoint": """### Technical Implementation: Base TwiML Endpoint
* **Goal**: Respond to Twilio's webhook and instruct it on how to handle the answered call.
* **Endpoint Path**: `POST /api/v1/voice/twiml`
* **TwiML Response**:
  * Initially, return a simple static message:
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Hello, this is a test from Receptify.</Say></Response>`
  * In Step 3, swap this to connect the live WebSocket audio stream.""",

    "signature verification": """### Technical Implementation: Twilio Signature Validation
* **Goal**: Prevent malicious users from spoofing Twilio call webhooks and modifying call logs.
* **Implementation**:
  * Use the Twilio SDK `RequestValidator` to validate the `X-Twilio-Signature` header.
  * Use the tenant's decrypted Twilio Auth Token as the validation secret.
  * Correctly handle Nginx proxy headers (X-Forwarded-Proto, X-Forwarded-Host) to reconstruct the exact URL.""",

    "call status webhook": """### Technical Implementation: Twilio Call Status Callback
* **Goal**: Handle status callbacks (e.g. busy, no-answer, completed) from Twilio to keep database metrics aligned.
* **Endpoint Path**: `POST /api/v1/voice/status`
* **Workflow**:
  * Parse incoming body parameters (`CallStatus`, `CallDuration`, `CallSid`).
  * Update the corresponding `Call` record with final duration and outcome.
  * Log the final transition event to `call_events`.""",

    "twiml stream": """### Technical Implementation: WebSocket Audio Stream Setup
* **Goal**: Establish the low-latency streaming connection between Twilio and our AI.
* **TwiML Change**: Modify the answered call TwiML response to:
  ```xml
  <Response>
    <Connect>
      <Stream url="wss://<your-domain>/api/v1/voice/stream/{call_id}" />
    </Connect>
  </Response>
  ```
* **Payload**: Instructs Twilio to stream raw 8000Hz G.711 mu-law audio packets over WebSockets.""",

    "websocket handler": """### Technical Implementation: FastAPI WebSocket Connection Loop
* **Goal**: Stream raw binary audio from Twilio into our Python AI core.
* **Endpoint Path**: `WS /api/v1/voice/stream/{call_id}`
* **Workflow**:
  * Accept the WebSocket connection.
  * Parse incoming JSON frames from Twilio (`connected`, `start`, `media`, `stop`).
  * Process binary payloads (the G.711 mu-law sound bytes) and forward them to our STT stream.""",

    "deepgram stt": """### Technical Implementation: Live Deepgram STT Stream
* **Goal**: Turn user speech into text in real time with sub-100ms latency.
* **Implementation**:
  * Open a persistent WebSocket streaming client connection to Deepgram.
  * Stream incoming Twilio mu-law audio packets directly to Deepgram.
  * Handle incoming transcripts asynchronously, passing finalized sentences to our LLM pipeline.""",

    "claude llm": """### Technical Implementation: Claude LLM Conversation Engine
* **Goal**: Generate high-quality, contextual receptionist responses dynamically.
* **Implementation**:
  * Use Claude 3.5 Sonnet to stream response tokens.
  * Supply the campaign's custom script text as the system instructions.
  * Feed finalized STT transcripts into the prompt history and stream the output tokens to our TTS engine.""",

    "barge-in": """### Technical Implementation: Barge-In Detection Logic
* **Goal**: Allow users to interrupt the AI when speaking.
* **Implementation**:
  * Monitor the incoming STT transcript stream for active speech.
  * If the user speaks while the AI is talking, immediately cancel any ongoing LLM and TTS streaming tasks, and flush the Twilio playback buffer.""",

    "elevenlabs": """### Technical Implementation: ElevenLabs TTS Stream
* **Goal**: Turn Claude's text into high-quality, professional Indian-accented speech.
* **Implementation**:
  * Establish a WebSocket stream with ElevenLabs.
  * Pipe Claude's token outputs directly to ElevenLabs.
  * Request direct `ulaw_8000` (mu-law 8kHz) audio format to match Twilio's expectation directly, skipping heavy transcoding logic.""",

    "playback sync": """### Technical Implementation: Audio Playback Synchronization
* **Goal**: Coordinate text-to-speech outputs back to the Twilio call.
* **Implementation**:
  * Send audio packets back to Twilio as binary JSON media frames over the active WebSocket.
  * Coordinate with Twilio's `mark` events to manage turns and guarantee clear playback without gaps.""",

    "multi-tenant isolation": """### Technical Implementation: Multi-Tenant Verification
* **Goal**: Ensure that parallel campaigns for separate businesses execute with absolute boundary isolation.
* **Details**:
  * Isolate database pools and session credentials.
  * Ensure WebSocket handlers for distinct call IDs remain strictly contained and cannot leak memory or state.""",

    "mid-call hangup": """### Technical Implementation: Active Task Cancellation
* **Goal**: Instantly stop APIs when a user hangs up to control costs.
* **Details**:
  * Catch the Twilio `stop` socket event.
  * Instantly cancel all active async tasks (Deepgram, Claude, ElevenLabs).
  * Safely close all external WebSocket connections.""",

    "recording downloader": """### Technical Implementation: Twilio Recording Downloader
* **Goal**: Store full call recordings in our database.
* **Details**:
  * Fetch the final recording URL from Twilio's status callbacks.
  * Save a reference to the recording in `call_recordings` to allow web playback.""",

    "server-sent events": """### Technical Implementation: SSE Real-Time Updates API
* **Goal**: Feed real-time transcriptions and call states directly to the frontend.
* **Route Path**: `GET /api/v1/campaigns/:id/live-updates` (Next.js)
* **Details**:
  * Keep an open HTTP connection using Server-Sent Events.
  * Stream live call status changes and transcript text to connected clients.""",

    "dashboard real-time": """### Technical Implementation: Dashboard Live Sync
* **Goal**: Build an "active control room" visual inside the campaign details page.
* **Details**:
  * Connect to our SSE endpoint when a campaign is running.
  * Render live animated call cards showing active conversations and live-updated chat bubbles.""",

    "call detail audio": """### Technical Implementation: Audio Player Component
* **Goal**: Play the actual call conversation in the Call Details page.
* **Path**: `src/app/(app)/calls/[id]/page.tsx`
* **Details**:
  * Integrate an elegant audio wave player utilizing the recording URL.
  * Link transcripts directly with audio player timestamps where possible.""",

    "nginx routing": """### Technical Implementation: Production Reverse Proxy Rules
* **Goal**: Correctly route standard HTTP traffic vs real-time WebSockets in production.
* **Configuration**:
  * Route `wss://<domain>/api/v1/voice/stream/*` directly to our Python FastAPI server.
  * Route `/api/v1/voice/*` to FastAPI.
  * Route all other API and webpage traffic to the Next.js server.""",

    "security hardening": """### Technical Implementation: Security Hardening & Pen-testing
* **Goal**: Rigorously verify that credentials cannot be accessed or compromised.
* **Verification Steps**:
  * Test credential decryption under a rotated `ENCRYPTION_KEY`.
  * Validate that cross-tenant access requests return a strict 403 Forbidden.""",

    "bilingual dialect": """### Technical Implementation: Hinglish & Voice Tone Optimization
* **Goal**: Ensure high conversational success with Indian SME customers.
* **Details**:
  * Optimize LLM prompts to seamlessly understand and respond in Hinglish (mixed English and Hindi).
  * Fine-tune ElevenLabs similarity and latency settings for clear vocal playback over PSTN."""
}

def clean_title(title):
    # Strip markdown bolding and trim
    title = re.sub(r'\*\*|\[ \]', '', title)
    return title.strip()

def get_detailed_description(summary_text, default_desc):
    # Match key phrases in task summaries to fetch detailed technical guides
    summary_lower = summary_text.lower()
    for key, detail in TECHNICAL_DETAILS.items():
        if key in summary_lower:
            return detail
    return default_desc

def create_issue(fields):
    payload = { 'fields': fields }
    req = urllib.request.Request(
        f'{JIRA_URL}/rest/api/2/issue',
        data=json.dumps(payload).encode('utf-8'),
        headers=headers
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        if hasattr(e, 'read'):
            err_details = e.read().decode('utf-8')
            print(f"Error creating issue '{fields.get('summary')}': {err_details}")
            raise Exception(err_details)
        else:
            print(f"Error: {e}")
            raise e

def parse_and_create_tickets():
    plan_path = 'memory/PHASE_2_1_WEEKLY_PLAN.md'
    if not os.path.exists(plan_path):
        print(f"Error: Phase weekly plan file not found at '{plan_path}'")
        return

    with open(plan_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split contents by weeks (## headings)
    weeks = re.split(r'\n## ', content)
    
    print("Starting automatic Jira ticket generation on project KAN...")
    
    for week_section in weeks:
        # We only care about weeks starting with a emoji or "Week"
        if not re.search(r'(Week\s+\d+|🟢|🔵|🟣|🔴|🟨)', week_section):
            continue
            
        lines = week_section.strip().split('\n')
        week_title = clean_title(lines[0])
        print(f"\nProcessing: {week_title}")
        
        # High-level overview of the week
        overview_lines = []
        exit_criteria = []
        current_list = overview_lines
        
        for l in lines[1:]:
            if l.startswith('###'):
                continue
            elif 'Exit Criteria' in l or 'Exit' in l:
                current_list = exit_criteria
            elif l.strip().startswith('* ') or l.strip().startswith('- '):
                current_list.append(l.strip())
            elif l.strip() and not l.strip().startswith('##'):
                current_list.append(l.strip())

        week_desc = f"### Goal of the week:\n" + "\n".join(overview_lines[:10]) + "\n\n"
        if exit_criteria:
            week_desc += f"### Weekly Exit Criteria:\n" + "\n".join(exit_criteria)
            
        # 1. Create main task for the Week
        week_fields = {
            'project': { 'key': PROJECT_KEY },
            'summary': week_title,
            'description': week_desc,
            'issuetype': { 'name': 'Task' }
        }
        
        print(f"Creating Parent Task: {week_title}...")
        parent_result = create_issue(week_fields)
        parent_key = parent_result.get('key')
        print(f"Created Parent Task {parent_key}!")
        
        # 2. Extract sub-tasks under this week
        subtasks_to_create = []
        current_subgroup = ""
        
        for line in lines[1:]:
            line_str = line.strip()
            if line_str.startswith('###'):
                current_subgroup = clean_title(line_str)
            elif line_str.startswith('* [ ]') or line_str.startswith('- [ ]') or line_str.startswith('* ') or line_str.startswith('- '):
                # Ensure it's a checklist item
                if '[ ]' in line_str or 'DB' in line_str or 'crypto' in line_str or 'FastAPI' in line_str or 'Settings' in line_str or 'POST' in line_str or 'GET' in line_str:
                    match = re.search(r'\*\*([^*]+)\*\*:(.*)', line_str)
                    if match:
                        item_title = match.group(1).strip()
                        item_desc = match.group(2).strip()
                    else:
                        # Fallback parsing
                        clean_item = re.sub(r'^[*\s-]+(?:\[\s*\])?\s*', '', line_str)
                        item_title = clean_item[:60] + '...' if len(clean_item) > 60 else clean_item
                        item_desc = clean_item
                    
                    subtasks_to_create.append((item_title, item_desc, current_subgroup))

        # Create Jira Subtasks
        for title, desc, subgroup in subtasks_to_create:
            full_title = f"{title}"
            subtask_desc = f"### Daily Subgroup:\n{subgroup}\n\n### Task Description:\n{desc}\n\n"
            subtask_desc = get_detailed_description(title, subtask_desc)
            
            subtask_fields = {
                'project': { 'key': PROJECT_KEY },
                'summary': full_title,
                'description': subtask_desc,
                'issuetype': { 'name': 'Subtask' },
                'parent': { 'key': parent_key }
            }
            
            print(f"  -> Creating Subtask: {full_title}...")
            sub_res = create_issue(subtask_fields)
            print(f"  -> Created Subtask {sub_res.get('key')}!")

if __name__ == '__main__':
    parse_and_create_tickets()
