# GEMINI.md — Development Handbook & Workflow

This file defines the technical overview, operational commands, and the step-by-step development flow that Gemini must follow for every feature, bugfix, or refactoring task in this repository. Follow all sections rigorously.

---

## 1. Project Overview & Architecture

Receptify is an enterprise-grade calling assistant and CRM campaign platform tailored for SMEs and clinics.

### Technology Stack & Layers:
- **Frontend**: Next.js (TypeScript, React 19, TailwindCSS). Styled using polished, glassmorphism layouts, Lucide icons, and Sonner notifications. Interactive components are located in `frontend/src/`.
- **Backend**: Django REST Framework (Python 3.9, django-decouple, psycopg2). Built with clean modular apps under `backend/` (`customers`, `campaigns`, `calls`, `llm`, `receptify`).
- **Database**: PostgreSQL with optimizations for dynamic key querying. Custom dynamic fields are stored in `JSONB` with `jsonb_path_ops` GIN indexing, and tags are stored in native `ArrayField(CharField)` columns.
- **Background Pipeline**: Asynchronous background workers and threads (e.g., `campaigns/dialer.py`) handle concurrent outbound campaigns and dialing simulations with atomic state transitions.
- **External Integrations**: Twilio (outbound call dispatches & webhook dispatches), Resend (emails), and Gemini API / Claude Sonnet (AI script synthesis).

---

## 2. Building & Running

### Backend Services (`backend/`)
- **Virtual Environment Setup**:
  ```bash
  python3.9 -m venv backend/venv
  source backend/venv/bin/activate
  pip install -r backend/requirements.txt
  ```
- **Database Migrations**:
  ```bash
  python backend/manage.py migrate
  ```
- **Run Django Server**:
  ```bash
  python backend/manage.py runserver 8000
  ```
- **Execute Test Suite**:
  ```bash
  python backend/manage.py test calls campaigns customers llm receptify --noinput
  ```

### Frontend Services (`frontend/`)
- **Installation**:
  ```bash
  npm install
  ```
- **Run Next.js Dev Server**:
  ```bash
  npm run dev
  ```
- **Production Build**:
  ```bash
  npm run build
  ```
- **ESLint/TS Checks**:
  ```bash
  npm run lint
  ```

---

## 3. Development Conventions & Patterns

### Backend Patterns (Django)
- **Primary Keys**: Always use UUID fields (`id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`).
- **Timestamps**: Ensure models inherit `created_at` and `updated_at` datetime fields.
- **Booleans**: Follow standard question prefixes (`is_`, `has_`, `needs_`, `should_`).
- **Scoping**: All queries must enforce business partition constraints on `request.user.business_id`.
- **Response Format**: Convert snake_case output properties using `to_camel_case()` helper.

### Frontend Patterns (React/Next.js)
- **Type Safety**: Strictly typed TypeScript (no `any` casts). Use local/Context state management.
- **DND/Compliance**: Enforce mandatory opt-out keyphrases (`opt-out`, `press 9`, or `dnd`) and minimum length ($\ge 30$ chars) on calling scripts before letting campaigns launch.

---

## 4. Development Workflow Stages

Follow these stages in order. Do not skip a stage or jump ahead without explicit approval.

### Stage 1 — Ticket Review
- Read and understand the Jira ticket fully (description, acceptance criteria, linked designs/specs) before writing any code.
- Ask clarifying questions if anything in the ticket is ambiguous.

### Stage 2 — Branch Creation
- Create a new branch named after the Jira ticket key + short description.
  - Format: `<TICKET-KEY>-short-description`
  - Example: `PROJ-123-add-user-login`

### Stage 3 — Planning
- Use skill: **`.gemini/skills/planning-guidelines`** to draft an implementation plan (approach, files to touch, edge cases, risks).
- Use skill: **`.gemini/skills/grill-me`** to stress-test the plan — challenge assumptions, poke holes, question edge cases — before presenting it.
- Present the plan to the user and **wait for explicit approval** before moving to implementation. Do not write backend/frontend code until approved.

### Stage 4 — Backend Development (after plan is approved)
Apply the following skills:
1. **`.gemini/skills/backend-patterns`** — follow established backend architecture/design patterns used in this codebase.
2. **`.gemini/skills/api-design`** — follow REST/API design conventions.
3. **`.gemini/skills/naming-conventions`** — apply consistent naming.

### Stage 5 — Frontend Development
Apply the following skills:
1. **`.gemini/skills/frontend-patterns`** — follow established frontend architecture/component patterns used in this codebase.
2. **`.gemini/skills/naming-conventions`** — same naming discipline as backend, adapted to frontend conventions.

### Stage 6 — Pre-Commit Code Review
Before every commit, use skill: **`.gemini/skills/ms-code-reviewer`** to:
- Review the diff for correctness and style.
- Check for **duplicate code** — refactor into shared functions/utilities where found.
- Check for **dead code** — remove unused variables, functions, imports, and commented-out blocks.
Only commit once this review passes.

### Stage 7 — Pull Request
- Push the branch and create a PR targeting the `dev` branch.
- PR title should reference the Jira ticket key.
- PR description should summarize the change and link the ticket.

### Stage 8 — CodeRabbit Review
- Wait for CodeRabbit's automated review comments on the PR.
- Address each comment:
  - Fix valid issues and push updates.
  - Reply with reasoning on comments that are intentionally not actioned.
- Do not merge until CodeRabbit comments are resolved and the PR is approved.

---

## 5. Quick Reference Flow

```
Ticket Review
   ↓
Create Branch (named after Jira ticket)
   ↓
Plan (planning-guidelines skill) → stress-test (grill-me skill) → WAIT FOR APPROVAL
   ↓
Backend (backend-patterns + api-design + naming-conventions skills)
   ↓
Frontend (frontend-patterns + naming-conventions skills)
   ↓
Pre-Commit Review (ms-code-reviewer skill: check duplicate + dead code)
   ↓
Commit
   ↓
Create PR → dev branch
   ↓
Wait for CodeRabbit comments → resolve → Merge
```
