'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { parsePuterMd } = require('./parser');

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

// GET /api/daily
app.get('/api/daily', (req, res) => {
  const parsed = getParsed();
  res.json({
    sections: parsed.daily ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('daily:')),
  });
});

// GET /api/week
app.get('/api/week', (req, res) => {
  const parsed = getParsed();
  res.json({
    weekOf: parsed.week?.weekOf ?? null,
    items: parsed.week?.items ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('week:')),
  });
});

// SPA catch-all — must be after all /api/* routes
if (serveStatic) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Bind to 0.0.0.0 so the phone can reach this server over the LAN.
// This is intentional: data is read-only and the network is a trusted home Wi-Fi.
// Revisit at Phase 3 (writes) and Phase 4 (always-on box).
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nP.U.T.E.R. v0.2.0`);
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
