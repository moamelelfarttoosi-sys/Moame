#!/usr/bin/env node
'use strict';

/**
 * Strategic-compaction suggester.
 *
 * Runs on PostToolUse. It counts activity in the session and, at a seam
 * (a milestone verified, a burst of file edits, a long run), suggests
 * compacting — rather than waiting for an indiscriminate automatic compaction
 * at the context limit.
 *
 * It only ever *suggests*. It never compacts anything itself.
 */

const path = require('path');
const {
  repoRoot,
  stateDir,
  readJson,
  writeJson,
  readStdinJson,
  emit,
  safeMain,
} = require('../lib/utils');

const DEFAULTS = {
  toolCallThreshold: 120,   // sustained activity
  editThreshold: 40,        // many files touched
  minCallsBetweenNudges: 60,
};

const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

function counterPath(root, sessionId) {
  return path.join(stateDir(root), `compact-counter-${sessionId || 'default'}.json`);
}

/**
 * Decide whether to nudge, given the running counters.
 * Pure: state in, {state, suggestion} out. This is what the tests exercise.
 */
function evaluate(state, event, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const next = {
    toolCalls: (state.toolCalls || 0) + 1,
    edits: (state.edits || 0) + (EDIT_TOOLS.has(event.tool_name) ? 1 : 0),
    lastNudgeAt: state.lastNudgeAt || 0,
    nudges: state.nudges || 0,
  };

  const sinceNudge = next.toolCalls - next.lastNudgeAt;
  if (sinceNudge < opts.minCallsBetweenNudges) return { state: next, suggestion: null };

  const reasons = [];
  if (next.toolCalls >= opts.toolCallThreshold) {
    reasons.push(`${next.toolCalls} tool calls in this session`);
  }
  if (next.edits >= opts.editThreshold) {
    reasons.push(`${next.edits} file edits`);
  }
  if (!reasons.length) return { state: next, suggestion: null };

  next.lastNudgeAt = next.toolCalls;
  next.nudges += 1;

  return {
    state: next,
    suggestion:
      `Context checkpoint: ${reasons.join(' and ')}. If the current milestone is finished and verified, ` +
      'this is a good seam to run /checkpoint and then /compact — write down the goal, the decisions, the ' +
      'repo facts and the exact next step first. If you are mid-edit or mid-debug, keep going and compact later.',
  };
}

async function main() {
  const payload = await readStdinJson();
  const root = repoRoot(payload.cwd || process.cwd());
  const file = counterPath(root, payload.session_id);
  const state = readJson(file) || {};
  const { state: nextState, suggestion } = evaluate(state, payload);
  writeJson(file, nextState);

  if (!suggestion) return emit(undefined);
  emit({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: suggestion,
    },
  });
}

if (require.main === module) safeMain(main);

module.exports = { evaluate, DEFAULTS, EDIT_TOOLS, counterPath };
