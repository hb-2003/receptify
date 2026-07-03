---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language vocabulary from the current conversation or codebase, flagging ambiguities and proposing canonical terms. Embeds into a feature doc's overview.md by default, or updates the shared backend core file. Use when user wants to define domain terms, build a glossary, harden terminology, create a ubiquitous language, or mentions "domain model" or "DDD".
disable-model-invocation: true
---

# Ubiquitous Language

Extract and formalize domain terminology into a consistent vocabulary section. Two modes:

- **Feature mode** *(default)* — embed a `## Vocabulary` section into a feature's `docs/<feature>/overview.md`. This is the common case.
- **Shared core mode** — update the project's shared core file at `backend/UBIQUITOUS_LANGUAGE.md`, used only for foundational vocabulary that crosses every feature.

The target always comes from the input prompt. If the user did not specify, ask which mode and which file before doing anything else. Never default to writing a new file in the working directory.

## Process

1. **Determine the target.** From the user's prompt, identify whether this is Feature mode or Shared core mode and the exact target file path. If ambiguous, ask.
2. **Read the shared core first** (`backend/UBIQUITOUS_LANGUAGE.md`). In Feature mode you need to know which terms are already canonical so you don't redefine them. In Shared core mode you need to know what's already there.
3. **Scan the source material** — the conversation, the relevant code, the existing feature doc — for domain-relevant nouns, verbs, and concepts.
4. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
5. **Propose a canonical set** with opinionated term choices.
6. **Write to the target file** using the format that matches the mode (templates below).
7. **Output a summary** inline in the conversation.

## Feature mode

The default mode. Embeds a `## Vocabulary` section into a feature's `overview.md`.

### Template

```md
## Vocabulary

> For foundational terms used here — **<list 3–5 most relevant shared terms>** — see `backend/UBIQUITOUS_LANGUAGE.md`. This section names only the terms specific to the <feature-name> feature.

| Term            | Definition                                                       | Aliases to avoid              |
|-----------------|------------------------------------------------------------------|-------------------------------|
| **<Term>**      | <One-sentence definition. What it IS, not what it does.>          | <comma-separated synonyms>    |
| ...             | ...                                                              | ...                           |

### Flagged ambiguities

- **"<word>"** — <what the conflict is>. <Recommended canonical use.>
- ...
```

### Feature-mode rules

- **Length budget: 30–60 lines** including the pointer, table, and ambiguities. If the section grows past 60 lines, you're re-explaining the feature — trim it back to terms only.
- **No example dialogue.** The surrounding feature doc already shows the terms in use.
- **Pointer to shared core is required.** List 3–5 of the shared terms most relevant to this feature in the pointer line so a reader knows what they're getting from the core.
- **Skip the Flagged ambiguities subsection if there are none.** Don't pad with weak entries.
- **Section name is `## Vocabulary`**, not "Glossary", "Terminology", or "Definitions".
- **Replace, never duplicate.** If the feature doc has an existing "Glossary" or "Vocabulary" section, replace it in place. Do not append a second one and do not create a parallel file.
- **Position the section near the top** — after the "At a Glance" section but before "Constraints and Limits". A reader should be able to learn the words before they read the rules.

### Re-running in Feature mode

When invoked again on the same feature:

1. Read the existing `## Vocabulary` section in the target file
2. Incorporate any new terms or ambiguities from subsequent code/conversation changes
3. Rewrite the section in place (do not append, do not version)
4. Re-flag any new ambiguities; remove ones that are no longer real

## Shared core mode

Used only when updating `backend/UBIQUITOUS_LANGUAGE.md`. This file holds vocabulary that crosses every feature — Campaigns, Call History, Call Outcomes, CSV Customers, AI Script generation, and Business multitenant boundaries.

### Template

```md
# Backend Ubiquitous Language — Shared Core

<one-paragraph intro>

> <one-line note about what lives here vs. in feature docs>

## <Cluster heading>

| Term       | Definition | Aliases to avoid |
| ---------- | ---------- | ---------------- |
| ...        | ...        | ...              |

## <Another cluster heading>

...

## Relationships

- <bullet list of cardinalities and rules>

## Example dialogue

> **Dev:** "..."
> **Domain expert:** "..."
> ...

## Flagged ambiguities

- **"<term>"** — ...

## Feature-specific vocabulary

| Feature | Vocabulary lives in |
| ------- | ------------------- |
| ...     | ...                 |
```

### Shared-core rules

- **Group terms into multiple tables** when natural clusters emerge (Business & Users, Campaigns & Audits, Calls & Transcripts, AI scripting, etc.). Each cluster gets its own heading and table.
- **Include a Relationships section** with cardinalities — User belongs to Business, Customer belongs to Business, CampaignCustomer joins Campaign and Customer, Call belongs to Campaign, etc.
- **Include an Example dialogue** (3–6 short exchanges between a dev and a domain expert) that demonstrates how the cross-cutting terms interact. This is where dialogue earns its keep — feature docs don't need it but the shared core does.
- **Include a "Feature-specific vocabulary" index at the bottom** mapping each feature to where its `## Vocabulary` section lives.
- **No length budget** — but every term must justify its place. Foundational only. If a term only appears in one feature, it does not belong here.

## Universal rules (both modes)

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid. Do not punt by listing all options as equal.
- **Definitions are one sentence.** Define what it IS, not what it does. If you need two sentences, the term is too coarse — split it.
- **Aliases are real.** List actual synonyms you've seen in code, docs, or conversation — not invented ones. The aliases column is what catches drift.
- **Flag conflicts explicitly.** When the same word means two things, the Flagged ambiguities subsection must call it out and recommend a canonical use.
- **Skip implementation names.** Class names, function names, file paths are not domain terms unless they ARE the canonical name in conversation. `CallTranscript` is a class; **Transcript** is the term. Keep the term, list the class as an alias to avoid.
- **Skip generic programming concepts.** Array, function, endpoint, queryset — only include if they have feature-specific meaning.
- **Verify before writing.** Before listing a class name, function, or field, grep the codebase to confirm it still exists by that name. Stale aliases are worse than missing ones.

## Anti-patterns to refuse

- Writing a new `UBIQUITOUS_LANGUAGE.md` file in the working directory or repo root by default. The two valid targets are a feature `overview.md` (Feature mode) or `backend/UBIQUITOUS_LANGUAGE.md` (Shared core mode).
- Duplicating shared-core terms inside a feature `## Vocabulary` section. Reference them via the pointer line; do not redefine them.
- Adding example dialogues to feature-mode sections. Save dialogue for the shared core.
- Producing 200-line "vocabulary" sections that are really feature documentation. If you cross 60 lines in Feature mode, the section has drifted into mechanics — trim it.
