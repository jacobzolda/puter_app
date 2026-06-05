# P.U.T.E.R. — Software Roadmap
### From living document to conversational system
**Operator:** Jacob Zolda
**Version:** 0.1
**Status:** Living document

---

## Purpose

This file is the long-term path for turning P.U.T.E.R. from markdown files into working software Jacob can use on his PC and phone. It keeps everyone — Jacob, the Claude.ai project, and Claude Code — pointed at the same destination, built brick by brick.

It complements the other two files without duplicating them:
- `PUTER.md` — the *system* (mission, principles, goals, checklists).
- `PUTER_DailyLog.md` — the *data* (daily activity).
- `ROADMAP.md` — the *build path* (this file): how the software gets made, in order.

---

## Two version lines (do not conflate)

P.U.T.E.R. now has two independent version numbers:

- **Document version** — `PUTER.md` (currently v0.4). Tracks the system's rules and structure.
- **Software version** — the app. Stays **v0.x** until it reaches **v1**.

**v1 is earned, not assigned.** The app is v1 only when it is **conversational, running on a local model, on the always-on machine.** Everything before that — dashboard, capture, reminders, even Claude wired in as an assist — is foundation, and stays v0.x.

---

## Settled architecture decisions

These are locked unless Jacob revises them. The reasoning lives in the project chat; the conclusions live here.

1. **Leverage, don't reinvent.** Build on solid, well-supported foundations so the system saves time rather than eating it.
2. **Markdown is the source of truth.** The app reads the markdown files as canonical. Any database is a *derived, disposable* index rebuilt from those files — never the other way around. This protects ownership, repairability, and plain-text longevity.
3. **Local web app, opened in a browser.** One app, reached from any device's browser — PC, Android, iOS — so switching phones (e.g. iPhone → Fairphone) is a non-event. No native app, no app store.
4. **The brain is a swappable seam.** The app talks to an endpoint that speaks the Anthropic Messages API. That endpoint is Claude (cloud) at first and a local open model (via Ollama, on the always-on box) later. Swapping the brain means swapping the endpoint, not rewriting the app.
5. **The host evolves; the app does not.** Backend runs on Jacob's PC now, and moves to a dedicated always-on machine later. Same app throughout.
6. **Sync evolves toward privacy-first.** OneDrive now (nothing sensitive yet). Self-hosted Syncthing once the always-on box exists and sensitive data is in play.

---

## Principles baked in from day one

So they are never an expensive retrofit:

- The model interface is designed as a swappable seam from the start, even before a brain sits behind it.
- The frontend carries an offline-first posture from the first write feature (capture must survive no signal — e.g. logging on a bike ride).
- The app always treats markdown as canonical and any database as disposable.
- The two version lines stay separate in all bookkeeping.

---

## Tech stack

- **Backend:** Node.js (one language across the app).
- **Frontend:** React (chosen — also doubles as portfolio evidence; cross-ref **CAR**).
- **Derived index:** SQLite, introduced when queries/writes need it (Phase 3) — not before.
- **Markdown layer:** parse the canonical files; tolerate human edits.
- **Version control:** the app lives in its own local git repository, kept **outside** the OneDrive-synced folder to avoid git/OneDrive conflicts.
- **Model runner (later):** Ollama on the always-on box, speaking the Anthropic Messages API.

---

## Phases

### Phase 1 — Read-only dashboard (brick two)
- **Goal:** Prove the markdown → app pipeline with zero risk to the source files.
- **Scope:** Backend parses `PUTER.md` and `PUTER_DailyLog.md`; serves one clean single-pane dashboard showing today's Daily Checklist, This Week, and Goals (focus: **CAR**, **HST**, **FIT**). Runs on the PC, opened in a browser.
- **Done when:** The dashboard renders the real files accurately and **never writes to them.**

### Phase 2 — Phone reach + PWA
- **Goal:** Use P.U.T.E.R. from the phone.
- **Scope:** Reach the dashboard from the phone's browser over home Wi-Fi (PC's local address). Make it an installable PWA — home-screen icon, fullscreen.
- **Done when:** The dashboard opens as an app-like icon on the phone while the PC is on.

### Phase 3 — Write-enabled + offline capture
- **Goal:** P.U.T.E.R. becomes genuinely useful, not just a viewer.
- **Scope:** Append to the daily log, check off tasks, edit This Week — from PC or phone. Introduce the SQLite derived index for fast filtering. Build offline-first capture that syncs when back online. Careful, safe writes to the canonical markdown.
- **Done when:** Jacob can run his nightly log and daily check-offs entirely in the app, offline-capable.

### Phase 4 — Always-on box + self-hosted sync
- **Goal:** Always available, privacy-first. *(Begins with a new chat for the PC build; cross-ref **PCB** / **FIN**.)*
- **Scope:** Stand up the always-on machine. Move the app onto it (served 24/7, reachable anywhere). Migrate sync from OneDrive to Syncthing.
- **Done when:** Every device reaches P.U.T.E.R. from anywhere, and sensitive data is self-hosted.

### Phase 5 — The brain → v1
- **Goal:** Conversational P.U.T.E.R. on a local model. **The finish line.**
- **Scope:** Wire in the model interface (Anthropic Messages API). Claude as brain first, then swap the endpoint to a local open model on the box. Add the conversational interface and command box.
- **Done when:** P.U.T.E.R. is conversational, on the local model, on the always-on box → **declare v1.**

---

## Where we are now

Phase 1, not yet started. Frontend framework chosen: React. Next action: Claude Code executes the Phase 1 build brief.

---

## Changelog
- **v0.1** — Roadmap established. Two version lines defined, six architecture decisions and four baked-in principles recorded, five phases laid out with definitions of done, React chosen, tech stack set.
