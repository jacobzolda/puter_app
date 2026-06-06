'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKUPS_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 20;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

function extractAllIds(lines) {
  const ids = new Set();
  for (const line of lines) {
    const m = line.match(/<!--\s*id:\s*([\w-]+)\s*-->/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function makeUniqueId(base, existingIds) {
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function getFileFingerprint(filePath) {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  return { mtimeMs: stat.mtimeMs, hash };
}

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function pruneBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('PUTER.md.') && f.endsWith('.bak'))
      .sort();
    while (files.length >= MAX_BACKUPS) {
      fs.unlinkSync(path.join(BACKUPS_DIR, files.shift()));
    }
  } catch {}
}

function makeBackup(filePath) {
  ensureBackupsDir();
  pruneBackups();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUPS_DIR, `PUTER.md.${ts}.bak`);
  fs.copyFileSync(filePath, dest);
}

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

// Returns { sectionStart, sectionEnd } — absolute line indices.
// sectionStart is the line after "## Daily Checklist"; sectionEnd is the next ## or EOF.
function findDailyChecklistRange(lines) {
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (sectionStart === -1 && /^## Daily Checklist/.test(lines[i])) {
      sectionStart = i + 1;
      continue;
    }
    if (sectionStart !== -1 && /^## /.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  if (sectionStart === -1) {
    const err = new Error('## Daily Checklist section not found in PUTER.md');
    err.notFound = true;
    throw err;
  }

  return { sectionStart, sectionEnd };
}

// Find the absolute line index of the item with the given id.
function findItemLineByID(lines, id) {
  // Escape the id for use in regex (ids are alphanumeric + hyphens, but be safe)
  const escaped = id.replace(/[-]/g, '\\-');
  const re = new RegExp(`<!--\\s*id:\\s*${escaped}\\s*-->`);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

// Returns all checklist item line indices within the sub-section that contains itemLineIdx.
// Sub-section boundaries are bold **...** lines within the Daily Checklist section.
function findSubsectionItemLines(lines, itemLineIdx, sectionStart, sectionEnd) {
  // Walk backward from itemLineIdx to find the bold sub-section header
  let headerIdx = -1;
  for (let i = itemLineIdx; i >= sectionStart; i--) {
    if (/^\*\*(.+?)\*\*$/.test(lines[i].trim())) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  // Walk forward from header, collect checklist item lines until next bold header
  const itemLines = [];
  for (let i = headerIdx + 1; i < sectionEnd; i++) {
    const trimmed = lines[i].trim();
    if (/^\*\*(.+?)\*\*$/.test(trimmed)) break;
    if (/^- \[[ xX]\]/.test(trimmed)) itemLines.push(i);
  }

  return { headerIdx, itemLines };
}

// Perform a structural edit on filePath.
// prevFingerprint: { mtimeMs, hash } captured when the client last loaded the data.
// op: 'add' | 'text' | 'reorder' | 'delete'
// params: op-specific (see routes in index.js)
// Returns { newId, fingerprint } on success.
// Throws { conflict: true } if the file changed since prevFingerprint.
function performEdit(filePath, prevFingerprint, op, params) {
  // Read the file and compute current fingerprint
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);

  // Optimistic concurrency: abort if file changed since client last read it
  if (stat.mtimeMs !== prevFingerprint.mtimeMs || hash !== prevFingerprint.hash) {
    const err = new Error('PUTER.md changed on disk');
    err.conflict = true;
    throw err;
  }

  // Detect line ending so new lines are consistent with the file
  const le = content.includes('\r\n') ? '\r' : '';

  const lines = content.split('\n');
  const { sectionStart, sectionEnd } = findDailyChecklistRange(lines);

  let newId = null;

  switch (op) {
    case 'add': {
      const { section, text } = params;

      // Find the sub-section header whose bold text matches `section`
      let subHeaderIdx = -1;
      for (let i = sectionStart; i < sectionEnd; i++) {
        const m = lines[i].trim().match(/^\*\*(.+?)\*\*$/);
        if (m && m[1].trim() === section) {
          subHeaderIdx = i;
          break;
        }
      }
      if (subHeaderIdx === -1) {
        const err = new Error(`Sub-section "${section}" not found in Daily Checklist`);
        err.notFound = true;
        throw err;
      }

      // Find insertion point: after the last checklist item in this sub-section
      let insertIdx = subHeaderIdx + 1;
      for (let i = subHeaderIdx + 1; i < sectionEnd; i++) {
        const trimmed = lines[i].trim();
        if (/^\*\*(.+?)\*\*$/.test(trimmed)) break;
        if (/^- \[[ xX]\]/.test(trimmed)) insertIdx = i + 1;
      }

      // Generate a unique ID from the new text
      const allIds = extractAllIds(lines.slice(sectionStart, sectionEnd));
      newId = makeUniqueId(slugify(text), allIds);

      lines.splice(insertIdx, 0, `- [ ] ${text} <!-- id: ${newId} -->${le}`);
      break;
    }

    case 'text': {
      const { id, text } = params;
      const lineIdx = findItemLineByID(lines, id);
      if (lineIdx === -1) throw new Error(`Item id "${id}" not found`);

      // Preserve prefix (- [ ] / - [x]) and id comment exactly; replace only the text
      const line = lines[lineIdx];
      const m = line.match(/^(- \[[ xX]\] )(.+?)(\s*<!--\s*id:\s*[\w-]+\s*-->)(\s*)$/);
      if (!m) throw new Error(`Cannot parse line for id "${id}": ${line}`);
      lines[lineIdx] = `${m[1]}${text}${m[3]}${m[4]}`;
      break;
    }

    case 'reorder': {
      const { id, direction } = params;
      const lineIdx = findItemLineByID(lines, id);
      if (lineIdx === -1) throw new Error(`Item id "${id}" not found`);

      const sub = findSubsectionItemLines(lines, lineIdx, sectionStart, sectionEnd);
      if (!sub) throw new Error(`Sub-section not found for item "${id}"`);

      const pos = sub.itemLines.indexOf(lineIdx);
      if (pos === -1) throw new Error(`Item line not in sub-section list`);

      if (direction === 'up') {
        if (pos === 0) throw new Error(`Item "${id}" is already first in its sub-section`);
        const other = sub.itemLines[pos - 1];
        [lines[lineIdx], lines[other]] = [lines[other], lines[lineIdx]];
      } else if (direction === 'down') {
        if (pos === sub.itemLines.length - 1) throw new Error(`Item "${id}" is already last in its sub-section`);
        const other = sub.itemLines[pos + 1];
        [lines[lineIdx], lines[other]] = [lines[other], lines[lineIdx]];
      } else {
        throw new Error(`Invalid direction "${direction}"`);
      }
      break;
    }

    case 'delete': {
      const { id } = params;
      const lineIdx = findItemLineByID(lines, id);
      if (lineIdx === -1) throw new Error(`Item id "${id}" not found`);
      lines.splice(lineIdx, 1);
      break;
    }

    default:
      throw new Error(`Unknown op "${op}"`);
  }

  const newContent = lines.join('\n');

  makeBackup(filePath);
  atomicWrite(filePath, newContent);

  // Compute new fingerprint from the written content
  const newStat = fs.statSync(filePath);
  const newHash = crypto.createHash('sha256').update(newContent).digest('hex').slice(0, 16);

  return { newId, fingerprint: { mtimeMs: newStat.mtimeMs, hash: newHash } };
}

module.exports = { performEdit, getFileFingerprint, slugify };
