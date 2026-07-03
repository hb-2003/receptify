# How to Write Effective Skills

Reference guide for writing and maintaining skills that LLMs reliably follow. Based on research from Anthropic official docs, OpenAI Codex docs, SIFo 2024 Benchmark, and practitioner-tested patterns.

Read this before creating or restructuring any skill file.

---

## The Hard Limits

- LLMs reliably follow ~150-200 total instructions per session
- Claude Code's system prompt already uses ~50 of those slots
- CLAUDE.md files: under 200 lines (Anthropic official recommendation)
- Skill process files: 40-100 lines
- Longer files don't give more compliance — they give random compliance, because the model can't weight everything equally

## Skill File Structure

A skill process file (SKILL.md) contains exactly four things:

1. **Brief description** (2-4 sentences) — what this skill does and when to use it
2. **When to use** — bullet list of trigger conditions
3. **Process steps** — numbered, ordered, each step is actionable. If a step needs detail, point to a reference file
4. **Output specification** — what the result should look like

Everything else (examples, edge cases, detailed reference tables) goes in separate files inside the skill folder. The process file points to them with "Read `reference-file.md` for details."

## What Makes Rules Stick

Ranked by strength of evidence:

### 1. Position matters — first and last get the most attention

LLMs have primacy and recency bias. Rules buried in the middle of a long file get the least weight. Put your most critical rules at the very top and repeat the non-negotiable ones at the bottom.

### 2. Positive imperative, verb-first

"Use zoneinfo for timezone handling" beats "Don't use pytz for timezone handling." Anthropic confirmed directly: positive examples showing the right way are more effective than negative examples telling the model what not to do.

Format: `verb + what + (context if needed)`
- "Use Shadcn UI for all new components"
- "Place business logic in services, not in ViewSets"
- "Name boolean variables as questions — is_, has_, needs_, should_"

### 3. Explain why in one sentence

A bare rule: "Never use pytz" — gets ignored more often.
A rule with reason: "Never use pytz — it's deprecated and mishandles DST transitions, use zoneinfo instead" — the model generalizes from the reason and applies it correctly in edge cases.

Keep the why to one sentence. Long rationale paragraphs consume context budget for marginal compliance gain.

### 4. Reserve emphasis for genuine hard rules

"IMPORTANT", "MUST", "NEVER" — these work, but only when used sparingly. If everything is emphasized, the model learns to discount emphasis. Save it for rules where the model's default behavior directly conflicts with what you want.

### 5. Separate process from reference

The process file stays lean (40-100 lines). Examples, code patterns, edge case tables — all go in separate reference files. The process step says "Follow the pattern in `backend-examples.md`" and the model reads it only when executing that step.

### 6. Only write rules where the model's default conflicts with your choice

"Write clean code" wastes an instruction slot — the model does this without being told. "Use Shadcn UI, not RSuite" is a real rule because the model would otherwise use whichever it finds in the codebase. The test: "Would removing this rule cause the model to do something wrong?" If no, cut it.

### 7. Use hooks for guarantees, instructions for preferences

If you absolutely cannot afford a rule being ignored, enforce it structurally (git hooks, linters, CI checks). Instructions are probabilistic — they increase the chance the model follows the rule, but they don't make it certain.

## Format Rules

| Format | When to use |
|---|---|
| Verb-first bullet list | All rules and conventions |
| Numbered list | Sequential steps that must happen in order |
| Table | Decision trees (when X, do Y) and include/exclude lists |
| One-line why | After any rule where the reason isn't obvious |
| Emphasis (IMPORTANT, MUST) | Only for rules where default behavior conflicts |
| Prose paragraphs | Almost never — only for brief introductory context |
| Code snippets | Avoid in process files — they go stale. Describe the pattern in words, or point to a real file as the canonical example |

## Anti-Patterns

Things that research shows LLMs ignore or that waste context budget:

- **Duplicated rules across files** — 28.7% of cursor rules studied were duplicates. Pure waste of instruction budget
- **Prose paragraphs explaining history** — one-line "why" is enough. History belongs in git commits
- **Linter-enforceable rules** — if your formatter handles it, don't write it as an instruction
- **Vague rules** — "be thoughtful about architecture" can't be operationalized. Name the specific pattern, file scope, and expected output
- **Code examples that go stale** — describe the pattern in words, or point to a real file in the codebase as the canonical example. Code snippets in instruction files rot as the codebase changes
- **Rules the model already follows by default** — every unnecessary rule dilutes attention from the rules that actually matter
- **Kitchen-sink files** — a file that tries to cover everything covers nothing well. Split by concern, load on demand

## Maintenance

- After creating or updating a skill, check: "Is every line earning its place?"
- If a rule keeps getting ignored, it's either buried in too much text, too vague to act on, or conflicting with another rule
- Periodically audit skills against the codebase — remove rules for patterns that linters now enforce, or conventions that changed
- When the model makes the same mistake twice despite a rule, the rule is probably too vague or too buried. Rewrite it shorter and move it higher
