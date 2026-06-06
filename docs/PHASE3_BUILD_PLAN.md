# P.U.T.E.R. App — Phase 3 Build Plan
### Write-enabled Daily Checklist (check / uncheck + today-only hide)
**Operator:** Jacob Zolda
**Software version target:** v0.3.0
**Status:** Planned — ready for Claude Code execution

---

## Goal

P.U.T.E.R. stops being a viewer and starts being usable: check and uncheck Daily Checklist items, and hide items you don't need today — from PC or phone, sharing one backend. The source files stay untouched.

**Done when:** Jacob can run his entire Daily Checklist in the app — tap items done/undone, hide today's non-applicable items, reveal and un-hide them — and PUTER.md is never written by the app. State resets cleanly each day at 4am.

---

## The decision this phase is built on (Path B)

PUTER.md is the **template** — the list of *what the items are*. The app owns a separate **daily-state file** that holds *today's check/hide state*. The app reads PUTER.md (as it always has) and never writes to it. This keeps the OneDrive write-collision problem out of the app entirely, makes the daily reset free, and matches Operating Principle 5 (system and data are separate).

Consequences, now made literal:
- PUTER.md checklist boxes are all `[ ]`, permanently. The box character is no longer the source of check-state.
- The Saturday `[o]` backpack hide moves out of the file and into app state.
- Jacob stops hand-marking `[x]` / `[o]` in VS Code for the Daily Checklist. If a box is marked in the file, the app ignores it.

---

## Stable item IDs

Every Daily Checklist item carries an invisible ID in a comment, using the v0.6 convention:

```
- [ ] Brush teeth <!-- id: teeth-am -->
```

The parser extracts the ID, strips the comment, renders just "Brush teeth," and keys all state by the ID. IDs survive reordering and text edits — which is exactly why they make Phase 3.5 (reorder / add / edit text) a non-event instead of a state migration. This is the goal-ID philosophy applied one level down to checklist items.

The full ID assignment is in the PUTER.md migration instruction (run first, see Sequencing).

---

## Scope

**In:**
- Parser extracts `<!-- id: ... -->` from Daily Checklist items; strips it from rendered text; includes `id` in the `/api/daily` response.
- App-owned daily-state file (JSON), on the PC backend, outside OneDrive, gitignored.
- 4am lazy day-rollover: on any state read/write, if the stored day ≠ the current logical day, reset to empty state. No cron, no scheduler.
- New API: `GET /api/state`, `PUT /api/state/check`, `PUT /api/state/hide`.
- Interactive Daily Checklist: tap to check/uncheck (optimistic, reverts on failure).
- "Manage" mode toggle: reveals hidden items and exposes per-item hide/unhide controls. Covers both hiding and the reveal-hidden requirement.
- Header badge updated to make clear the *source files* stay read-only; only the app's own state file is written.

**Explicitly out (deferred):**
- **Daily-log writes** — logs stay in Bear → OneDrive, by Jacob's decision. The app never touches them.
- **This Week writes** — stays read-only, box-driven, hand-marked as today. (It needs a *weekly* reset cadence, not the daily one — belongs to a later phase.)
- **SQLite derived index** — its original justification was filtering log data; with logs out of the app, it has no job yet. Defers until a query actually needs it.
- **Offline write-queue** — was tied to logging on a bike ride. Check/hide require the live backend (PC on), so there is nothing to queue. Phase 2's offline message already covers the PC-off case.
- **Structural edits** (reorder, add task, edit task text) — Phase 3.5. Different, riskier write: it modifies PUTER.md itself.

---

## Architecture

### Daily-state file
- Path: `server/state/daily-state.json` (repo is already outside OneDrive). Add `server/state/` to `.gitignore`.
- Shape:
  ```json
  {
    "day": "2026-06-06",
    "checked": ["teeth-am", "shower"],
    "hidden": ["pack-bag"]
  }
  ```
- Writes are atomic: write to `daily-state.json.tmp`, then rename over the real file, so a crash mid-write can't corrupt it. Single backend process, so no lock needed.

### Day rollover (4am, lazy)
- `logicalDay(now)` = if local hour < 4, the date of *yesterday*; else the date of *today*. This puts Jacob's late-night tail (logs run past midnight) on the correct day.
- On every `/api/state` read and every write: if `stored.day !== logicalDay(now)`, replace state with `{ day: logicalDay, checked: [], hidden: [] }` and persist. Reset happens on first interaction after 4am — no scheduled job.

### API contract
- `GET /api/state` → `{ day, checked: [...ids], hidden: [...ids] }` (applies rollover first)
- `PUT /api/state/check` → body `{ id, value }` (boolean) → returns updated state
- `PUT /api/state/hide` → body `{ id, value }` (boolean) → returns updated state

`value` is the explicit target state, not a toggle — idempotent and safe when PC and phone are both open.

---

## Backend changes (`server/`)
- **`parser.js`** — for Daily Checklist lines, match a trailing `<!-- id: SLUG -->`, capture the slug, strip it from the item text. Item objects gain `id` (string) — `null` if no tag found. Keep tolerant parsing: an untagged Daily item still renders but can't hold state; surface a parse warning (consistent with existing behavior). Section-note comments (`<!-- *text* -->`) must NOT be mistaken for ID comments — match only the `id:` pattern. The box character on Daily items is ignored for state.
- **New `server/state.js`** — load/save the daily-state file, atomic write, `logicalDay()` helper, rollover-on-access.
- **`index.js`** — wire the three new endpoints to the state module.

## Frontend changes (`client/`)
- **`App.jsx`** — fetch `/api/state` alongside the existing endpoints; pass state + a refetch/update callback to `DailyChecklist`. Keep the Phase 2 `/api/health` offline guard.
- **`DailyChecklist.jsx`** —
  - Checked state comes from `state.checked.includes(id)`, not the box.
  - Hidden items (`state.hidden.includes(id)`) are filtered out in normal mode.
  - Tapping a checkbox: optimistic update → `PUT /api/state/check {id, value}` → revert + brief inline notice on failure.
  - **Manage mode** (header toggle): hidden items reappear, greyed; each item shows a hide/unhide button → `PUT /api/state/hide {id, value}`.
  - Items with `id === null`: render, but check/hide disabled.
- **Header badge** — change from a flat "read-only" to wording that says the source files (PUTER.md) stay untouched; the app writes only its own daily state.
- **This Week / Goals** — unchanged.

---

## Sequencing

1. **PUTER.md migration first** (separate Claude Code task in the OneDrive PUTER folder): tag every Daily Checklist item with its stable ID and reset all boxes to `[ ]`. The app's parser depends on these tags existing. Bumps PUTER.md to v0.8.
2. **App build** (this plan, in `C:\Users\jakez\Documents\puter_app`): the kickoff prompt.
3. **On completion:** add the Phase 3 entry to `PUTER_APP_BUILD_LOG.md` in OneDrive; tag the repo v0.3.0.

---

## Definition of done (verification)
- [ ] Open the app on PC and iPhone; both show the same checked/hidden state.
- [ ] Tap items checked/unchecked; refresh — state persists.
- [ ] Hide an item in Manage mode; it disappears in normal mode.
- [ ] Reveal + un-hide it in Manage mode; it returns.
- [ ] After 4am the next day, all checks and hides are cleared automatically.
- [ ] PUTER.md is byte-for-byte unchanged by any app action.
- [ ] PC off → Phase 2 offline message still shown (no write attempts).

---

## Versioning note
Software → **v0.3.0**. Document (PUTER.md) → **v0.8** from the ID migration. Two separate lines; do not conflate. v1 is still earned only at conversational + local model + always-on box.
