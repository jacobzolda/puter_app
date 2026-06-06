# P.U.T.E.R. App — Phase 3.5 Build Plan
### Structural editing of the Daily Checklist (reorder / add / edit text / delete)
**Operator:** Jacob Zolda
**Software version target:** v0.4.0
**Document version:** v0.8 (unchanged — no PUTER.md migration needed)
**Status:** Planned — ready for Claude Code execution

---

## Why this phase is the careful one

Through Phase 3, the app never wrote to PUTER.md — Path B put all daily state in the app's own file. Phase 3.5 changes that: the app now edits PUTER.md directly to reshape the Daily Checklist. This is the first time software touches the canonical, OneDrive-synced file, so the whole phase is built around writing it *safely* — never losing a hand-edit, never corrupting it, always recoverable.

The good news: because Phase 3 already tagged every item with a stable ID, **no PUTER.md migration is needed for 3.5.** The groundwork is done. Reorder, edit-text, and delete all key off IDs, so daily check/hide state survives every structural change with zero migration — which was the entire point of doing IDs early.

---

## Goal

Jacob can reshape the Daily Checklist from the app — reorder items, add a new one, edit an item's text, delete one — from PC or phone, without opening VS Code. PUTER.md stays valid, everything the app doesn't understand is preserved byte-for-byte, and any write is recoverable.

**Done when:** Jacob can reorder, add, rename, and delete Daily Checklist items in the app; PUTER.md reflects the change correctly with the rest of the file untouched; a concurrent edit is detected and refused rather than clobbered; and a backup of the prior version exists.

---

## Scope

**In:**
- Reorder a Daily Checklist item up/down within its sub-section.
- Add a new item to a sub-section (app mints a unique ID).
- Edit an item's text (ID preserved).
- Delete an item (with confirm; ID removed from daily-state).
- Safe-write machinery: on-disk-change detection, backup-before-write, atomic write, Daily-Checklist-only edits.
- An "Edit list" mode in the UI, distinct from Phase 3's "Manage" (today-only hide) mode.

**Explicitly out (deferred):**
- **This Week writes** — needs its own weekly-reset state design and an ID decision for transient items. Its own later increment.
- **Cross-sub-section moves** — within-section reorder first; moving an item to a different sub-section is an easy follow-on.
- **Editing anything outside the Daily Checklist** (Goals, This Week, changelog, headers) from the app — never. Those stay human / Claude Code edits.
- SQLite, conversational brain, offline write-queue — later phases.

---

## Safe-write design (the heart of this phase)

### Surgical edits, never regenerate
The app must **not** parse PUTER.md into a model and rewrite the whole file from that model — that would silently drop everything the parser doesn't capture (changelog, goals, comment blocks, blank lines, formatting). Instead, every operation is a **targeted line edit inside the Daily Checklist section only.** Locate the section (`## Daily Checklist` → next `##`), find the exact item line by its ID, transform just that line (or move it), and leave every other byte of the file identical.

### The template invariant holds
The box stays `[ ]`. The editor never writes `[x]` or `[o]` — check/hide state still lives only in `daily-state.json` (Phase 3). Edit-text rewrites only the text between `- [ ] ` and ` <!-- id: SLUG -->`; the box and the ID comment are preserved.

### Optimistic concurrency (don't clobber a hand-edit)
Before any write: read PUTER.md and record its `mtimeMs` (and a content hash). Apply the edit in memory. Immediately before writing, re-stat the file; if the mtime/hash differs from what was read, **abort** and return a conflict (HTTP 409) telling the client the file changed on disk. The client shows a "PUTER.md changed — reload" banner and re-fetches. This is what prevents the app from overwriting a change Jacob just made in VS Code (or one OneDrive just synced in).

### Backup-before-write + atomic write
On every accepted structural write: first copy the current PUTER.md to `server/backups/PUTER.md.<ISO-timestamp>.bak` (keep the last ~20, prune older), then write via temp file → atomic rename. So a bad or interrupted write can never corrupt PUTER.md, and the prior version is always recoverable. `server/backups/` is git-ignored.

### Residual OneDrive risk, stated honestly
These guards make concurrent edits *safe* (refused, not lost) and every write *recoverable*. They can't stop OneDrive from occasionally spawning a conflict copy if a sync lands mid-write — but the backup + atomic write mean no data is lost if it does. Real collisions are rare since Jacob is the only human editor on one PC; the machinery is there for when they aren't.

