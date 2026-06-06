# Phase 2 Build Plan — Phone reach + PWA
**For:** Jacob (overview) and Claude Code (executable brief below)
**App version target:** v0.2.0
**Repo:** `C:\Users\jakez\Documents\puter_app` (GitHub: jacobzolda/puter_app)
**Builds on:** Phase 1 — read-only dashboard, complete and verified
**Status:** Ready to build

This is **brick three**: take the working read-only dashboard and make it reachable and installable from the phone, with zero new data risk. Phase 1 proved the markdown → app pipeline on the PC. Phase 2 puts that same pipeline in Jacob's hand over home Wi-Fi.

---

## What Phase 1 left us

- Backend in `server/`: tolerant `PUTER.md` parser, Express server with `/api/goals`, `/api/daily`, `/api/week`, `/api/recurring`, `/api/health`; reads `PUTER_DIR` from `.env`.
- Frontend in `client/`: `App.jsx` fetching all endpoints in parallel; `DailyChecklist.jsx`, `ThisWeek.jsx`, `Goals.jsx`; Vite proxy routing `/api/*` to the backend; responsive at a 600px breakpoint; read-only header badge.
- Run loop: `npm run dev`, open localhost, edit `PUTER.md`, refresh, change appears.

Phase 2 changes how the app is *reached and installed*, not what it shows. The three regions (Today, This Week, Goals) stay as they are.

---

## Non-negotiables (unchanged from Phase 1)

1. **Still read-only.** Phase 2 adds no write features. Never write to, move, or modify anything in `C:\Users\jakez\OneDrive\PUTER`. Writes are Phase 3.
2. **Markdown stays canonical.** No database. No SQLite — that is still Phase 3.
3. **No model/LLM calls.** No brain until Phase 5.
4. **Point, don't copy.** Do not add `PUTER.md`, `PUTER_DailyLog.md`, or `CLAUDE.md` to the repo. Read them from `PUTER_DIR`.
5. **Repo stays outside OneDrive.** Work inside the existing repo; no `git init`, no re-clone.
6. **Stay in scope.** Build only Phase 2. Anything under "Out of scope" is a later phase.

---

## Goal

Open P.U.T.E.R. on the phone, over home Wi-Fi, as an app-like icon on the home screen — while the PC is on. Same dashboard, same data, now in hand.

This breaks into two independent pieces that can be verified separately:

1. **Phone reach** — the phone's browser loads the dashboard from the PC's local network address.
2. **PWA install** — that page installs to the home screen, opens fullscreen, and shows a clear "PC must be on / no connection" state when the PC is unreachable.

---

## Architecture decisions for this phase

These extend the settled decisions in `ROADMAP.md`; none of them conflict with it. If Claude Code finds a conflict, it stops and asks rather than guessing.

- **One origin, not two.** In dev, Phase 1 runs Vite (client) and Express (server) as separate processes with a proxy. That is fine on the PC but awkward to reach cleanly from a phone. For Phase 2, the backend serves the built frontend as static files, so the phone hits **one** address and one port for both the app and the API. Keep the two-process dev mode for fast local iteration; add a "build + serve" path for phone use.
- **Bind to the LAN, deliberately.** The server must listen on `0.0.0.0` (all interfaces) rather than only `localhost`, so other devices on the home network can reach it. This is a conscious, documented choice — it is the whole point of the phase — and it is acceptable because the data is read-only and the network is Jacob's home Wi-Fi. Note it plainly in the README so the security posture is explicit and revisited at Phase 4 (always-on box) and Phase 3 (writes).
- **HTTP is acceptable here; HTTPS is a known asterisk.** PWAs normally require a secure context (HTTPS) to install, with one built-in exception: `localhost`. Over the LAN by IP, the phone is *not* on localhost, so the install prompt may not appear under plain HTTP depending on the browser. This is the one genuinely fiddly part of the phase — see "The HTTPS reality" below. Do not paper over it; surface it.
- **PWA does not mean offline yet.** Phase 2 makes the app *installable*, not *offline-capable*. The service worker should cache the app shell so the icon opens and the UI renders, but live data still requires the PC. **Offline-first capture is Phase 3** and must not be pre-built. A service worker that caches the shell is in scope; one that queues writes or fakes data is not.

---

## Backend — in scope

- Add a static-serving path: when the client has been built (`client/dist`), Express serves it at `/`, with the existing `/api/*` routes unchanged underneath. The phone loads everything from one origin.
- Change the listen host to `0.0.0.0` and keep the port configurable via `.env` (e.g. `PORT`, default something memorable like 4173 or 8080 — Claude Code picks, documents it). Keep `PUTER_DIR` exactly as Phase 1 had it.
- On startup, log the reachable LAN URL(s) — e.g. `http://192.168.x.x:PORT` — so Jacob knows what to type on the phone. Detect the machine's LAN IP and print it; if several, print all.
- `/api/health` stays, and is the natural thing the frontend pings to decide "is the PC reachable?"

