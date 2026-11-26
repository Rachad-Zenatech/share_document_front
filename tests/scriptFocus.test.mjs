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
