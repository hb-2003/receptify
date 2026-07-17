# Receptify Code Standards Audit
> Audited against: `backend-patterns`, `api-design`, `frontend-patterns`, `naming-conventions`, `comment-writer`  
> Date: 2026-07-17

---

## 📊 Overall Score

| Skill | Score | Verdict |
|-------|-------|---------|
| **backend-patterns** | 7/10 | Mostly follows — import ordering, UUID PKs, timestamps, explicit tables all correct. Violations in helper placement, JSONField handling, missing transaction guards |
| **api-design** | 6/10 | Business scoping ✅, camelCase responses ✅. Missing PATCH endpoints, broken permission classes, no pagination, no Zod-style validation |
| **frontend-patterns** | 6/10 | Stack correct (Next.js App Router, Tailwind, Lucide, Sonner). Missing Zod validation, no URL search params for filters, excessive `any` types, dead code |
| **naming-conventions** | 7/10 | Model/view/serializer naming excellent. Frontend has generic variable names (`data`, `d`, `c`, `r`), some abbreviations |
| **comment-writer** | 5/10 | Backend has good section comments. Frontend has almost zero comments. Some jargon in backend. Missing casual-english style |

---

## 1. BACKEND-PATTERNS Violations

### ✅ What's Correct
- **UUID primary keys** — All models use `models.UUIDField(primary_key=True, default=uuid.uuid4)`
- **Timestamps** — All models have `created_at = auto_now_add` (and `updated_at` where relevant)
- **Explicit `db_table`** — Every Meta class sets `db_table`
- **Explicit `db_column` on FKs** — All foreign keys have `db_column='...'`
- **`transaction.atomic`** — Used in campaign creation and launch
- **Phone formatting** — `format_phone()` and `is_valid_indian_phone()` follow the standard pattern

### ❌ Violations to Fix

| # | File | Violation | Skill Rule | Fix |
|---|------|-----------|------------|-----|
| **BP-1** | `campaigns/views.py:1-20` | Import ordering wrong — `from receptify.models import TwilioCredentials` (line 20) is separated from other internal imports (lines 12-17) by a blank line and another `from receptify` import group | Imports: group 4 (internal-other-apps) should be one contiguous block | Move line 20 into the internal imports block at lines 12-17 |
| **BP-2** | `campaigns/views.py:1-5` | Unused imports: `re`, `uuid`, `random`, `time` are imported but never used | Import only what's needed | Remove `import re, uuid, random, time` |
| **BP-3** | `customers/views.py:120,136,194,290` | `custom_fields` saved via `json.dumps()` on a `JSONField` — double-encoding | JSONField handles serialization automatically | Pass raw `dict` directly, remove `json.dumps()` calls |
| **BP-4** | `customers/views.py:346-432` | `compile_filters_to_q()` is a standalone function in `views.py` — should be in a helpers module | "Place utility and validation helpers inside the app views/helpers where they are used" | Move to `customers/helpers.py` or `customers/filters.py` for cleaner separation |
| **BP-5** | `campaigns/dialer.py:74-75` | Hardcoded `https://receptify.in` instead of `config('PUBLIC_APP_URL')` | Use `decouple.config()` for environment-specific values | Use `config('PUBLIC_APP_URL', default='https://receptify.in')` like `utils_twilio.py` does |
| **BP-6** | `campaigns/views.py:59-113` | Campaign creation has `transaction.atomic()` but launch logic also spawns a thread inside the same method — thread should start AFTER the transaction commits | Background tasks should be clean from transaction boundaries | Move `thread.start()` after the `with transaction.atomic()` block (already correct — verify) |
| **BP-7** | `calls/views_twilio.py:38-52` | `TwilioTwiMLView` returns static hardcoded TwiML without any call context — dead/unused endpoint | Clean up unused code | Remove if `TwilioCallTwiMLView` is the actual webhook, or document why both exist |

---

## 2. API-DESIGN Violations

### ✅ What's Correct
- **Business scoping** — All views filter by `user.business_id`
- **camelCase responses** — `to_camel_case()` applied consistently
- **camelCase input parsing** — Request data parsed with camelCase keys
- **Modular URL structure** — `/api/customers/`, `/api/campaigns/`, `/api/calls/`, `/api/llm/`
- **Error responses** — Return `{'error': '...'}` with appropriate status codes

### ❌ Violations to Fix

