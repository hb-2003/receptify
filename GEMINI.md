# GEMINI.md — Development Workflow

This file defines the step-by-step development flow that Gemini must follow
for every feature/bugfix ticket in this repository. Follow the stages in
order. Do not skip a stage or jump ahead without the required approval.

Skills referenced below live in `.gemini/skills/`.

---

## Stage 1 — Ticket Review

- Read and understand the Jira ticket fully (description, acceptance
  criteria, linked designs/specs) before writing any code.
- Ask clarifying questions if anything in the ticket is ambiguous.

## Stage 2 — Branch Creation

- Create a new branch named after the Jira ticket key + short description.
  - Format: `<TICKET-KEY>-short-description`
  - Example: `PROJ-123-add-user-login`

## Stage 3 — Planning

- Use skill: **`.gemini/skills/planning-guidelines`** to draft an
  implementation plan (approach, files to touch, edge cases, risks).
- Use skill: **`.gemini/skills/grill-me`** to stress-test the plan —
  challenge assumptions, poke holes, question edge cases — before
  presenting it.
- Present the plan to the user and **wait for explicit approval** before
  moving to implementation. Do not write backend/frontend code until
  approved.

## Stage 4 — Backend Development (after plan is approved)

Apply the following skills:
1. **`.gemini/skills/backend-patterns`** — follow established backend
   architecture/design patterns used in this codebase.
2. **`.gemini/skills/api-design`** — follow REST/API design conventions
   (routes, status codes, payload shape, versioning, error format).
3. **`.gemini/skills/naming-conventions`** — apply consistent naming for
   variables, functions, classes, files, and folders on the backend.

## Stage 5 — Frontend Development

Apply the following skills:
1. **`.gemini/skills/frontend-patterns`** — follow established frontend
   architecture/component patterns used in this codebase.
2. **`.gemini/skills/naming-conventions`** — same naming discipline as
   backend, adapted to frontend conventions (components, hooks, styles,
   files).

## Stage 6 — Pre-Commit Code Review

Before every commit, use skill: **`.gemini/skills/ms-code-reviewer`** to:
- Review the diff for correctness and style.
- Check for **duplicate code** — refactor into shared functions/utilities
  where found.
- Check for **dead code** — remove unused variables, functions, imports,
  and commented-out blocks.

Only commit once this review passes.

## Stage 7 — Pull Request

- Push the branch and create a PR targeting the `dev` branch.
- PR title should reference the Jira ticket key.
- PR description should summarize the change and link the ticket.

## Stage 8 — CodeRabbit Review

- Wait for CodeRabbit's automated review comments on the PR.
- Address each comment:
  - Fix valid issues and push updates.
  - Reply with reasoning on comments that are intentionally not actioned.
- Do not merge until CodeRabbit comments are resolved and the PR is
  approved.

---

## Quick Reference Flow

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

---

## Skills Not Yet Placed in This Flow

Your `.gemini/skills/` folder also has these, which weren't mentioned in the
flow above. Let me know if/where you want them wired in:

- **`comment-writer`** — could run during Stage 4/5 to write code comments.
- **`feature-docs-guidelines`** — could run after PR creation (Stage 7) to
  generate/update feature documentation.
- **`ubiquitous-language`** — could run during Stage 3 (Planning) to align
  domain terminology before implementation.
- **`how-to-write-effective-skills.md`** — reference doc, not a workflow
  step; kept as-is.
