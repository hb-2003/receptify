# Receptify Campaign System — Step-Wise Implementation Plan

> **Created:** 2026-07-17  
> **Branch:** `feature/KAN-26-dynamic-audience-builder`  
> **Status:** Planning  
> **Estimated Total Effort:** ~40-50 hours across all phases

---

## Phase 0: Critical Bug Fixes (Ship Blockers)
**Priority:** 🔴 IMMEDIATE | **Effort:** ~2 hours | **Risk if skipped:** Data corruption, server crashes, wrong audiences

### Step 0.1 — Fix `custom_fields` double-encoding
- **File:** `backend/customers/views.py` (lines 120, 136, 194, 290)
- **Bug:** `json.dumps()` called before saving to Django `JSONField` — double-encodes as `"{\"k\":\"v\"}"` string instead of `{"k": "val"}` JSON object
- **Impact:** Breaks ALL JSONB filter queries on custom fields
- **Fix:** Remove `json.dumps()` calls. Pass raw `dict` directly — Django `JSONField` handles serialization automatically
- **Changes:**
  - Line 120: `custom_fields_str = json.dumps(custom_fields)` → `custom_fields_val = custom_fields if isinstance(custom_fields, dict) else None`
  - Line 136: Pass `custom_fields=custom_fields_val` (not `custom_fields_str`)
  - Line 194: Same pattern in PATCH handler
  - Line 290: Same pattern in CSV upload handler
- **Test:** Create customer with `custom_fields={"lead_score": 85}`, then filter with `custom_fields.lead_score GREATER_THAN 80` — should match

### Step 0.2 — Fix `logic_operator` None crash
- **File:** `backend/customers/views.py` (line 354)
- **Bug:** `group_data.get('logic_operator', 'AND').upper()` — if key exists with value `None`, `.get()` returns `None`, `None.upper()` → `AttributeError`
- **Fix:** Change to:
  ```python
  logic_operator = (group_data.get('logic_operator') or group_data.get('logicOperator') or 'AND').upper()
  ```
- **Test:** Send `{"logic_operator": null}` in filter group payload — should default to AND, not crash

### Step 0.3 — Reject unknown field names in filter compiler
- **File:** `backend/customers/views.py` (lines 362-420)
- **Bug:** Unknown `field_name` produces empty `Q()` which matches ALL customers silently
- **Fix:** Add validation — if `field_name` doesn't match any known field and doesn't start with `custom_fields.`, skip the rule (or raise error)
- **Changes:** Add an `else` clause at the end of the if/elif chain:
  ```python
  else:
      continue  # Skip unknown fields instead of matching everything
  ```
- **Test:** Send `{"field_name": "nonexistent_field", "operator": "EQUALS", "value": "x"}` — should return 0 matches, not all customers

### Step 0.4 — Fix dialer hardcoded callback URL
- **File:** `backend/campaigns/dialer.py` (lines 74-75)
- **Bug:** `twiml_callback` and `status_callback` hardcoded to `https://receptify.in/...`
- **Fix:** Use `config('PUBLIC_APP_URL')` like `utils_twilio.py` already does:
  ```python
  from decouple import config
  base_url = config('PUBLIC_APP_URL', default='https://receptify.in')
  twiml_callback = f"{base_url}/api/calls/{call.id}/twiml"
  status_callback = f"{base_url}/api/calls/{call.id}/status"
  ```
- **Test:** Set `PUBLIC_APP_URL=https://abc123.ngrok.io` in `.env`, launch campaign — webhook URLs should use ngrok domain

### Step 0.5 — Fix "Launch" from Step 8 creating draft instead of launching
- **File:** `backend/campaigns/views.py` (line 84) + `frontend/src/app/(app)/campaigns/new/page.tsx`
- **Bug:** Frontend sends `status: 'scheduled'` but backend hardcodes `status='draft'` and ignores it
- **Fix (Option A — Backend):** After creating the campaign, if the request includes `complianceConfirmed: true` and a `scheduledAt`, keep it as draft but auto-trigger the launch flow
- **Fix (Option B — Frontend):** After successful create (returns campaign ID), immediately call `POST /api/campaigns/{id}/launch` if user clicked "Launch Campaign"
- **Recommended:** Option B — cleaner separation. Frontend does:
  ```typescript
  const res = await fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) });
  const { campaign } = await res.json();
  if (statusOverride === 'scheduled') {
    await fetch(`/api/campaigns/${campaign.id}/launch`, { method: 'POST' });
  }
  ```