| # | File | Violation | Skill Rule | Fix |
|---|------|-----------|------------|-----|
| **API-1** | `campaigns/views.py` | **No PATCH endpoint** for campaigns | Full CRUD required | Add `patch()` method to `CampaignDetailView` for editing draft campaigns |
| **API-2** | `llm/views.py` | Script generation endpoint uses `AllowAny` | "Use `AllowAny` only for public-facing/auth routes like login, signup" | Change to `IsAuthenticated` |
| **API-3** | `calls/views_twilio.py:38,55,104` | Three webhook views use `AllowAny` but only two validate Twilio signatures — `TwilioTwiMLView` (line 38) does NO signature validation | Security: public webhooks must verify caller | Add `verify_twilio_signature()` to `TwilioTwiMLView` or remove if unused |
| **API-4** | `customers/views.py:85` | Customer list hardcapped at `[:500]` with no pagination | "No pagination" identified as scalability gap | Implement DRF `PageNumberPagination` or `CursorPagination` |
| **API-5** | `campaigns/views.py:116-144` | Campaign detail doesn't return filter groups — only static `CampaignCustomer` links | Response should include all related data needed by frontend | Serialize and return `filter_groups` with nested `rules` |
| **API-6** | `customers/views.py:330-342` | `to_camel_case()` utility is defined in `customers/views.py` but imported by `campaigns/views.py` | Cross-app utilities should live in a shared module | Move to `receptify/utils.py` or `receptify/helpers.py` |
| **API-7** | `receptify/urls.py:40-47` | Duplicate no-slash routes alongside modular `include()` routes | URL routing redundancy | Use `APPEND_SLASH = False` in settings, or a middleware, instead of duplicating every route |
| **API-8** | `campaigns/serializers.py` | All serializers use `fields = '__all__'` | Explicit field lists are safer — prevents accidentally exposing new fields | List fields explicitly: `fields = ['id', 'name', 'purpose', ...]` |

---

## 3. FRONTEND-PATTERNS Violations

### ✅ What's Correct
- **App Router structure** — Pages at `src/app/(app)/campaigns/page.tsx`, etc.
- **TypeScript `.tsx` files** — All components are TypeScript
- **Lucide icons** — Used consistently throughout
- **Sonner toasts** — `toast.success()`, `toast.error()` used correctly
- **Tailwind CSS** — Consistent styling with `cn()` helper
- **Functional components** — All components are functions with hooks
- **`'use client'` directives** — Present on all interactive pages

### ❌ Violations to Fix

| # | File | Violation | Skill Rule | Fix |
|---|------|-----------|------------|-----|
| **FE-1** | `campaigns/new/page.tsx` | **No Zod validation** on campaign form data — submits raw state with no schema validation | "Use Zod for schema validation. Define schemas clearly" | Add `campaignFormSchema` with Zod, validate on submit |
| **FE-2** | `campaigns/new/page.tsx:15,77,103` | Excessive `any` types: `useState<any[]>([])`, `useState<any>(null)` | TypeScript strictly — maintain type safety | Define `Campaign`, `Customer`, `FilterGroup` interfaces and use them |
| **FE-3** | `campaigns/page.tsx:12` | `useState<any[]>([])` for campaign list | Type safety | Define `Campaign` interface |
| **FE-4** | `campaigns/[id]/page.tsx:15` | `useState<any>(null)` for campaign detail data | Type safety | Define proper response type |
| **FE-5** | `campaigns/page.tsx:21` | Filter state not in URL search params — `setInterval(load, 4000)` with no filter state | "URL search params for filter states, query strings, active tabs — survives browser refresh" | No filters exist on list page — add status filter using URL params |
| **FE-6** | `campaigns/new/page.tsx:44-49` | `FILTER_FIELDS` constant is dead code — dropdown uses hardcoded `<option>` elements | Clean unused code | Either use the constant to render options dynamically, or delete it |
| **FE-7** | `campaigns/new/page.tsx:107-124` | Core campaign state uses a flat object `data` with no type annotation | State declarations should be typed | Define `CampaignFormData` interface |
| **FE-8** | `campaigns/[id]/page.tsx:31` | 2-second polling interval regardless of campaign status | Smart polling based on state | Poll 2s only when `running`, 10s when `scheduled`, stop when `completed`/`draft` |
| **FE-9** | `campaigns/new/page.tsx` | 1065-line single file — all 8 wizard steps in one component | Components should be extracted for reusability | Extract each step into separate components: `StepBasics.tsx`, `StepAudience.tsx`, etc. |
| **FE-10** | `campaigns/page.tsx:16-20` | `load()` function has no error handling — if fetch fails, `isLoading` stays true forever | "Always parse and handle success or error cases gracefully" | Add try/catch with error state |

