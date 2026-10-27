import type { AttachedSpreadsheet, SpreadsheetTab, SecBlock } from '../types/secFiling';
import type {
  ReuploadAxisSlot,
  ReuploadCellStatus,
  ReuploadTabDiff,
  WorkbookReuploadDiff
} from '../types/spreadsheet';
import {
  colToLetter,
  parseCellRef,
  ensureSpreadsheetTabs,
  evaluateSpreadsheetFormula,
  letterToCol,
  shiftBlocksCellReferences,
  type CellShiftOperation
} from './documentVariables';

/** Minimum similarity for two rows/columns to be considered "the same" line. */
const MATCH_THRESHOLD = 0.5;
/** Score given when every text label in a line matches but the numbers changed. */
const LABEL_MATCH_SCORE = 0.6;
/**
 * Score for pairing a blank line with a sparsely filled one (values typed into an empty
 * row/column). Exactly at the threshold, so any genuine match always wins over it.
 */
const BLANK_FILL_SCORE = MATCH_THRESHOLD;

/** Whether a line with `filled` values out of `length` positions is sparse enough to be a filled-in blank. */
const isSparseFill = (filled: number, length: number): boolean =>
  filled <= Math.max(3, Math.floor(length * 0.1));

type Cells = Record<string, string | number | boolean>;

const normalize = (v: unknown): string =>
  v === undefined || v === null ? '' : String(v).trim();

const isTextValue = (v: string): boolean => v !== '' && Number.isNaN(Number(v.replace(/[$,%()]/g, '')));

/** Last populated row and column, so trailing padding from the parser does not count as a change. */
function getUsedExtent(cells: Cells): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [ref, val] of Object.entries(cells || {})) {
    if (normalize(val) === '') continue;
    const parsed = parseCellRef(ref);
    if (!parsed) continue;
    rows = Math.max(rows, parsed.rowIndex);
    cols = Math.max(cols, parsed.colIndex);
  }
  return { rows, cols };
}

/** Builds a dense [row][col] string grid (0-based) of the used range. */
function toGrid(cells: Cells, rows: number, cols: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(cols).fill(''));
  for (const [ref, val] of Object.entries(cells || {})) {
    const parsed = parseCellRef(ref);
    if (!parsed || parsed.rowIndex > rows || parsed.colIndex > cols) continue;
    grid[parsed.rowIndex - 1][parsed.colIndex - 1] = normalize(val);
  }
  return grid;
}

/** Similarity of two lines of values (same length, positionally paired). */
function lineSimilarity(a: string[], b: string[]): number {
  let union = 0;
  let equal = 0;
  let textUnion = 0;
  let textEqual = 0;
  for (let k = 0; k < a.length; k++) {
    const x = a[k];
    const y = b[k];
    if (x === '' && y === '') continue;
    union++;
    if (x === y) equal++;
    if (isTextValue(x) || isTextValue(y)) {
      textUnion++;
      if (x === y) textEqual++;
    }
  }
  if (union === 0) return 1;
  if (equal === 0) {
    const filledA = a.filter((v) => v !== '').length;
    const filledB = b.filter((v) => v !== '').length;
    if ((filledA === 0 && isSparseFill(filledB, b.length)) || (filledB === 0 && isSparseFill(filledA, a.length))) {
      return BLANK_FILL_SCORE;
    }
  }
  const full = equal / union;
  // Same labels, updated figures: still the same financial line.
  const labels = textUnion > 0 && textEqual === textUnion ? LABEL_MATCH_SCORE : 0;
  return Math.max(full, labels);
}