---

## Phase 1: Complete Core Campaign Flows
**Priority:** 🟡 HIGH | **Effort:** ~10-12 hours | **Goal:** Full CRUD + working voice + working test call

### Step 1.1 — Wire `voice_type` to TwiML (1 hour)
- **File:** `backend/calls/views_twilio.py` (line 98)
- **Problem:** Always uses `voice="alice"` regardless of campaign voice setting
- **Changes:**
  1. Add voice mapping dict:
     ```python
     VOICE_MAP = {
         'female_professional': 'Polly.Aditi',
         'female_friendly': 'Polly.Kajal',
         'male_professional': 'Polly.Amit',
         'male_friendly': 'Polly.Amit',
     }
     ```
  2. In `TwilioCallTwiMLView.post()`:
     ```python
     voice_id = VOICE_MAP.get(call.campaign.voice_type, 'Polly.Aditi')
     f'<Say voice="{voice_id}">{escaped_script}</Say>'
     ```
- **Result:** User's voice selection in Step 4 actually affects the call voice

### Step 1.2 — Add Campaign PATCH endpoint (2-3 hours)
- **File:** `backend/campaigns/views.py` — add `patch()` method to `CampaignDetailView`
- **Scope:** Only allow editing `draft` campaigns
- **Editable fields:** `name`, `purpose`, `language`, `voice_type`, `script_text`, `scheduled_at`, `calling_window_start`, `calling_window_end`, `retry_attempts`, `delay_between_calls`
- **Also handle:** Updating `filterGroups` — delete existing groups/rules, recreate from new payload
- **Validation:** Reject PATCH if `campaign.status != 'draft'`
- **Frontend:** Add "Edit Campaign" button on detail page → navigate to edit form (can reuse wizard components)

### Step 1.3 — Return filter groups in Campaign Detail API (30 min)
- **File:** `backend/campaigns/views.py` — `CampaignDetailView.get()`
- **Changes:** Serialize and return `filter_groups` with nested `rules`:
  ```python
  filter_groups = campaign.filter_groups.all()
  filter_groups_data = []
  for g in filter_groups:
      filter_groups_data.append({
          'id': str(g.id),
          'logic_operator': g.logic_operator,
          'rules': [{'field_name': r.field_name, 'operator': r.operator, 'value': r.value} for r in g.rules.all()]
      })
  # Include in response
  'filterGroups': to_camel_case(filter_groups_data)
  ```
- **Frontend:** Display audience rules on campaign detail page

### Step 1.4 — Create test-call backend endpoint (1-2 hours)
- **File:** `backend/calls/views.py` or `backend/calls/views_twilio.py`
- **Route:** `POST /api/calls/test-call`
- **Logic:**
  1. Validate user is authenticated and has Twilio credentials
  2. Accept `{ phoneNumber, scriptText }`
  3. Place a single Twilio call to the given phone number
  4. Use `<Say>` with the provided script text
  5. Don't create a Campaign — just a standalone test Call record
- **Frontend:** Step 7 already has the UI, just needs a working backend

### Step 1.5 — Add debounce to audience preview fetch (15 min)
- **File:** `frontend/src/app/(app)/campaigns/new/page.tsx`
- **Changes:** Add 300ms debounce before calling `triggerPreviewFetch()`:
  ```typescript
  const debounceTimer = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (audienceMode === 'rules' && step === 2) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(triggerPreviewFetch, 300);
    }
    return () => clearTimeout(debounceTimer.current);
  }, [filterGroups, audienceMode, step]);
  ```

### Step 1.6 — Fix voice preview template mismatch (15 min)
- **File:** `frontend/src/app/(app)/campaigns/new/page.tsx`
- **Bug:** Voice preview looks for `{{fullName}}` but script editor uses `[Customer Name]`
- **Fix:** Update the voice preview's variable replacement to use `[bracket]` syntax matching the editor

### Step 1.7 — Smart polling on campaign detail page (30 min)
- **File:** `frontend/src/app/(app)/campaigns/[id]/page.tsx`
- **Changes:** Poll based on campaign status:
  - `running` → 2s interval (current)
  - `scheduled` → 10s interval
  - `draft` / `completed` / `failed` → no polling
- **Also:** Clear interval on unmount

---

## Phase 2: Call Retry & Campaign Lifecycle
**Priority:** 🟡 HIGH | **Effort:** ~8-10 hours | **Goal:** Retry failed calls + pause/resume/cancel