## Backend — out of scope

- Any write endpoint (`POST`/`PUT`/`PATCH`/`DELETE`). Phase 3.
- Auth/login. Not needed on a trusted home LAN at this phase; note it as a Phase 4 consideration.
- SQLite, file watching, model calls.

---

## Frontend — in scope

- **Make it a PWA:**
  - Add a web app manifest (name "P.U.T.E.R.", short name "PUTER", theme/background colors matching the existing clean design, `display: standalone`, start URL `/`).
  - Provide app icons at the required sizes (at minimum 192px and 512px, plus a maskable icon). Simple, clean placeholder icon is fine — Jacob can swap art later; note that in the README.
  - Register a service worker that **precaches the app shell** (HTML, JS, CSS, icons) so the installed app opens and renders its frame without the network. Use a maintained tool rather than hand-rolling — `vite-plugin-pwa` (Workbox under the hood) fits the existing Vite setup. Configure it for shell caching only.
  - **Do not cache `/api/*` responses as if they were durable data.** Either leave API calls network-only, or use a short network-first strategy purely so a momentary blip doesn't blank the screen. The user must never see stale checklist data presented as current. When in doubt, network-only for `/api/*`.
- **Reachability state:** the app already handles loading/error from Phase 1. Extend the error state into a clear, friendly "Can't reach P.U.T.E.R. — is the PC on and on the same Wi-Fi?" message when `/api/health` or the data endpoints fail. This is the state the phone will actually hit most.
- Keep the responsive layout from Phase 1; verify it on a real phone viewport now that it'll be used there.

## Frontend — out of scope

- Offline data, write/queue/sync logic, background sync — all Phase 3.
- Any new screens, routing, or regions. Same single pane.
- Push notifications. Not on the roadmap for this phase.

---

## The HTTPS reality (the one fiddly part — read this)

PWA installability wants a secure context. `localhost` is exempt, but the phone reaching the PC by LAN IP is not localhost, so under plain `http://192.168.x.x` the install prompt's behavior varies by browser. There are three honest paths; Claude Code should implement the simplest that works and document the rest, not silently assume:

1. **Try plain HTTP first.** On some Android/Chrome setups the app is still usable and partially installable over HTTP on the LAN; the app shell and "add to home screen" may work well enough for Jacob's use. If it does, stop here — least complexity.
2. **Local HTTPS with a self-signed/mkcert certificate** if the install prompt won't appear over HTTP. This gets a true secure context but means trusting a local cert on the phone — extra steps, documented in the README.
3. **Defer true install, ship "Add to Home Screen" as-is.** Even without a full PWA install, iOS Safari and Android Chrome can pin any page to the home screen as an icon; combined with the cached shell that may satisfy the phase's "app-like icon" goal.

iOS note: Safari's PWA support is real but quirkier than Chrome's (icon and `display` handling differ). Since Jacob is on an iPhone 12 Pro now but the roadmap explicitly anticipates a move to a Fairphone (Android), build to the standard and don't special-case one OS. Test on the iPhone, note any iOS rough edges in `NOTES.md`.

Claude Code should pick path 1 if it works on Jacob's phone, fall back to 3, and only reach for 2 if Jacob wants the genuine install badge. Whatever it lands on, the README must state plainly which path is live and why.

---

## Done when

- From the phone's browser, on home Wi-Fi, typing the PC's LAN URL loads the real dashboard with live data while the PC is on.
- The page can be added to the phone's home screen as an icon and opens fullscreen (standalone) from that icon.
- Opening the icon while the PC is **off** shows the app shell and a clear "can't reach P.U.T.E.R." message — not a browser error page, not stale data presented as live.
- Still zero writes to anything in `PUTER_DIR`; OneDrive files untouched.
- README updated: how to build and serve for phone use, the LAN URL, the `0.0.0.0` security note, which HTTPS path is live, and the "icon art is a placeholder" note. `NOTES.md` updated with any iOS quirks and PWA assumptions.

---

## Deliverables

1. Backend serving the built client at one origin, bound to the LAN, printing the reachable URL on startup.
2. Installable PWA: manifest, icons, shell-caching service worker via `vite-plugin-pwa`.
3. Friendly unreachable-state UI.
4. Updated `README.md` (run/build/serve, LAN URL, security note, HTTPS path chosen) and `NOTES.md` (assumptions, iOS quirks).
5. `package.json` bumped to `0.2.0`.
6. Clean commits with clear messages, pushed to `origin main`.

---

## After Claude Code finishes (for Jacob)

- Test it on the iPhone over your home Wi-Fi, PC on, then PC off, and confirm the four "Done when" bullets.
- Add a Phase 2 entry to `PUTER_APP_BUILD_LOG.md` in the OneDrive folder, same style as the Phase 1 entry, noting what was built and which HTTPS path is live.
- Bring the result back to this project and we'll check it against this plan before scoping Phase 3 (the first phase that writes — where the read-only guarantee finally, carefully, comes off).
