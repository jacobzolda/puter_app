# P.U.T.E.R. App — v0.4.0

**P**ersonal **U**tility **T**o **E**nhance **R**elaxation — local dashboard for Jacob Zolda's life-management system, installable as a PWA on the phone.

> v1 = conversational on a local model (see `docs/ROADMAP.md`). Everything until then is foundation and stays v0.x.

---

## Prerequisites

- **Node.js** 18 or later
- The canonical **P.U.T.E.R.** folder on your machine (OneDrive or equivalent), containing `PUTER.md`
- For the always-on server only: **Docker Engine** with the Compose plugin. Node is not needed on the server; it comes inside the image.

---

## Install

```bash
# Install all dependencies (root + client)
npm run install:all
```

---

## Configuration

Copy `.env.example` to `.env` and set `PUTER_DIR`:

```env
PUTER_DIR=C:\Users\jakez\OneDrive\PUTER
PORT=3001        # optional — defaults to 3001
PUTER_TZ=America/New_York # IANA tz name — used for the 4am daily-state rollover
```

`.env` is git-ignored and never committed.

A server deployment uses a different set of variables in its own `.env` — see **Server (Docker, always on)** below. `.env.example` lists both sets.

---

## Run modes

### Dev (PC, fast iteration)

```bash
npm run dev
```

Starts the Express backend (port from `.env`, default 3001) and the Vite dev server (port 5173) in one terminal. Vite proxies `/api/*` to Express. Open **http://localhost:5173**. Edit `PUTER.md` and refresh to see changes immediately.

### Serve (phone use)

```bash
npm run serve
```

Builds the frontend (`client/dist`), then starts Express on `0.0.0.0:PORT`. The backend serves both the built app and the API from **one origin**. The URL to open on your phone is printed at startup — it looks like:

```
  Network (use on phone):
    http://192.168.x.x:3001
```

Type that address into the phone's browser while the PC is on.

Since v0.4.0 the phone normally uses the always-on server below. This mode remains for running everything from the PC.

### Server (Docker, always on)

The always-on deployment runs two containers, described in `compose.yaml`:

- **`app`** — this repo, built from `Dockerfile`. It publishes no port.
- **`proxy`** — nginx, configured by `nginx/puter.conf`. It is the only door: it serves HTTPS and passes each request to the app over Compose's private network.

Everything worth keeping lives in host folders under one directory (`PUTER_HOME`), mounted into the containers:

| Host folder | Holds |
|---|---|
| `data/` | The P.U.T.E.R. folder (`PUTER.md` and the logs) |
| `state/` | `daily-state.json` |
| `backups/` | `PUTER.md` backups |
| `certs/` | `server.crt`, `server.key` and `ca.crt` for HTTPS |

The first three must belong to the user with UID 1000 (the user the app runs as inside the container), with owner write permission on the folder itself.

Settings go in a `.env` beside `compose.yaml`. The values here are examples:

```env
PUTER_HOME=/srv/puter        # host directory holding the four folders
PUTER_BIND=10.0.0.1          # host address the proxy listens on — required
PUTER_URL=https://10.0.0.1   # the address you open; printed at startup
PUTER_TZ=America/New_York
```

```bash
docker compose config          # print the file with every variable filled in
docker compose up -d --build   # build and start in the background
docker compose ps              # expect both Up, and the app (healthy)
docker compose logs app        # startup banner: version, address, PUTER_DIR
```

Add `sudo` unless your user is in the `docker` group. Both containers restart after a crash and at boot (`restart: unless-stopped`).

**Updating:** commit and push from the PC, then on the server:

```bash
git pull
docker compose up -d --build
```

The server's checkout is pull-only. Never edit files there.

---

## Installing to the phone home screen

### Which HTTPS path is live

**On the server (v0.4.0): HTTPS from a private certificate authority.** nginx presents a certificate signed by a certificate authority (CA) you create yourself. Each device installs that CA's public certificate once and shows a padlock from then on. This is the "path 2" that Phase 2 deferred, done with a private CA instead of mkcert.