/** Similarity of two columns, ignoring row positions so inserted rows do not break column matching. */
function columnSimilarity(a: string[], b: string[]): number {
  const countValues = (vals: string[]) => {
    const all = new Map<string, number>();
    const text = new Map<string, number>();
    for (const v of vals) {
      if (v === '') continue;
      all.set(v, (all.get(v) || 0) + 1);
      if (isTextValue(v)) text.set(v, (text.get(v) || 0) + 1);
    }
    return { all, text };
  };
  const jaccard = (x: Map<string, number>, y: Map<string, number>) => {
    let min = 0;
    let max = 0;
    const keys = new Set([...x.keys(), ...y.keys()]);
    for (const k of keys) {
      const cx = x.get(k) || 0;
      const cy = y.get(k) || 0;
      min += Math.min(cx, cy);
      max += Math.max(cx, cy);
    }
    return max === 0 ? 1 : min / max;
  };
  const ca = countValues(a);
  const cb = countValues(b);
  const filledA = a.length - a.filter((v) => v === '').length;
  const filledB = b.length - b.filter((v) => v === '').length;
  if ((filledA === 0 && filledB > 0 && isSparseFill(filledB, b.length)) || (filledB === 0 && filledA > 0 && isSparseFill(filledA, a.length))) {
    return BLANK_FILL_SCORE;
  }
  const full = jaccard(ca.all, cb.all);
  const textBoth = ca.text.size > 0 || cb.text.size > 0;
  const labels = textBoth && jaccard(ca.text, cb.text) === 1 ? LABEL_MATCH_SCORE : 0;
  return Math.max(full, labels);
}

/**
 * Aligns two sequences (LCS-style DP maximizing total similarity) and returns
 * slots in display order. Deletions are emitted before insertions at the same position.
 */
function alignSequences(
  baseLen: number,
  nextLen: number,
  similarity: (i: number, j: number) => number
): ReuploadAxisSlot[] {
  // Trim identical prefix / suffix to keep the DP small for typical small edits.
  let start = 0;
  while (start < baseLen && start < nextLen && similarity(start, start) === 1) start++;
  let endB = baseLen;
  let endN = nextLen;
  while (endB > start && endN > start && similarity(endB - 1, endN - 1) === 1) {
    endB--;
    endN--;
  }

  const n = endB - start;
  const m = endN - start;
  const width = m + 1;
  const score = new Float64Array((n + 1) * width);
  const sim = new Float64Array(n * m);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = similarity(start + i - 1, start + j - 1);
      sim[(i - 1) * m + (j - 1)] = s;
      let best = Math.max(score[(i - 1) * width + j], score[i * width + j - 1]);
      if (s >= MATCH_THRESHOLD) best = Math.max(best, score[(i - 1) * width + j - 1] + s);
      score[i * width + j] = best;
    }
  }

  const middle: ReuploadAxisSlot[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const s = sim[(i - 1) * m + (j - 1)];
      if (s >= MATCH_THRESHOLD && score[i * width + j] === score[(i - 1) * width + j - 1] + s) {
        middle.push({ status: 'matched', baseIndex: start + i, nextIndex: start + j });
        i--;
        j--;
        continue;
      }
    }
    if (j > 0 && (i === 0 || score[i * width + j] === score[i * width + j - 1])) {
      middle.push({ status: 'added', baseIndex: null, nextIndex: start + j });
      j--;
    } else {
      middle.push({ status: 'deleted', baseIndex: start + i, nextIndex: null });
      i--;
    }
  }
  middle.reverse();

  const slots: ReuploadAxisSlot[] = [];
  for (let k = 1; k <= start; k++) slots.push({ status: 'matched', baseIndex: k, nextIndex: k });
  slots.push(...middle);
  for (let k = 0; k < baseLen - endB; k++) {
    slots.push({ status: 'matched', baseIndex: endB + k + 1, nextIndex: endN + k + 1 });
  }
  return slots;
}

const isFormula = (v: unknown): v is string => typeof v === 'string' && v.startsWith('=') && v.length > 1;

/** A tab's cells as displayed: formulas replaced by their computed values. */
function resolveTabValues(workbook: AttachedSpreadsheet, tab: SpreadsheetTab | null): Cells {
  if (!tab) return {};
  const cache = new Map<string, string | number>();
  const values: Cells = {};
  for (const [ref, raw] of Object.entries(tab.cells || {})) {
    values[ref] = isFormula(raw) ? evaluateSpreadsheetFormula(raw, workbook, tab.name, 0, cache) : raw;
  }
  return values;
}

