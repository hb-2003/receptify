# Phase 2 — Call Retry Logic & Campaign Lifecycle Management

## Status
**Phase**: 2 (after Phase 1 frontend completion)
**Goal**: Implement campaign lifecycle controls (pause/resume/cancel/duplicate), call retry logic with exponential backoff, and scheduled campaign auto-launcher.

---

## Background & Context

### From `docs/features/bulk-calling-platform-spec.md`

**Section 10 (Feature Summary) — Retry & failure handling:**
- Retry on no-answer/busy/failed
- Configurable attempt count, delay between retries
- Auto-skip after repeated failures

**Section 7 (Campaign Creation Flow):**
- Stage 5 defines `retry_attempts`, `delay_between_calls`, `calling_window`
- Stage 10 covers "Review & launch" with options: save as draft, schedule, launch immediately
- Stage 11 covers "Monitor campaign" with retry queue visibility

### Research Findings (Best Practices)

**Twilio Retry Strategy** (source: Twilio Help Center):
- Retry on HTTP **429** (rate limit), **500**, **502**, **503**, **504** — these are transient
- Do NOT retry on HTTP 400, 401, 403, 404, 405, 422 — these are permanent failures
- Use **exponential backoff**: 1s, 2s, 4s, 8s… capped at a maximum
- Always respect `Retry-After` header for HTTP 429 responses
- Maximum retries: 3–5 attempts is the common recommendation

**No-Answer Handling** (source: Twilio Developer Blog):
- Twilio call statuses: `busy`, `no-answer`, `canceled`, `failed` are "bad" statuses for retry purposes
- `StatusCallback` webhook fires with `CallStatus` parameter for each event
- Use `StatusCallbackEvent: ["initiated", "ringing", "answered", "completed"]` to capture all state transitions

**Webhook Idempotency** (source: codehooks.io integration guide):
- Use `CallSid` or `MessageSid` as idempotency keys — Twilio may retry failed webhooks
- Return HTTP 200–299 for success; Twilio won't retry
- Return 4xx/5xx triggers Twilio retries with exponential backoff
- **15-second timeout** — respond within 100–500ms, defer heavy processing

**General Retry Pattern Reference** (sources: OpenReplay blog, Medium):
- `setTimeout` + `clearTimeout` in `useEffect` cleanup is the standard JavaScript debounce pattern
- `useInterval` with `null` delay pattern is the standard for pausing intervals
- Page Visibility API (`document.hidden`) should be used to pause polling when tab is hidden

---

## Current Codebase State

### Models

**`Campaign` model** (`backend/campaigns/models.py`):
- `status`: CharField, default `'draft'`, values: `draft`, `scheduled`, `running`, `completed`, `failed`, `paused`, `canceled`, `canceling`
- `retry_attempts`: IntegerField, default `2`
- `delay_between_calls`: IntegerField, default `5` (minutes)
- `scheduled_at`: DateTimeField, nullable
- `total_contacts`, `calls_completed`, `calls_answered`, `calls_failed`: IntegerFields

**`Call` model** (`backend/calls/models.py`):
- `status`: CharField, default `'queued'`, values: `queued`, `ringing`, `failed`, `completed`
- `outcome`: CharField, default `'pending'`
- `attempt_number`: IntegerField, default `0`
- `started_at`, `ended_at`: DateTimeField, nullable

### Current Dialer Flow (`backend/campaigns/dialer.py`)

1. `run_live_campaign_dialer(campaign_id)` — entry point called via `threading.Thread` from `CampaignLaunchView.post()`
2. Acquires campaign lock via `select_for_update(nowait=True)`, transitions `scheduled → running`
3. Loads Twilio credentials, fetches queued calls
4. Dispatches `dial_customer()` for each call via `asyncio.gather()` with `Semaphore(5)`
5. `dial_customer()`: checks TRAI compliance window, DND scrubbing, makes Twilio API POST
6. After all calls dispatched: sets campaign status to `completed`

### Current Launch Flow (`backend/campaigns/views.py`, `CampaignLaunchView`)

1. Validates campaign is `draft` → sets `status='scheduled'`, `channel_type=1` (Live Twilio)
2. Resolves audience via `compile_filters_to_q()`, creates `Call` records via `bulk_create`
3. Deducts business `call_credits`
4. Spawns `threading.Thread(target=run_live_campaign_dialer, args=(campaign.id,))`

### Current Frontend (`frontend/src/app/(app)/campaigns/[id]/page.tsx`)

1. Polls `/api/campaigns/{id}` every 2000ms via `setInterval`
2. Shows "Launch campaign" button only when `c.status === 'draft'`
3. StatusBadge shows `c.status` value

---

## Phase 2 Features

### 2.1 — Call Retry Logic in Dialer

**File**: `backend/campaigns/dialer.py`
**Function**: `dial_customer()` call — extend the existing Twilio API POST block