### Step 2.1 — Implement call retry logic (3-4 hours)
- **File:** `backend/campaigns/dialer.py`
- **Problem:** `campaign.retry_attempts` and `delay_between_calls` are stored but never used
- **Changes:**
  1. After all calls complete in `run_live_campaign_dialer_async`, check for failed calls:
     ```python
     failed_calls = Call.objects.filter(campaign_id=campaign_id, status='failed', outcome__in=['no_answer', 'busy'])
     ```
  2. For each failed call where `attempt_number < campaign.retry_attempts`:
     - Wait `campaign.delay_between_calls * 60` seconds
     - Reset `status='queued'`, increment `attempt_number`
     - Re-dial using the same `dial_customer()` function
  3. After all retries exhausted, mark campaign as `completed`
- **Edge case:** Don't retry `blocked` (NDNC) or `canceled` calls — only `no_answer` and `busy`

### Step 2.2 — Add campaign pause endpoint (1 hour)
- **Route:** `POST /api/campaigns/{id}/pause`
- **Logic:**
  1. Validate campaign is `running`
  2. Set `campaign.status = 'paused'`
  3. The dialer should check campaign status before each `dial_customer()` call and stop if paused
- **Dialer change:** Add status check inside the dialing loop:
  ```python
  campaign.refresh_from_db()
  if campaign.status == 'paused':
      return  # Stop dialing, don't mark as completed
  ```

### Step 2.3 — Add campaign resume endpoint (1 hour)
- **Route:** `POST /api/campaigns/{id}/resume`
- **Logic:**
  1. Validate campaign is `paused`
  2. Set `campaign.status = 'scheduled'`
  3. Re-spawn dialer thread for remaining `queued` calls
- **Frontend:** Add pause/resume buttons on campaign detail page

### Step 2.4 — Add campaign cancel endpoint (1 hour)
- **Route:** `POST /api/campaigns/{id}/cancel`
- **Logic:**
  1. Validate campaign is `running` or `paused` or `scheduled`
  2. Set `campaign.status = 'canceled'`
  3. Mark all remaining `queued` calls as `status='canceled'`
  4. Refund unused call credits:
     ```python
     unused_count = Call.objects.filter(campaign_id=id, status='canceled').count()
     business.call_credits = F('call_credits') + unused_count
     ```

### Step 2.5 — Add campaign duplicate endpoint (1 hour)
- **Route:** `POST /api/campaigns/{id}/duplicate`
- **Logic:** Create new campaign with same `name + " (Copy)"`, `purpose`, `script_text`, `voice_type`, `language`, filter groups/rules. Status = `draft`

### Step 2.6 — Scheduled campaign auto-launcher (2-3 hours)
- **Problem:** `scheduled_at` is stored but nothing triggers launch at that time
- **Options:**
  - **Option A (Simple):** Django management command + cron job — `python manage.py launch_scheduled_campaigns` runs every minute
  - **Option B (Better):** Celery beat periodic task
- **Logic:**
  ```python
  campaigns = Campaign.objects.filter(status='draft', scheduled_at__lte=timezone.now())
  for campaign in campaigns:
      # Trigger same logic as CampaignLaunchView
  ```

---

## Phase 3: Voice & TTS Pipeline
**Priority:** 🔵 MEDIUM | **Effort:** ~8-10 hours | **Goal:** Real human-quality voice on calls

### Step 3.1 — Quick win: Twilio Polly voices (Done in Step 1.1)
- Already covered in Phase 1
- Maps `voice_type` → Twilio `Polly.Aditi` / `Polly.Kajal` / `Polly.Amit`
- Quality: ★★★☆☆ (good Indian English, neural voices)

### Step 3.2 — Wire Google Cloud TTS adapter (4-6 hours)
- **Files:** `backend/calls/tts_adapter.py` (already built), `backend/calls/views_twilio.py`
- **Flow:**
  1. When TwiML webhook fires (customer answers), synthesize the script via Google Cloud TTS
  2. Upload generated audio to GCS bucket (or serve via streaming endpoint)
  3. Return `<Play url="https://storage.googleapis.com/...">` TwiML instead of `<Say>`
- **Changes needed:**
  - Create `POST /api/calls/{id}/tts-audio` endpoint that generates + caches audio
  - Modify `TwilioCallTwiMLView` to return `<Play>` pointing to the audio URL
  - Map `voice_type` → Google Cloud TTS voice names:
    ```python
    GCLOUD_VOICE_MAP = {
        'female_professional': 'en-IN-Neural2-A',
        'female_friendly': 'en-IN-Neural2-D',
        'male_professional': 'en-IN-Neural2-B',
        'male_friendly': 'en-IN-Neural2-C',
    }
    ```