/**
 * A formula with its relative references written as offsets from its own cell (R1C1
 * style), so the same formula moved by an inserted row/column compares as unchanged.
 * Constants return null.
 */
function relativeFormula(raw: unknown, row: number, col: number): string | null {
  if (!isFormula(raw)) return null;
  return raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/(?<![A-Z0-9_.$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Z0-9_(])/g, (_m, colAbs, letters, rowAbs, digits) => {
      const c = letterToCol(letters);
      const r = parseInt(digits, 10);
      const rPart = rowAbs ? `R${r}` : `R[${r - row}]`;
      const cPart = colAbs ? `C${c}` : `C[${c - col}]`;
      return `${rPart}${cPart}`;
    });
}

export interface ReuploadCellChange {
  status: ReuploadCellStatus;
  before: unknown;
  after: unknown;
  /** Raw formulas ("=F9+B9"), when the cell holds one. */
  beforeFormula?: string;
  afterFormula?: string;
  /** The formula was edited, added or removed (whether or not the value changed too). */
  formulaChanged: boolean;
}

/** Compares one cell at a matched row × matched column intersection (values, then formulas). */
export function getReuploadCellChange(
  tab: ReuploadTabDiff,
  baseRow: number,
  baseCol: number,
  nextRow: number,
  nextCol: number
): ReuploadCellChange {
  const baseRef = colToLetter(baseCol) + baseRow;
  const nextRef = colToLetter(nextCol) + nextRow;
  const rawBefore = tab.baseTab?.cells?.[baseRef];
  const rawAfter = tab.nextTab?.cells?.[nextRef];
  const change: ReuploadCellChange = {
    status: 'unchanged',
    before: tab.baseValues[baseRef],
    after: tab.nextValues[nextRef],
    beforeFormula: isFormula(rawBefore) ? rawBefore : undefined,
    afterFormula: isFormula(rawAfter) ? rawAfter : undefined,
    formulaChanged: relativeFormula(rawBefore, baseRow, baseCol) !== relativeFormula(rawAfter, nextRow, nextCol)
  };
  const a = normalize(change.before);
  const b = normalize(change.after);
  if (a !== b) {
    change.status = a === '' ? 'added' : b === '' ? 'deleted' : 'modified';
  } else if (change.formulaChanged) {
    change.status = 'formula';
  }
  return change;
}

const findTabByName = (tabs: SpreadsheetTab[], name: string) =>
  tabs.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());

