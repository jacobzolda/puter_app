# Phase 1 Build Brief — P.U.T.E.R. read-only dashboard
**For:** Claude Code
**App version target:** v0.1.0
**Repo:** `C:\Users\jakez\Documents\puter_app` (GitHub: jacobzolda/puter_app)
**Status:** Repo cloned and ready — begin build

This brief tells you exactly what to build for Phase 1 of the P.U.T.E.R. software. This is **brick two**: the smallest safe brick that proves the markdown → app pipeline.

The git repo already exists at `C:\Users\jakez\Documents\puter_app`, cloned from GitHub and correctly located outside OneDrive. **Work inside this repo. Do not run `git init` or re-clone.** It already contains a stub `README.md` and a Node `.gitignore` from GitHub.

Before starting, read these three files for context. The first lives in this repo; the other two live in the canonical OneDrive P.U.T.E.R. folder (the same path as `PUTER_DIR`, below) — open them **read-only**:
- `ROADMAP.md` (in this repo)
- `PUTER.md` (OneDrive P.U.T.E.R. folder)
- `CLAUDE.md` (OneDrive P.U.T.E.R. folder)

---

## Non-negotiables (read first)

1. **Read-only.** Phase 1 must never write to, move, or modify `PUTER.md`, `PUTER_DailyLog.md`, or anything in the OneDrive P.U.T.E.R. folder. Open those files read-only. If anyone asks for a write feature, that is Phase 3 — refuse and note it.
2. **Markdown is canonical.** The app reads the files as the source of truth. Do not reformat Jacob's files to suit the parser; make the parser tolerate his formatting.
3. **Never copy the life-system files into this repo.** `PUTER.md`, `PUTER_DailyLog.md`, and `CLAUDE.md` stay in OneDrive and are read via `PUTER_DIR`. They must not be added to the repo — not as copies, not as fixtures, not in test data. This keeps one source of truth and keeps personal data out of git history (the repo may go public later as a portfolio piece). The repo holds code and build docs only.
4. **Stay in scope.** Build only what is listed under "In scope." Everything under "Out of scope" belongs to a later phase — do not pre-build it.
5. **No creative content.** P.U.T.E.R. organizes and displays; it does not generate creative ideas. Not relevant to this phase, but the rule holds.

---

## Goal

A single-pane web dashboard, served locally and opened in a browser on the PC, that renders Jacob's real P.U.T.E.R. files accurately and read-only. It must prove three things work: reading the canonical files, parsing them into structured data, and displaying them cleanly.

---

## Tech

- **Backend:** Node.js. A minimal HTTP server (Express or Fastify is fine) exposing a small JSON API.
- **Frontend:** React, scaffolded with Vite.
- **Markdown parsing:** use a maintained parser (e.g. `gray-matter` for any frontmatter, plus a markdown/AST parser such as `remark`/`unified`, or a pragmatic line-based parser given the files' known structure). Choose the simplest approach that is robust to hand edits.
- **No SQLite in Phase 1.** Parse markdown → in-memory structured data → JSON. The derived SQLite index is deliberately deferred to Phase 3, when writes and filtering justify it. Do not add a database now.
- **No model/LLM calls.** There is no brain in Phase 1. Keep the backend modular so a `model` module can be added later (Phase 5), but do not build an empty seam now.

---

## Configuration

- The path to the canonical P.U.T.E.R. folder must be configurable via a `PUTER_DIR` env var, read from a `.env` file. It points at the OneDrive P.U.T.E.R. folder. **Jacob will supply the exact path** (it will look like `C:\Users\jakez\OneDrive\...\PUTER`). Do not hardcode it.
- `.env` must stay git-ignored. Confirm the existing `.gitignore` excludes `.env`; the standard GitHub Node template does, but verify. Provide a committed `.env.example` showing the `PUTER_DIR` key with a placeholder value.
- App version starts at `0.1.0` in `package.json`.

---

## Backend — in scope

Parse the two files (read from `PUTER_DIR`) and expose read-only JSON:

- `GET /api/goals` → goals parsed from `PUTER.md`: for each goal, its 3-char ID, name, priority tier (Top / Medium / Low), and body text. Preserve order.
- `GET /api/daily` → the Daily Checklist from `PUTER.md`: sections (Morning in-order, Morning any-order, Midday, Afternoon, Evening, Night, Building) with their items and each item's checked state as written in the file.
- `GET /api/week` → the "This Week" items and the "Week of" value.
- `GET /api/recurring` → the Recurring (non-daily) items.
- `GET /api/health` → simple OK + which files were found and last-read timestamps.

Parsing notes:
- The Goals section uses `### <tier>` headings and `**XYZ — Name**` goal headings. Items use `- [ ]` / `- [x]`.
- Be tolerant: if a section is missing or malformed, return what you can and include a per-section `parseWarning` rather than crashing. Never let one bad line take down the whole response.
- Files are read fresh per request (or cached with a short TTL) so edits in VS Code appear on refresh. No file watching required in Phase 1.

---

## Frontend — in scope

One single-pane dashboard. No routing, no multiple screens.

- **Three regions, in this priority order:** Today (the Daily Checklist), This Week, then Goals.
- **Goals region:** group by tier; visually surface **CAR**, **HST**, and **FIT** as the current focus (e.g. a "focus" marker), since those are Phase-1 priorities. Show all goals, but make the focus three easy to find.
- **Checklist display:** render items with their checked/unchecked state from the file. Checkboxes are **display-only** — non-interactive, nothing persists. Make it clear this is a read-only view (e.g. a small "read-only" indicator).
- **Design:** clean, calm, minimal — utilitarian, not flashy. Readable typography, generous spacing, one accent color. Use semantic, accessible markup. Build it responsive (it will be opened on a phone in Phase 2), but Phase 1 only needs to look right on desktop.
- **States:** handle loading, empty sections, and parse warnings gracefully with quiet inline messages.

---

## Out of scope (later phases — do not build)

- Any writing to files, check-off persistence, or editing (Phase 3).
- SQLite or any database (Phase 3).
- PWA, offline support, service workers, notifications (Phase 2 / 3).
- Phone/remote access setup (Phase 2).
- Any LLM/model integration or chat/command interface (Phase 5).
- Auth/accounts (not needed while local and single-user).

---

## Definition of done

- `npm install` then a single documented command starts backend + frontend.
- Opening the app in a desktop browser shows Today, This Week, and Goals, accurately reflecting the **real** `PUTER.md` and `PUTER_DailyLog.md` read from `PUTER_DIR`.
- Editing a file in VS Code and refreshing the browser shows the change.
- The app provably never writes to the OneDrive P.U.T.E.R. folder.
- The existing stub `README.md` is **expanded (edited/overwritten, not newly created)** to document: prerequisites, install, configuration (`PUTER_DIR` + `.env`), run commands, and a one-line note that this is P.U.T.E.R. app v0.1.0 and that **v1 = conversational on a local model** (the long-term target in `ROADMAP.md`).

---

## Deliverables

1. Working read-only backend + React dashboard per the specs above, committed to the existing repo.
2. Expanded `README.md` as described, plus a committed `.env.example`.
3. A short `NOTES.md` listing any parsing assumptions you made about `PUTER.md` structure, so they can be revisited if Jacob's formatting changes.
4. A clean commit (or small series of commits) with clear messages, pushed to `origin main`.
