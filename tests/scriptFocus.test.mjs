import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScriptFocus, scriptFocusMatch } from '../src/lib/scriptFocus.ts';

test('accepts bounded focus requests and rejects malformed payloads', () => {
  assert.deepEqual(parseScriptFocus({ requestId: 1, terms: ['approved'] }), { requestId: 1, terms: ['approved'] });
  for (const payload of [null, {}, { requestId: '1', terms: ['approved'] }, { requestId: 1, terms: [] }, { requestId: 1, terms: [false] }, { requestId: 1, terms: ['x'.repeat(4001)] }]) {
    assert.equal(parseScriptFocus(payload), null);
  }
});

test('matches the reported evidence across a timecode and visual cell', () => {
  const text = '0:27\nPRODUCT: Slow push on an approved aircraft still. Then return to the scale.';
  const match = scriptFocusMatch(text, ['0:27 PRODUCT: Slow push on an approved aircraft still.']);
  assert.equal(text.slice(match.start, match.end), '0:27\nPRODUCT: Slow push on an approved aircraft still');
});

test('finds an editable visual field when its timecode is in another cell', () => {
  const text = 'PRODUCT: Slow push on an approved aircraft still.';
  const match = scriptFocusMatch(text, ['0:27 PRODUCT: Slow push on an approved aircraft still.']);
  assert.equal(text.slice(match.start, match.end), 'PRODUCT: Slow push on an approved aircraft still');
});

test('retains original casing and curly apostrophes without matching partial words', () => {
  const text = 'The company’s APPROVED aircraft';
  const match = scriptFocusMatch(text, ["company's approved"]);
  assert.equal(text.slice(match.start, match.end), 'company’s APPROVED');
  assert.equal(scriptFocusMatch(text, ['craft']), null);
});

test('matches the reported bracketed timecode and synthetic Visual label against its cell', () => {
  const visual = 'PRODUCT: Slow push on an approved aircraft still. Then return to the scale.';
  const evidence = '[0:27] Visual: PRODUCT: Slow push on an approved aircraft still.';
  for (const text of [visual, '0:27\n' + visual]) {
    const match = scriptFocusMatch(text, [evidence]);
    assert.ok(match);
    assert.equal(text.slice(match.start, match.end), 'PRODUCT: Slow push on an approved aircraft still');
  }
});

test('supports table column labels while preserving the full passage and its meaningful prefixes', () => {
  for (const label of ['Visuals', 'Voiceover', 'Voice over', 'Supers', 'On-screen text', 'Audio']) {
    const text = 'PRODUCT: Slow push on an approved aircraft still.';
    const match = scriptFocusMatch(text, [`[0:27] ${label}: ${text}`]);
    assert.equal(text.slice(match.start, match.end), text.slice(0, -1));
  }
  const literal = 'Visual: show the approved aircraft';
  const match = scriptFocusMatch(literal, [literal]);
  assert.equal(literal.slice(match.start, match.end), literal);
});

test('does not fall back to a repeated trigger when the actual evidence passage is missing', () => {
  assert.equal(scriptFocusMatch('An approved aircraft with a different visual.', [
    '[0:27] Visual: PRODUCT: Slow push on an approved aircraft still.',
  ]), null);
});
