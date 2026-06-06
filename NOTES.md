# NOTES.md — Parser and PWA Assumptions

---

## Phase 1 — Parser assumptions (`server/parser.js`)

Assumptions the parser makes about `PUTER.md` structure. Revisit these if formatting changes.

### Section detection

- Top-level sections are identified by `## Heading` lines (H2). The parser splits the file at each H2 and processes each section independently.
- Section names are matched by prefix (e.g. `"Daily Checklist"` matches `"## Daily Checklist"`), so minor title edits won't break parsing.

### Daily Checklist

- Sub-sections are identified by a line that is **only** a bold span: `**Text**` (nothing before or after the asterisks on the line). These become the section headers (e.g. "Morning — in order", "Night", "Building — working toward daily").
- Checklist items use `- [ ]` (unchecked) or `- [x]` / `- [X]` (checked). Capitalization of `x` is tolerated.
- Blockquote lines (`> text`) are attached as a `note` to the current sub-section and displayed beneath its items.
- H3 headings or other markup inside the Daily Checklist section are silently skipped.

### Recurring

- Any `- [ ]` / `- [x]` line is treated as an item.
- Bare `- text` lines (no checkbox) are included as unchecked items — this handles any entries missing the bracket syntax.
- H3 headings and blockquotes are skipped.

### This Week

- The `Week of: ____` line is extracted; the value after the colon is the week identifier (may be blank/underscores, which displays as `—`).
- Items are collected from `- [ ]` / `- [x]` lines **before** the `### Weekly Review` sub-heading. Items after that heading are ignored (they belong to the Weekly Review protocol, not the week's tasks).
- Blank placeholder items (`- [ ]` with no text after the bracket) are silently dropped.

### Goals

- Tier groups are identified by `### Tier Name` headings (H3). Expected: `### Top Priority`, `### Medium Priority`, `### Low Priority`.
- Individual goals are identified by a bold-only line matching `**ID — Name**` where ID is 2–4 uppercase letters.
- Everything between one goal heading and the next (or end of tier) is treated as the goal's body text, joined and trimmed. Markdown in the body (bullet points, blockquotes) is preserved as plain text.
- If a goal heading appears before any tier heading, it is placed in an `"Unknown"` tier with a parse warning rather than crashing.

### Error handling

- If any section is missing, the parser returns an empty result for that section plus a `parseWarning` string.
- If a section throws during parsing, the parser catches it and returns an empty result + warning. Other sections are unaffected.
- Parse warnings are passed through the API and displayed in the UI as quiet inline notices.

---

## Phase 2 — PWA and LAN serving assumptions

### One origin, one port

`npm run serve` builds the client and starts Express on `0.0.0.0:PORT` (default 3001). The built frontend is served as static files from `client/dist`; the `/api/*` routes sit on the same origin. Dev mode (`npm run dev`) still uses two processes (Vite + Express) with a Vite proxy — the LAN/serve path is only for phone use.

### Service worker caching strategy

- **Precached (shell):** all files matching `**/*.{js,css,html,svg,png,ico}` in `client/dist`. This is the app shell — the UI renders from cache when the PC is off.
- **API routes (`/api/*`):** network-only. The service worker does not intercept or cache these. If the network call fails, the fetch rejects and the offline state UI appears. Stale API data is never presented as live.
- `navigateFallback: 'index.html'` ensures that opening the PWA icon offline (a navigation request) serves the cached shell rather than a browser error page.
- `navigateFallbackDenylist: [/^\/api\//]` ensures the fallback never fires for API routes.

### Reachability state

`App.jsx` pings `/api/health` on mount. `null` = in-flight (shows "Connecting…"), `true` = server reachable (shows dashboard), `false` = server unreachable (shows "Can't reach P.U.T.E.R." message). The data section API calls happen unconditionally but their results are only rendered when `serverUp === true`.

### Icons

Icons are solid-color PNG placeholders (`#4a7c59` accent). The 512×512 icon is declared as both the regular and maskable icon in the manifest — acceptable for a placeholder since the safe zone is the full image. Replace with proper artwork (192, 512 regular; 512 maskable with content in the inner 80%; 180 apple-touch-icon) when ready.

### iOS quirks (tested on iPhone 12 Pro)

- iOS Safari supports "Add to Home Screen" for HTTP PWAs; it does **not** surface an install banner like Android Chrome.
- The installed icon launches in a browser-wrapper rather than true standalone (no address bar, but also not full native feel). This is expected iOS behavior for HTTP.
- `apple-mobile-web-app-capable` and `apple-mobile-web-app-title` are set in `index.html` to improve the experience.
- The apple-touch-icon (180×180) is referenced via `<link rel="apple-touch-icon">` as well as included in the manifest; iOS uses the `<link>` tag preferentially.
- If true standalone (`display: standalone`) is needed on iOS, a local HTTPS cert (mkcert) is required. Deferred to Phase 4 or until Jacob requests it.

---

## Phase 3 — Daily-state and ID assumptions (v0.3.0)

### Daily Checklist IDs
- Each Daily Checklist item carries a trailing `<!-- id: SLUG -->`. The parser captures the slug into the item's `id` field and strips the comment from rendered text. Only the `id:` pattern is treated as an ID — section-note comments (`<!-- *text* -->`) are left alone.
- The box character on Daily items is no longer the source of check-state; it stays `[ ]` in PUTER.md (template). An untagged Daily item still renders but cannot hold state and emits a parse warning.

### Daily-state file
- The app owns `server/state/daily-state.json`, shape `{ day, checked[], hidden[] }` — the only file the app writes. PUTER.md / OneDrive are never written.
- `logicalDay()` sets the day boundary at 4am so a late-night session lands on the right day. On every state read/write, if the stored day ≠ the current logical day, state resets to empty — lazy rollover, no scheduler. Writes are atomic (`.tmp` → rename); `server/state/` is git-ignored.
- Check/hide require the live backend (PC on) — no offline write-queue. Hide is today-only and clears at rollover; Manage mode reveals hidden items and un-hides.

---

*Parser notes: Phase 1 (v0.1.0). PWA notes: Phase 2 (v0.2.0). Daily-state/ID notes: Phase 3 (v0.3.0). Update this file if `PUTER.md` formatting or the PWA strategy changes significantly.*
