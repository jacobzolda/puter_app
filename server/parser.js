'use strict';

const fs = require('fs');

// Split raw text into top-level H2 sections: { sectionTitle: [lines] }
function splitH2Sections(text) {
  const lines = text.split('\n');
  const sections = {};
  let current = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^## (.+)$/);
    if (m) {
      if (current !== null) sections[current] = buf;
      current = m[1].trim();
      buf = [];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  if (current !== null) sections[current] = buf;
  return sections;
}

// Parse a checkbox line: "- [ ] text" or "- [x] text"
function parseCheckboxLine(line) {
  const m = line.match(/^- \[([ xX])\] (.*)$/);
  if (!m) return null;
  return { checked: m[1].trim().toLowerCase() === 'x', text: m[2].trim() };
}

// Extract trailing <!-- id: SLUG --> from a text string.
// Returns { text, id } — id is null if the pattern is absent.
// Only matches "id:" comments; ignores other <!-- ... --> comments.
function extractId(raw) {
  const m = raw.match(/^(.*?)\s*<!--\s*id:\s*([\w-]+)\s*-->\s*$/);
  if (m) return { text: m[1].trim(), id: m[2] };
  return { text: raw.trim(), id: null };
}

// Parse the Daily Checklist section.
// Bold lines (**text**) are sub-section headers; checkbox lines are items.
// Blockquotes are attached as a note to the current sub-section.
function parseDailyChecklist(lines) {
  const sections = [];
  let current = null;
  const warnings = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Bold line = sub-section header: **Morning — in order**
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
      current = { name: boldMatch[1].trim(), items: [], note: null };
      sections.push(current);
      continue;
    }

    // Checkbox item
    const cb = parseCheckboxLine(trimmed);
    if (cb) {
      if (!current) {
        warnings.push(`Orphan checklist item before any section header: "${trimmed}"`);
        current = { name: 'Uncategorized', items: [], note: null };
        sections.push(current);
      }
      const { text, id } = extractId(cb.text);
      if (id === null) {
        warnings.push(`Untagged Daily item (no <!-- id: SLUG -->): "${text}"`);
      }
      current.items.push({ text, id });
      continue;
    }

    // Blockquote — attach as note to current section
    if (trimmed.startsWith('>')) {
      const noteText = trimmed.replace(/^>\s*\*?/, '').replace(/\*?$/, '').trim();
      if (current) current.note = noteText;
      continue;
    }

    // H3 headings or anything else — skip silently (tolerate extra structure)
  }

  return { sections, warnings };
}

// Parse "This Week — Varying Checklist".
// Extract "Week of: X" value and items up to the ### Weekly Review subsection.
function parseThisWeek(lines) {
  const warnings = [];
  let weekOf = null;
  const items = [];
  let inWeeklyReview = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Stop at Weekly Review subsection
    if (trimmed.startsWith('### Weekly Review')) {
      inWeeklyReview = true;
      continue;
    }
    if (inWeeklyReview) continue;

    // "Week of: ________"
    const wofMatch = trimmed.match(/^Week of:\s*(.*)/i);
    if (wofMatch) {
      const val = wofMatch[1].trim().replace(/^_+$/, '');
      weekOf = val || null;
      continue;
    }

    // Checkbox items
    const cb = parseCheckboxLine(trimmed);
    if (cb) {
      // Skip blank placeholder items ("- [ ]" with empty text)
      if (cb.text.trim()) items.push(cb);
      continue;
    }
  }

  return { weekOf, items, warnings };
}

// Parse Goals section.
// ### Tier headings → tier name
// **ID — Name** lines → new goal
// Everything else is body text for the current goal.
function parseGoals(lines) {
  const tiers = [];
  const warnings = [];
  let currentTier = null;
  let currentGoal = null;

  const flushGoal = () => {
    if (currentGoal && currentTier) {
      // Trim trailing blank lines from body
      while (currentGoal.body.length && !currentGoal.body[currentGoal.body.length - 1].trim()) {
        currentGoal.body.pop();
      }
      currentTier.goals.push({
        id: currentGoal.id,
        name: currentGoal.name,
        tier: currentTier.name,
        body: currentGoal.body.join('\n').trim(),
      });
    }
    currentGoal = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // ### Tier heading
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      flushGoal();
      currentTier = { name: h3[1].trim(), goals: [] };
      tiers.push(currentTier);
      continue;
    }

    // **ID — Name** goal heading (bold only line)
    const goalMatch = trimmed.match(/^\*\*([A-Z]{2,4}) — (.+?)\*\*$/);
    if (goalMatch) {
      flushGoal();
      if (!currentTier) {
        warnings.push(`Goal "${goalMatch[0]}" found before any tier heading`);
        currentTier = { name: 'Unknown', goals: [] };
        tiers.push(currentTier);
      }
      currentGoal = { id: goalMatch[1], name: goalMatch[2].trim(), body: [] };
      continue;
    }

    // Body line for current goal (skip horizontal rules)
    if (currentGoal && trimmed !== '---') {
      currentGoal.body.push(line);
    }
  }

  flushGoal();

  // Flatten to a goals array preserving order, keeping tier info
  const goals = tiers.flatMap(t => t.goals);
  return { goals, warnings };
}

// Main entry point: read and parse PUTER.md.
// Returns { goals, daily, week, warnings, lastRead }
function parsePuterMd(filePath) {
  const result = {
    goals: null,
    daily: null,
    week: null,
    warnings: [],
    lastRead: null,
    fileFound: false,
  };

  try {
    const text = fs.readFileSync(filePath, 'utf8');
    result.fileFound = true;
    result.lastRead = new Date().toISOString();
    const sections = splitH2Sections(text);

    // Daily Checklist
    try {
      const dailyKey = Object.keys(sections).find(k => k.startsWith('Daily Checklist'));
      if (dailyKey) {
        const parsed = parseDailyChecklist(sections[dailyKey]);
        result.daily = parsed.sections;
        result.warnings.push(...parsed.warnings.map(w => `daily: ${w}`));
      } else {
        result.warnings.push('daily: Section "Daily Checklist" not found');
        result.daily = [];
      }
    } catch (e) {
      result.warnings.push(`daily: Parse error — ${e.message}`);
      result.daily = [];
    }

    // This Week
    try {
      const weekKey = Object.keys(sections).find(k => k.startsWith('This Week'));
      if (weekKey) {
        const parsed = parseThisWeek(sections[weekKey]);
        result.week = { weekOf: parsed.weekOf, items: parsed.items };
        result.warnings.push(...parsed.warnings.map(w => `week: ${w}`));
      } else {
        result.warnings.push('week: Section "This Week" not found');
        result.week = { weekOf: null, items: [] };
      }
    } catch (e) {
      result.warnings.push(`week: Parse error — ${e.message}`);
      result.week = { weekOf: null, items: [] };
    }

    // Goals
    try {
      const goalsKey = Object.keys(sections).find(k => k === 'Goals');
      if (goalsKey) {
        const parsed = parseGoals(sections[goalsKey]);
        result.goals = parsed.goals;
        result.warnings.push(...parsed.warnings.map(w => `goals: ${w}`));
      } else {
        result.warnings.push('goals: Section "Goals" not found');
        result.goals = [];
      }
    } catch (e) {
      result.warnings.push(`goals: Parse error — ${e.message}`);
      result.goals = [];
    }
  } catch (e) {
    result.warnings.push(`File read error: ${e.message}`);
  }

  return result;
}

module.exports = { parsePuterMd };