function diffTab(
  baseTab: SpreadsheetTab | null,
  nextTab: SpreadsheetTab | null,
  baseWorkbook: AttachedSpreadsheet,
  nextWorkbook: AttachedSpreadsheet
): ReuploadTabDiff {
  const name = (nextTab || baseTab)!.name;
  // Rows and columns are aligned on what the sheet shows, not on formula text, which
  // Excel rewrites for every cell below an inserted row.
  const baseCells = resolveTabValues(baseWorkbook, baseTab);
  const nextCells = resolveTabValues(nextWorkbook, nextTab);
  const baseExt = getUsedExtent(baseCells);
  const nextExt = getUsedExtent(nextCells);
  const status: ReuploadTabDiff['status'] = !baseTab ? 'added' : !nextTab ? 'deleted' : 'matched';

  const baseGrid = toGrid(baseCells, baseExt.rows, baseExt.cols);
  const nextGrid = toGrid(nextCells, nextExt.rows, nextExt.cols);

  const baseColCache = Array.from({ length: baseExt.cols }, (_, c) => baseGrid.map((row) => row[c]));
  const nextColCache = Array.from({ length: nextExt.cols }, (_, c) => nextGrid.map((row) => row[c]));

  // Comparing columns as bags of values breaks when a column has few values and one is
  // edited (e.g. a single formula cell): it then looks like a different column. So also
  // compare them row by row along a first-pass row alignment (columns taken by position).
  const commonCols = Math.min(baseExt.cols, nextExt.cols);
  const provisionalRows = alignSequences(baseExt.rows, nextExt.rows, (i, j) =>
    lineSimilarity(baseGrid[i].slice(0, commonCols), nextGrid[j].slice(0, commonCols))
  ).filter((s) => s.status === 'matched');
  const pairedColumnSimilarity = (i: number, j: number): number => {
    const a = provisionalRows.map((s) => baseColCache[i][s.baseIndex! - 1]);
    const b = provisionalRows.map((s) => nextColCache[j][s.nextIndex! - 1]);
    let filledEither = 0;
    let filledBoth = 0;
    for (let k = 0; k < a.length; k++) {
      if (a[k] !== '' || b[k] !== '') filledEither++;
      if (a[k] !== '' && b[k] !== '') filledBoth++;
    }
    // Same rows filled in: the same column with edited values. Exactly at the threshold,
    // so a column whose values actually match always wins.
    const sameShape = filledEither > 0 && filledBoth / filledEither >= 0.8 ? MATCH_THRESHOLD : 0;
    return Math.max(lineSimilarity(a, b), sameShape);
  };

  const cols = alignSequences(baseExt.cols, nextExt.cols, (i, j) =>
    Math.max(columnSimilarity(baseColCache[i], nextColCache[j]), pairedColumnSimilarity(i, j))
  );

  // Compare rows only across matched columns so inserted/deleted columns do not affect row matching.
  const pairedCols = cols.filter((s) => s.status === 'matched');
  const baseRowVals = baseGrid.map((row) => pairedCols.map((s) => row[s.baseIndex! - 1]));
  const nextRowVals = nextGrid.map((row) => pairedCols.map((s) => row[s.nextIndex! - 1]));
  const rows = alignSequences(baseExt.rows, nextExt.rows, (i, j) =>
    lineSimilarity(baseRowVals[i], nextRowVals[j])
  );

  const addedRows = rows.filter((s) => s.status === 'added').length;
  const deletedRows = rows.filter((s) => s.status === 'deleted').length;
  const addedCols = cols.filter((s) => s.status === 'added').length;
  const deletedCols = cols.filter((s) => s.status === 'deleted').length;

  const result: ReuploadTabDiff = {
    name,
    status,
    baseTab,
    nextTab,
    baseValues: baseCells,
    nextValues: nextCells,
    rows,
    cols,
    addedRows,
    deletedRows,
    addedCols,
    deletedCols,
    addedCells: 0,
    deletedCells: 0,
    modifiedCells: 0,
    formulaCells: 0,
    hasChanges: false
  };

  for (const r of rows) {
    if (r.status !== 'matched') continue;
    for (const c of pairedCols) {
      const change = getReuploadCellChange(result, r.baseIndex!, c.baseIndex!, r.nextIndex!, c.nextIndex!);
      if (change.status === 'added') result.addedCells++;
      else if (change.status === 'deleted') result.deletedCells++;
      else if (change.status === 'modified') result.modifiedCells++;
      if (change.formulaChanged) result.formulaCells++;
    }
  }

  result.hasChanges =
    status !== 'matched' ||
    addedRows + deletedRows + addedCols + deletedCols +
      result.addedCells + result.deletedCells + result.modifiedCells + result.formulaCells > 0;
  return result;
}

/**
 * Compares a freshly uploaded workbook against the current one, tab by tab (matched by name),
 * detecting inserted/deleted rows and columns plus changed cell values.
 */
export function computeWorkbookReuploadDiff(
  current: AttachedSpreadsheet,
  uploaded: AttachedSpreadsheet
): WorkbookReuploadDiff {
  const baseWorkbook = ensureSpreadsheetTabs(current);
  const nextWorkbook = ensureSpreadsheetTabs(uploaded);
  const baseTabs = baseWorkbook.tabs || [];
  const nextTabs = nextWorkbook.tabs || [];

  const tabs: ReuploadTabDiff[] = [];
  for (const nextTab of nextTabs) {
    tabs.push(diffTab(findTabByName(baseTabs, nextTab.name) || null, nextTab, baseWorkbook, nextWorkbook));
  }
  for (const baseTab of baseTabs) {
    if (!findTabByName(nextTabs, baseTab.name)) tabs.push(diffTab(baseTab, null, baseWorkbook, nextWorkbook));
  }

  return { tabs, hasChanges: tabs.some((t) => t.hasChanges) };
}

