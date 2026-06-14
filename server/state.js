'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state', 'daily-state.json');
const TMP_FILE = STATE_FILE + '.tmp';

// The logical day rolls over at 4am in PUTER_TZ (DST-aware via Intl), not midnight UTC.
function logicalDay(now = new Date()) {
  const tz = process.env.PUTER_TZ || 'America/New_York';
  const shifted = new Date(now.getTime() - 4 * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted); // YYYY-MM-DD
}

function emptyState(day) {
  return { day, checked: [], hidden: [] };
}

function writeState(state) {
  fs.writeFileSync(TMP_FILE, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(TMP_FILE, STATE_FILE);
}

function readState() {
  const today = logicalDay(new Date());
  let state;

  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    state = JSON.parse(raw);
  } catch {
    state = emptyState(today);
    writeState(state);
    return state;
  }

  if (state.day !== today) {
    state = emptyState(today);
    writeState(state);
  }

  return state;
}

function setChecked(id, value) {
  const state = readState();
  if (value) {
    if (!state.checked.includes(id)) state.checked.push(id);
  } else {
    state.checked = state.checked.filter(x => x !== id);
  }
  writeState(state);
  return state;
}

function setHidden(id, value) {
  const state = readState();
  if (value) {
    if (!state.hidden.includes(id)) state.hidden.push(id);
  } else {
    state.hidden = state.hidden.filter(x => x !== id);
  }
  writeState(state);
  return state;
}

function removeIdFromState(id) {
  const state = readState();
  state.checked = state.checked.filter(x => x !== id);
  state.hidden = state.hidden.filter(x => x !== id);
  writeState(state);
  return state;
}

module.exports = { readState, setChecked, setHidden, removeIdFromState, logicalDay };