- **Caching:** Generate audio once per campaign script + voice combo, cache URL for all calls
- Quality: ★★★★☆ (natural, Indian-accented neural voice)

### Step 3.3 — Frontend TTS preview via backend (2 hours)
- **Route:** `POST /api/tts/preview`
- **Logic:** Accept `{ text, voiceType }`, synthesize via Google Cloud TTS, return audio/wav
- **Frontend:** Replace browser `SpeechSynthesisUtterance` with `<audio>` element playing backend-generated audio
- **Result:** Voice preview sounds exactly like the actual call

### Step 3.4 — ElevenLabs streaming integration (Future — 2-3 days)
- **Goal:** Premium conversational AI voice via WebSocket streaming
- **Architecture:**
  1. Twilio `<Stream>` bidirectional WebSocket
  2. Django Channels or separate WebSocket server
  3. ElevenLabs API streams audio chunks back to Twilio in real-time
- **Use case:** Interactive calls with real-time customer responses (beyond simple script reading)
- **Prerequisite:** Requires Twilio Media Streams + WebSocket infrastructure

---

## Phase 4: Recording, Transcription & AI Analysis
**Priority:** 🔵 MEDIUM | **Effort:** ~6-8 hours | **Goal:** Capture, transcribe, and analyze every call

### Step 4.1 — Enable Twilio call recording (2 hours)
- **File:** `backend/campaigns/dialer.py`
- **Changes:** Add `Record=true` and `RecordingStatusCallback` to Twilio API payload:
  ```python
  payload = {
      ...
      "Record": True,
      "RecordingStatusCallback": f"{base_url}/api/calls/{call.id}/recording",
      "RecordingStatusCallbackEvent": "completed"
  }
  ```
- **New endpoint:** `POST /api/calls/{id}/recording` — webhook that Twilio calls when recording is ready
  - Download recording from Twilio
  - Upload to GCS/S3
  - Update `CallRecording.audio_url` with real URL
- **Frontend:** `calls/[id]/page.tsx` already has an audio player — just needs real URL

### Step 4.2 — Integrate Deepgram STT for transcription (2-3 hours)
- **Trigger:** After recording is saved (Step 4.1)
- **Flow:**
  1. Send audio file URL to Deepgram API
  2. Receive transcript JSON
  3. Save to `CallTranscript.text`
- **Async:** Run in background (Celery task or thread) to not block the webhook

### Step 4.3 — AI call summary generation (1-2 hours)
- **Trigger:** After transcript is saved (Step 4.2)
- **Flow:**
  1. Send transcript to Gemini/Claude API with prompt:
     > "Summarize this sales call. Include: customer sentiment, key objections, action items, call outcome."
  2. Save to `CallTranscript.summary`
- **Frontend:** `calls/[id]/page.tsx` already displays summary field

### Step 4.4 — Store Twilio Call SID (30 min)
- **File:** `backend/calls/models.py`
- **Add:** `twilio_sid = models.CharField(max_length=64, null=True, blank=True)`
- **File:** `backend/campaigns/dialer.py`
- **Save:** Extract `sid` from Twilio API response and store on Call record
- **Use:** Debug correlation with Twilio dashboard

---

## Phase 5: Production Hardening
**Priority:** 🟢 IMPORTANT | **Effort:** ~6-8 hours | **Goal:** Production-ready infrastructure

### Step 5.1 — Environment variable security (1 hour)
- Move `DEBUG`, `SECRET_KEY`, `JWT_SECRET` to env vars (no hardcoded defaults)
- Set `ALLOWED_HOSTS` from env var
- Lock down `CORS_ALLOWED_ORIGINS` to specific domains
- Rotate the existing `SECRET_KEY` and `JWT_SECRET` values

### Step 5.2 — Migrate dialer to Celery + Redis (3-4 hours)
- **Install:** `celery`, `redis`, `django-celery-beat`
- **Refactor:** Replace `threading.Thread` with `campaign_dialer.delay(campaign_id)`
- **Benefits:** Survives process restarts, retry on failure, monitoring via Flower, horizontal scaling
- **Also:** Move scheduled campaign auto-launcher to Celery Beat periodic task

### Step 5.3 — Add rate limiting (1 hour)
- **Install:** `django-ratelimit` or use DRF throttle classes
- **Apply to:**
  - Auth endpoints: 5/min per IP
  - API endpoints: 60/min per user
  - Public webhooks: 100/min per IP
  - Script generation: 10/min per user