/**
 * Produces the workbook to save after accepting a re-upload: the uploaded content,
 * but keeping the existing workbook identity (id, name, document links) and tab ids.
 */
export function applyWorkbookReupload(
  current: AttachedSpreadsheet,
  uploaded: AttachedSpreadsheet
): AttachedSpreadsheet {
  const safeCurrent = ensureSpreadsheetTabs(current);
  const baseTabs = safeCurrent.tabs || [];
  const activeName = baseTabs.find((t) => t.id === safeCurrent.activeTabId)?.name;

  const tabs = (ensureSpreadsheetTabs(uploaded).tabs || []).map((t) => {
    const existing = findTabByName(baseTabs, t.name);
    return existing ? { ...t, id: existing.id } : t;
  });
  const activeTab = (activeName && findTabByName(tabs, activeName)) || tabs[0];

  return {
    ...safeCurrent,
    tabs,
    activeTabId: activeTab.id,
    sheetName: activeTab.name,
    rowCount: activeTab.rowCount,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
}

/** Converts aligned slots into sequential insert/delete operations (in current-sheet coordinates). */
function slotsToShiftOps(slots: ReuploadAxisSlot[], axis: 'row' | 'col'): CellShiftOperation[] {
  const ops: CellShiftOperation[] = [];
  let pos = 1;
  for (const slot of slots) {
    if (slot.status === 'matched') {
      pos++;
    } else if (slot.status === 'deleted') {
      ops.push(axis === 'row' ? { type: 'delete_row', targetRow: pos } : { type: 'delete_col', targetCol: pos });
    } else {
      ops.push(axis === 'row' ? { type: 'insert_row', targetRow: pos } : { type: 'insert_col', targetCol: pos });
      pos++;
    }
  }
  return ops;
}

/**
 * Shifts document cell variables bound to the given tab so they keep pointing at the same
 * data after rows/columns were inserted or deleted in Excel. References to deleted lines become #REF!.
 */
export function shiftBlocksForReupload(
  blocks: SecBlock[],
  tabDiff: ReuploadTabDiff,
  nextSpreadsheet: AttachedSpreadsheet
): { updatedBlocks: SecBlock[]; shiftedCount: number } {
  const ops = [...slotsToShiftOps(tabDiff.rows, 'row'), ...slotsToShiftOps(tabDiff.cols, 'col')];
  let updatedBlocks = blocks;
  let shiftedCount = 0;
  ops.forEach((op, idx) => {
    // Only sync live display values on the final pass, once coordinates are settled.
    const result = shiftBlocksCellReferences(
      updatedBlocks,
      op,
      tabDiff.name,
      idx === ops.length - 1 ? nextSpreadsheet : undefined
    );
    updatedBlocks = result.updatedBlocks;
    shiftedCount += result.shiftedCount;
  });
  return { updatedBlocks, shiftedCount };
}


/**
 * Applies an accepted re-upload: keeps workbook identity and re-binds document cell variables
 * on the active tab. `shiftedBlocks` is undefined when no block references moved.
 */
export function applyReuploadWithBlocks(
  current: AttachedSpreadsheet,
  uploaded: AttachedSpreadsheet,
  diff: WorkbookReuploadDiff,
  blocks: SecBlock[]
): { merged: AttachedSpreadsheet; shiftedBlocks?: SecBlock[]; shiftedCount: number } {
  const merged = applyWorkbookReupload(current, uploaded);
  const safeCurrent = ensureSpreadsheetTabs(current);
  const activeTabName = safeCurrent.tabs?.find((t) => t.id === safeCurrent.activeTabId)?.name;
  const activeTabDiff = diff.tabs.find((t) => t.status === 'matched' && t.name === activeTabName);
  if (!activeTabDiff || blocks.length === 0) return { merged, shiftedCount: 0 };

  const { updatedBlocks, shiftedCount } = shiftBlocksForReupload(blocks, activeTabDiff, merged);
  return { merged, shiftedBlocks: shiftedCount > 0 ? updatedBlocks : undefined, shiftedCount };
}
