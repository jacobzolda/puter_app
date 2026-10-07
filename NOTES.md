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

## Phase 3.5 — Structural-write assumptions (v0.3.1)

### Surgical-edit rule
The app never regenerates PUTER.md from a parsed model. Every write locates the target item by its `<!-- id: SLUG -->` comment, modifies only that line (or swaps exactly two adjacent lines for reorder), and leaves every other byte of the file identical — blank lines, comment blocks, the version header, and the changelog are all untouched. Only the Daily Checklist section (`## Daily Checklist` up to the next `##`) is ever touched; This Week, Goals, and all other sections are off-limits.

### On-disk-change guard (optimistic concurrency)
`GET /api/daily` now returns a `fingerprint: { mtimeMs, hash }` alongside the sections. Every structure-edit request echoes the fingerprint back. The server re-stats and re-hashes PUTER.md; if either value differs it returns HTTP 409 `{ conflict: true, reload: true }` without writing. The frontend shows a "PUTER.md changed on disk — reload" banner and exits edit mode. This prevents clobbering edits made in VS Code or from another device while the app is open.

### Backups and atomic write
Before each accepted write, the server copies PUTER.md to `server/backups/PUTER.md.<ISO-timestamp>.bak` (oldest pruned when count reaches 20). The write itself goes to a `.tmp` file first, then an atomic `rename` replaces the live file — so PUTER.md is never in a partially written state. `server/backups/` is git-ignored and auto-created on first write.

### ID minting and uniqueness
New items: text is slugified (lowercase, non-alphanumeric runs → hyphens, max 60 chars). If the slug already exists in the section, a `-2`, `-3`, … suffix is appended until unique. The ID set is computed from the raw file lines (all `<!-- id: SLUG -->` patterns in the Daily Checklist section).

### What the client holds
The client stores the fingerprint in `daily.data.fingerprint` (updated from every GET /api/daily response and from every successful structure-edit response). The App component passes it into each structure-edit call; it is never persisted to localStorage or service-worker cache.

---

## Phase 3.6 — Rollover, Goals notes, This Week sub-sections (v0.3.2)

### 4am rollover now resolves in PUTER_TZ
`logicalDay()` previously derived the day from a UTC date while checking the hour in local server time — a mismatch that put the rollover at midnight UTC (8pm EDT). It now shifts the instant back 4 hours and formats the date in `PUTER_TZ` (default `America/New_York`) via `Intl.DateTimeFormat`, so the boundary is always 4am in that zone, DST-aware. Output is still a `YYYY-MM-DD` string and `daily-state.json`'s shape is unchanged. A one-time state reset on first run after deploy is expected.

### Goals strip contextual comments
The Goals parser now removes `<!-- ... -->` spans (including the italic `<!-- *note* -->` cross-reference comments under FIN/FIT/CRE) from each goal's assembled body, then drops any lines left empty by that removal. Daily Checklist id-handling and This Week parsing are unaffected.

### This Week parses bold sub-headers into groups
`parseThisWeek` now mirrors the Daily Checklist's bold-header grouping: a line that is only `**Text**` starts a new sub-section, and checkbox items collect under it. Items before the first header land in an untitled group. Trailing inline comments (e.g. `<!-- FIT -->`) are stripped from item text, same as the Daily convention. `GET /api/week` now returns `{ weekOf, sections: [{ title, items: [{ text, checked }] }] }` instead of a flat `items[]`; `ThisWeek.jsx` renders each section with a header, still read-only. The `### Weekly Review` guard remains as defensive code.

---

## Phase 4 — Container, proxy and access assumptions (v0.4.0)

### Two containers, one door
`compose.yaml` runs the app (`app`, built from `Dockerfile`) and nginx (`proxy`). The app publishes no port. nginx reaches it at `http://app:3001` over Compose's private network and is the only container with published ports. The app's `0.0.0.0` bind now means the container's own interfaces.

### Data lives outside the container
Three host folders under `PUTER_HOME` are mounted into the app: `data` → `/data` (`PUTER_DIR`), `state` → `/app/server/state`, `backups` → `/app/server/backups`. The container itself is disposable. The app runs as the image's `node` user (UID 1000) and assumes those folders belong to UID 1000 on the host, with owner write permission on the folder itself and not only on the files: every write is a temp file followed by a rename, and both are controlled by the folder. A read-only `data` folder fails with `EACCES … PUTER.md.tmp`.

### nginx looks the app up per request
`resolver 127.0.0.11` plus a variable in `proxy_pass` make nginx resolve the name `app` as requests arrive, through Docker's built-in DNS, instead of once at startup. nginx therefore starts whether or not the app is up, and follows the app when its container is recreated. Each port has a single `server` block, which makes that block the default: it answers whatever name or address was used. `server_name _` is only a placeholder name that matches nothing.

