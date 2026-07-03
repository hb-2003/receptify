---
name: ms-code-reviewer
description: Three-pass parallel code review. Spawns 3 independent agents (quality, blast radius, adversarial) that run simultaneously, then consolidates findings. Use before merging any branch. Plan file is optional.
effort: high
---

# Receptify Code Reviewer

Three-pass implementation reviewer. Each pass runs as an independent agent in parallel.

## Why a Skill, Not an Agent

Subagents in Gemini CLI/Claude cannot spawn other agents (the Agent tool is stripped from subagent toolsets). This skill runs in the main conversation so it CAN spawn the 3 parallel agents.

## How to Run This Review

Follow these steps exactly. Do not skip the fan-out.

### Step 1: Collect Context

Run these commands and save the results:

1. `git diff development...HEAD --name-only` — list of changed files
2. `git diff development...HEAD` — full diff (fall back to `git diff --staged` or `git diff` if no branch diff)
3. If the user provided a plan file path, read it

Catalog changed files into: models, views/serializers, API endpoints, helpers, frontend components/pages, migrations, config, other.

### Step 2: Spawn 3 Agents in a Single Message

Send exactly ONE message containing THREE Agent tool calls (subagent_type: general-purpose). All three run in parallel. Each receives the full diff, changed file list, and plan file content (if provided).

Do not set a model for the passes — let each agent inherit the session's currently selected model.

The prompts for each pass are defined below in the PASS sections. Paste the full diff and context into each prompt — do not ask the subagent to fetch it.

### Step 3: Consolidate After All 3 Return

Wait for all three to complete, then produce the consolidated report using the format in the "Consolidation Template" section below.

---

## PASS 1 PROMPT: Code Quality

Use this as the prompt for the Pass 1 agent:

"You are reviewing changed code for quality, conventions, and known pitfalls. You are ONLY looking at the changed files themselves — not their consumers or callers (that is a separate pass).

### Plan Compliance (only if plan file provided)

For each item in the plan:
- Was it implemented? Mark as DONE, PARTIAL, or MISSING
- Does the implementation match what the plan described?
- Are there changes to files NOT in the plan? Flag as scope violations

### Naming Quality

Read each changed file and check naming against the project naming philosophy — code should read like a story in plain English:
- Variable names should make sense when read out loud in a sentence
- No abbreviations (business not biz, campaign not camp, customer not cust)
- Booleans should read as questions (is_, has_, needs_, should_)
- Constants should include their unit (DELAY_MS, TIMEOUT_SEC)
- Function names should use the right verb (ensure = idempotent, resolve = figure out the answer, process = multi-step pipeline)

### Convention Checks

For each changed file, apply checks based on file type:

Django Models: UUID fields for primary keys, timestamps on new models use created_at/updated_at, foreign keys use explicit db_column, db_table explicitly declared in Meta class.

Django Views: business-scoping enforced via `request.user.business_id`, responses converted using `to_camel_case()` helper to support the Next.js frontend requirements.

Serializers: handles camelCase input properties, proper validation rules, clean mappings.

Next.js Frontend Components/Pages: TypeScript strictly typed (no any, proper interfaces), Tailwind styles following the glassmorphism gradients and blue branding palette, Lucide React icons, Sonner toast notifications, Zod for validation schemas.

Next.js Server-side/TypeORM: correct transaction handling for multi-row queries, safe queries with where filters utilizing parameterized properties.

### Security Checks

- No hardcoded credentials, API keys, or tokens (e.g., Twilio tokens, LLM keys)
- No SQL injection via raw query string concatenation
- No cross-business data leakage (ensure scoping checks are fully active)
- Authentication filters are fully active (e.g., JWT HttpOnly cookies check)
- No sensitive data in logs, error responses, or API outputs

### Comment Quality

- Plain English, no tech jargon
- Self-contained — never references other comments or code
- Multi-step processes use # --- pass name --- format
- No comments that just restate what the code does

Report findings with severity (CRITICAL/HIGH/MEDIUM/LOW), file path, line number, and specific fix recommendation."

---

## PASS 2 PROMPT: Blast Radius

Use this as the prompt for the Pass 2 agent:

"You are analyzing how the changed code affects the REST of the system — everything OUTSIDE the changed files. Your job is to find things that will break because of these changes.

### Consumer Analysis

For EVERY changed function, class, model field, component, or hook:

1. Grep the ENTIRE project for all consumers/callers/importers
2. Read each consumer file
3. Verify the consumer still works correctly with the change
4. Pay special attention to: background workers, mock calling thread, billing logs, database migrations, audio transcript helpers — these are commonly missed

For every renamed field, class, function, or import path — grep for the OLD name. Any remaining references are broken.

For every deleted file — grep for imports of that file.

Report a blast radius map: Changed item -> list of consumers found -> compatibility status (OK / BROKEN / NEEDS UPDATE)

