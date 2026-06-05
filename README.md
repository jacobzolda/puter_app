# P.U.T.E.R. App — v0.1.0

**P**ersonal **U**tility **T**o **E**nhance **R**elaxation — local read-only dashboard for Jacob Zolda's life-management system.

> v1 = conversational on a local model (see `docs/ROADMAP.md`). Everything until then is foundation and stays v0.x.

---

## Prerequisites

- **Node.js** 18 or later
- The canonical **P.U.T.E.R.** folder on your machine (OneDrive or equivalent), containing `PUTER.md`

---

## Install

```bash
# 1. Clone the repo (already done if you're reading this locally)
git clone https://github.com/jacobzolda/puter_app.git
cd puter_app

# 2. Install all dependencies (root + client)
npm run install:all
```

---

## Configuration

Copy `.env.example` to `.env` and set `PUTER_DIR` to the absolute path of your P.U.T.E.R. folder:

```bash
cp .env.example .env
# Then edit .env:
PUTER_DIR=C:\Users\jakez\OneDrive\PUTER
PORT=3001        # optional, defaults to 3001
```

`.env` is git-ignored and never committed.

---

## Run

```bash
npm run dev
```

This starts both the backend (Express, port 3001) and the frontend (Vite dev server, port 5173) in one terminal using `concurrently`.

Open **http://localhost:5173** in your browser.

Editing `PUTER.md` in VS Code and refreshing the browser reflects the change immediately — no restart needed.

---

## Project structure

```
puter_app/
  server/
    index.js       Express API server
    parser.js      PUTER.md parser (line-based, tolerant)
  client/
    src/
      App.jsx
      components/
        DailyChecklist.jsx
        ThisWeek.jsx
        Goals.jsx
  docs/
    PHASE1_BUILD_BRIEF.md
    ROADMAP.md
  .env.example     committed — copy to .env and fill in
  NOTES.md         parser assumptions
```

---

## API endpoints (backend only)

| Endpoint | Description |
|---|---|
| `GET /api/health` | File status and last-read timestamps |
| `GET /api/goals` | Goals parsed from PUTER.md |
| `GET /api/daily` | Daily Checklist sections and items |
| `GET /api/week` | This Week items and "Week of" value |
| `GET /api/recurring` | Recurring (non-daily) items |

---

## Phase 1 scope

This release is **read-only**. The app never writes to the OneDrive P.U.T.E.R. folder. Write features, offline capture, and the conversational brain are later phases — see `docs/ROADMAP.md`.
