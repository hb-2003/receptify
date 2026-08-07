# Bulk Calling Platform — Architecture & Decisions

*A consolidated reference for the multi-tenant AI voice calling platform: technology choices, data architecture, campaign flow, and pricing.*

---

## 1. Overview

The platform allows any business to sign up, upload or sync their customer contacts, and run fully automated AI voice calling campaigns. Each business (tenant) manages its own contacts, campaigns, and custom data fields independently.

**Scope for v1: India-first, solo/bootstrapped build.** International expansion is a deliberate later phase, not part of the initial launch — see Section 12 for the phased rollout plan.

**Core capabilities:**
- Multi-tenant contact management with business-specific custom fields
- Campaign builder covering audience targeting, AI agent configuration, retry logic, and compliance
- Fully automated outbound calling, using each business's own Twilio credentials (BYO model — see Section 3)
- Usage-based subscription billing (for platform features; calling costs are billed directly to the business by Twilio)

---

## 2. Technology Stack

**Decision: fully custom build**, rather than a managed voice-AI vendor (Bland AI / Retell / Vapi), for full control and better unit economics at scale.

| Layer | Provider | Role |
|---|---|---|
| Telephony | Twilio | Placing/receiving calls, number provisioning |
| Speech-to-text | Deepgram (Nova-3, streaming) | Real-time transcription of the caller's speech |
| Text-to-speech | ElevenLabs | Converting the AI agent's responses into natural speech |
| Conversation logic | Claude API (Anthropic) | The AI "brain" driving the conversation |
| Orchestration | Custom backend (or n8n for early prototyping) | Glues telephony, STT, LLM, and TTS together in real time |

**Rationale:** managed platforms (Bland AI, Retell, Vapi, or India-priced options like Bolna) offer faster time-to-market but cost roughly $0.09–0.20/minute all-in. The custom stack costs roughly $0.06/minute in raw vendor costs (see Section 8), giving significantly better margin at volume — at the cost of more engineering effort upfront.

**MVP note (solo/bootstrapped, India-first):** given the constraints of a solo build, v1 should launch on a managed voice-AI vendor (e.g., Bolna) rather than the full custom stack below. The custom stack remains the target architecture once the platform has paying customers and the engineering investment is justified — treat this section as the long-term direction, not the v1 starting point.

---

## 3. Twilio Account Architecture

**Decision (revised): BYO — each business connects their own Twilio credentials via Settings.** This reverses the earlier platform-owned/subaccount model, chosen for the solo/bootstrapped v1 to avoid fronting Twilio costs and to remove subaccount billing/metering engineering from the v1 scope.

**Why BYO over platform-owned, for this stage:**
- The platform doesn't pay Twilio upfront or carry collections risk — each business is billed directly by Twilio
- No subaccount provisioning, usage metering, or markup calculation needed in v1
- Businesses will already be registering as a TRAI Principal Entity themselves regardless of which model is used (see Section 11), so BYO doesn't add net-new regulatory burden

**How credentials are collected (Settings page):**
- Businesses are instructed to generate a **restricted/scoped API Key** (Key SID + Secret) from their Twilio console — **not** their master Account SID + Auth Token — to limit the platform's access if the key is ever compromised, and so the business can revoke it independently
- Twilio Connect (OAuth-style authorization) is the longer-term "correct" answer, where the business never copies/pastes a credential at all — noted as a future improvement, not required for v1

**Required platform behavior around BYO credentials:**
1. **Validation on entry** — test the credentials against Twilio's API (e.g., fetch account details) before saving, so a typo or invalid key is caught immediately rather than failing silently on the first campaign
2. **Encrypted storage at rest** — even a scoped API key is encrypted, never stored in plaintext. *Implementation note: AES-256-GCM encryption is deployed via `receptify/crypto.py`, using `ENCRYPTION_KEY` from environment variables.*
3. **Number selection from their account** — after validation, pull the business's existing Twilio phone numbers via API so they select from what they actually own, rather than typing a number manually
4. **Failure handling** — if a business's Twilio balance runs out or their key is revoked mid-campaign, the platform detects the failure state and pauses the campaign with a clear message, rather than silently retrying
5. **Credential rotation** — businesses can replace their key later without re-entering everything else

