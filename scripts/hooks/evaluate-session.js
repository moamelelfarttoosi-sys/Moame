#!/usr/bin/env node
'use strict';

/**
 * Continuous learning — mine a finished session for durable, repo-specific
 * lessons and write them to `.claude/state/<ts>-lessons.md` for review.
 *
 * It proposes; it never edits CLAUDE.md on its own. The user approves.
 */

const fs = require('fs');
const path = require('path');
const {
  repoRoot,
  stateDir,
  exists,
  writeText,
  fileTimestamp,
  redactSecrets,
  truncate,
  readStdinJson,
  emit,
  safeMain,
} = require('../lib/utils');

/** Phrases that mark a user turn as a correction worth remembering. */
const CORRECTION_MARKERS = [
  /\bno[,.]? (?:we|you|it) (?:always|never|should|must)\b/i,
  /\b(?:we|you) (?:always|never) (?:use|do|run|write|put)\b/i,
  /\bdon'?t (?:use|do|run|write|touch|edit)\b/i,
  /\bactually[,]? /i,
  /\bthat'?s wrong\b/i,
  /\buse .* instead\b/i,
  /\bin this repo\b/i,
];

function textOf(entry) {
  const content = entry.content || (entry.message && entry.message.content);
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

function roleOf(entry) {
  return entry.role || (entry.message && entry.message.role) || null;
}

/**
 * Extract candidate lessons from transcript entries.
 * Exported and pure so the tests can feed it fixtures.
 */
function extractLessons(entries, { limit = 5 } = {}) {
  const lessons = [];
  const seen = new Set();

  for (const entry of entries) {
    if (roleOf(entry) !== 'user') continue;
    const text = textOf(entry).trim();
    if (!text || text.startsWith('<')) continue;

    for (const line of text.split('\n')) {
      const candidate = line.trim();
      if (candidate.length < 12 || candidate.length > 300) continue;
      if (!CORRECTION_MARKERS.some((re) => re.test(candidate))) continue;
      const key = candidate.toLowerCase().replace(/\W+/g, ' ').trim();
      if (seen.has(key)) continue;
      seen.add(key);
      lessons.push(truncate(redactSecrets(candidate), 240));
      if (lessons.length >= limit) return lessons;
    }
  }
  return lessons;
}

function readTranscript(transcriptPath, maxLines = 1500) {
  if (!transcriptPath || !exists(transcriptPath)) return [];
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
  return lines
    .slice(-maxLines)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Render the review document. Exported for tests. */
function buildReport(lessons, meta = {}) {
  if (!lessons.length) {
    return `# Session lessons — ${new Date().toISOString()}\n\nNothing durable and repo-specific surfaced this session.\n`;
  }
  return [
    `# Session lessons — ${new Date().toISOString()}`,
    '',
    meta.sessionId ? `Session: ${meta.sessionId}` : null,
    '',
    'Proposed additions to CLAUDE.md. Review before accepting — nothing was written automatically.',
    '',
    ...lessons.map((l) => `- ${l}`),
    '',
    'Keep only what is durable, repo-specific and actionable. Discard anything true of software in general.',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function main() {
  const payload = await readStdinJson();
  const root = repoRoot(payload.cwd || process.cwd());
  const entries = readTranscript(payload.transcript_path);
  const lessons = extractLessons(entries);
  if (!lessons.length) return emit(undefined);

  const file = path.join(stateDir(root), `${fileTimestamp()}-lessons.md`);
  writeText(file, buildReport(lessons, { sessionId: payload.session_id }));
  emit({
    hookSpecificOutput: {
      hookEventName: payload.hook_event_name || 'SessionEnd',
      additionalContext: `Captured ${lessons.length} candidate lesson(s) in ${path.relative(root, file)}. Run /learn to review and fold them into CLAUDE.md.`,
    },
  });
}

if (require.main === module) safeMain(main);

module.exports = { extractLessons, buildReport, readTranscript, CORRECTION_MARKERS };
