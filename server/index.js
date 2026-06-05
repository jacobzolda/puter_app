'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// Simple per-request parse (no caching needed in Phase 1 — files are small)
function getParsed() {
  return parsePuterMd(PUTER_MD);
}

app.use(cors());
app.use(express.json());

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

// GET /api/recurring
app.get('/api/recurring', (req, res) => {
  const parsed = getParsed();
  res.json({
    items: parsed.recurring ?? [],
    parseWarnings: parsed.warnings.filter(w => w.startsWith('recurring:')),
  });
});

app.listen(PORT, () => {
  console.log(`P.U.T.E.R. backend running at http://localhost:${PORT}`);
  console.log(`Reading from PUTER_DIR: ${PUTER_DIR}`);
});
