---
name: feature-docs-guidelines
description: Use when creating or updating feature documentation. Provides consistent structure, templates, and rules for writing big-tech quality feature docs across Receptify.
effort: max
---

# Feature Documentation Guidelines

Use this skill when creating or updating documentation for any feature in Receptify. It ensures every feature's docs follow the same structure, are easy to navigate, and stay maintainable.

## When to Use

- When a feature is built and needs documentation
- When existing feature docs need updating after changes
- When someone asks for feature documentation
- Invoked as `/feature-docs-guidelines create` or `/feature-docs-guidelines update`

There is no specific time when docs must be created — sometimes right after shipping, sometimes later. Plan files in `docs/plans/` get deleted after the feature ships. Feature docs in `docs/{feature-name}/` are the permanent record.

## Modes

### Create Mode

1. Explore the feature's codebase thoroughly (backend models, views, api endpoints, frontend Next.js pages, TypeORM entities, typescript components)
2. Propose which doc files to create based on what the feature actually has (not every feature needs all files)
3. Get user confirmation on the proposed structure
4. Write each doc file following the template and rules below
5. After `overview.md` is written, invoke the `ubiquitous-language` skill in Feature mode targeting `docs/{feature-name}/overview.md` to populate the `## Vocabulary` section. This is part of the standard create flow, not an optional step
6. DO NOT start writing until the user approves the structure

### Update Mode

1. Read all existing doc files for the feature
2. Explore the current codebase for the feature
3. Identify gaps (new code not in docs), stale sections (docs describing code that changed), and missing pieces
4. Propose specific updates with reasoning
5. Apply approved changes
6. If the feature's `overview.md` has a `## Vocabulary` section and code or terms changed in this update, re-invoke the `ubiquitous-language` skill in Feature mode to refresh it in place. Do not let the Vocabulary section drift while the rest of the doc is updated
7. Update "Last verified" dates on all touched files

## File Structure

Feature docs live in `docs/{feature-name}/` with this structure:

```
docs/{feature-name}/
  overview.md              -- Doc index, vocabulary, constraints, user flows, architecture diagram
  backend/
    models.md              -- Why models exist, relationships, cross-app connections, design decisions
    api.md                 -- Permission patterns, error strategies, non-obvious API design decisions
    services.md            -- Flows, background task execution, script/summary LLM integration
    {concern-specific}.md  -- Split services.md by concern for larger features (see below)
  frontend.md              -- Next.js App Router, page structures, state management decisions, non-obvious patterns
```

### When to Split vs Combine