### Frontend-Backend Parity

Verify database and response schemas:
- Did you change a Django model field? Check if the frontend page rendering, Next.js TypeORM schemas, or response conversion (`to_camel_case`) needs a corresponding change.
- Did you change frontend request payload keys? Verify the Django view parses the updated keys.

### Calling Simulator Pipeline Impact

If any call-related code changed (status transitions, calling aggregates, campaign launches):
- Verify the chain: Campaign -> CampaignCustomer -> Call -> CallTranscript -> CallRecording.
- Ensure aggregates like total_contacts, calls_completed, calls_answered are updated properly.
- Verify background worker thread doesn't conflict with concurrent updates.

Report findings with the blast radius map and severity grades."

---

## PASS 3 PROMPT: Break It

Use this as the prompt for the Pass 3 agent:

"You are a QA engineer trying to break this code. You have NOT seen any previous review findings. Your only job is to find inputs, scenarios, and edge cases that make this code fail.

### ENFORCED EVIDENCE RULES (READ TWICE)

Every finding MUST include all five of these fields:

1. **File path + line numbers** — absolute path and the exact line range of the suspect code.
2. **Verbatim snippet** — a 1-4 line copy-paste from the file, matching whitespace exactly. Not paraphrased. Not summarized.
3. **Triggering input or scenario** — concrete and reproducible. Examples: "POST body with empty phone or full name", "CSV upload with duplicate phone rows", "calling launch with 0 call credits".
4. **Actual behavior** — the specific failure mode (exception type + where it lands, wrong row written, leaked data, silent skip, etc).
5. **Expected behavior + minimal fix** — what should happen and the smallest code change that gets there.

If you cannot produce all 5 fields for a finding, **DROP THE FINDING**. Generic statements without a concrete trigger are rejected. Quality over quantity — three real bugs beats ten theoretical ones.

### Input Edge Cases
For every function, method, validation gate, or conditional:
- What happens with None/null?
- What happens with empty lists, empty strings, empty dicts?
- What happens with zero or negative credits in business logs?
- What happens with an invalid Indian phone number (e.g. not starting with 6-9, or wrong length)?
- What happens with concurrent campaign launches for the same campaign?

### Performance Edge Cases
- Any unbounded database fetches?
- Any performance bottlenecks in CSV processing?
- Any N+1 queries or redundant calls?
- Any threads left unjoined or background processes that could leak resources?

### Required Output Format

Use this EXACT structure for every finding — no prose between findings:

[SEVERITY: CRITICAL | HIGH | MEDIUM | LOW] Short title
File: <absolute path>:<line range>
Snippet:
```
<copy-pasted verbatim from the file — must match exactly, including indentation>
```
Triggering input/scenario: <concrete and reproducible>
Actual behavior: <what fails — exception type, wrong DB write, leaked data, etc>
Expected behavior: <what should happen instead>
Fix: <minimal code change>

End with a count line: `Total findings: N (Critical: x, High: y, Medium: z, Low: w)`.

If you find fewer than 3 real bugs after reading every file, say so explicitly. Do not pad with theoretical issues."

---

## Consolidation Template

After all 3 passes return, produce this report:

### Plan Completion (if plan was provided)

| Plan Item | Status | Notes |
|-----------|--------|-------|
| Step 1: ... | DONE / PARTIAL / MISSING | Details |

### Blast Radius Map (from Pass 2)

| Changed Item | Consumers Found | Status |
|---|---|---|
| Example | 3 direct, 2 via views | OK / BROKEN / NEEDS UPDATE |

### Findings by Pass

Group each pass's findings using this format:

[SEVERITY] Short description
File: path/to/file.py:line_number
Issue: What is wrong and why it matters
Fix: Specific fix recommendation

### Scope Violations (if plan was provided)
List any changes that fall outside the plan scope.

### Review Summary

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Pass 1   | 0        | 0    | 0      | 0   |
| Pass 2   | 0        | 0    | 0      | 0   |
| Pass 3   | 0        | 0    | 0      | 0   |

Severity levels:
- CRITICAL — Will cause bugs, data loss, or security vulnerabilities. Must fix before merge.
- HIGH — Pattern violation or missing functionality that will cause problems. Should fix before merge.
- MEDIUM — Could cause issues under certain conditions. Fix recommended.
- LOW — Convention or quality issue. Note for awareness.

Verdict: APPROVE / WARNING / BLOCK
- APPROVE — No CRITICAL or HIGH in any pass
- WARNING — HIGH issues exist, can merge after fixing them
- BLOCK — CRITICAL issues, must fix before merge

### Confidence Rule

- Report ONLY issues you are more than 80% confident about
- Do NOT fabricate issues or flag things that do not exist
- CONSOLIDATE similar issues
- SKIP stylistic preferences unless they violate project conventions
