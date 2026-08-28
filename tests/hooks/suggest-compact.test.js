'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const hook = require('../../scripts/hooks/suggest-compact');

function drive(events, options) {
  let state = {};
  const suggestions = [];
  for (const event of events) {
    const result = hook.evaluate(state, event, options);
    state = result.state;
    if (result.suggestion) suggestions.push({ at: state.toolCalls, text: result.suggestion });
  }
  return { state, suggestions };
}

const read = () => ({ tool_name: 'Read' });
const edit = () => ({ tool_name: 'Edit' });

test('a short session is never nudged', () => {
  const { suggestions } = drive(Array.from({ length: 20 }, read));
  assert.equal(suggestions.length, 0);
});

test('sustained tool use eventually suggests a checkpoint', () => {
  const { suggestions } = drive(Array.from({ length: 130 }, read));
  assert.ok(suggestions.length >= 1);
  assert.match(suggestions[0].text, /\/checkpoint/);
  assert.match(suggestions[0].text, /\/compact/);
});

test('nudges are spaced out rather than repeated every call', () => {
  const { suggestions } = drive(Array.from({ length: 300 }, read));
  for (let i = 1; i < suggestions.length; i += 1) {
    assert.ok(
      suggestions[i].at - suggestions[i - 1].at >= hook.DEFAULTS.minCallsBetweenNudges,
      'two nudges were closer together than the minimum spacing'
    );
  }
});

test('edits are counted separately from reads', () => {
  const events = [...Array.from({ length: 30 }, edit), ...Array.from({ length: 30 }, read)];
  const { state } = drive(events);
  assert.equal(state.toolCalls, 60);
  assert.equal(state.edits, 30);
});

test('a large edit burst triggers a nudge on the edit count alone', () => {
  const options = { toolCallThreshold: 10000, editThreshold: 5, minCallsBetweenNudges: 5 };
  const { suggestions } = drive(Array.from({ length: 20 }, edit), options);
  assert.ok(suggestions.length >= 1);
  assert.match(suggestions[0].text, /file edits/);
});

test('the suggestion tells the agent not to compact mid-edit', () => {
  const options = { toolCallThreshold: 3, minCallsBetweenNudges: 3 };
  const { suggestions } = drive(Array.from({ length: 5 }, read), options);
  assert.match(suggestions[0].text, /mid-edit or mid-debug/);
});

test('evaluate never mutates the state it was given', () => {
  const state = { toolCalls: 5, edits: 2 };
  const snapshot = { ...state };
  hook.evaluate(state, edit());
  assert.deepEqual(state, snapshot);
});

test('unknown tool names still count as activity', () => {
  const { state } = drive([{ tool_name: 'SomeFutureTool' }, {}]);
  assert.equal(state.toolCalls, 2);
  assert.equal(state.edits, 0);
});
