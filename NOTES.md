# NOTES.md — Parser Assumptions

Assumptions the Phase 1 parser (`server/parser.js`) makes about `PUTER.md` structure.
Revisit these if formatting changes.

---

## Section detection

- Top-level sections are identified by `## Heading` lines (H2). The parser splits the file at each H2 and processes each section independently.
- Section names are matched by prefix (e.g. `"Daily Checklist"` matches `"## Daily Checklist"`), so minor title edits won't break parsing.

## Daily Checklist

- Sub-sections are identified by a line that is **only** a bold span: `**Text**` (nothing before or after the asterisks on the line). These become the section headers (e.g. "Morning — in order", "Night", "Building — working toward daily").
- Checklist items use `- [ ]` (unchecked) or `- [x]` / `- [X]` (checked). Capitalization of `x` is tolerated.
- Blockquote lines (`> text`) are attached as a `note` to the current sub-section and displayed beneath its items.
- H3 headings or other markup inside the Daily Checklist section are silently skipped.

## Recurring

- Any `- [ ]` / `- [x]` line is treated as an item.
- Bare `- text` lines (no checkbox) are included as unchecked items — this handles any entries missing the bracket syntax.
- H3 headings and blockquotes are skipped.

## This Week

- The `Week of: ____` line is extracted; the value after the colon is the week identifier (may be blank/underscores, which displays as `—`).
- Items are collected from `- [ ]` / `- [x]` lines **before** the `### Weekly Review` sub-heading. Items after that heading are ignored (they belong to the Weekly Review protocol, not the week's tasks).
- Blank placeholder items (`- [ ]` with no text after the bracket) are silently dropped.

## Goals

- Tier groups are identified by `### Tier Name` headings (H3). Expected: `### Top Priority`, `### Medium Priority`, `### Low Priority`.
- Individual goals are identified by a bold-only line matching `**ID — Name**` where ID is 2–4 uppercase letters.
- Everything between one goal heading and the next (or end of tier) is treated as the goal's body text, joined and trimmed. Markdown in the body (bullet points, blockquotes) is preserved as plain text.
- If a goal heading appears before any tier heading, it is placed in an `"Unknown"` tier with a parse warning rather than crashing.

## Error handling

- If any section is missing, the parser returns an empty result for that section plus a `parseWarning` string.
- If a section throws during parsing, the parser catches it and returns an empty result + warning. Other sections are unaffected.
- Parse warnings are passed through the API and displayed in the UI as quiet inline notices.

---

*This file documents the parser as of Phase 1 (v0.1.0). Update it if `PUTER.md` formatting changes significantly.*