**With `npm run serve` on a PC: plain HTTP over the LAN (path 1)**, unchanged from Phase 2. The phone reaches the PC by its LAN IP, not `localhost`, so the full PWA install prompt that requires a secure context may not appear on all browsers. In practice:

- **Android + Chrome**: "Add to Home Screen" is available; the app opens standalone (fullscreen) from the icon and the cached shell renders while the PC is off. A native install banner may or may not appear depending on Chrome's heuristics — if it doesn't, use the browser menu → "Add to Home Screen" manually.
- **iOS + Safari**: Use **Share → Add to Home Screen**. The icon appears on the home screen and the app opens in a browser wrapper (not true standalone). The cached shell still renders offline. This is normal iOS behavior for HTTP PWAs.

Whether iOS opens the icon in true standalone over the server's HTTPS address has not been checked yet. The icon is re-added from that address at the Phase 4 Stage 5 cutover.

### Steps (iOS Safari, server)

1. Connect the phone to the private network the proxy is bound to.
2. Once per device, trust the CA. Open `http://<address>/ca.crt` in Safari and allow the download, install the profile in **Settings**, then switch the CA on under **Settings → General → About → Certificate Trust Settings**. Both the install and the switch are needed.
3. Open the address printed at startup in Safari. It should load with no warning.
4. Tap the Share icon → **Add to Home Screen** → **Add**.

### Steps (iOS Safari, PC)

1. `npm run serve` on the PC.
2. Note the `http://192.168.x.x:3001` URL in the console.
3. Open that URL in Safari on the iPhone.
4. Tap the Share icon → **Add to Home Screen** → **Add**.
5. Launch from the icon. While the PC is on you see live data; while it's off you see the cached shell and the "Can't reach P.U.T.E.R." message.

---

## Security note — who can reach the app

The app has **no login**. It is private only because of where it is published, so that is the part to get right.

- **Server (Docker):** the app container publishes no port. Only the proxy's ports 80 and 443 are published, and only on the one host address in `PUTER_BIND`. Bind that to a private interface. In the deployment this repo was built for it is a WireGuard tunnel address: nothing on the internet can reach it, and devices on the home network have no route to it. Compose refuses to start when `PUTER_BIND` is unset, rather than fall back to every address.
- **A bind address is not an interface filter.** Docker forwards any packet addressed to the bound address, whichever network card it arrived on. A device on the same local network that deliberately adds a route to that address can still reach the proxy. To rule that out, add a packet-filter rule on the host that drops traffic for the bound address arriving on the local-network interface. `ufw`'s ordinary rules do not help here: Docker handles published ports before they see the traffic.
- **Inside the container** the app still binds `0.0.0.0`. That now means the container's own interfaces, which is what lets the proxy reach it.
- **`npm run serve` on a PC** binds all of the PC's network interfaces over plain HTTP, so the phone can reach it over home Wi-Fi. This is acceptable on a trusted home network only.
- **`npm run dev`:** the Vite dev server listens on localhost only. The Express API behind it listens on all interfaces at the port in `.env`, as in serve mode.
- **No cross-origin access:** since v0.4.0 the API no longer sends `Access-Control-Allow-Origin: *`, so a page from another site open in your browser cannot read or edit through it.

The app writes two paths: `server/state/daily-state.json` (daily check/hide state) and `PUTER.md` (Daily Checklist section only, via the structure-edit endpoints). Both writes follow strict guards (see `server/editor.js`).

---

## App icons — placeholder note

The icons in `client/public/icons/` are solid-color placeholders generated by `scripts/gen-icons.js`. They use the brand accent color (`#4a7c59`). Swap them with real artwork anytime — re-run `npm run gen:icons` only if you want to regenerate the placeholders. The icon files are committed to the repo.

---

## Project structure

