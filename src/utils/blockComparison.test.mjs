import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

function loadSource(relative, imports = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const require = (id) => {
    if (id in imports) return imports[id];
    throw new Error(`Unexpected runtime dependency: ${id}`);
  };
  new Function('require', 'exports', compiled)(require, exports);
  return exports;
}

const comparison = loadSource('./blockComparison.ts');
const { calculateDiffs: calculateDocumentDiffs, compactFinancialTableBlock } = loadSource('../services/secFiling/secFilingDiff.ts', { '../../utils/blockComparison': comparison, '../../data/initialSecFilingData': { INITIAL_SEC_FILING_DOC: { blocks: [] } } });
const calculateDiffs = (base, proposed, origin) => calculateDocumentDiffs(base, proposed, origin, 'script');
const clone = (value) => JSON.parse(JSON.stringify(value));
const heading = { id: 'heading', type: 'heading', section: 'Script', level: 2, text: 'The pigeon' };
const paragraph = { id: 'paragraph', type: 'paragraph', section: 'Script', text: 'Storyline: history' };
const table = { id: 'table', type: 'financial_table', section: 'Script', title: 'Script',
  headers: ['Time', 'Visual / footage', 'Voiceover', 'On-screen text'], columnAlignments: ['left', 'left', 'left', 'left'],
  columnWidths: ['7%', '29%', '40%', '24%'], rows: [
    { id: 'first', type: 'data', cells: ['0:00', 'Assets', 'A true story', '(Go'] },
    { id: 'second', type: 'data', shading: '#F0F4F8', cells: ['0:04', 'Forest', 'No radio', '1918'] },
  ] };
const base = [heading, paragraph, table];
const changes = (proposed, origin) => calculateDiffs(base, proposed, origin).filter((diff) => diff.status !== 'unchanged');

test('opening an unchanged script reports zero edits, independently of object/key order', () => {
  assert.equal(changes(clone(base)).length, 0);
  assert.ok(comparison.blocksEqual(paragraph, { text: paragraph.text, section: 'Script', type: 'paragraph', id: 'paragraph' }));
});

test('metadata and equivalent renderer defaults are not user changes', () => {
  const normalized = clone(base);
  Object.assign(normalized[0], { bold: true, italic: false, alignment: 'left', spacing: 'normal', spacingTop: 8,
    fontSize: 16, lineSpacing: 1.2, updatedAt: 'later', modifiedBy: 'viewer' });
  normalized[2].rows.forEach((row, index) => Object.assign(row, { id: `generated-${index}`, indent: 1, bold: false }));
  assert.equal(changes(normalized).length, 0);
});

test('script cells resembling finance headings or split parentheses are not repaired', () => {
  const original = JSON.stringify(table);
  assert.equal(compactFinancialTableBlock(table, 'script'), table);
  assert.equal(JSON.stringify(table), original);
});

test('actual text, whitespace and line breaks remain reviewable', () => {
  for (const text of ['Edited storyline', paragraph.text + ' ', paragraph.text + '\nSecond line']) {
    const proposed = clone(base);
    proposed[1].text = text;
    assert.equal(changes(proposed).length, 1);
  }
});

test('one changed script cell reports that exact cell', () => {
  const proposed = clone(base);
  proposed[2].rows[0].cells[2] = 'An edited story';
  const [diff] = changes(proposed);
  assert.equal(diff.tableCellDiffs.length, 1);
  assert.equal(diff.tableCellDiffs[0].newValue, 'An edited story');
});

test('intentional spacing, column widths and row fills remain detectable', () => {
  const spacing = clone(base);
  spacing[0].spacingTop = 25;
  assert.equal(changes(spacing)[0].isSpacingOnly, true);
  const resized = clone(base);
  resized[2].columnWidths = ['15%', '25%', '35%', '25%'];
  assert.equal(changes(resized).length, 1);
  const shaded = clone(base);
  shaded[2].rows[0].shading = '#ff0000';
  assert.equal(changes(shaded).length, 1);
});

test('deletions use the actual script baseline, rather than a demo filing', () => {
  assert.equal(changes([heading, table])[0].status, 'deleted');
  assert.equal(changes([heading, table], [heading, table]).length, 0);
});

test('reordering is structural, but inserting a neighbor does not move existing items', () => {
  assert.ok(changes([paragraph, heading, table]).every((diff) => diff.changeCategories.includes('structure')));
  const added = { id: 'new', type: 'paragraph', section: 'Script', text: 'New content' };
  assert.deepEqual(changes([added, ...base]).map((diff) => diff.status), ['added']);
});

test('branch snapshots protect content added to Main after a branch was created', () => {
  const branch = { baseVersionNumber: 1, baseSnapshotBlocks: [heading, table] };
  const origin = comparison.proposalBaseBlocks(branch, []);
  assert.equal(changes([heading, table], origin).length, 0);
  assert.equal(comparison.proposalBaseBlocks({ baseVersionNumber: 1 }, [{ versionNumber: 1, blocks: base }]), base);
});

test('non-script documents retain original raw comparison and financial compaction', () => {
  const metadata = clone(base);
  metadata[1].updatedAt = 'later';
  assert.ok(calculateDocumentDiffs(base, metadata).some((diff) => diff.status === 'modified'));
  assert.equal(calculateDiffs(base, metadata).filter((diff) => diff.status !== 'unchanged').length, 0);
  assert.notEqual(compactFinancialTableBlock(table), table);
  assert.equal(compactFinancialTableBlock(table).rows[0].indent, 1);
  assert.ok(calculateDocumentDiffs(base, [paragraph, heading, table]).every((diff) => diff.status === 'unchanged'));
  assert.ok(calculateDocumentDiffs(base, [heading, table]).every((diff) => diff.status === 'unchanged'));
});
