'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { parsePuterMd } = require('./parser');
const { readState, setChecked, setHidden, removeIdFromState } = require('./state');
const { performEdit, getFileFingerprint } = require('./editor');

const app = express();
const PORT = process.env.PORT || 3001;
const PUTER_DIR = process.env.PUTER_DIR;

if (!PUTER_DIR) {
  console.error('ERROR: PUTER_DIR is not set. Copy .env.example to .env and set the path.');
  process.exit(1);
}

const PUTER_MD = path.join(PUTER_DIR, 'PUTER.md');
const BUILD_LOG_MD = path.join(PUTER_DIR, 'PUTER_APP_BUILD_LOG.md');

function getParsed() {
  return parsePuterMd(PUTER_MD);
}

function getLANAddresses() {
  const result = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) result.push(addr.address);
    }
  }
  return result;
}

// Phase 2: serve the built frontend from one origin when client/dist exists.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const serveStatic = fs.existsSync(clientDist);

app.use(cors());
app.use(express.json());

if (serveStatic) {
  app.use(express.static(clientDist));
}

// GET /api/health
app.get('/api/health', (req, res) => {
  const parsed = getParsed();
  res.json({
    ok: true,
    files: {
      'PUTER.md': { found: fs.existsSync(PUTER_MD), path: PUTER_MD, lastRead: parsed.lastRead },
      'PUTER_APP_BUILD_LOG.md': { found: fs.existsSync(BUILD_LOG_MD), path: BUILD_LOG_MD },
    },
    warnings: parsed.warnings,
  });
});

// GET /api/goals
app.get('/api/goals', (req, res) => {
  const parsed = getParsed();
  res.json({
    goals: parsed.goals ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('goals:')),
  });
});

// GET /api/daily — includes fingerprint for optimistic-concurrency on structure edits
app.get('/api/daily', (req, res) => {
  const parsed = getParsed();
  let fingerprint = null;
  try { fingerprint = getFileFingerprint(PUTER_MD); } catch {}
  res.json({
    sections: parsed.daily ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('daily:')),
    fingerprint,
  });
});

// GET /api/week
app.get('/api/week', (req, res) => {
  const parsed = getParsed();
  res.json({
    weekOf: parsed.week?.weekOf ?? null,
    sections: parsed.week?.sections ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('week:')),
  });
});

// GET /api/state
app.get('/api/state', (req, res) => {
  try {
    res.json(readState());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/state/check  body: { id, value }
app.put('/api/state/check', (req, res) => {
  const { id, value } = req.body;
  if (typeof id !== 'string' || typeof value !== 'boolean') {
    return res.status(400).json({ error: 'id (string) and value (boolean) required' });
  }
  try {
    res.json(setChecked(id, value));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/state/hide  body: { id, value }
app.put('/api/state/hide', (req, res) => {
  const { id, value } = req.body;
  if (typeof id !== 'string' || typeof value !== 'boolean') {
    return res.status(400).json({ error: 'id (string) and value (boolean) required' });
  }
  try {
    res.json(setHidden(id, value));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Phase 3.5 — structural editing of Daily Checklist in PUTER.md
// All four endpoints return the re-parsed Daily Checklist on success,
// or HTTP 409 + { conflict: true, reload: true } if the file changed on disk.
// ---------------------------------------------------------------------------

// Validate that mtimeMs and hash are present in the request body.
function requireFingerprint(req, res) {
  const { mtimeMs, hash } = req.body;
  if (typeof mtimeMs !== 'number' || typeof hash !== 'string') {
    res.status(400).json({ error: 'mtimeMs (number) and hash (string) required' });
    return null;
  }
  return { mtimeMs, hash };
}

// Build the standard success response: re-parsed daily sections + new fingerprint.
function buildDailyResponse(fingerprint) {
  const parsed = getParsed();
  return {
    sections: parsed.daily ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('daily:')),
    fingerprint,
  };
}

// Shared error handler for structure endpoints.
function handleEditError(e, res) {
  if (e.conflict) return res.status(409).json({ conflict: true, reload: true });
  if (e.notFound) return res.status(404).json({ error: e.message });
  return res.status(500).json({ error: e.message });
}

// POST /api/structure/add  body: { section, text, mtimeMs, hash }
// Returns { ...dailySections, newId }
app.post('/api/structure/add', (req, res) => {
  const fp = requireFingerprint(req, res);
  if (!fp) return;
  const { section, text } = req.body;
  if (typeof section !== 'string' || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'section (string) and text (non-empty string) required' });
  }
  try {
    const result = performEdit(PUTER_MD, fp, 'add', { section, text: text.trim() });
    res.json({ ...buildDailyResponse(result.fingerprint), newId: result.newId });
  } catch (e) {
    handleEditError(e, res);
  }
});

// PUT /api/structure/text  body: { id, text, mtimeMs, hash }
app.put('/api/structure/text', (req, res) => {
  const fp = requireFingerprint(req, res);
  if (!fp) return;
  const { id, text } = req.body;
  if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'id (string) and text (non-empty string) required' });
  }
  try {
    const result = performEdit(PUTER_MD, fp, 'text', { id, text: text.trim() });
    res.json(buildDailyResponse(result.fingerprint));
  } catch (e) {
    handleEditError(e, res);
  }
});

// PUT /api/structure/reorder  body: { id, direction, mtimeMs, hash }
app.put('/api/structure/reorder', (req, res) => {
  const fp = requireFingerprint(req, res);
  if (!fp) return;
  const { id, direction } = req.body;
  if (typeof id !== 'string' || (direction !== 'up' && direction !== 'down')) {
    return res.status(400).json({ error: 'id (string) and direction ("up"|"down") required' });
  }
  try {
    const result = performEdit(PUTER_MD, fp, 'reorder', { id, direction });
    res.json(buildDailyResponse(result.fingerprint));
  } catch (e) {
    handleEditError(e, res);
  }
});

// DELETE /api/structure/item  body: { id, mtimeMs, hash }
app.delete('/api/structure/item', (req, res) => {
  const fp = requireFingerprint(req, res);
  if (!fp) return;
  const { id } = req.body;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'id (string) required' });
  }
  try {
    const result = performEdit(PUTER_MD, fp, 'delete', { id });
    // Also remove the id from daily-state so stale check/hide entries don't linger.
    try { removeIdFromState(id); } catch {}
    res.json(buildDailyResponse(result.fingerprint));
  } catch (e) {
    handleEditError(e, res);
  }
});

// SPA catch-all — must be after all /api/* routes
if (serveStatic) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Binds to 0.0.0.0 so the phone can reach this server over the LAN.
// Phase 3.5 introduces PUTER.md writes — see security note in README.md.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nP.U.T.E.R. v0.3.2`);
  if (serveStatic) {
    console.log(`  Mode:    serve (built frontend + API, one origin)`);
  } else {
    console.log(`  Mode:    API only (run "npm run serve" or build client first for phone use)`);
  }
  console.log(`  Local:   http://localhost:${PORT}`);
  const lanIPs = getLANAddresses();
  if (lanIPs.length > 0) {
    console.log(`  Network (use on phone):`);
    for (const ip of lanIPs) {
      console.log(`    http://${ip}:${PORT}`);
    }
  }
  console.log(`  PUTER_DIR: ${PUTER_DIR}\n`);
});