**Decision**: Retry on Twilio API-level failures (HTTP 429, 500, 502, 503, 504) only at call-setup time. Retry on Twilio `CallStatus` of `busy`, `no-answer`, `failed`, `canceled` — captured via `StatusCallback` webhook (future enhancement; Phase 2 focuses on setup-time retries).

**Implementation**:

1. When Twilio API POST fails with retryable status code:
   - Check `call.attempt_number < campaign.retry_attempts`
   - Increment `call.attempt_number`
   - Schedule retry with exponential backoff: `delay = campaign.delay_between_calls * (2 ** attempt_number)` minutes, capped at 60 minutes
   - Queue retry call for a scheduled retry processor (future)
2. When Twilio API POST fails with non-retryable status code:
   - Mark `call.status = 'failed'`, `call.outcome = 'failed'`, set `call.notes` with error details
3. After max retries exhausted, skip the customer (auto-skip after repeated failures)

**Model updates needed**:
- Add `next_retry_at` DateTimeField to `Call` model (nullable)
- Add `max_retries` tracking (already have `attempt_number`, `retry_attempts` on Campaign)

**Test plan**:
- Test that `attempt_number` increments on retryable failures
- Test that non-retryable failures mark call as failed immediately
- Test that exponential backoff calculation is correct
- Test that auto-skip kicks in after `retry_attempts` exhausted

### 2.2 — Campaign Lifecycle Endpoints

#### `POST /api/campaigns/{id}/pause` — Pause a running campaign

**File**: `backend/campaigns/views.py` — new `CampaignPauseView` class
**File**: `backend/campaigns/urls.py` — add `path('<uuid:id>/pause', ...)`

**Logic**:
- Only valid when `campaign.status == 'running'` → set to `'paused'`
- Set all `Call` records with `status='queued'` to `status='paused'`
- Return 400 if campaign is not running
- Return 200 with updated campaign data

#### `POST /api/campaigns/{id}/resume` — Resume a paused campaign

**File**: `backend/campaigns/views.py` — new `CampaignResumeView` class
**File**: `backend/campaigns/urls.py` — add `path('<uuid:id>/resume', ...)`

**Logic**:
- Only valid when `campaign.status == 'paused'` → set to `'scheduled'`
- Set all `Call` records with `status='paused'` back to `status='queued'`
- Re-spawn dialer thread via `threading.Thread(target=run_live_campaign_dialer, args=(campaign.id,))`
- Validate TRAI compliance window before resuming (if outside window, keep as `paused`)
- Return 200 with updated campaign data

#### `POST /api/campaigns/{id}/cancel` — Cancel a campaign

**File**: `backend/campaigns/views.py` — new `CampaignCancelView` class
**File**: `backend/campaigns/urls.py` — add `path('<uuid:id>/cancel', ...)`

**Logic**:
- Valid when status is `draft`, `scheduled`, `running`, or `paused` → set to `'canceled'`
- Terminal states (`completed`, `failed`, `canceled`) cannot be canceled (return 400)
- Set all `Call` records with non-terminal status to `status='canceled'`
- Return 200 with updated campaign data

#### `POST /api/campaigns/{id}/duplicate` — Duplicate a draft campaign

**File**: `backend/campaigns/views.py` — new `CampaignDuplicateView` class
**File**: `backend/campaigns/urls.py` — add `path('<uuid:id>/duplicate', ...)`

**Logic**:
- Copy campaign name, purpose, voice_type, language, script_text, retry_attempts, delay_between_calls, calling_window, schedule, etc.
- New campaign gets `name = "Copy of {original_name}"`, `status='draft'`
- Duplicate all `CampaignFilterGroup` + `CampaignFilterRule` records (foreign keys point to new campaign)
- Do NOT copy Call records, calls_completed, calls_answered, etc. (reset to 0)
- Return 201 with serialized new campaign data

**Frontend updates** (`frontend/src/app/(app)/campaigns/[id]/page.tsx`):
- Add pause/resume/cancel/duplicate buttons based on `c.status`
- Pause button visible when `c.status === 'running'`
- Resume button visible when `c.status === 'paused'`
- Cancel button visible when `c.status` is in `['scheduled', 'running', 'paused']`
- Duplicate button visible when `c.status === 'draft'` (or always visible except terminal states)
- Update `useSmartPolling` to increase poll interval when campaign reaches terminal state (`completed`, `failed`, `canceled`)

### 2.6 — Scheduled Campaign Auto-Launcher

**File**: `backend/campaigns/management/commands/launch_scheduled.py` — new management command
**File**: `backend/campaigns/dialer.py` — expose `is_campaign_launchable()` helper

**Logic**:
- Query all campaigns where `status='scheduled' AND scheduled_at <= now()`
- For each: validate Twilio credentials exist, validate TRAI compliance window
- If outside TRAI window: set `status='scheduled'` (wait, keep scheduled_at)
- If credentials missing: set `status='failed'`, `notes='Missing Twilio credentials'`
- If all checks pass: spawn `threading.Thread(target=run_live_campaign_dialer, args=(campaign.id,))`
- Command output: log each campaign transition