---

## 4. NAMING-CONVENTIONS Violations

### ✅ What's Correct
- **Models** — `Campaign`, `CampaignFilterGroup`, `CampaignFilterRule`, `Customer`, `Call`, `CallEvent` — all PascalCase noun phrases ✅
- **Views** — `CampaignListCreateView`, `CustomerDetailView`, `AudiencePreviewView` — descriptive PascalCase ✅
- **Serializers** — `CampaignSerializer`, `CustomerSerializer` — `{Model}Serializer` pattern ✅
- **Table names** — `campaigns`, `customers`, `calls`, `campaign_filter_groups` — lowercase snake_case plural ✅
- **Utility functions** — `format_phone()`, `is_valid_indian_phone()`, `parse_date_string()` — readable snake_case ✅
- **Booleans** — `is_compliance_confirmed`, `is_valid_indian_phone`, `isFetchingPreview` — `is_`/`has_` prefixed ✅

### ❌ Violations to Fix

| # | File | Violation | Rule | Fix |
|---|------|-----------|------|-----|
| **NC-1** | `campaigns/[id]/page.tsx:45-46` | `const c = data.campaign` and `const calls = data.calls` — `c` is a single-letter generic name | "No abbreviations. Write the full word. Always" | Rename to `campaign` |
| **NC-2** | `campaigns/page.tsx:17` | `const d = await r.json()` — `d` and `r` are meaningless single-letter names | Avoid generic names like `data`, `result` | Use `const response = await fetch(...)` and `const responseData = await response.json()` |
| **NC-3** | `campaigns/new/page.tsx:138-139` | Same pattern: `.then((r) => r.json()).then((d) => ...)` — `r` and `d` everywhere | Full descriptive names | Use `response` and `customerList` / `businessData` etc. |
| **NC-4** | `campaigns/new/page.tsx:107` | `const [data, setData] = useState(...)` — `data` is the most generic name possible | "Never use `data`, `values`, `process`, `handle`, `info`, `item`, `result`" | Rename to `campaignForm` / `setCampaignForm` or `formState` / `setFormState` |
| **NC-5** | `customers/views.py:354` | Variable `logic_operator` vs field `logic_operator` — same name for local var and DB field makes it confusing | Context-aware naming | Use `group_logic` or `group_operator` for the local variable |
| **NC-6** | `campaigns/dialer.py:167` | `semaphore = asyncio.Semaphore(5)` — magic number `5` not named as a constant | "Constants include their unit" | Define `MAX_CONCURRENT_CALLS = 5` at module level |
| **NC-7** | `campaigns/views.py:104` | `campaign_customer_relationships` — overly long, but acceptable. However, could be shorter while still clear | Context-aware length | `campaign_links` or `customer_links` since we're already in campaign context |

---

## 5. COMMENT-WRITER Violations

### ✅ What's Correct
- **Backend section labels** — `# --- TRAI Compliance Pass ---`, `# --- DND/NDNC Scrubbing Pass ---`, `# --- Twilio Dial Pass ---` in dialer.py ✅
- **`customers/views.py`** — Good header comment `# Helpers for Indian Phone Formatting and Validation` ✅
- **`campaigns/views.py:22-24`** — NOTE comment explaining removed mock simulator is useful ✅
- **`calls/helpers.py`** — Good inline comments explaining TRAI window and NDNC registry ✅
- **`calls/tts_adapter.py`** — Good class-level docstrings explaining what each adapter does ✅

### ❌ Violations to Fix