### Step 5.4 — Add Sentry error tracking (30 min)
- **Install:** `sentry-sdk`
- **Configure:** In `settings.py` with DSN from env var
- **Result:** All unhandled exceptions captured with stack traces

### Step 5.5 — Add API pagination (1-2 hours)
- **Apply to:** Customer list, Campaign list, Call list, Call events
- **Implementation:** DRF `CursorPagination` or `PageNumberPagination`
- **Default:** 50 items per page
- **Frontend:** Add pagination controls to all list pages

### Step 5.6 — Webhook idempotency + security (1 hour)
- **Problem:** Twilio may send duplicate status callbacks
- **Fix:** Use `select_for_update()` in `TwilioCallStatusView` to prevent race conditions
- **Also:** Protect script generation endpoint with `IsAuthenticated` (currently `AllowAny`)

### Step 5.7 — Add health check endpoint (15 min)
- **Route:** `GET /api/health`
- **Logic:** Check DB connection, Redis connection (if added), return `{"status": "ok"}`

---

## Implementation Order (Recommended)

```
Week 1: Phase 0 (Bug Fixes)                    ~2 hours
        Phase 1 Steps 1.1-1.5 (Core Flows)     ~5 hours
        ─────────────────────────────────────────────────
        Milestone: Campaign create→launch works correctly
                   Voice selection works
                   Test call works

Week 2: Phase 1 Steps 1.6-1.7                  ~1 hour
        Phase 2 Steps 2.1-2.4 (Lifecycle)       ~7 hours
        ─────────────────────────────────────────────────
        Milestone: Retry logic works
                   Pause/resume/cancel works
                   Campaign edit works

Week 3: Phase 3 Steps 3.1-3.3 (Voice)          ~8 hours
        Phase 4 Steps 4.1-4.4 (Recording)      ~7 hours
        ─────────────────────────────────────────────────
        Milestone: Real Google TTS voice on calls
                   Recordings captured + transcribed
                   AI summaries generated

Week 4: Phase 5 (Production Hardening)          ~8 hours
        Phase 2 Steps 2.5-2.6 (Duplicate+Auto)  ~4 hours
        ─────────────────────────────────────────────────
        Milestone: Production-ready
                   Celery task queue
                   Security hardened
```

---

## Files Affected (Complete List)

### Backend
| File | Phases |
|------|--------|
| `customers/views.py` | 0.1, 0.2, 0.3 |
| `campaigns/views.py` | 0.5, 1.2, 1.3, 2.2, 2.3, 2.4, 2.5 |
| `campaigns/dialer.py` | 0.4, 2.1, 2.2, 4.1 |
| `calls/views_twilio.py` | 1.1, 3.2, 4.1 |
| `calls/models.py` | 4.4 |
| `calls/tts_adapter.py` | 3.2 |
| `calls/views.py` | 1.4 |
| `calls/urls.py` | 1.4, 4.1 |
| `campaigns/urls.py` | 2.2, 2.3, 2.4, 2.5 |
| `receptify/settings.py` | 5.1, 5.2, 5.3, 5.4 |

### Frontend
| File | Phases |
|------|--------|
| `campaigns/new/page.tsx` | 0.5, 1.5, 1.6 |
| `campaigns/[id]/page.tsx` | 1.3, 1.7, 2.2, 2.3, 2.4 |
| `campaigns/page.tsx` | 2.5 |
| `calls/[id]/page.tsx` | 4.1, 4.2, 4.3 |

### New Files
| File | Phase |
|------|-------|
| `backend/campaigns/management/commands/launch_scheduled.py` | 2.6 |
| `backend/receptify/celery.py` | 5.2 |
| `backend/campaigns/tasks.py` | 5.2 |

---

## Success Criteria

| Milestone | Criteria |
|-----------|----------|
| **Phase 0 done** | No server crashes on null operators, correct JSONB queries, correct webhook URLs |
| **Phase 1 done** | Voice selection audible on calls, test call works, campaign editable, preview debounced |
| **Phase 2 done** | Failed calls retried per config, campaigns pausable/resumable/cancelable |
| **Phase 3 done** | Google Cloud TTS voice on actual calls, frontend preview matches call voice |
| **Phase 4 done** | Every call has a recording + transcript + AI summary |
| **Phase 5 done** | Dialer survives restarts, rate limiting active, errors tracked, API paginated |