- If the backend is simple, use a single `backend.md` or even just `overview.md`
- If a feature has no frontend, skip `frontend.md`
- Only create a file when there is enough non-obvious content to justify it — if a file would just restate what the code says, skip it
- For larger features, split `services.md` by concern rather than keeping one large file. Name files after the concern they cover (e.g. `calling-simulation.md`, `csv-parser.md`, `llm-script-generator.md`), not after code structure (e.g. don't name them `helpers.md` or `utils.md`)
- When in doubt, fewer files is better than more files

## Language Standard

Feature docs are read more often than any other artifact in the project. They should follow the same readability philosophy as the code and comments:

1. **Plain English, no jargon.** If a sentence uses words like "hydrate", "propagate", "orchestrate", or "instantiate" — rewrite it in simpler words. Write like you're explaining to a smart colleague who hasn't seen this feature before.

2. **Context-aware descriptions.** Don't just list what something is — explain what it does and when it matters. "Stores call status" is a field description. "Each call in a campaign — starting as queued, then ringing, to in-progress, and ending as completed or failed, with transcripts and recordings for SME reviews" tells a reader why this model exists.

3. **Storytelling in flows and processes.** User flows and service descriptions should read like a narrative — what happens first, what that triggers, what comes next. Connective words (first, then, now, finally, if, otherwise) make flows readable without needing a flowchart.

4. **Precise but not verbose.** Every sentence should earn its place. If removing a sentence doesn't lose information, remove it. But don't sacrifice clarity for brevity — a clear two-sentence explanation beats a cryptic one-liner.

## Consistent Template

Every doc file follows this structure:

```
# [Title]

> When to read this: [actionable one-liner telling the reader when this file is useful]
> Last verified: YYYY-MM-DD

## At a Glance

Quick-reference summary. Tables, key facts, counts.
A reader who just needs a reminder stops here.

## [Content Sections]

The detailed explanation. Varies by file type.
Source file paths referenced at section start.

## Design Decisions

What was decided, why, what alternative was rejected.

## Connections

Related doc files. Where to go next for more detail.
```

### Rules for Each Section

**Title and One-liner:**
- The one-liner must be actionable: "Read this when you need to understand phone format validation or CSV column mapping" not "This file contains customer documentation"
- Set "Last verified" to today's date when creating or updating

**At a Glance:**
- Tables and bullet points only, no prose paragraphs
- Should fit on one screen (roughly 20-30 lines max)
- Include counts, key names, and quick-reference facts

**Content Sections:**
- Start each section with the source file path it documents
- Use tables for decisions, constraints, and cross-cutting connections — not for restating source file contents
- Use prose where flow or logic needs explaining and a table would not work
- No code blocks (project rule for docs/ folder)

**Design Decisions:**
- Only include decisions that are non-obvious or would surprise someone
- Each decision: what was decided, why, what was the alternative
- Skip obvious choices that anyone would make the same way

**Connections:**
- Link to other doc files in this feature's docs
- Link to project-wide reference docs (ARCHITECTURE.md, model-reference.md, etc.) when relevant
- Keep it to 3-5 links max

## Complementarity Principle

Docs and code complete each other — they should not compete over who has the latest information. Code is the source of truth for WHAT (fields, methods, parameters, component props). Docs are the source of truth for WHY (decisions, flows, constraints from external systems, cross-cutting connections, gotchas that would surprise a reader).

**Staleness test:** before writing any section, ask — if the code changes (a field renamed, a method added, an endpoint moved), will this section silently become wrong? If yes, you are documenting the WHAT instead of the WHY. Document what the code cannot tell you.

| Belongs in docs                                        | Belongs in code (do not restate in docs)    |
| ------------------------------------------------------ | ------------------------------------------- |
| Why a model exists and how it relates to others         | Field names, types, and constraints          |
| Why an API is shaped a certain way, permission patterns | Endpoint paths, parameters, response shapes  |
| Data flows — what triggers what, in what order          | Method signatures and internal logic          |
| Timing dependencies and external system constraints     | Implementation details of calling/processing  |
| Cross-app connections and why they exist                | FK definitions and on_delete behavior         |
| Gotchas that would surprise someone reading the code    | Component props and hook return values        |

## Content Guidelines Per File Type

These describe what matters for each file type — not rigid section requirements. Let the actual content shape the structure. If a file type has nothing non-obvious to say for a given feature, skip the file entirely.

**models.md** — Why models exist and how they relate. Relationship diagram showing the full picture across apps. Cross-app FKs and why they exist. Non-obvious constraints and design decisions about the data shape. Do not list fields — that is `models.py`.

**api.md** — Permission patterns and why they are the way they are. Error handling strategies. Non-obvious API design decisions (handling camelCase inputs, why endpoints are shaped a certain way). Cross-cutting patterns. Do not list endpoints — that is `urls.py`.

**services.md** — Flows: how data moves end-to-end, what triggers what, what depends on what. Timing and ordering requirements. External system constraints that shaped the implementation (e.g. Twilio SID, DND list rules). Background task worker threads. Do not list methods — that is the view/service file itself.

**Domain-specific docs** (calling-pipeline.md, llm-generation.md, etc.) — Pipeline flows with branching and conditional paths. External API constraints and quirks. Thresholds and why they are set where they are.

**frontend.md** — How the feature integrates into the Next.js App Router (pages, layout, middleware). State management decisions — Zod validation schemes, React local state, next/navigation. Key patterns that are not self-evident from reading the TSX component files. Do not list components, props, or hooks — that is the source directory.

## Flowchart Rules

Text-based flowcharts are valuable when a process has multiple steps with branching or looping — they make complex flows scannable at a glance. But a bad flowchart is worse than no flowchart.

**Use flowcharts for:** Architecture diagrams in overview.md, user flows with 3+ steps that branch or loop, calling pipeline flows with conditional paths, csv-upload lifecycles.

**Don't use flowcharts for:** Model relationships (use tables), endpoint listings (use tables), component hierarchies (use indented lists), anything with fewer than 3 steps or no branching.

**Readability rules:** Each node should be a short, plain-English phrase — not a function name or technical description. The flow should tell a story that someone unfamiliar with the code can follow. If a flowchart needs its own explanation to understand, it's too complex — simplify or split it.

## Overview-Specific Sections

The overview.md file has additional sections beyond the standard template:

**Documentation Map** — Table listing every doc file with a one-line description. This is the index readers use to find the right file.

**Vocabulary** — Feature-specific terms with canonical definitions and aliases to avoid. This section is generated and maintained by the `ubiquitous-language` skill in Feature mode — invoke it after the rest of the overview is written, and re-invoke it during Update mode if terms changed.

The section follows this format: a one-line pointer to `backend/UBIQUITOUS_LANGUAGE.md` (or `backend/UBIQUITOUS_LANGUAGE.md` / `backend/receptify/UBIQUITOUS_LANGUAGE.md`) listing the most relevant shared terms; a single Term / Definition / Aliases to avoid table; an optional **Flagged ambiguities** subsection only when real conflicts exist. Length budget is 30–60 lines. No example dialogue (the surrounding feature doc already shows the terms in use).

Only define terms that have a specific meaning within this feature. Foundational terms (Business, Campaign, Call, Customer, Script, etc.) live in the shared core file — reference them via the pointer line, do not redefine them.

**Constraints and Limits** — One central table of ALL hardcoded limits, thresholds, and magic numbers from the codebase. Include: what the limit is, what its value is, where it's defined (file path).

**User Flows** — Text-based flowcharts showing end-to-end user journeys. Focus on what the user does and sees, not internal implementation.

**Architecture Diagram** — One text-based diagram showing how the feature's pieces connect. Show: Next.js frontend, Django/FastAPI API, background threads, external integrations (Twilio, ElevenLabs), database. Keep it high-level.

## Verification Rules

Docs that reference code must be verified against the current codebase. Stale paths and outdated descriptions are worse than no docs.

**Before writing any file path in a doc**, glob or grep to confirm the file still exists. Do not write paths from memory.

**Before describing a function, class, or field**, read the source file to confirm the name, behavior, and signature still match. Do not trust what's already written in an existing doc — it may be stale.

**When updating docs**, read the source files for every section you touch. Compare what the doc says against what the code actually does. Update anything that's drifted.

**"Last verified" date** means "I read the source code and confirmed this doc matches the current implementation on this date." Do not update the date without actually verifying.

## Formatting Rules

1. No code blocks anywhere in docs (project rule for docs/ folder)
2. Use proper spacing for table structure: pad every cell with spaces so columns align visually in raw markdown source. Separator row dashes must match the column header width. Every cell needs at least one space after the opening pipe and before the closing pipe.
3. Tables for decisions, constraints, limits, and cross-cutting connections
4. Source file paths at the start of each section (not line numbers — they go stale)
5. No emojis unless the user explicitly requests them

## What NOT to Include

- Deployment steps or infrastructure details
- Testing guides or test case lists
- Full API request/response JSON examples
- Code blocks of any kind
- Anything already documented in CLAUDE.md or ARCHITECTURE.md files
- Setup instructions or environment configuration
- Future plans or roadmap items (those belong in plan docs under docs/plans/)
- Information derivable by reading source files — field definitions, method signatures, endpoint parameters, component props, hook return shapes. If someone can get it by opening the file, the doc should not restate it

## Quality Checks Before Finishing

Before marking documentation as complete, verify:

1. Every file follows the template (one-liner, last verified, at a glance, content, decisions, connections)
2. overview.md has: doc map, vocabulary, constraints table, user flows, architecture diagram
3. All source file paths referenced were verified via glob/grep against the current codebase
4. All function names, class names, and field names were verified by reading the source files
5. Tables have proper spacing: columns align visually in raw source
6. Flowcharts are readable as a story without needing code knowledge
7. api.md references Swagger and does NOT duplicate field specs
8. No section is empty (if nothing to write, remove the section)
9. Connections section in each file links to related docs
10. Vocabulary section only defines terms specific to this feature. Foundational terms (Business, Campaign, Call, Customer, Script, etc.) reference the shared core — they are not redefined here. The section was generated by the `ubiquitous-language` skill, not hand-written
11. Language is plain English — no jargon, no technical vocabulary where simple words work
