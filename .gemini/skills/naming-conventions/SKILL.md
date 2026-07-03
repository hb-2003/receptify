---
name: naming-conventions
description: Naming philosophy and conventions for Receptify. Use whenever naming variables, functions, classes, files, or modules in any part of the codebase (Python/Django or TypeScript/Next.js). Covers the "read it out loud" methodology, word choice precision, and the naming convention table by type.
---

# Naming Conventions

Use this skill whenever naming anything — variables, functions, classes, files, modules. Good names make code read like a story in plain English. If someone has to pause and re-read a name to understand it, the name is wrong.

Write code so that variable names, function names, class names, and overall structure read like a story in plain English. Avoid abbreviations, tech jargon, and heavy vocabulary. A reader should be able to follow the logic like reading a book, not deciphering a puzzle.

## Core Principles

1. **Read it out loud.** If a variable name sounds natural in a sentence, it's good. If it sounds robotic or needs explanation, pick a better word.
   - `is_valid_phone` reads naturally: "if this phone number is valid, format it"
   - `phone_check_flag` sounds like implementation jargon — bad.

2. **Choose the right word, not just a descriptive word.** The verb or noun should carry the exact meaning for the context.
   - `format_phone` — "format" signals standardization (takes raw text, standardizes to standard Indian E.164 form).
   - `validate_and_save_customer` — "validate_and_save" signals multi-step data flow check and DB execution.
   - `run_mock_campaign` — "run" signals asynchronous process simulation execution.

3. **No abbreviations. Write the full word. Always.**
   - `business` not `biz` (though `biz` may occasionally appear as a short parameter, avoid it for model fields or classes), `campaign` not `camp`, `customer` not `cust`, `recording` not `rec`.
   - Exception: standard, universally understood abbreviations like `id`, `uuid`, `jwt`, `csv`.

4. **Context-aware length.** Carry enough meaning to be understood, but don't repeat what surrounding code already tells you.
   - Inside a view that fetches campaigns: `campaign_name` is enough.
   - In a shared utility with no context: `generate_campaign_call_script` would be needed.

5. **Booleans read as questions.** Prefix with `is_`, `has_`, `needs_`, `should_` — they read naturally in if statements.
   - `if is_verified:` reads as a question with a yes/no answer.
   - `if has_unsaved_changes:` reads like prose.
   - `if verified:` or `if unsaved:` — unclear what's being asked.

6. **Avoid generic words.** Never use `data`, `values`, `process`, `handle`, `info`, `item`, `result`, `temp`, `stuff` as names — they say nothing about what the thing actually is. Use specific nouns and verbs that belong to the feature's domain.
   - `customer_data` → `customer_list` or `invalid_customers`
   - `process_values` → `format_csv_row` or `launch_calling_simulation`
   - `handle_result` → `save_call_transcript` or `parse_api_error`

7. **Constants include their unit** — encode what the number means.
   - `MAX_RETRY_ATTEMPTS` — you know it's retry count.
   - `CALL_DELAY_SEC` — you know it's seconds, not milliseconds.
   - `TIMEOUT_MS` — you know it's milliseconds.

## Naming Conventions by Type

| Type | Convention | Example |
|---|---|---|
| Models (Django) | PascalCase, noun phrase | `Business`, `Customer`, `Campaign`, `CallTranscript` |
| Views (Django) | PascalCase, modular description | `CustomerListCreateView`, `CustomerUploadView` |
| Serializers (Django) | PascalCase, `{Model}Serializer` suffix | `CustomerSerializer`, `CampaignSerializer` |
| Table Names (Postgres) | lowercase snake_case, plural | `businesses`, `customers`, `campaigns`, `calls` |
| Frontend Pages (Next.js) | PascalCase page view or layout | `CampaignsDashboard`, `CampaignWizard` |
| Frontend Components | PascalCase, descriptive noun | `KpiCard`, `EmptyState`, `StatusBadge` |
| TypeScript Types/Interfaces | PascalCase, with descriptive context | `User`, `Campaign`, `CallRecord` |
| Zod Schemas | camelCase with `Schema` suffix | `campaignFormSchema`, `loginSchema` |
| Utility Functions | camelCase (TS) or snake_case (Python) | `toCamelCase()`, `format_phone()` |

IMPORTANT: Names that need extra context to understand are wrong. Every name should be understandable when read alone, within its feature/functionality context.