```
puter_app/
  server/
    index.js       Express API + static serving
    parser.js      PUTER.md parser (line-based, tolerant)
    state.js       Daily check/hide state (atomic writes, 4am rollover)
    editor.js      Structural editor for PUTER.md Daily Checklist (Phase 3.5)
    healthcheck.js Container health check (calls /api/health)
    state/         daily-state.json — git-ignored, auto-created
    backups/       Timestamped PUTER.md backups — git-ignored, auto-created
  client/
    public/
      icons/       PWA icons (192, 512, 180px) — replace with real art
    src/
      App.jsx
      components/
        DailyChecklist.jsx
        ThisWeek.jsx
        Goals.jsx
  nginx/
    puter.conf     Reverse proxy: HTTPS, redirect from HTTP, hand-off to the app
  scripts/
    gen-icons.js   Placeholder icon generator
  docs/
    PHASE1_BUILD_BRIEF.md
    PHASE2_BUILD_PLAN.md
    PHASE3_BUILD_PLAN.md
    PHASE3_5_BUILD_PLAN.md
    ROADMAP.md
  Dockerfile       Two-stage image: build the client, then the runtime
  compose.yaml     The app and proxy containers (server deployment)
  .dockerignore    What an image build must not copy in
  .env.example     committed — copy to .env and fill in
  NOTES.md         parser, PWA, write-safety, and deployment assumptions
```

---

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | File status and last-read timestamps |
| `GET /api/goals` | Goals parsed from PUTER.md |
| `GET /api/daily` | Daily Checklist sections, items, and PUTER.md fingerprint |
| `GET /api/week` | This Week grouped sub-sections (read-only) and "Week of" value |
| `GET /api/state` | Today's check/hide state (auto-rolls over at 4am) |
| `PUT /api/state/check` | Body `{ id, value }` — set check state for a Daily item |
| `PUT /api/state/hide` | Body `{ id, value }` — set hide state for a Daily item |
| `POST /api/structure/add` | Body `{ section, text, mtimeMs, hash }` — add item; returns `newId` |
| `PUT /api/structure/text` | Body `{ id, text, mtimeMs, hash }` — edit item text |
| `PUT /api/structure/reorder` | Body `{ id, direction, mtimeMs, hash }` — move item up or down within its sub-section |
| `DELETE /api/structure/item` | Body `{ id, mtimeMs, hash }` — delete item and clear its daily state |

Structure endpoints return the re-parsed Daily Checklist + new fingerprint on success, or `409 { conflict: true, reload: true }` if PUTER.md changed on disk since the client last read it.

---

## Phase scope

**v0.3.1** adds structural editing of the Daily Checklist in PUTER.md — reorder items, add items, edit item text, and delete items — from PC or phone. Writes are surgical (target line only, every other byte identical), guarded by an mtime+hash fingerprint, and backed up before each write. The only OneDrive file the app writes is PUTER.md, and only its Daily Checklist section. Phase 3 check/hide state is unchanged. This Week writes, Goals writes, offline capture, and the conversational brain are later phases — see `docs/ROADMAP.md`.

**v0.3.2** fixes the daily-state rollover to resolve the 4am day boundary in `PUTER_TZ` (DST-aware, via `Intl`) instead of UTC; strips contextual `<!-- ... -->` notes from rendered Goals; and renders This Week's sub-sections (Recurring / Tasks for Goals / Hobbies / Other) read-only.

**v0.4.0** moves the app onto an always-on server (ROADMAP Phase 4, Stages 3–4). It runs in Docker behind an nginx reverse proxy, over HTTPS from a private certificate authority, published only on a private tunnel address. No new features. The move surfaced a set of fixes: the open cross-origin header is gone; the state folder is created when missing; a structural edit that fails to save now says so on the page and in the server log, as does a failed load of the day's check state; the version comes from `package.json` alone; the startup banner prints the configured address (`PUTER_URL`); the offline message no longer asks about the PC and Wi-Fi; and `concurrently` is a dev dependency, so it no longer ships in the image.