**Deployment**:
- Add to AGENTS.md as `python manage.py launch_scheduled` run via cron every minute
- Cron entry: `* * * * * cd /app && python manage.py launch_scheduled >> /var/log/receptify/scheduler.log 2>&1`

**Test plan**:
- Test that scheduled campaigns with `scheduled_at` in the past get launched
- Test that scheduled campaigns with `scheduled_at` in the future are NOT launched
- Test that TRAI compliance check pauses launches outside calling window
- Test that missing credentials cause campaign to fail

---

## API Design

All new endpoints follow existing patterns: APIView with `CookieJWTAuthentication`, `BusinessSharedPermission`, camelCase responses.

| Method | Endpoint | Status Transition | Allowed Current Status |
|---|---|---|---|
| POST | `/api/campaigns/{id}/pause` | `running → paused` | `running` |
| POST | `/api/campaigns/{id}/resume` | `paused → scheduled` | `paused` |
| POST | `/api/campaigns/{id}/cancel` | `* → canceled` | `draft`, `scheduled`, `running`, `paused` |
| POST | `/api/campaigns/{id}/duplicate` | `(new) → draft` | any |
| GET | `/api/campaigns/{id}` | (status change detection triggers poll interval change) | n/a |

---

## Frontend Changes Summary (`frontend/src/app/(app)/campaigns/[id]/page.tsx`)

| Status | Visible Actions |
|---|---|
| `draft` | Launch, Duplicate |
| `scheduled` | Cancel |
| `running` | Pause, Cancel |
| `paused` | Resume, Cancel |
| `completed` / `failed` / `canceled` | Duplicate (new draft from this) |

Poll interval logic:
- `running` / `paused`: poll every 2000ms
- `scheduled`: poll every 5000ms (checking for auto-launch)
- `completed` / `failed` / `canceled`: stop polling (return `null` from `useSmartPolling`)

---

## Test Coverage Plan

### Backend (Django test cases in `backend/campaigns/tests.py`)

1. **Retry logic tests** (`TestCallRetryLogic`):
   - `test_retryable_failure_increments_attempt_number`
   - `test_non_retryable_failure_marks_failed_immediately`
   - `test_exponential_backoff_calculation`
   - `test_max_retries_auto_skip`

2. **Campaign pause tests** (`TestCampaignPause`):
   - `test_pause_running_campaign` — status `running → paused`
   - `test_pause_draft_campaign_returns_400` — cannot pause draft
   - `test_pause_sets_queued_calls_to_paused`

3. **Campaign resume tests** (`TestCampaignResume`):
   - `test_resume_paused_campaign` — status `paused → scheduled`
   - `test_resume_running_campaign_returns_400`
   - `test_resume_unpauses_queued_calls`

4. **Campaign cancel tests** (`TestCampaignCancel`):
   - `test_cancel_running_campaign`
   - `test_cancel_completed_campaign_returns_400` — terminal state
   - `test_cancel_sets_active_calls_to_canceled`

5. **Campaign duplicate tests** (`TestCampaignDuplicate`):
   - `test_duplicate_creates_new_draft` — name prefixed with "Copy of"
   - `test_duplicate_copies_filter_groups`
   - `test_duplicate_resets_call_metrics`

6. **Scheduled launcher tests** (`TestScheduledLauncher`):
   - `test_scheduled_campaign_launches_when_due`
   - `test_future_scheduled_campaign_not_launched`
   - `test_trailing_campaign_stays_scheduled_if_outside_trafi_window`

### Frontend (if Phase 1 wizard tests exist — check `frontend/src/app/(app)/campaigns/[id]/`)

- Verify action buttons render per status
- Verify polling stops on terminal states

---

## Implementation Order

1. Create `docs/plans/phase_2_retry_and_lifecycle.md` (this document)
2. Add `next_retry_at` field to `Call` model + migration
3. Implement retry logic in `dial_customer()` within `campaigns/dialer.py`
4. Implement `CampaignPauseView`, `CampaignResumeView`, `CampaignCancelView`, `CampaignDuplicateView` in `campaigns/views.py`
5. Add URL routes in `campaigns/urls.py`
6. Create `campaigns/management/commands/launch_scheduled.py`
7. Update frontend `[id]/page.tsx` with action buttons + poll interval logic
8. Write tests in `campaigns/tests.py`
9. Run `python manage.py makemigrations` + `migrate`
10. Run full test suite: `python manage.py test customers calls campaigns llm receptify --noinput`
11. Run pyflakes on modified Python files
12. Commit and push to `feature/phase-2-retry-and-lifecycle`

---

## Out of Scope for Phase 2

- StatusCallback-based retry (when Twilio reports `busy`, `no-answer` via webhook — requires additional webhook endpoint work)
- Rate limiting (API key throttling) — future Phase
- Sentry error tracking — future Phase
- Pagination on campaign list — future Phase
- Webhook signature validation is already in place (`calls/views_twilio.py`), no changes needed