**Open decision:** whether credential setup is required before a business can build their first campaign, or only enforced at launch time (campaign creation allowed without credentials, blocked when they hit "Launch"). Leaning toward the latter, to reduce onboarding friction — not yet finalized.

---

## 4. Contact Data Ingestion

Three supported methods for getting a business's customers into the platform:

| Method | Best for | Real-time? |
|---|---|---|
| **Manual entry / CSV upload** | Small businesses, one-off campaigns | No |
| **Native CRM sync** (HubSpot, Salesforce, GoHighLevel) | Businesses already using a supported CRM | Near real-time (webhook) or scheduled polling as fallback |
| **API push** | Businesses with their own custom system/website | Real-time |

**CSV upload** requires `name` and `phone` at minimum, with optional `email` and any number of custom columns matching the business's defined fields.

**CRM sync** uses webhook subscriptions where supported (preferred), falling back to scheduled polling (default every 5 minutes) when a CRM doesn't support outbound webhooks for the relevant object type. Businesses can scope sync to a specific list, pipeline stage, or tag.

**API push** — businesses with their own systems (custom CRM, ERP, booking software) send contacts via:
```
POST https://api.yourplatform.com/v1/contacts
Authorization: Bearer <api_key>
```
*Note: This is a future public-facing API, distinct from the internal dashboard endpoint `POST /api/customers/` used by the React frontend. The internal endpoint uses cookie-based JWT authentication and accepts camelCase keys (`fullName`, `customerType`). The public API will use API key authentication and follow REST conventions.*
```
POST https://api.yourplatform.com/v1/contacts
Authorization: Bearer <api_key>

{
  "campaign_id": "camp_123",
  "name": "Rahul Shah",
  "phone": "+919876543210",
  "email": "rahul@example.com",
  "metadata": { "source": "signup_form", "budget": 5000000 }
}
```
Supports idempotency keys to avoid duplicate contacts on retried requests. Default rate limit: 100 requests/second per API key, scoped per business account.

**Fallback for non-technical businesses without a supported CRM:** Zapier/Make connector, requiring no code on the business's side.

**Security baseline across all methods:** HTTPS only, per-business API keys (never shared across tenants), webhook signature verification, and rate limiting per key.

---

## 5. Customer Data Model

**Problem:** every business type needs different customer attributes (a clinic needs age/medical history; a real estate business needs budget/location), and the schema must support any business type without per-industry tables or migrations.

**Decision: single `customers` table with a JSONB column for custom attributes, paired with a `field_definitions` table describing each business's schema.**

```sql
customers (
  id                uuid primary key,
  business_id       uuid not null references businesses(id),
  full_name         text not null,
  phone             text not null,
  email             text,
  consent_status    text,
  created_at        timestamptz,
  custom_fields     jsonb not null default '{}'
)

custom_field_definitions (
  id, business_id, name, key, field_type,
  is_required, options, group_name   -- for select/enum fields
)
```

**Why this approach over the alternatives:**

| Option | Why not chosen as primary |
|---|---|
| EAV (key-value attribute table) | Poor query performance, no type safety, painful filtering |
| Separate table per business type | Doesn't scale to arbitrary industries; requires migrations per new business type |
| **JSONB + field_definitions (chosen)** | Flexible, no migrations, structured validation via the definitions table |

**`custom_field_definitions` drives:**
- Dynamic form rendering in the dashboard (dropdown for enums, number input for numeric fields, etc.)
- Validation on CSV upload / API push (reject missing required fields or wrong types)
- The `is_sensitive` flag — fields like `medical_history` get extra handling (encryption, transcript redaction, restricted access). *Note: `is_sensitive` is not yet on the model — flagged for a future migration.*

**Performance — promoting hot fields:** JSONB with a GIN index handles equality/tag lookups well (a GIN index with `jsonb_path_ops` is already deployed on the `customers.custom_fields` column), but range queries (`>`, `<`, `BETWEEN`) on numeric/date fields inside JSONB don't benefit from that index. For fields that are frequently range-filtered (age, budget, appointment date), promote them to real generated columns:

```sql
ALTER TABLE customers ADD COLUMN age int
  GENERATED ALWAYS AS ((custom_attributes->>'age')::int) STORED;
CREATE INDEX idx_customers_age ON customers(business_id, age);
```