---

## ID lifecycle
- **Add:** slugify the new item's text, ensure uniqueness against all existing IDs (append `-2`, `-3`… on collision), write `- [ ] {text} <!-- id: {slug} -->`. The app guarantees uniqueness because daily-state keys off it.
- **Edit text / reorder:** ID never changes, so daily-state carries over untouched.
- **Delete:** remove the line, and remove the ID from `daily-state.json` `checked`/`hidden` if present.

---

## API (`server/index.js`, new `server/editor.js`)
- `POST /api/structure/add` → `{ section, text, position? }` → mints + returns new `id`, returns re-parsed Daily Checklist.
- `PUT /api/structure/text` → `{ id, text }`.
- `PUT /api/structure/reorder` → `{ id, direction: "up" | "down" }` (within sub-section).
- `DELETE /api/structure/item` → `{ id }`.
- All return the freshly re-parsed Daily Checklist on success, or **409** with a reload flag on an on-disk-change conflict.
- `section` is identified by its sub-section header text (e.g. `"Morning — any order"`), which the client already has from the parse.

`server/editor.js` owns: locate-section, locate-item-by-id, the four transforms, mtime/hash guard, backup, atomic write.

## Frontend (`client/`)
- **"Edit list" mode** — a header toggle separate from "Manage". In Edit list mode each item shows up/down arrows, an inline editable text field (or edit control), and a delete button (with confirm). Each sub-section shows a "+ Add item" row.
- **Normal mode and Manage mode are unchanged** from Phase 3.
- **Conflict banner** — any 409 surfaces "PUTER.md changed on disk — reload" with a reload button; reload re-fetches and exits Edit list mode.
- A brief "saving…" state on structural calls is fine (less frequent than checkbox taps).
- Touch-safe: arrows + buttons, no fragile drag gestures on the iPhone PWA.

---

## Guardrails baked into this build

These address the post-change tedium (doc drift, scattered port numbers). They apply going forward, not just to 3.5:

1. **Doc updates are part of Definition of Done, done in this same session by Claude Code** — not handed to Jacob afterward. See the closeout list below.
2. **Config has one source.** Port/paths live in `.env` and are printed at startup. New or edited docs reference them generically ("the port in `.env`", "the URL printed at startup") and mark any literal value as an example. No re-hardcoding the same value across files.
3. **App-driven template edits don't bump PUTER.md's version or changelog** (decision 4). The editor leaves the header and changelog alone.
4. **README stays structural** — directories and key files, not a line per component, so removing a file doesn't strand a stale reference.

---

## Definition of done (verification + closeout)

**Function:**
- [ ] Reorder an item up/down in a sub-section; PUTER.md line order changes, nothing else does.
- [ ] Add an item; it appears with a new unique ID; its box is `[ ]`.
- [ ] Edit an item's text; text changes, ID and box preserved; its daily check-state survives.
- [ ] Delete an item; line gone, ID cleared from daily-state.
- [ ] Edit PUTER.md in VS Code, then attempt an app edit without reloading → app refuses with a conflict, does not clobber.
- [ ] A timestamped backup exists in `server/backups/` after each write.
- [ ] Changelog, Goals, This Week, comment blocks, version header all byte-identical after an app edit.
- [ ] Daily check/hide (Phase 3) still works; state survives reorder and text edits.

**Closeout (Claude Code, same session):**
- [ ] `PUTER_APP_BUILD_LOG.md` — new Phase 3.5 entry (v0.4.0): editor module, safe-write strategy, API, Edit list mode, out-of-scope, test steps.
- [ ] `README.md` — version header → v0.4.0; new endpoints in the table; Phase scope updated; structure tree kept high-level.
- [ ] `NOTES.md` — new "Phase 3.5 — structural-write assumptions" section (surgical edits, mtime/hash guard, backups, atomic write, ID minting); footer line updated.
- [ ] `ROADMAP.md` — "Where we are now" updated (or left as a pointer to the build log per the guardrail); changelog entry; mark Phase 3.5 done.

---

## Versioning note
Phase labels and software versions are independent (two-version-lines principle). "3.5" is a roadmap waypoint; the software takes its next minor bump to **v0.4.0** for the new write surface. PUTER.md stays **v0.8** — its format is unchanged and app edits don't bump it. v1 is still earned only at conversational + local model + always-on box.