### The bind address, and its limit
The proxy's ports are published on `PUTER_BIND` only, and Compose refuses to start when it is unset (`${PUTER_BIND:?}`). The bind address decides which of the host's addresses answers. It does not check which interface a packet arrived on: Docker forwards anything addressed to the bound address, so a device on another of the host's networks that routes that address to the host still gets through. Restricting by interface takes a packet-filter rule that runs ahead of Docker's own, such as a drop in the `raw` table for traffic to the bound address arriving on the wrong interface. `ufw`'s ordinary rules do not apply, because Docker handles published ports before they see the traffic.

### Start order
If the bind address belongs to an interface that appears after boot (a VPN tunnel), Docker has to start after it. Otherwise the proxy fails with `cannot assign requested address` and is left without ports until it is recreated (`docker compose up -d --force-recreate proxy`); a plain restart is not enough.

### HTTPS and certificate files
nginx terminates TLS (1.2 and 1.3) with `server.crt` and `server.key` from `${PUTER_HOME}/certs`, mounted read-only. Port 80 serves exactly one file, `/ca.crt` (the certificate authority's public certificate, so a new device can fetch it), and redirects everything else to HTTPS. nginx's worker processes are unprivileged, so the `certs` folder and the two `.crt` files must be world-readable (755 and 644). The key stays 600; only nginx's root-owned main process reads it. The server certificate must list the address or name people open in its `subjectAltName`.

### Health check and restart
`server/healthcheck.js` calls `/api/health` from inside the container every 30 seconds, and the proxy waits for it at start (`depends_on: condition: service_healthy`). `restart: unless-stopped`, together with Docker starting at boot, is what makes the app a service. `init: true` gives Node a first process that forwards stop signals.

### Startup banner and version
The version is read from `package.json`, the only place it is written. When `PUTER_URL` is set the banner prints it as the app's address. Without it the banner falls back to listing the machine's own interfaces, which inside a container are internal addresses nobody can open.

### No CORS
`cors()` was removed. Serve mode and the container are one origin, and dev mode goes through the Vite proxy, so nothing needed it. With no login, an `Access-Control-Allow-Origin: *` header would have let any web page open in the user's browser read and edit through the API.

### Failures are visible
A structural edit that fails for any reason other than a conflict shows a "Save failed: …" banner carrying the server's message. A failed load of the daily state shows a warning, and the boxes stay disabled. The server logs every failed state or structure request as `METHOD path failed: message`; a 409 conflict is an expected outcome and is not logged. `server/state/` is created on the first write when it is missing, as `server/backups/` already was.

---

## Phase 4 Stage 5 — Line endings and a synced data folder (v0.4.1)

### Line endings
`splitH2Sections` strips a leading byte-order mark and splits on `\r?\n`. Every later parsing step works on the lines it returns, so none of them sees a carriage return. Before v0.4.1 the split was on `\n` alone: with Windows (CRLF) endings every line kept a trailing `\r`, the `$`-anchored patterns stopped matching, and the dashboard loaded with empty sections and no error.

The editor (`server/editor.js`) needed no change. It splits on `\n`, detects the file's ending once (`\r\n` present or not), and writes new and changed lines with that ending, so a CRLF file stays CRLF and an LF file stays LF. Item IDs are the same under either ending, because they come from the stripped line.

`PUTER.md` is kept with LF endings. CRLF is tolerated, not preferred. A file that mixes the two parses correctly, and edits follow the detected ending.

### The data folder may be synced
In the server deployment the `data` folder is also a Syncthing folder, so `PUTER.md` can change underneath the app at any moment. Nothing new was needed for that: the file is read on every request, and each structural edit carries the fingerprint (mtime + hash) of the copy the page was showing, so an edit made against a copy that has since been replaced by sync is refused with a 409 and the page reloads.

Syncthing replaces a file the same way the app does: it writes a temporary file in the same folder (`.syncthing.NAME.tmp`) and renames it over the original. Its own entries in the folder (`.stfolder`, and `.stversions` if in-folder versioning is ever used) are not markdown and the app does not look at them. When both sides changed a file, Syncthing keeps the loser as `NAME.sync-conflict-DATE-TIME-ID.md` beside the original; the app does not read or report those.

Syncthing does not keep an old version of a file that was changed on the device itself. The server-side history of the app's own edits is therefore the app's `backups` folder; Syncthing's versions folder holds what other devices overwrote.

*Parser notes: Phase 1 (v0.1.0). PWA notes: Phase 2 (v0.2.0). Daily-state/ID notes: Phase 3 (v0.3.0). Structural-write notes: Phase 3.5 (v0.3.1). Rollover/Goals/This Week notes: Phase 3.6 (v0.3.2). Container/proxy/access notes: Phase 4 (v0.4.0). Line-ending and synced-folder notes: Phase 4 Stage 5 (v0.4.1). Update this file if `PUTER.md` formatting, the PWA strategy, or the deployment changes significantly.*