Fields used for equality/tag matching only (property_type, gender, condition) can remain in JSONB with a GIN index — no promotion needed.

---

## 6. Audience Filtering & Campaign Targeting

**Decision: a dynamic filter builder, driven by each business's `field_definitions` — never raw/free-text SQL exposed to the user.**

The filter builder renders the appropriate input and operator set per field type:

| Field type | Operators | Example |
|---|---|---|
| Number | `>`, `<`, `between`, `=` | age > 60, budget > 5,000,000 |
| Date | `before`, `after`, `in the last N days`, `this week/month` | appointment scheduled this week |
| Single-select | `is`, `is not`, `is one of` | property_type = apartment |
| Multi-select | `includes`, `includes any of` | tags includes "diabetic" |
| Text | `contains`, `is` | condition contains "hypertension" |

The frontend builds a structured filter object (fields, operators, AND/OR grouping):
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "age", "op": ">", "value": 60 },
    { "field": "condition", "op": "contains", "value": "diabetic" }
  ]
}
```

The backend validates every referenced field against that business's `field_definitions` (preventing injection through field names) and compiles it into parameterized SQL. Relative date conditions ("this week") are resolved to concrete date ranges server-side at query time.

**Live audience count:** the same filter, wrapped in `COUNT(*)`, powers a live "this targets N customers" preview before a campaign launches.

---

## 7. Campaign Creation Flow

Eleven-stage flow, grouped into three phases:

**Configuration**
1. Campaign details (name, description, business/workspace)
2. Select audience (filter builder from Section 6)
3. Define call objective (lead qualification, appointment confirmation/scheduling, payment reminder, feedback survey, order/delivery confirmation, event reminder, custom)
4. Configure AI agent (voice, language/accent, greeting, script/prompt, knowledge base, response guidelines, escalation rules)
5. Call settings (business hours, timezone, calling window, max concurrent calls, timeout, max duration)

**Behavior rules**
6. Retry & failure rules (retry on no-answer/busy/failed, attempt count, delay, skip-after-N-failures)
7. Call actions (transfer to human, send SMS/email, schedule follow-up, create CRM task, update status, trigger webhook)
8. Outcome & qualification (define outcomes — interested, not interested, callback requested, no answer, wrong number, voicemail; lead scoring; tagging; CRM field updates)
9. Compliance & recording (recording toggle, consent announcement, DNC checks, country-specific rules)

**Launch & monitor**
10. Review & launch (config review, estimated call count, test call, save as draft, schedule, launch immediately)
11. Monitor campaign (live dashboard, active/completed calls, success rate, retry queue, transcripts, recordings, analytics)

**Gaps flagged for future iteration:**
- Budget/spend cap per campaign, not just estimated call count
- Per-contact consent status (not just a campaign-level recording toggle) — especially relevant for regulated data like medical history
- Daily/weekly call-frequency cap per contact, separate from per-campaign retry limits
- Campaign templates / duplication for recurring campaign types
- Roles & permissions (e.g., manager approval before launch)
- Script versioning (behavior when a script is edited mid-campaign)
- Holiday/blackout date calendar, separate from business-hours/timezone settings
- Consider merging steps 7 and 8 into one "outcome-driven automation" section, since "update customer status" currently appears in both

### 7.1 Condensed User-Facing Flow

The 11 steps above remain the full underlying data model, but a user shouldn't answer all 11 every time they launch a campaign. **Decision: push repeat settings (business hours, compliance rules, default retry policy, default voice/language) up to account-level defaults**, set once in Settings, and reduce the campaign creation wizard to 4 user-facing steps:

1. **Campaign basics** — name, objective (from templates), audience (via the filter builder or a saved segment). Replaces steps 1–3.
2. **Script & voice** — script/prompt editor with contact variables, voice selection. Escalation rules and knowledge base default from account settings, with an optional "advanced" override per campaign.
3. **Schedule** — when to run it (now / later / recurring). Business hours, timezone, retry rules, and compliance settings are pulled from account defaults and shown as an editable summary.
4. **Review & launch** — estimated call count, test call, launch. Outcome definitions and post-call actions use account-level defaults unless the user opens "customize outcomes."

**Campaign templates:** once a business runs a campaign successfully, they can save it as a reusable template — a repeat campaign becomes "pick template → confirm audience → launch."

---

## 8. Cost Structure (Per-Call Estimate)

Estimated raw vendor cost for a single 5-minute AI voice call to a US destination:

| Component | Rate | Usage | Cost |
|---|---|---|---|
| Twilio (telephony) | $0.013/min (US outbound) | 5 min | $0.065 |
| Deepgram (STT) | $0.0077/min (streaming) | 5 min | $0.039 |
| ElevenLabs (TTS) | $0.10 per 1,000 characters | ~2,000 characters (agent speaks ~half the call) | $0.15 |
| Claude (LLM) | ~$2/$10 per million input/output tokens | ~6,000 input + 900 output tokens | $0.021 |
| Recording + storage | $0.0025/min record + $0.0025/min stored | 5 min | $0.025 |
| Phone number (amortized) | $1.15/month | spread across ~1,000 calls/month | ~$0.001 |
| **Total** | | | **~$0.30/call (~$0.06/min)** |

**Notes:**
- International destinations vary significantly in Twilio rate (up to 10–40x the US rate for some countries) — pricing tiers should account for destination, not use one flat rate.
- Prompt caching on the LLM system prompt/script (reused every call) can meaningfully reduce the Claude cost line.
- Not included above: own infrastructure/hosting (~$0.01–0.03/call amortized), payment processing fees, monitoring tooling — see Section 9 for how these factor into pricing.

---

## 9. Subscription Plans

Target: 3–4x markup on raw per-minute cost (~$0.06/min) for healthy gross margin, with per-minute rate decreasing at higher tiers (standard SaaS bundling economics).

| Plan | Price | Included minutes | Effective $/min | Concurrent calls | Key features |
|---|---|---|---|---|---|
| Starter | $49/mo | 250 | $0.196 | 2 | CSV upload only, 1 number, email support |
| Growth | $199/mo | 1,200 | $0.166 | 10 | CRM sync + webhooks, 3 numbers, priority support |
| Business | $499/mo | 3,500 | $0.143 | 25 | Full API access, 10 numbers, phone support |
| Enterprise | Custom | Volume-based | ~$0.10–0.12 | Unlimited | BYO Twilio option, dedicated numbers, SLA |

**Structural decisions:**
- Overage rate is priced higher than the bundled rate (nudges upgrades, protects margin on usage spikes)
- International destinations consume bundled minutes at a multiplier (e.g., 1 minute to a "zone 3" country = 3 bundled minutes) rather than flat pricing across all geographies
- Annual billing discount (10–20%) recommended for cash flow and retention
- Call recording/storage treated as an optional add-on rather than bundled into every plan by default

---

## 10. Feature Summary

Everything a business gets access to, grouped by category:

| Category | Features |
|---|---|
| Contact & customer management | CSV upload, CRM sync, API push, custom fields per business, dynamic filter builder, live audience count |
| Campaign creation | Campaign basics, objective templates, condensed 4-step flow (Section 7.1), campaign templates |
| AI agent configuration | Voice, language/accent, greeting, script/prompt editor, knowledge base, response guidelines, escalation rules |
| Call settings | Business hours, timezone, calling window, max concurrent calls, timeout, max duration |
| Retry & failure handling | Retry on no-answer/busy/failed, attempt count, delay, auto-skip after repeated failures |
| Post-call automation | Transfer to human, SMS/email after call, follow-up scheduling, CRM task creation, status update, webhook trigger |
| Outcomes & qualification | Predefined outcomes, lead scoring, tagging, CRM field updates |
| Compliance & recording | Recording toggle, consent announcement, DND/DNC checks, country-specific rules (Section 11) |
| Launch & monitoring | Draft/schedule/launch, test call, estimated call count, live dashboard, retry queue, transcripts, recordings, analytics |
| Account & billing | Tiered plans, usage-based overage, multiple phone numbers, API access on higher tiers |

---

## 11. India Compliance (v1 Launch Requirement)

Two separate regulatory frameworks apply, and both are mandatory before real calls go out — neither is optional or something to retrofit later.

**DPDP Act 2023 (Digital Personal Data Protection Act)** — governs how personal data is handled, not the calling itself:
- Requires informed consent before processing personal data (voice recordings, transcripts, CRM entries, sensitive fields like medical history)
- Enforces purpose limitation — data collected for one stated purpose can't be repurposed without fresh consent
- Includes data erasure rights (customers can request deletion)
- Penalties for serious violations can be substantial

**TRAI DLT / DND (under TCCCPR 2018)** — governs who is allowed to make commercial calls to Indian numbers at all:
- Every business making commercial calls must register as a **Principal Entity** on the DLT platform; the platform itself likely needs to register as a **Telemarketer**, with an active PE–Telemarketer link for calls to be legitimate
- Without this registration, outbound calls are automatically classified as spam and blocked by carriers
- Calling window restricted to **9 AM–9 PM**
- Every number must be checked against the **National DND registry** before dialing, unless the specific contact has given explicit consent
- Enforcement is active — TRAI issued a very high volume of non-compliance notices in the past year

**Recommendation:** consult a telecom compliance specialist or lean on the telephony/vendor's onboarding support (Exotel, Knowlarity, and similar India-native providers typically walk businesses through DLT registration) before enabling live calling — this is not legal advice, and getting the registration process right matters enough to get expert input rather than relying on general guidance.

---

## 12. Phased Rollout Plan

**Phase 1 — India, voice calling only (current focus)**
- BYO Twilio credentials (Section 3)
- Managed voice-AI vendor for v1 (Section 2 MVP note)
- Condensed 4-step campaign flow (Section 7.1)
- DLT/DND and DPDP compliance in place before any live calling (Section 11)
- Single vertical focus recommended for initial customer validation, even though the data model supports any business type

**Phase 2 — Additional communication channels (same Settings-page pattern, separate underlying credentials/registrations)**
- Bulk WhatsApp messaging — requires separate Meta Business API approval and per-business message template registration; Twilio credentials alone don't unlock this
- Bulk SMS messaging — requires its own DLT header/template registration, distinct from the Principal Entity registration used for voice
- Bulk email sending — uses a separate email provider/credential (e.g., Twilio SendGrid is a different product from Twilio Voice/SMS), even if presented under the same Settings page in the UI

**Phase 3 — Geographic expansion**
- Only after India has real paying/active usage
- Prioritize markets with lower compliance friction, or markets existing India customers are already asking for, over jumping straight to the most heavily regulated markets (US/EU)
- Each new country is its own compliance and telephony-rate project — not a checkbox

---

## 13. Completed Platform Architecture Items & Next Steps

### Completed Core Infrastructure & Features:
- ~~Filter-object-to-SQL translation function~~ → **Implemented:** `compile_filters_to_q()` in `customers/views.py` with `CampaignFilterGroup`/`CampaignFilterRule` models
- ~~Settings-page field list and credential validation flow~~ → **Implemented:** Settings page with Twilio credential entry, connection testing, and AES-GCM encrypted storage (`receptify/crypto.py`)
- ~~Enforce Twilio credentials before launch~~ → **Implemented:** Campaigns can be created as drafts; `CampaignLaunchView` verifies valid `TwilioCredentials` before initiating dialer threads.
- ~~Twilio Account Phone Number Selection~~ → **Implemented:** `GET /api/v1/business/twilio/numbers` pulls live provisioned numbers from the tenant's Twilio account.
- ~~Server-Side Voice & TTS Preview Pipeline~~ → **Implemented:** Google Cloud TTS adapter (`GoogleCloudTTSAdapter` & `MockFallbackAdapter`) with `POST /api/tts/preview` MP3 audio stream generation.
- ~~Campaign Lifecycle & Retry Engine~~ → **Implemented:** Pause, resume, cancel, duplicate endpoints (`/pause`, `/resume`, `/cancel`, `/duplicate`) with attempt retries and status management.
- ~~TRAI Telecom Compliance Enforcer~~ → **Implemented:** Restricts active campaign dialing to the mandatory 9 AM – 9 PM IST window (`is_within_calling_window()`).

### Open Items & Future Roadmap:
- Cost table and subscription pricing recalculated in INR against India-specific telephony rates (Sections 8–9 are currently USD/US-rate based and need an India-first pass)
- Indian payment gateway (e.g., Razorpay/UPI) and GST-compliant invoicing for billing
- DLT Principal Entity / Telemarketer registration process — first-hand walkthrough once started
- Target vertical selection for initial customer validation
