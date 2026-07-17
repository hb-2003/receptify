# Implementation Plan: Code Standards Audit & Technical Refactoring

## Problem Statement
The Receptify codebase has been audited against standard backend-patterns, api-design, frontend-patterns, naming-conventions, and comment-writer skills. The audit identified several key areas of architectural non-compliance and security vulnerabilities: (1) double-serialization of JSONFields on the backend, (2) unauthenticated access gates on LLM and public webhooks, (3) hardcoded callback URLs in bg workers, (4) generic wildcard serializer declarations, (5) generic variables on the frontend, and (6) missing Zod form schemas.

The desired state is to resolve each of these audit violations cleanly. This will ensure top-tier security compliance, robust data integrity, optimal performance, and highly readable, plain English documentation of all modules.

## Current Architecture
The current architecture involves:
- Customers App: backend/customers/views.py (which houses customer list, upload, detail, and query compiling APIs), and backend/customers/models.py.
- Campaigns App: backend/campaigns/views.py (which houses list, detail, and launch views), backend/campaigns/models.py, backend/campaigns/serializers.py, and backend/campaigns/dialer.py (background dialing poller).
- LLM App: backend/llm/views.py (synthesis scripts).
- Calls App: backend/calls/views_twilio.py (incoming TwiML webhooks).
- Receptify Base: backend/receptify/urls.py (url router).
- Next.js Frontend: frontend/src/app/(app)/campaigns/new/page.tsx (wizard), frontend/src/app/(app)/campaigns/page.tsx, and frontend/src/app/(app)/campaigns/[id]/page.tsx (detail page).

## What Changes vs What Stays

### What Changes:
- backend/customers/views.py:
  - Relocate standalone to_camel_case utility to shared core receptify.
  - Relocate compile_filters_to_q to a dedicated customers helper module.
  - Remove redundant json.dumps stringification on Customer JSONFields.
  - Implement DRF page-number slicing on list actions.
  - Secure customer PATCH endpoint with tags/customFields payload schema validation.
- backend/campaigns/views.py:
  - Add campaign update PATCH view.
  - Implement related filter_groups serialization inside Campaign Detail payload.
  - Group and organize PEP-8 module-level imports.
- backend/campaigns/serializers.py:
  - Specify explicit, safe fields lists for all serializers.
- backend/llm/views.py:
  - Lock LLM endpoint to authenticated requests using REST framework IsAuthenticated.
  - Shift all local imports to module-level scope.
  - Log failures cleanly with log.exception.
- backend/calls/views_twilio.py:
  - Protect TwilioTwiMLView with signature checking.
- backend/campaigns/dialer.py:
  - Replace hardcoded callback URLs with environment configuration lookups.
- frontend/src/app/(app)/campaigns/new/page.tsx:
  - Add campaignFormSchema Zod form validation.
  - Replace any casts with strictly typed interfaces.
  - Rename generic and abbreviated variables to storybook prose.
- frontend/src/app/(app)/campaigns/page.tsx & campaigns/[id]/page.tsx:
  - Refactor generic variables to full, descriptive names.
  - Implement smart polling timers depending on active status.
- docs/features/custom_fields_and_compliance.md:
  - Correct minor spelling errors.
- GEMINI.md:
  - Correct typos and update scoping reference.

### What Stays:
- Main database tables and field columns remain unmodified.
- Django authentication middleware and JWT session cookies remain unmodified.
- Existing business-scoping logic remains strictly active.

## Implementation Steps

### Phase 1: Security, Concurrency, and Data Integrity
1. Remove Double Serialization (BP-3):
   - File: backend/customers/views.py
   - Modify the Customer creation, patch update, and bulk upload POST methods to pass dict objects directly to custom_fields, removing any json.dumps() calls.
   - Verification: Run unit tests and confirm custom_fields values are queried as native objects.
2. Protect LLM View (API-2):
   - File: backend/llm/views.py
   - Replace AllowAny with IsAuthenticated in GenerateScriptView permission_classes.
   - Verification: Verify unauthenticated requests to LLM endpoints are rejected with HTTP 401.
