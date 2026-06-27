# Receptify — Product Requirements Document

> **AI Voice Receptionist · Answer Every Call**
> A bulk AI calling SaaS for Indian SMEs (NBFCs, clinics, real-estate, gyms, D2C, coaching, local services).

## Original problem statement
A bulk AI calling platform for Indian businesses where users upload/add a customer list, choose a calling purpose, generate or customize a call script, and run automated calls using an AI voice agent. Premium glassmorphism design, blue brand palette, India-focused, compliance-aware. Stack: Next.js + TypeScript + PostgreSQL + TypeORM. Mocked calling pipeline for Phase 1.

## Architecture (delivered)
- **Frontend (port 3000)**: Next.js 15 App Router · TypeScript · Tailwind · Plus Jakarta Sans
  - UI pages + most `/api/*` routes (TypeORM + Postgres)
- **Backend (port 8001)**: FastAPI Python
  - Direct: `/api/llm/generate-script`, `/api/llm/generate-summary` (Claude Sonnet 4.5 via Emergent universal key)
  - Reverse-proxies all other `/api/*` → Next.js on `localhost:3000`
- **DB**: PostgreSQL 15 local cluster (`receptify` db, supervisor-managed)
- **Auth**: JWT in httpOnly cookie · bcryptjs hashing
- **Mock calling engine**: `src/lib/calling-mock.ts` — async loop transitions Call rows `queued → ringing → in_progress → completed/failed/no_answer` with weighted random outcomes, generates transcripts + recording placeholders, updates campaign aggregates.

## User personas
- NBFC / finance ops doing EMI reminders
- Clinic front-desk staff confirming appointments
- Real-estate brokers following up on enquiries
- Gym owners chasing membership renewals
- D2C brand managers confirming COD orders

## Core requirements (delivered in Phase 1)
- Marketing landing page with all sections (hero, problem, solution, how-it-works, use cases, industries, features, compliance, dashboard preview, benefits, pricing, FAQ, final CTA)
- Auth: signup, login, forgot-password
- Dashboard with KPI cards, 14-day line chart, outcome donut, recent campaigns/calls
- Sidebar nav with all 14 sections wired
- Customer mgmt: list, add modal, delete, search
- CSV upload flow: parse → map → preview → import (with phone validation + dedupe)
- Campaign list, delete, detail with live progress
- Campaign creation wizard: 7 steps (purpose → audience → script → voice → schedule → compliance → review)
- AI Script Generator page with Claude Sonnet 4.5 (graceful fallback if budget exhausted)
- Mock calling launch — produces simulated call statuses, transcripts, recordings, analytics
- Call history table with status/outcome filters
- Call detail with audio player, transcript, AI summary
- Analytics dashboard with KPIs + bar/donut charts
- Templates (9 pre-seeded industry templates)
- Compliance info page
- Billing page with plan + credits + plan cards
- Settings + Help pages
- Protected routes enforced via middleware

## Database (TypeORM)
Entities: User, Business, Customer, Campaign, CampaignCustomer, Script, Template, Call, CallTranscript, CallRecording, BillingPlan, Subscription, UsageLog.
Migrations: `src/lib/db/migrations/1700000000000-InitSchema.ts` + scripts in `package.json` (`db:migrate`, `db:generate`, `db:revert`, `db:show`, `db:seed`).

## Setup commands
```bash
# Bootstrap (idempotent — recovers DB on container reset)
bash /app/scripts/bootstrap.sh

# Frontend (Next.js + TypeORM)
cd /app/frontend
yarn install
yarn db:seed        # runs migrations + seeds demo data
yarn dev            # dev server on :3000
yarn build && yarn serve   # production

# Backend (FastAPI proxy + LLM)
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

## Environment variables
- `frontend/.env`: `REACT_APP_BACKEND_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `LLM_SERVICE_URL`
- `backend/.env`: `EMERGENT_LLM_KEY`, `NEXT_INTERNAL_URL`

## Demo account (seeded)
- `demo@receptify.in` / `Demo@1234` (see `/app/memory/test_credentials.md`)
- Business: Demo Clinic & Diagnostics · 1000 call credits · 10 customers

## Status — Phase 1 complete (Jan 2026)
- All 18 backend pytest cases pass
- ~95% frontend smoke tests pass (testing agent iteration_1.json)
- Landing, auth, dashboard, customer mgmt, CSV upload, campaign wizard, AI script generator, mock calling, call history/detail, analytics, templates, compliance, billing, settings, help — all working
- **MOCKED**: Calling engine (no Twilio/ElevenLabs yet) · Audio recording is silent WAV placeholder
- **MOCKED**: Claude script generation falls back to deterministic template if Emergent LLM key budget exhausted (returns 200 with valid 9-field structure)

## Prioritized backlog (Phase 2+)
- **P0** Real calling integration: Twilio + ElevenLabs/OpenAI TTS or Bolna/Vapi pluggable adapter
- **P0** Top up Emergent LLM key budget so Claude generates real scripts
- **P1** Admin panel (total users, businesses, revenue, monitoring)
- **P1** Email verification + password reset emails (SendGrid/Resend)
- **P1** Stripe / Razorpay subscription billing + invoice history
- **P1** Real DND-list scrubbing integration
- **P2** Team members & roles
- **P2** Custom voice training / cloning
- **P2** Multilingual transcript translation
- **P2** Custom webhook / Zapier integration
- **P2** Mobile app

## Known minor items
- `/api/auth/me` returns 200 with `{user: null}` when unauthenticated (intentional — middleware handles page-level auth).
- Recording audio is silent placeholder.