| # | File | Violation | Rule | Fix |
|---|------|-----------|------|-----|
| **CW-1** | `calls/tts_adapter.py:6-22` | Uses docstrings (`"""..."""`) instead of `#` comments | "Use `#` for Python. Never docstrings or `/* */` blocks" | Convert class/method docstrings to `#` comment blocks above the definition |
| **CW-2** | `campaigns/views.py:27` | `CampaignListCreateView` has no header comment explaining what it does | "1-2 lines above the definition explaining what it does" | Add: `# Handles listing all campaigns for the business and creating new ones with optional dynamic filter rules.` |
| **CW-3** | `campaigns/new/page.tsx` | **Zero comments** in a 1065-line file — no section labels, no why-explanations for complex logic | "Add one when something is non-obvious: a business rule, a workaround, a choice" | Add section labels for each wizard step, explain compliance scan logic, explain debounce-less preview fetch |
| **CW-4** | `campaigns/[id]/page.tsx` | Zero comments in the detail page | At minimum, label the sections | Add: `// Live call log with 2-second polling` above the polling useEffect |
| **CW-5** | `campaigns/page.tsx` | Zero comments | Missing section labels | Add header: `// Campaign list grid with auto-refresh polling` |
| **CW-6** | `customers/views.py:346` | `compile_filters_to_q` has a code comment but it uses jargon: "Safe, dynamic query generation compiler translating filter rules to Django Q objects" | "Casual English — like you're talking to a person" | Rewrite to: `# Takes the filter rules the user built in the audience UI and turns them into a database query that finds matching customers.` |
| **CW-7** | `calls/views_twilio.py:55-60` | Docstring uses jargon: "Public TwiML webhook specific to an active Call ID" | Casual English | Rewrite: `# When a customer picks up the phone, Twilio hits this endpoint. We tell Twilio what to say by returning the campaign script as voice instructions.` |
| **CW-8** | `calls/views_twilio.py:104-108` | Docstring: "Public webhook callback called by Twilio on call state transitions" | Jargon | Rewrite: `# Twilio sends us updates every time a call changes state (ringing, answered, hung up, failed). We record the duration and outcome here.` |
| **CW-9** | `campaigns/dialer.py` | No file-level header comment explaining what this module does | Module header needed | Add: `# Background calling engine — picks up scheduled campaigns and dials each customer through Twilio, respecting TRAI calling hours and concurrency limits.` |

---

## 6. CROSS-CUTTING ISSUES

These violate multiple skills simultaneously:

| # | Issue | Skills Violated | Fix |
|---|-------|-----------------|-----|
| **X-1** | `to_camel_case()` lives in `customers/views.py` but is imported by `campaigns/views.py` | backend-patterns (helper placement), api-design (shared utils) | Move to `receptify/utils.py` |
| **X-2** | No test-call endpoint exists but frontend calls it | api-design (endpoint completeness), backend-patterns (CRUD) | Create `POST /api/calls/test-call` |
| **X-3** | `voice_type` stored but ignored in TwiML | api-design (response accuracy), naming-conventions (misleading field) | Wire `voice_type` to Twilio Polly voices |
| **X-4** | Frontend sends `status: 'scheduled'` on submit but backend ignores it | api-design (input handling), frontend-patterns (correct API contract) | Either honor the field or don't send it |
| **X-5** | 1065-line wizard file with zero comments and `any` types everywhere | frontend-patterns (type safety, component extraction), comment-writer (section labels), naming-conventions (generic names) | Split into step components, add types, add comments |

---

## 7. PRIORITY FIX ORDER

### 🔴 Fix Now (Standards violations that cause bugs or security issues)

1. **BP-3** — Remove `json.dumps()` on JSONField (data corruption)
2. **API-2** — Protect script generation with `IsAuthenticated` (security)
3. **API-3** — Add signature validation to `TwilioTwiMLView` (security)
4. **BP-5** — Use `config('PUBLIC_APP_URL')` in dialer (broken webhooks)
5. **API-8** — Explicit serializer field lists (data exposure risk)

### 🟡 Fix Soon (Standards violations that hurt code quality)

6. **BP-1, BP-2** — Clean up import ordering and remove unused imports
7. **NC-1 to NC-4** — Fix generic variable names (`c`, `d`, `r`, `data`)
8. **FE-1** — Add Zod form validation on campaign wizard
9. **FE-2 to FE-4** — Replace `any` types with proper interfaces
10. **FE-9** — Extract wizard steps into separate components
11. **API-1** — Add campaign PATCH endpoint
12. **API-6** — Move `to_camel_case()` to shared module

### 🟢 Fix Later (Clean code / polish)

13. **CW-1 to CW-9** — Fix comment style across all files
14. **FE-5** — Add URL search params for filter state
15. **FE-6** — Remove dead `FILTER_FIELDS` constant
16. **NC-6** — Name magic constants (`MAX_CONCURRENT_CALLS = 5`)
17. **API-4** — Add pagination to list endpoints
18. **API-7** — Clean up duplicate URL routes
19. **FE-8** — Smart polling on detail page
20. **BP-4** — Move `compile_filters_to_q()` to helpers module