3. Verify Webhook Signatures (API-3):
   - File: backend/calls/views_twilio.py
   - Apply the verify_twilio_signature decorator to TwilioTwiMLView.
   - Verification: Verify that spoofed webhook requests fail signature validation.
4. Environment Callback URLs in Dialer (BP-5):
   - File: backend/campaigns/dialer.py
   - Replace hardcoded callback domains with PUBLIC_APP_URL config lookups.
   - Verification: Run dialer worker in development and confirm callback urls are formatted correctly.
5. Explicit Serializer Fields (API-8):
   - File: backend/campaigns/serializers.py
   - Replace fields = '__all__' with explicit array field lists for Campaign, Script, and Template serializers.
   - Verification: Run test suite and confirm serializers match the exact specified keys.

### Phase 2: Naming, Type Safety, and App Decoupling
6. Move Shared camelCase Utility (API-6 & X-1):
   - Files: backend/customers/views.py ➜ backend/receptify/utils.py
   - Relocate to_camel_case to receptify/utils.py and update all import statements across customers, campaigns, and calls.
   - Verification: Run tests and ensure response payloads are cleanly camelCased without import issues.
7. Decouple Dynamic segment Compiler (BP-4):
   - Files: backend/customers/views.py ➜ backend/customers/helpers.py
   - Relocate compile_filters_to_q to a helper module and resolve imports.
   - Verification: Run query tests to ensure compiler logic remains completely functional.
8. TypeScript Type Safety & Clean naming (FE-2 to FE-4, NC-1 to NC-4):
   - Files: frontend/src/app/(app)/campaigns/new/page.tsx, campaigns/page.tsx, and campaigns/[id]/page.tsx
   - Replace generic variables and any types with Campaign, Customer, FilterGroup, and CampaignFormData interfaces.
   - Verification: Run npm run lint and confirm Next.js build succeeds with zero TypeScript warnings.
9. Clean Backend Imports (BP-1, BP-2):
   - Files: backend/campaigns/views.py
   - Re-order imports into standard library, Django, third-party, and internal blocks, removing unused packages.
   - Verification: Ensure files load and pass tests cleanly.

### Phase 3: Pagination, Form Validation, and Comment Novel Styling
10. Zod Form Validation (FE-1):
    - File: frontend/src/app/(app)/campaigns/new/page.tsx
    - Define a Zod schema campaignFormSchema and trigger schema verification on submit.
    - Verification: Verify invalid inputs are blocked from submission and display Sonner toasts.
11. Campaign PATCH Update API (API-1):
    - File: backend/campaigns/views.py
    - Implement a PATCH method in CampaignDetailView to support updates to draft campaigns.
    - Verification: Verify campaign values are editable in test cases.
12. Customer Page Slicing Slices (API-4):
    - File: backend/customers/views.py
    - Add standard PageNumberPagination to list queries in CustomerListCreateView.
    - Verification: Verify that the API output conforms to count, next, previous, and result paginated structure.
13. Comment Novel Styling (CW-1 to CW-9):
    - Files: backend/campaigns/dialer.py, backend/calls/views_twilio.py, and Next.js frontend pages.
    - Change python docstrings to # blocks and adjust all inline comments to casual, friendly English explaining the "why".
    - Verification: Confirm comments are easy to read and understand.

## Risks and Open Questions
- Next.js Route Parsing: Ensuring URL query parameter polling updates do not trigger unnecessary whole-page re-renders. We will use Next.js shallow searchParam hooks.
- Double-Serialization Data Transition: Verify that existing JSON fields in PostgreSQL database are converted to objects and don't require any raw json parsing fallback in views.

## Acceptance Criteria
- [ ] No json.dumps() calls remain inside customers or campaigns apps.
- [ ] GenerateScriptView rejects any requests that do not present a valid authenticated user JWT.
- [ ] Dialer background loops generate webhook urls pointing to dynamic PUBLIC_APP_URL.
- [ ] Serializers do not utilize __all__ wildcard strings.
- [ ] Frontend page directories build cleanly with zero lint or typescript any warnings.
- [ ] Form wizard validations block progress on step 2 if rules contain empty target values.
- [ ] All 32 Django backend tests pass successfully.
