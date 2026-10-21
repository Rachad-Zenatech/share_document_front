import type { AttachedSpreadsheet, SpreadsheetTab, SecBlock } from '../types/secFiling';
import ExcelJS from 'exceljs';

/**
 * Regex to match spreadsheet cell variables in document text.
 * Matches:
 *   - @A1
 *   - @A1{500}
 *   - @'06.30.26 TB'!B8{639,739.32}
 *   - @'Balance Sheet'!C12{$45,000}
 *   - @Notes!A5
 * Groups:
 *   1: Quoted sheet name (e.g. "06.30.26 TB" or "Balance Sheet")
 *   2: Unquoted sheet name (e.g. "Notes" or "TB")
 *   3: Cell reference (e.g. "A1", "B8", "AW272")
 *   4: Optional cached display fallback (e.g. "500", "$45,000")
 */
export const CELL_VARIABLE_REGEX =
  /@+(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?(\$?[A-Za-z]{1,3}\$?\d{1,4})(?:\{([^}]*)\})*/g;

/**
 * Check if a string contains any spreadsheet variable reference.
 */
export function hasDocumentVariables(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /@+(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+)!)?\$?[A-Za-z]{1,3}\$?\d{1,4}/i.test(text);
}

/**
 * Converts a column number (1-based) to column letters (A, B, ... Z, AA ... AW).
 */
export function colToLetter(col: number): string {
  let letter = '';
  let tempCol = col;
  while (tempCol > 0) {
    const temp = (tempCol - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    tempCol = Math.floor((tempCol - temp - 1) / 26);
  }
  return letter;
}

// Pre-instantiated formatters for fast number formatting without per-call Intl allocation
const intFormatter = new Intl.NumberFormat('en-US');
const floatFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formats a cell value into a human-readable display string.
 */
export function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '0';
    if (Number.isInteger(val)) {
      return intFormatter.format(val);
    }
    return floatFormatter.format(val);
  }
  return String(val);
}

/**
 * Formats a cell reference for insertion into document text.
 * E.g. If multiTab is active: `@'06.30.26 TB'!B8{$639,739}`
 * E.g. If single sheet: `@B8{$639,739}`
 */
export function createCellVariableToken(
  cellRef: string,
  displayVal?: string,
  tabName?: string,
  isMultiTab = false
): string {
  const cleanRef = cellRef.trim().toUpperCase();
  const valPart = displayVal !== undefined && displayVal !== '' ? `{${displayVal}}` : '';
  if (isMultiTab && tabName && tabName.trim()) {
    const cleanTab = tabName.trim();
    const needsQuotes = /[\s.\-_(),]/.test(cleanTab);
    const formattedTab = needsQuotes ? `'${cleanTab}'` : cleanTab;
    return `@${formattedTab}!${cleanRef}${valPart}`;
  }
  return `@${cleanRef}${valPart}`;
}

/**
 * Resolves a cell reference like 'A1', '$A$1', 'Sheet1!B8', or ''06.30.26 TB'!$C$12'
 * from an attached spreadsheet.
 */
/**
 * Evaluates an Excel-style formula string (e.g. "=E8+B8", "=SUM(A1:A5)", "=AVERAGE(B2:B10)")
 * using the cells of an AttachedSpreadsheet and returns the calculated number or string.
 */
export function evaluateSpreadsheetFormula(
  formula: string,
  spreadsheet?: AttachedSpreadsheet | null,
  activeTabName?: string,
  depth = 0,
  formulaCache?: Map<string, string | number>
): string | number {
  if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  if (depth > 30) return '#CYCLE!';
  if (formulaCache?.has(formula)) return formulaCache.get(formula)!;

  const expr = formula.slice(1).trim();

  // Find default cells for the active tab or top-level spreadsheet
  let defaultCells: Record<string, any> = spreadsheet?.cells || {};
  if (spreadsheet?.tabs && spreadsheet.tabs.length > 0) {
    if (activeTabName) {
      const cleanActive = activeTabName.trim().toLowerCase();
      const tab = spreadsheet.tabs.find(
        (t) => t.name.trim().toLowerCase() === cleanActive || t.id.toLowerCase() === cleanActive
      );
      if (tab?.cells) defaultCells = tab.cells;
    } else {
      const activeTab =
        spreadsheet.tabs.find((t) => t.id === spreadsheet.activeTabId) || spreadsheet.tabs[0];
      if (activeTab?.cells) defaultCells = activeTab.cells;
    }
  }

  // Resolve a single cell ref like A1, $A$1, 'Sheet1'!A1, Sheet1!$B$5 => its numeric value
  const resolveCell = (rawRef: string): number => {
    let tabName: string | undefined;
    let cleanRef = rawRef.trim();

    const tabMatch = cleanRef.match(/^(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!(.*)$/);
    if (tabMatch) {
      tabName = tabMatch[1] || tabMatch[2];
      cleanRef = tabMatch[3].trim();
    }

    cleanRef = cleanRef.replace(/\$/g, '').toUpperCase();

    let targetCells = defaultCells;
    if (tabName && spreadsheet?.tabs) {
      const cleanTab = tabName.trim().toLowerCase();
      const foundTab = spreadsheet.tabs.find(
        (t) => t.name.trim().toLowerCase() === cleanTab || t.id.toLowerCase() === cleanTab
      );
      if (foundTab?.cells) {
        targetCells = foundTab.cells;
      }
    }

    const v = targetCells[cleanRef];
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      if (v.startsWith('=')) {
        if (v === formula) return 0;
        const sub = evaluateSpreadsheetFormula(
          v,
          spreadsheet,
          tabName || activeTabName,
          depth + 1,
          formulaCache
        );
        const subNum = Number(String(sub).replace(/[$,\s%]/g, ''));
        return isNaN(subNum) ? 0 : subNum;
      }
      const cleaned = v.replace(/[$,\s%]/g, '');
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  // Expand a range like A1:B3 or $A$1:$B$3 or 'Sheet1'!A1:B3 into individual ref values
  const expandRange = (rangeStr: string): number[] => {
    let tabName: string | undefined;
    let cleanRange = rangeStr.trim();
    const tabMatch = cleanRange.match(/^(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!(.*)$/);
    if (tabMatch) {
      tabName = tabMatch[1] || tabMatch[2];
      cleanRange = tabMatch[3].trim();
    }

    const m = cleanRange.match(/^(\s*\$?)([A-Z]+)(\$?)([0-9]+):(\$?)([A-Z]+)(\$?)([0-9]+)$/i);
    if (!m) return [resolveCell(rangeStr)];

    const startCol = m[2].toUpperCase(); const startRow = parseInt(m[4], 10);
    const endCol = m[6].toUpperCase(); const endRow = parseInt(m[8], 10);
    const sc = letterToCol(startCol); const ec = letterToCol(endCol);
    const minCol = Math.min(sc, ec); const maxCol = Math.max(sc, ec);
    const minRow = Math.min(startRow, endRow); const maxRow = Math.max(startRow, endRow);

    const tabPrefix = tabName ? `'${tabName}'!` : '';
    const vals: number[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        vals.push(resolveCell(`${tabPrefix}${colToLetter(c)}${r}`));
      }
    }
    return vals;
  };

  // Parse comma-separated args, respecting nested parens
  const splitArgs = (s: string): string[] => {
    const args: string[] = []; let d = 0; let cur = '';
    for (const ch of s) {
      if (ch === '(') d++;
      else if (ch === ')') d--;
      if (ch === ',' && d === 0) { args.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
  };

  // Recursively evaluate sub-expression
  const evalExpr = (e: string): number | string => {
    e = e.trim();
    if ((e.startsWith('"') && e.endsWith('"')) || (e.startsWith("'") && e.endsWith("'"))) {
      return e.slice(1, -1);
    }
    if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(e)) return parseFloat(e);
    if (/^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+$/i.test(e)) {
      return resolveCell(e);
    }
    if (/^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(e)) {
      return expandRange(e)[0] ?? 0;
    }

    const fnMatch = e.match(/^([A-Z_]+)\((.*)\)$/i);
    if (fnMatch) {
      const fn = fnMatch[1].toUpperCase();
      const innerArgs = splitArgs(fnMatch[2]);
      const numArgs = innerArgs.flatMap((a) =>
        /^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(a.trim())
          ? expandRange(a.trim())
          : [Number(evalExpr(a))]
      );
      switch (fn) {
        case 'SUM':     return numArgs.reduce((s, v) => s + v, 0);
        case 'AVERAGE': return numArgs.length ? numArgs.reduce((s, v) => s + v, 0) / numArgs.length : 0;
        case 'MIN':     return numArgs.length ? Math.min(...numArgs) : 0;
        case 'MAX':     return numArgs.length ? Math.max(...numArgs) : 0;
        case 'PRODUCT': return numArgs.length ? numArgs.reduce((s, v) => s * v, 1) : 0;
        case 'COUNT':   return numArgs.filter((v) => !isNaN(v)).length;
        case 'COUNTA':  return innerArgs.flatMap((a) => /^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(a.trim()) ? expandRange(a.trim()) : [evalExpr(a)]).filter((v) => v !== '' && v !== 0).length;
        case 'ROUND':   return Math.round(Number(evalExpr(innerArgs[0])) * Math.pow(10, Number(evalExpr(innerArgs[1] ?? '0')))) / Math.pow(10, Number(evalExpr(innerArgs[1] ?? '0')));
        case 'ABS':     return Math.abs(Number(evalExpr(innerArgs[0])));
        case 'SQRT':    return Math.sqrt(Number(evalExpr(innerArgs[0])));
        case 'INT':     return Math.floor(Number(evalExpr(innerArgs[0])));
        case 'POWER':   return Math.pow(Number(evalExpr(innerArgs[0])), Number(evalExpr(innerArgs[1] ?? '1')));
        case 'MOD':     return ((Number(evalExpr(innerArgs[0])) % Number(evalExpr(innerArgs[1]))) + Number(evalExpr(innerArgs[1]))) % Number(evalExpr(innerArgs[1]));
        case 'MEDIAN': {
          if (numArgs.length === 0) return 0;
          const sorted = [...numArgs].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        case 'IF': {
          const cond = innerArgs[0];
          const condVal = cond.includes('>=')
            ? Number(evalExpr(cond.split('>=')[0])) >= Number(evalExpr(cond.split('>=')[1]))
            : cond.includes('<=')
            ? Number(evalExpr(cond.split('<=')[0])) <= Number(evalExpr(cond.split('<=')[1]))
            : cond.includes('>')
            ? Number(evalExpr(cond.split('>')[0])) > Number(evalExpr(cond.split('>')[1]))
            : cond.includes('<')
            ? Number(evalExpr(cond.split('<')[0])) < Number(evalExpr(cond.split('<')[1]))
            : cond.includes('<>')
            ? evalExpr(cond.split('<>')[0]) !== evalExpr(cond.split('<>')[1])
            : cond.includes('=')
            ? evalExpr(cond.split('=')[0]) === evalExpr(cond.split('=')[1])
            : Boolean(evalExpr(cond));
          return condVal ? evalExpr(innerArgs[1] ?? '0') : evalExpr(innerArgs[2] ?? '0');
        }
        case 'CONCATENATE': return innerArgs.map((a) => String(evalExpr(a))).join('');
        default: return '#NAME?';
      }
    }

    let withRefs = e.replace(/(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Za-z]+\$?[0-9]+/gi, (match) => String(resolveCell(match)));
    withRefs = withRefs.replace(/([0-9.]+)\s*%/g, '($1/100)');
    withRefs = withRefs.replace(/\^/g, '**');

    try {
      if (/^[0-9+\-*/().\s*]+$/.test(withRefs)) {
        // eslint-disable-next-line no-new-func
        return Function(`"use strict"; return (${withRefs})`)() as number;
      }
    } catch { /**/ }
    return '#ERROR';
  };

  try {
    const result = evalExpr(expr);
    let finalResult: number | string;
    if (typeof result === 'number') {
      if (!isFinite(result)) finalResult = '#DIV/0!';
      else finalResult = parseFloat(result.toFixed(10));
    } else {
      finalResult = String(result);
    }
    formulaCache?.set(formula, finalResult);
    return finalResult;
  } catch {
    formulaCache?.set(formula, '#ERROR');
    return '#ERROR';
  }
}

/**
 * Resolves a cell reference like 'A1', '$A$1', 'Sheet1!B8', or ''06.30.26 TB'!$C$12'
 * from an attached spreadsheet. Automatically evaluates formula cells (e.g. "=E8+B8")
 * so calling code receives the computed numeric/string value.
 */
export function getCellValue(
  cellRef: string,
  spreadsheet?: AttachedSpreadsheet | null,
  specifiedTabName?: string,
  evaluateFormulas = true
): any {
  if (!spreadsheet) return undefined;

  let targetTabName = specifiedTabName;
  let targetCell = cellRef.trim();

  // If cellRef itself contains sheet prefix: 'Sheet'!Cell or Sheet!Cell
  const match = targetCell.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?(\$?[A-Za-z]{1,3}\$?\d{1,4})$/i);
  if (match) {
    if (match[1] || match[2]) {
      targetTabName = match[1] || match[2];
    }
    targetCell = match[3];
  }

  // Normalize cell coordinate: strip any $ absolute reference indicators so $B$8 maps to B8
  const upperCell = targetCell.toUpperCase().replace(/\$/g, '');

  let rawVal: any;

  // 1. If tabName specified, find that tab
  if (targetTabName && spreadsheet.tabs && spreadsheet.tabs.length > 0) {
    const cleanTarget = targetTabName.trim().toLowerCase();
    const foundTab = spreadsheet.tabs.find(
      (t) => t.name.trim().toLowerCase() === cleanTarget || t.id.toLowerCase() === cleanTarget
    );
    if (foundTab && foundTab.cells && foundTab.cells[upperCell] !== undefined) {
      rawVal = foundTab.cells[upperCell];
    }
  }

  // 2. Search active tab if tabs exist
  if (rawVal === undefined && spreadsheet.tabs && spreadsheet.tabs.length > 0) {
    const activeTab =
      spreadsheet.tabs.find((t) => t.id === spreadsheet.activeTabId) || spreadsheet.tabs[0];
    if (activeTab && activeTab.cells && activeTab.cells[upperCell] !== undefined) {
      rawVal = activeTab.cells[upperCell];
    }
  }

  // 3. Fallback to top-level cells object
  if (rawVal === undefined && spreadsheet.cells && spreadsheet.cells[upperCell] !== undefined) {
    rawVal = spreadsheet.cells[upperCell];
  }

  if (rawVal === undefined) return undefined;

  if (evaluateFormulas && typeof rawVal === 'string' && rawVal.startsWith('=')) {
    return evaluateSpreadsheetFormula(rawVal, spreadsheet, targetTabName);
  }

  return rawVal;
}

/**
 * Computes all cell-by-cell differences between two attached spreadsheets
 * and tracks which document blocks link to each modified cell.
 */
export function computeSpreadsheetDiffs(
  baseSheet?: AttachedSpreadsheet | null,
  proposedSheet?: AttachedSpreadsheet | null,
  blocks: SecBlock[] = []
): Array<{
  id: string;
  tabName?: string;
  cellRef: string;
  oldValue: any;
  newValue: any;
  oldFormatted: string;
  newFormatted: string;
  status: 'modified' | 'added' | 'deleted';
  linkedBlocks: Array<{
    blockId: string;
    blockType: string;
    section: string;
    snippet: string;
  }>;
}> {
  // Normalize sheets if provided
  const normBase = baseSheet ? ensureSpreadsheetTabs(baseSheet) : null;
  const normProp = proposedSheet && proposedSheet !== baseSheet ? ensureSpreadsheetTabs(proposedSheet) : null;

  const diffs: Array<{
    id: string;
    tabName?: string;
    cellRef: string;
    oldValue: any;
    newValue: any;
    oldFormatted: string;
    newFormatted: string;
    status: 'modified' | 'added' | 'deleted';
    linkedBlocks: Array<{
      blockId: string;
      blockType: string;
      section: string;
      snippet: string;
    }>;
  }> = [];

  const recordedDiffIds = new Set<string>();

  // Helper to find linked blocks for a cell
  const findLinkedBlocks = (cellRef: string, tabName?: string) => {
    const linked: Array<{ blockId: string; blockType: string; section: string; snippet: string }> = [];
    const upperCell = cellRef.toUpperCase();
    const cleanTab = tabName ? tabName.trim().toLowerCase() : '';

    const checkBlockText = (text: string, b: SecBlock) => {
      if (!text || typeof text !== 'string' || !text.includes('@')) return;
      const regex = new RegExp(CELL_VARIABLE_REGEX);
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        const tokenTab = (m[1] || m[2] || '').trim().toLowerCase();
        const tokenCell = m[3].toUpperCase();
        if (tokenCell === upperCell) {
          if (!tokenTab || !cleanTab || tokenTab === cleanTab) {
            linked.push({
              blockId: b.id,
              blockType: b.type,
              section: b.section || 'General',
              snippet: text.length > 90 ? text.slice(0, 90) + '...' : text
            });
            break;
          }
        }
      }
    };

    for (const b of blocks) {
      if (b.type === 'paragraph' || b.type === 'heading') {
        checkBlockText(b.text, b);
      } else if (b.type === 'callout') {
        checkBlockText(b.content, b);
        if (b.title) checkBlockText(b.title, b);
      } else if (b.type === 'financial_table' && Array.isArray(b.rows)) {
        for (const r of b.rows) {
          if (Array.isArray(r.cells)) {
            for (const c of r.cells) {
              if (typeof c === 'string') checkBlockText(c, b);
            }
          }
        }
      }
    }
    return linked;
  };

  // Helper to compare values safely without false diffs
  const areValuesDifferent = (a: any, b: any) => {
    if (a === b) return false;
    const isAEmpty = a === undefined || a === null || a === '' || (typeof a === 'string' && a.trim() === '');
    const isBEmpty = b === undefined || b === null || b === '' || (typeof b === 'string' && b.trim() === '');
    if (isAEmpty && isBEmpty) return false;
    if (isAEmpty !== isBEmpty) return true;

    // Number vs string or formatted comparison (e.g. 3300000 vs "3,300,000" vs "$3,300,000")
    const cleanNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[$,\s%]/g, '');
        if (cleaned !== '' && !isNaN(Number(cleaned))) {
          return Number(cleaned);
        }
      }
      return null;
    };

    const numA = cleanNumber(a);
    const numB = cleanNumber(b);
    if (numA !== null && numB !== null) {
      return Math.abs(numA - numB) > 0.000001;
    }

    return String(a ?? '').trim() !== String(b ?? '').trim();
  };

  const baseTabs = normBase?.tabs || [];
  const propTabs = normProp?.tabs || [];

  // Pair up tabs between base and proposed
  const tabPairs: Array<{
    tabName: string;
    baseCells: Record<string, any>;
    propCells: Record<string, any>;
  }> = [];

  if (normBase && normProp) {
    if (baseTabs.length === 1 && propTabs.length === 1) {
      // Single tab workbook on both sides: always pair them even if renamed
      const tabName = propTabs[0].name || baseTabs[0].name || 'Sheet1';
      tabPairs.push({
        tabName,
        baseCells: baseTabs[0].cells || {},
        propCells: propTabs[0].cells || {}
      });
    } else if (propTabs.length > 0 || baseTabs.length > 0) {
      const matchedBaseIndices = new Set<number>();

      for (let pIdx = 0; pIdx < propTabs.length; pIdx++) {
        const pTab = propTabs[pIdx];
        // 1. Match by ID
        let bIdx = baseTabs.findIndex((b, idx) => !matchedBaseIndices.has(idx) && b.id === pTab.id);
        // 2. Match by Name
        if (bIdx === -1) {
          bIdx = baseTabs.findIndex(
            (b, idx) => !matchedBaseIndices.has(idx) && b.name.trim().toLowerCase() === pTab.name.trim().toLowerCase()
          );
        }
        // 3. Match by Position if count matches
        if (bIdx === -1 && baseTabs.length === propTabs.length && !matchedBaseIndices.has(pIdx)) {
          bIdx = pIdx;
        }

        if (bIdx !== -1) {
          matchedBaseIndices.add(bIdx);
          tabPairs.push({
            tabName: pTab.name,
            baseCells: baseTabs[bIdx].cells || {},
            propCells: pTab.cells || {}
          });
        } else {
          // Newly added tab
          tabPairs.push({
            tabName: pTab.name,
            baseCells: {},
            propCells: pTab.cells || {}
          });
        }
      }

      // Unmatched base tabs (deleted tabs)
      for (let bIdx = 0; bIdx < baseTabs.length; bIdx++) {
        if (!matchedBaseIndices.has(bIdx)) {
          tabPairs.push({
            tabName: baseTabs[bIdx].name,
            baseCells: baseTabs[bIdx].cells || {},
            propCells: {}
          });
        }
      }
    }
  }

  // 1. Process all cell comparisons across all paired tabs
  for (const { tabName, baseCells, propCells } of tabPairs) {
    const allKeys = new Set<string>([...Object.keys(baseCells), ...Object.keys(propCells)]);

    for (const cellKey of allKeys) {
      const pVal = propCells[cellKey];
      const bVal = baseCells[cellKey];

      if (areValuesDifferent(pVal, bVal)) {
        const isBValEmpty = bVal === undefined || bVal === null || bVal === '' || (typeof bVal === 'string' && bVal.trim() === '');
        const isPValEmpty = pVal === undefined || pVal === null || pVal === '' || (typeof pVal === 'string' && pVal.trim() === '');

        if (isBValEmpty && isPValEmpty) continue;

        const isDeleted = isPValEmpty && !isBValEmpty;
        const isAdded = isBValEmpty && !isPValEmpty;
        const status: 'modified' | 'added' | 'deleted' = isDeleted ? 'deleted' : isAdded ? 'added' : 'modified';

        const diffId = `${tabName}!${cellKey}`;
        recordedDiffIds.add(diffId);
        recordedDiffIds.add(cellKey);

        diffs.push({
          id: diffId,
          tabName,
          cellRef: cellKey,
          oldValue: bVal ?? null,
          newValue: pVal ?? null,
          oldFormatted: formatCellValue(bVal),
          newFormatted: formatCellValue(pVal),
          status,
          linkedBlocks: findLinkedBlocks(cellKey, tabName)
        });
      }
    }
  }

  // 2. Document Block Variable Tag Inspection:
  // Detect any variables with cached values in proposal blocks that differ from baseSheet
  for (const b of blocks) {
    const textToCheck: string[] = [];
    if (b.type === 'paragraph' || b.type === 'heading') {
      textToCheck.push(b.text || '');
    } else if (b.type === 'callout') {
      textToCheck.push(b.content || '');
      if (b.title) textToCheck.push(b.title);
    } else if (b.type === 'financial_table' && Array.isArray(b.rows)) {
      for (const r of b.rows) {
        if (Array.isArray(r.cells)) {
          for (const c of r.cells) {
            if (typeof c === 'string') textToCheck.push(c);
          }
        }
      }
    }

    for (const text of textToCheck) {
      if (!text || !text.includes('@')) continue;
      const regex = new RegExp(CELL_VARIABLE_REGEX);
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        const tabName = (m[1] || m[2] || '').trim();
        const cellRef = m[3].toUpperCase();
        const fallbackVal = m[4]; // e.g. "$3,300,000" or "3300000"
        const diffId = tabName ? `${tabName}!${cellRef}` : cellRef;

        if (!recordedDiffIds.has(diffId) && fallbackVal !== undefined && fallbackVal !== '') {
          const baseVal = getCellValue(cellRef, normBase || baseSheet, tabName || undefined);
          if (areValuesDifferent(fallbackVal, baseVal)) {
            recordedDiffIds.add(diffId);
            recordedDiffIds.add(cellRef);
            diffs.push({
              id: diffId,
              tabName: tabName || undefined,
              cellRef,
              oldValue: baseVal ?? null,
              newValue: fallbackVal,
              oldFormatted: formatCellValue(baseVal),
              newFormatted: fallbackVal,
              status: baseVal !== undefined && baseVal !== null ? 'modified' : 'added',
              linkedBlocks: findLinkedBlocks(cellRef, tabName || undefined)
            });
          }
        }
      }
    }
  }

  return diffs;
}

/**
 * Replaces all cell variables in a text string with their live spreadsheet values.
 */
export function interpolateVariables(
  text: string,
  spreadsheet?: AttachedSpreadsheet | null
): string {
  if (!text || typeof text !== 'string') return text || '';
  if (!spreadsheet) {
    return text.replace(CELL_VARIABLE_REGEX, (_match, _qTab, _uTab, cell, fallback) => {
      return fallback !== undefined && fallback !== '' ? fallback : `@${cell.toUpperCase()}`;
    });
  }

  return text.replace(CELL_VARIABLE_REGEX, (match, qTab, uTab, cellRef, fallback) => {
    const tabName = qTab || uTab;
    const liveVal = getCellValue(cellRef, spreadsheet, tabName);
    if (liveVal !== undefined && liveVal !== null) {
      return formatCellValue(liveVal);
    }
    return fallback !== undefined && fallback !== '' ? fallback : match;
  });
}

/**
 * Updates text in-place so cached tag previews `@Cell{old}` stay fresh `@Cell{new}`.
 */
export function syncVariableCacheTags(
  text: string,
  spreadsheet?: AttachedSpreadsheet | null
): string {
  if (!text || typeof text !== 'string') return text || '';
  if (!spreadsheet) return text;

  return text.replace(CELL_VARIABLE_REGEX, (_match, qTab, uTab, cellRef, fallback) => {
    const tabName = qTab || uTab;
    const upperRef = cellRef.toUpperCase();
    const liveVal = getCellValue(upperRef, spreadsheet, tabName);
    const prefix = tabName ? (qTab ? `@'${tabName}'!` : `@${tabName}!`) : '@';
    if (liveVal !== undefined && liveVal !== null) {
      return `${prefix}${upperRef}{${formatCellValue(liveVal)}}`;
    }
    if (fallback !== undefined && fallback !== '') {
      const cleanFallback = fallback.replace(/^\{+|\}+$/g, '').trim();
      return `${prefix}${upperRef}{${cleanFallback}}`;
    }
    return `${prefix}${upperRef}`;
  });
}

/**
 * Extracts all unique cell references used in a string.
 */
export function extractCellReferences(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const refs = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(CELL_VARIABLE_REGEX);
  while ((match = regex.exec(text)) !== null) {
    const tab = match[1] || match[2];
    const cell = match[3].toUpperCase();
    refs.add(tab ? `${tab}!${cell}` : cell);
  }
  return Array.from(refs);
}

/**
 * Ensures an AttachedSpreadsheet has its `tabs` array initialized.
 */
export function ensureSpreadsheetTabs(sheet?: AttachedSpreadsheet | null): AttachedSpreadsheet {
  if (!sheet) {
    return createBlankSpreadsheet('Workbook.xlsx', 'Sheet1', 30, 10);
  }
  if (sheet.tabs && sheet.tabs.length > 0) {
    const hasActive = sheet.tabs.some((t) => t.id === sheet.activeTabId);
    return {
      ...sheet,
      activeTabId: hasActive ? sheet.activeTabId : sheet.tabs[0].id
    };
  }

  const initialTabId = sheet.id ? `tab-${sheet.id}-main` : 'tab-main-1';
  const rowCount = Math.max(1, sheet.rowCount || 30);
  const colCount = Math.max(1, sheet.colCount || 10);
  const maxCol = sheet.maxCol || colToLetter(colCount);

  const colLetters = sheet.colLetters && sheet.colLetters.length >= colCount
    ? sheet.colLetters
    : Array.from({ length: colCount }, (_, i) => colToLetter(i + 1));

  const headers = sheet.headers && sheet.headers.length >= colCount
    ? sheet.headers
    : colLetters.map((c) => `Column ${c}`);

  const initialTab: SpreadsheetTab = {
    id: initialTabId,
    name: sheet.sheetName || 'Sheet1',
    rowCount,
    colCount,
    maxCol,
    colLetters,
    headers,
    cells: { ...(sheet.cells || {}) }
  };

  return {
    ...sheet,
    tabs: [initialTab],
    activeTabId: initialTab.id,
    sheetName: initialTab.name,
    rowCount,
    colCount,
    maxCol,
    colLetters,
    headers,
    cells: initialTab.cells
  };
}

/**
 * Synchronizes an active tab's full dimensional metadata into the top-level AttachedSpreadsheet properties.
 */
export function syncActiveTabToTopLevel(
  withTabs: AttachedSpreadsheet,
  updatedTabs: SpreadsheetTab[],
  activeId?: string
): AttachedSpreadsheet {
  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0] || {
    id: 'tab-main-1',
    name: 'Sheet1',
    rowCount: 30,
    colCount: 10,
    maxCol: 'J',
    colLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    headers: [],
    cells: {}
  };

  return {
    ...withTabs,
    tabs: updatedTabs,
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

/**
 * Switches the active tab and synchronizes the active tab's metadata into top-level properties.
 */
export function switchActiveTab(sheet: AttachedSpreadsheet, tabId: string): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const targetTab = withTabs.tabs?.find((t) => t.id === tabId) || withTabs.tabs?.[0];
  if (!targetTab) return sheet;

  return syncActiveTabToTopLevel(withTabs, withTabs.tabs || [], targetTab.id);
}

/**
 * Adds a new tab to an AttachedSpreadsheet.
 */
export function addTabToSpreadsheet(
  sheet: AttachedSpreadsheet,
  tabName?: string,
  rowCount = 30,
  colCount = 10
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const existingTabs = withTabs.tabs || [];
  const nextNum = existingTabs.length + 1;
  const name = tabName?.trim() || `Sheet${nextNum}`;

  const colLetters: string[] = [];
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const letter = colToLetter(c);
    colLetters.push(letter);
    headers.push(`Column ${letter}`);
  }

  const newTab: SpreadsheetTab = {
    id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    rowCount,
    colCount,
    maxCol: colToLetter(colCount),
    colLetters,
    headers,
    cells: {}
  };

  const updatedTabs = [...existingTabs, newTab];

  return {
    ...withTabs,
    tabs: updatedTabs,
    activeTabId: newTab.id,
    sheetName: newTab.name,
    rowCount: newTab.rowCount,
    colCount: newTab.colCount,
    maxCol: newTab.maxCol,
    colLetters: newTab.colLetters,
    headers: newTab.headers,
    cells: newTab.cells,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Removes a tab from the AttachedSpreadsheet.
 */
export function removeTabFromSpreadsheet(sheet: AttachedSpreadsheet, tabId: string): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const existingTabs = withTabs.tabs || [];
  if (existingTabs.length <= 1) return sheet; // Cannot remove the last tab

  const updatedTabs = existingTabs.filter((t) => t.id !== tabId);
  const nextActive = updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    activeTabId: nextActive.id,
    sheetName: nextActive.name,
    rowCount: nextActive.rowCount,
    colCount: nextActive.colCount,
    maxCol: nextActive.maxCol,
    colLetters: nextActive.colLetters,
    headers: nextActive.headers,
    cells: nextActive.cells,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Renames an existing tab in an AttachedSpreadsheet.
 */
export function renameTabInSpreadsheet(
  sheet: AttachedSpreadsheet,
  tabId: string,
  newName: string
): AttachedSpreadsheet {
  if (!newName.trim()) return sheet;
  const withTabs = ensureSpreadsheetTabs(sheet);
  const updatedTabs = (withTabs.tabs || []).map((t) =>
    t.id === tabId ? { ...t, name: newName.trim() } : t
  );

  const activeTab = updatedTabs.find((t) => t.id === withTabs.activeTabId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    sheetName: activeTab ? activeTab.name : withTabs.sheetName,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Updates the cells of the currently active tab.
 */
export function updateActiveTabCells(
  sheet: AttachedSpreadsheet,
  updatedCells: Record<string, string | number | boolean>
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;

  const updatedTabs = (withTabs.tabs || []).map((t) =>
    t.id === activeId ? { ...t, cells: updatedCells } : t
  );

  return {
    ...withTabs,
    tabs: updatedTabs,
    cells: updatedCells,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Parses an uploaded .xlsx file with MULTIPLE worksheets into an AttachedSpreadsheet with tabs.
 */
export async function parseExcelFileToSpreadsheet(file: File): Promise<AttachedSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  if (!wb.worksheets || wb.worksheets.length === 0) {
    throw new Error('No worksheets found in uploaded Excel file.');
  }

  const tabs: SpreadsheetTab[] = [];

  for (let i = 0; i < wb.worksheets.length; i++) {
    const ws = wb.worksheets[i];
    const maxRows = Math.min(Math.max(30, ws.rowCount || 30), 800);
    const maxCols = Math.min(Math.max(10, ws.columnCount || 10), 100);

    const colLetters: string[] = [];
    const headers: string[] = [];
    // Check row 6 or row 1 for potential column headings
    const headerRow = ws.getRow(6).values ? ws.getRow(6) : ws.getRow(1);
    for (let c = 1; c <= maxCols; c++) {
      const letter = colToLetter(c);
      colLetters.push(letter);
      const val = headerRow.getCell(c).value;
      headers.push(val ? String(val).trim() : `Col ${letter}`);
    }

    const cells: Record<string, string | number | boolean> = {};

    for (let r = 1; r <= maxRows; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= maxCols; c++) {
        const cell = row.getCell(c);
        let val: any = null;
        if (cell.result !== undefined && cell.result !== null) {
          val = cell.result;
        } else if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object') {
            if (cell.value instanceof Date) {
              val = cell.value.toISOString().split('T')[0];
            } else if ('result' in cell.value && cell.value.result !== undefined) {
              val = cell.value.result;
            } else if ('richText' in cell.value) {
              val = cell.value.richText.map((t: any) => t.text).join('');
            } else if ('text' in cell.value) {
              val = cell.value.text;
            } else {
              val = cell.text || '';
            }
          } else {
            val = cell.value;
          }
        }

        if (val === undefined) val = null;
        if (typeof val === 'number') {
          if (Math.abs(val) < 1e-9) val = 0;
          else val = Math.round(val * 100) / 100;
        }

        if (val !== null && val !== '') {
          const cellRef = colToLetter(c) + r;
          cells[cellRef] = val;
        }
      }
    }

    tabs.push({
      id: `tab-${i + 1}-${Date.now()}`,
      name: ws.name || `Sheet${i + 1}`,
      rowCount: maxRows,
      colCount: maxCols,
      maxCol: colToLetter(maxCols),
      colLetters,
      headers,
      cells
    });
  }

  // Find preferred default active tab (e.g. TB or first)
  let activeIdx = tabs.findIndex((t) => t.name.toLowerCase().includes('tb'));
  if (activeIdx < 0) activeIdx = 0;
  const activeTab = tabs[activeIdx];

  return {
    id: `sheet-${Date.now()}`,
    fileName: file.name,
    sheetName: activeTab.name,
    rowCount: activeTab.rowCount,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    tabs,
    activeTabId: activeTab.id,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Exports an AttachedSpreadsheet (including ALL tabs) back to an .xlsx Blob.
 */
export async function exportSpreadsheetToExcel(sheet: AttachedSpreadsheet): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const withTabs = ensureSpreadsheetTabs(sheet);
  const tabs = withTabs.tabs || [];

  if (tabs.length === 0) {
    const ws = wb.addWorksheet(sheet.sheetName || 'Sheet1');
    for (let r = 1; r <= (sheet.rowCount || 30); r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= (sheet.colCount || 10); c++) {
        const cellRef = colToLetter(c) + r;
        const val = sheet.cells[cellRef];
        if (val !== undefined && val !== null) {
          row.getCell(c).value = val as any;
        }
      }
    }
  } else {
    for (const tab of tabs) {
      const ws = wb.addWorksheet(tab.name || 'Sheet');
      for (let r = 1; r <= tab.rowCount; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= tab.colCount; c++) {
          const cellRef = colToLetter(c) + r;
          const val = tab.cells[cellRef];
          if (val !== undefined && val !== null) {
            row.getCell(c).value = val as any;
          }
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Creates a brand new blank spreadsheet with customizable dimensions and tab support.
 */
export function createBlankSpreadsheet(
  name = 'Custom Spreadsheet',
  sheetName = 'Sheet1',
  rowCount = 30,
  colCount = 10
): AttachedSpreadsheet {
  const colLetters: string[] = [];
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const letter = colToLetter(c);
    colLetters.push(letter);
    headers.push(`Column ${letter}`);
  }

  const initialTab: SpreadsheetTab = {
    id: `tab-1-${Date.now()}`,
    name: sheetName,
    rowCount,
    colCount,
    maxCol: colToLetter(colCount),
    colLetters,
    headers,
    cells: {}
  };

  return {
    id: `sheet-${Date.now()}`,
    fileName: `${name}.xlsx`,
    sheetName,
    rowCount,
    colCount,
    maxCol: colToLetter(colCount),
    colLetters,
    headers,
    cells: {},
    tabs: [initialTab],
    activeTabId: initialTab.id,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Adds rows to the active tab of an existing spreadsheet.
 */
export function addRowsToSpreadsheet(sheet: AttachedSpreadsheet, count = 1): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const nextRows = Math.max(1, (t.rowCount || 1) + count);
      return { ...t, rowCount: nextRows };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Removes rows from the bottom of the active tab.
 */
export function removeRowsFromSpreadsheet(sheet: AttachedSpreadsheet, count = 1): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const nextRows = Math.max(1, (t.rowCount || 1) - count);
      return { ...t, rowCount: nextRows };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Adds columns to the right of the active tab.
 */
export function addColumnsToSpreadsheet(sheet: AttachedSpreadsheet, count = 1): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const currentCols = t.colCount || 1;
      const nextCols = Math.min(100, currentCols + count);
      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers] : [];
      for (let c = 1; c <= nextCols; c++) {
        const letter = colToLetter(c);
        colLetters.push(letter);
        if (!headers[c - 1]) headers[c - 1] = `Column ${letter}`;
      }
      return {
        ...t,
        colCount: nextCols,
        maxCol: colToLetter(nextCols),
        colLetters,
        headers
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Removes columns from the right of the active tab.
 */
export function removeColumnsFromSpreadsheet(sheet: AttachedSpreadsheet, count = 1): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const currentCols = t.colCount || 1;
      const nextCols = Math.max(1, currentCols - count);
      const colLetters: string[] = [];
      const headers = (t.headers || []).slice(0, nextCols);
      for (let c = 1; c <= nextCols; c++) {
        colLetters.push(colToLetter(c));
      }
      return {
        ...t,
        colCount: nextCols,
        maxCol: colToLetter(nextCols),
        colLetters,
        headers
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Resizes the grid of the active tab to exact row and column dimensions.
 */
export function resizeSpreadsheetGrid(
  sheet: AttachedSpreadsheet,
  targetRows: number,
  targetCols: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const rows = Math.max(1, Math.min(2000, targetRows));
  const cols = Math.max(1, Math.min(100, targetCols));

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers].slice(0, cols) : [];
      for (let c = 1; c <= cols; c++) {
        const letter = colToLetter(c);
        colLetters.push(letter);
        if (!headers[c - 1]) headers[c - 1] = `Column ${letter}`;
      }
      return {
        ...t,
        rowCount: rows,
        colCount: cols,
        maxCol: colToLetter(cols),
        colLetters,
        headers
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Converts column letter (e.g. "A", "Z", "AA", "AW") to 1-based column number.
 */
export function letterToCol(letter: string): number {
  let col = 0;
  const clean = (letter || '').trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return Math.max(1, col);
}

/**
 * Parses a cell reference like "A1", "$A$1", "A$1", or "AW272" into column letters, 1-based column index, and 1-based row index.
 */
export function parseCellRef(
  ref: string
): { colLetter: string; colIndex: number; rowIndex: number; isColAbsolute?: boolean; isRowAbsolute?: boolean } | null {
  const match = (ref || '').trim().toUpperCase().match(/^(\$?)([A-Z]+)(\$?)([0-9]+)$/);
  if (!match) return null;
  const isColAbsolute = Boolean(match[1]);
  const colLetter = match[2];
  const isRowAbsolute = Boolean(match[3]);
  const rowIndex = parseInt(match[4], 10);
  const colIndex = letterToCol(colLetter);
  return { colLetter, colIndex, rowIndex, isColAbsolute, isRowAbsolute };
}

/**
 * Specification of a cell grid shifting or row/col insertion/deletion operation.
 */
export type CellShiftOperation =
  | { type: 'insert_row'; targetRow: number }
  | { type: 'delete_row'; targetRow: number }
  | { type: 'insert_col'; targetCol: number }
  | { type: 'delete_col'; targetCol: number }
  | { type: 'shift_down'; targetCol: number; targetRow: number }
  | { type: 'shift_up'; targetCol: number; targetRow: number }
  | { type: 'shift_right'; targetCol: number; targetRow: number }
  | { type: 'shift_left'; targetCol: number; targetRow: number };

/**
 * Shifts a single cell coordinate according to the given operation.
 * Returns the shifted cell ref (e.g. "B9" or "$B$9") or "#REF!" if the cell was deleted.
 */
export function shiftSingleCellRef(
  colIndex: number,
  rowIndex: number,
  op: CellShiftOperation,
  isColAbsolute = false,
  isRowAbsolute = false
): string {
  let newCol = colIndex;
  let newRow = rowIndex;

  switch (op.type) {
    case 'insert_row': {
      if (rowIndex >= op.targetRow) {
        newRow = rowIndex + 1;
      }
      break;
    }
    case 'delete_row': {
      if (rowIndex === op.targetRow) {
        return '#REF!';
      } else if (rowIndex > op.targetRow) {
        newRow = rowIndex - 1;
      }
      break;
    }
    case 'insert_col': {
      if (colIndex >= op.targetCol) {
        newCol = colIndex + 1;
      }
      break;
    }
    case 'delete_col': {
      if (colIndex === op.targetCol) {
        return '#REF!';
      } else if (colIndex > op.targetCol) {
        newCol = colIndex - 1;
      }
      break;
    }
    case 'shift_down': {
      if (colIndex === op.targetCol && rowIndex >= op.targetRow) {
        newRow = rowIndex + 1;
      }
      break;
    }
    case 'shift_up': {
      if (colIndex === op.targetCol && rowIndex === op.targetRow) {
        return '#REF!';
      } else if (colIndex === op.targetCol && rowIndex > op.targetRow) {
        newRow = rowIndex - 1;
      }
      break;
    }
    case 'shift_right': {
      if (rowIndex === op.targetRow && colIndex >= op.targetCol) {
        newCol = colIndex + 1;
      }
      break;
    }
    case 'shift_left': {
      if (rowIndex === op.targetRow && colIndex === op.targetCol) {
        return '#REF!';
      } else if (rowIndex === op.targetRow && colIndex > op.targetCol) {
        newCol = colIndex - 1;
      }
      break;
    }
  }

  const colPrefix = isColAbsolute ? '$' : '';
  const rowPrefix = isRowAbsolute ? '$' : '';
  return `${colPrefix}${colToLetter(newCol)}${rowPrefix}${newRow}`;
}

/**
 * Shifts any cell references inside a formula string (e.g. "=B8*1.1" -> "=B9*1.1", "=$A$1+2" -> "=$A$2+2").
 */
export function shiftFormulaInString(
  formulaStr: string,
  op: CellShiftOperation,
  targetTabName?: string
): string {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
    return formulaStr;
  }

  return formulaStr.replace(
    /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,5})/g,
    (match, qTab, uTab, colAbs, colLetters, rowAbs, rowDigits) => {
      const tab = qTab || uTab;
      if (tab && targetTabName) {
        if (tab.trim().toLowerCase() !== targetTabName.trim().toLowerCase()) {
          return match;
        }
      }
      const col = letterToCol(colLetters);
      const row = parseInt(rowDigits, 10);
      const isColAbsolute = Boolean(colAbs);
      const isRowAbsolute = Boolean(rowAbs);
      const shifted = shiftSingleCellRef(col, row, op, isColAbsolute, isRowAbsolute);
      if (shifted === '#REF!') {
        return tab ? (qTab ? `'${tab}'!#REF!` : `${tab}!#REF!`) : '#REF!';
      }
      if (tab) {
        const formattedTab = qTab ? `'${tab}'` : tab;
        return `${formattedTab}!${shifted}`;
      }
      return shifted;
    }
  );
}

/**
 * Shifts document block cell variable tokens so document data remains accurately bound
 * to the exact same cell data when rows or columns are inserted, deleted, or shifted.
 */
export function shiftBlocksCellReferences(
  blocks: SecBlock[],
  op: CellShiftOperation,
  targetTabName?: string,
  nextSpreadsheet?: AttachedSpreadsheet
): { updatedBlocks: SecBlock[]; shiftedCount: number } {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return { updatedBlocks: blocks || [], shiftedCount: 0 };
  }

  let shiftedCount = 0;

  const transformText = (text: string): string => {
    if (!text || typeof text !== 'string') return text;

    return text.replace(CELL_VARIABLE_REGEX, (match, qTab, uTab, cellRef, fallback) => {
      const tab = qTab || uTab;
      if (tab && targetTabName) {
        if (tab.trim().toLowerCase() !== targetTabName.trim().toLowerCase()) {
          return match;
        }
      }

      const parsed = parseCellRef(cellRef);
      if (!parsed) return match;

      // Preserve absolute cell reference flags so $B$8 shifts to $B$9
      const shifted = shiftSingleCellRef(
        parsed.colIndex,
        parsed.rowIndex,
        op,
        parsed.isColAbsolute,
        parsed.isRowAbsolute
      );

      if (shifted === '#REF!') {
        shiftedCount++;
        const tabPrefix = tab ? (qTab ? `'${tab}'!` : `${tab}!`) : '';
        return `@${tabPrefix}#REF!{#REF!}`;
      }

      // Check if the cell coordinate shifted or if the live value from nextSpreadsheet should be synced
      const tabPrefix = tab ? (qTab ? `'${tab}'!` : `${tab}!`) : '';
      let displayValue = fallback;
      if (nextSpreadsheet) {
        const liveVal = getCellValue(shifted, nextSpreadsheet, tab);
        if (liveVal !== undefined && liveVal !== null) {
          displayValue = formatCellValue(liveVal);
        }
      }

      if (shifted !== cellRef.toUpperCase() || (nextSpreadsheet && displayValue !== fallback)) {
        shiftedCount++;
        const fallbackPart = displayValue !== undefined && displayValue !== '' ? `{${displayValue}}` : '';
        return `@${tabPrefix}${shifted}${fallbackPart}`;
      }

      return match;
    });
  };

  const updatedBlocks = blocks.map((b) => {
    if (b.type === 'paragraph' || b.type === 'heading') {
      const newText = transformText(b.text);
      if (newText !== b.text) {
        return { ...b, text: newText, updatedAt: new Date().toISOString() };
      }
    } else if (b.type === 'callout') {
      const newContent = transformText(b.content);
      const newTitle = b.title ? transformText(b.title) : b.title;
      if (newContent !== b.content || newTitle !== b.title) {
        return { ...b, content: newContent, title: newTitle, updatedAt: new Date().toISOString() };
      }
    } else if (b.type === 'financial_table' && Array.isArray(b.rows)) {
      let rowChanged = false;
      const newRows = b.rows.map((r) => {
        if (Array.isArray(r.cells)) {
          let cellChanged = false;
          const newCells = r.cells.map((c) => {
            if (typeof c === 'string') {
              const updated = transformText(c);
              if (updated !== c) {
                cellChanged = true;
                rowChanged = true;
                return updated;
              }
            }
            return c;
          });
          if (cellChanged) return { ...r, cells: newCells };
        }
        return r;
      });
      if (rowChanged) {
        return { ...b, rows: newRows, updatedAt: new Date().toISOString() };
      }
    }
    return b;
  });

  return { updatedBlocks, shiftedCount };
}

/**
 * Inserts a blank row at the specified 1-based row index in the active tab,
 * shifting all existing cells at or below that row down by 1.
 */
export function insertRowAtIndex(
  sheet: AttachedSpreadsheet,
  targetRow: number,
  position: 'above' | 'below' = 'below'
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const actualRow = position === 'below' ? targetRow + 1 : targetRow;
  const op: CellShiftOperation = { type: 'insert_row', targetRow: actualRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const newCells: Record<string, string | number | boolean> = {};
      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }
        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }
        if (parsed.rowIndex >= actualRow) {
          newCells[`${parsed.colLetter}${parsed.rowIndex + 1}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }
      return {
        ...t,
        rowCount: (t.rowCount || 1) + 1,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Deletes a row at the specified 1-based row index in the active tab,
 * shifting all rows below it up by 1.
 */
export function deleteRowAtIndex(
  sheet: AttachedSpreadsheet,
  targetRow: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'delete_row', targetRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      if ((t.rowCount || 1) <= 1) return t;
      const newCells: Record<string, string | number | boolean> = {};
      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }
        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }
        if (parsed.rowIndex === targetRow) {
          continue;
        } else if (parsed.rowIndex > targetRow) {
          newCells[`${parsed.colLetter}${parsed.rowIndex - 1}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }
      return {
        ...t,
        rowCount: Math.max(1, (t.rowCount || 1) - 1),
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Inserts a blank column at the specified 1-based column index in the active tab,
 * shifting all columns at or to the right of targetCol to the right by 1.
 */
export function insertColAtIndex(
  sheet: AttachedSpreadsheet,
  targetCol: number,
  position: 'left' | 'right' = 'right'
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const actualCol = position === 'right' ? targetCol + 1 : targetCol;
  const op: CellShiftOperation = { type: 'insert_col', targetCol: actualCol };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const nextColCount = Math.min(100, (t.colCount || 1) + 1);
      const newCells: Record<string, string | number | boolean> = {};
      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }
        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }
        if (parsed.colIndex >= actualCol) {
          const shiftedColLetter = colToLetter(parsed.colIndex + 1);
          newCells[`${shiftedColLetter}${parsed.rowIndex}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers] : [];
      headers.splice(actualCol - 1, 0, `Column ${colToLetter(actualCol)}`);
      for (let c = 1; c <= nextColCount; c++) {
        colLetters.push(colToLetter(c));
      }

      return {
        ...t,
        colCount: nextColCount,
        maxCol: colToLetter(nextColCount),
        colLetters,
        headers,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Deletes a column at the specified 1-based column index in the active tab.
 */
export function deleteColAtIndex(
  sheet: AttachedSpreadsheet,
  targetCol: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'delete_col', targetCol };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      if ((t.colCount || 1) <= 1) return t;
      const nextColCount = Math.max(1, (t.colCount || 1) - 1);
      const newCells: Record<string, string | number | boolean> = {};
      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }
        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }
        if (parsed.colIndex === targetCol) {
          continue;
        } else if (parsed.colIndex > targetCol) {
          const shiftedColLetter = colToLetter(parsed.colIndex - 1);
          newCells[`${shiftedColLetter}${parsed.rowIndex}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers] : [];
      headers.splice(targetCol - 1, 1);
      for (let c = 1; c <= nextColCount; c++) {
        colLetters.push(colToLetter(c));
      }

      return {
        ...t,
        colCount: nextColCount,
        maxCol: colToLetter(nextColCount),
        colLetters,
        headers,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Updates a column header label for the active tab.
 */
export function updateTabHeader(
  sheet: AttachedSpreadsheet,
  colIndex: number,
  title: string
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const headers = [...(t.headers || [])];
      while (headers.length < colIndex) {
        headers.push(`Column ${colToLetter(headers.length + 1)}`);
      }
      headers[colIndex - 1] = title.trim();
      return { ...t, headers };
    }
    return t;
  });

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    headers: activeTab.headers,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Duplicates a tab with all its cells and headers.
 */
export function duplicateTab(
  sheet: AttachedSpreadsheet,
  tabId: string
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const tabToClone = (withTabs.tabs || []).find((t) => t.id === tabId);
  if (!tabToClone) return sheet;

  const newTab: SpreadsheetTab = {
    ...tabToClone,
    id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: `${tabToClone.name} (Copy)`,
    cells: { ...tabToClone.cells }
  };

  const newTabs = [...(withTabs.tabs || []), newTab];
  return {
    ...withTabs,
    tabs: newTabs,
    activeTabId: newTab.id,
    sheetName: newTab.name,
    cells: newTab.cells,
    rowCount: newTab.rowCount,
    colCount: newTab.colCount,
    maxCol: newTab.maxCol,
    colLetters: newTab.colLetters,
    headers: newTab.headers,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Pastes clipboard text (TSV/CSV) into the spreadsheet grid starting from startCellRef.
 * Automatically expands rows and columns if pasted content extends beyond boundaries.
 */
export function pasteDataIntoGrid(
  sheet: AttachedSpreadsheet,
  startCellRef: string,
  rawText: string
): { spreadsheet: AttachedSpreadsheet; cellsUpdated: number } {
  const parsed = parseCellRef(startCellRef);
  if (!parsed || !rawText) return { spreadsheet: sheet, cellsUpdated: 0 };

  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
  const currentTab = (withTabs.tabs || []).find((t) => t.id === activeId) || withTabs.tabs?.[0];
  if (!currentTab) return { spreadsheet: sheet, cellsUpdated: 0 };

  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { spreadsheet: sheet, cellsUpdated: 0 };

  let maxRowNeeded = currentTab.rowCount || 1;
  let maxColNeeded = currentTab.colCount || 1;
  const nextCells = { ...(currentTab.cells || {}) };
  let cellsUpdated = 0;

  for (let rIdx = 0; rIdx < lines.length; rIdx++) {
    const rowNum = parsed.rowIndex + rIdx;
    if (rowNum > maxRowNeeded) maxRowNeeded = rowNum;

    // Split on tab first, otherwise comma if no tabs
    const cellsInRow = lines[rIdx].includes('\t')
      ? lines[rIdx].split('\t')
      : lines[rIdx].split(',');

    for (let cIdx = 0; cIdx < cellsInRow.length; cIdx++) {
      const colNum = parsed.colIndex + cIdx;
      if (colNum > maxColNeeded) maxColNeeded = colNum;

      const colLetter = colToLetter(colNum);
      const targetRef = `${colLetter}${rowNum}`;

      let val: string | number | boolean = cellsInRow[cIdx].trim();
      // Remove enclosing quotes if CSV
      if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      // Check if numeric
      const cleanNum = String(val).replace(/,/g, '');
      if (cleanNum !== '' && !isNaN(Number(cleanNum))) {
        val = Number(cleanNum);
      }

      nextCells[targetRef] = val;
      cellsUpdated++;
    }
  }

  // Update tabs
  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers] : [];
      for (let c = 1; c <= maxColNeeded; c++) {
        const letter = colToLetter(c);
        colLetters.push(letter);
        if (!headers[c - 1]) headers[c - 1] = `Column ${letter}`;
      }
      return {
        ...t,
        rowCount: maxRowNeeded,
        colCount: maxColNeeded,
        maxCol: colToLetter(maxColNeeded),
        colLetters,
        headers,
        cells: nextCells
      };
    }
    return t;
  });

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  const nextSheet: AttachedSpreadsheet = {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };

  return { spreadsheet: nextSheet, cellsUpdated };
}

/**
 * Shifts cells in targetRow at and to the right of targetCol to the right by 1 column.
 * The cell at (targetCol, targetRow) becomes empty.
 */
export function shiftCellsRight(
  sheet: AttachedSpreadsheet,
  targetCol: number,
  targetRow: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'shift_right', targetCol, targetRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      let maxColUsed = t.colCount || 10;
      const newCells: Record<string, string | number | boolean> = {};

      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }

        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }

        if (parsed.rowIndex === targetRow && parsed.colIndex >= targetCol) {
          const nextCol = parsed.colIndex + 1;
          if (nextCol > maxColUsed) maxColUsed = nextCol;
          newCells[`${colToLetter(nextCol)}${parsed.rowIndex}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      const nextColCount = Math.max(t.colCount || 10, maxColUsed);
      const colLetters: string[] = [];
      const headers = t.headers ? [...t.headers] : [];
      while (headers.length < nextColCount) {
        headers.push(`Column ${colToLetter(headers.length + 1)}`);
      }
      for (let c = 1; c <= nextColCount; c++) {
        colLetters.push(colToLetter(c));
      }

      return {
        ...t,
        colCount: nextColCount,
        maxCol: colToLetter(nextColCount),
        colLetters,
        headers,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Shifts cells in targetCol at and below targetRow down by 1 row.
 * The cell at (targetCol, targetRow) becomes empty.
 */
export function shiftCellsDown(
  sheet: AttachedSpreadsheet,
  targetCol: number,
  targetRow: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'shift_down', targetCol, targetRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      let maxRowUsed = t.rowCount || 30;
      const newCells: Record<string, string | number | boolean> = {};

      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }

        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }

        if (parsed.colIndex === targetCol && parsed.rowIndex >= targetRow) {
          const nextRow = parsed.rowIndex + 1;
          if (nextRow > maxRowUsed) maxRowUsed = nextRow;
          newCells[`${parsed.colLetter}${nextRow}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      const nextRowCount = Math.max(t.rowCount || 30, maxRowUsed);
      return {
        ...t,
        rowCount: nextRowCount,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Shifts cells in targetRow to the left starting after targetCol.
 */
export function shiftCellsLeft(
  sheet: AttachedSpreadsheet,
  targetCol: number,
  targetRow: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'shift_left', targetCol, targetRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const newCells: Record<string, string | number | boolean> = {};

      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }

        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }

        if (parsed.rowIndex === targetRow && parsed.colIndex === targetCol) {
          continue;
        } else if (parsed.rowIndex === targetRow && parsed.colIndex > targetCol) {
          newCells[`${colToLetter(parsed.colIndex - 1)}${parsed.rowIndex}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      return {
        ...t,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Shifts cells in targetCol up starting after targetRow.
 */
export function shiftCellsUp(
  sheet: AttachedSpreadsheet,
  targetCol: number,
  targetRow: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId || withTabs.tabs?.[0]?.id;
  const op: CellShiftOperation = { type: 'shift_up', targetCol, targetRow };

  const updatedTabs = (withTabs.tabs || []).map((t) => {
    if (t.id === activeId) {
      const newCells: Record<string, string | number | boolean> = {};

      for (const [cellRef, val] of Object.entries(t.cells || {})) {
        const parsed = parseCellRef(cellRef);
        if (!parsed) {
          newCells[cellRef] = val;
          continue;
        }

        let cellVal = val;
        if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
          cellVal = shiftFormulaInString(cellVal, op, t.name);
        }

        if (parsed.colIndex === targetCol && parsed.rowIndex === targetRow) {
          continue;
        } else if (parsed.colIndex === targetCol && parsed.rowIndex > targetRow) {
          newCells[`${parsed.colLetter}${parsed.rowIndex - 1}`] = cellVal;
        } else {
          newCells[cellRef] = cellVal;
        }
      }

      return {
        ...t,
        cells: newCells
      };
    }
    return t;
  });

  return syncActiveTabToTopLevel(withTabs, updatedTabs, activeId);
}

/**
 * Adjusts cell references inside a formula string by a column and row offset (e.g. for copy/paste or fill handle),
 * respecting $ absolute anchors:
 * - Columns preceded by $ are locked (deltaCol ignored).
 * - Rows preceded by $ are locked (deltaRow ignored).
 */
export function adjustFormulaForOffset(
  formulaStr: string,
  deltaCol: number,
  deltaRow: number
): string {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
    return formulaStr;
  }

  return formulaStr.replace(
    /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,5})/g,
    (_match, qTab, uTab, colAbs, colLetters, rowAbs, rowDigits) => {
      const tab = qTab || uTab;
      const col = letterToCol(colLetters);
      const row = parseInt(rowDigits, 10);
      const isColAbsolute = Boolean(colAbs);
      const isRowAbsolute = Boolean(rowAbs);

      const finalCol = isColAbsolute ? col : Math.max(1, col + deltaCol);
      const finalRow = isRowAbsolute ? row : Math.max(1, row + deltaRow);

      const colPrefix = isColAbsolute ? '$' : '';
      const rowPrefix = isRowAbsolute ? '$' : '';
      const shifted = `${colPrefix}${colToLetter(finalCol)}${rowPrefix}${finalRow}`;

      if (tab) {
        const formattedTab = qTab ? `'${tab}'` : tab;
        return `${formattedTab}!${shifted}`;
      }
      return shifted;
    }
  );
}

/**
 * Copies a source cell value to a target cell reference, adjusting any relative formulas by the offset
 * between source and target coordinates while keeping $ absolute anchors fixed.
 */
export function copyCellWithSmartOffset(
  sourceRef: string,
  targetRef: string,
  sourceValue: any
): any {
  if (typeof sourceValue !== 'string' || !sourceValue.startsWith('=')) {
    return sourceValue;
  }
  const sourceParsed = parseCellRef(sourceRef);
  const targetParsed = parseCellRef(targetRef);
  if (!sourceParsed || !targetParsed) {
    return sourceValue;
  }
  const deltaCol = targetParsed.colIndex - sourceParsed.colIndex;
  const deltaRow = targetParsed.rowIndex - sourceParsed.rowIndex;
  return adjustFormulaForOffset(sourceValue, deltaCol, deltaRow);
}

export interface FormulaCellReference {
  raw: string;
  cleanRef: string;
  sheetName?: string;
  color: string;
  ringClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  index: number;
}

export const FORMULA_REF_COLORS = [
  {
    color: '#2563eb', // blue
    ringClass: 'ring-2 ring-blue-500',
    bgClass: 'bg-blue-500/15 dark:bg-blue-500/25',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-500',
  },
  {
    color: '#9333ea', // purple
    ringClass: 'ring-2 ring-purple-500',
    bgClass: 'bg-purple-500/15 dark:bg-purple-500/25',
    textClass: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-500',
  },
  {
    color: '#d97706', // amber
    ringClass: 'ring-2 ring-amber-500',
    bgClass: 'bg-amber-500/15 dark:bg-amber-500/25',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-500',
  },
  {
    color: '#059669', // emerald
    ringClass: 'ring-2 ring-emerald-500',
    bgClass: 'bg-emerald-500/15 dark:bg-emerald-500/25',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500',
  },
  {
    color: '#e11d48', // rose
    ringClass: 'ring-2 ring-rose-500',
    bgClass: 'bg-rose-500/15 dark:bg-rose-500/25',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-500',
  },
  {
    color: '#0891b2', // cyan
    ringClass: 'ring-2 ring-cyan-500',
    bgClass: 'bg-cyan-500/15 dark:bg-cyan-500/25',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-500',
  },
];

/**
 * Cycles an individual cell reference through the 4 Excel reference states:
 *   A1 -> $A$1 -> A$1 -> $A1 -> A1
 * Preserves sheet prefix (e.g. 'Sheet1'!A1 -> 'Sheet1'!$A$1).
 */
export function cycleSingleCellRef(cell: string): string {
  const m = cell.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,5})$/);
  if (!m) return cell;
  const qSheet = m[1];
  const uSheet = m[2];
  const sheet = qSheet ? `'${qSheet}'!` : uSheet ? `${uSheet}!` : '';
  const colAbs = m[3] === '$';
  const col = m[4].toUpperCase();
  const rowAbs = m[5] === '$';
  const row = m[6];

  let nextColAbs: boolean;
  let nextRowAbs: boolean;
  if (!colAbs && !rowAbs) {
    // A1 -> $A$1
    nextColAbs = true;
    nextRowAbs = true;
  } else if (colAbs && rowAbs) {
    // $A$1 -> A$1
    nextColAbs = false;
    nextRowAbs = true;
  } else if (!colAbs && rowAbs) {
    // A$1 -> $A1
    nextColAbs = true;
    nextRowAbs = false;
  } else {
    // $A1 -> A1
    nextColAbs = false;
    nextRowAbs = false;
  }

  return `${sheet}${nextColAbs ? '$' : ''}${col}${nextRowAbs ? '$' : ''}${row}`;
}

/**
 * Excel F4 key cycling for formulas:
 * Cycles the cell reference at or near cursorPos (or the last cell ref in formula).
 */
export function cycleCellRefAbsolute(
  formula: string,
  cursorPos?: number
): { newFormula: string; newCursorPos: number } {
  if (!formula || typeof formula !== 'string') {
    return { newFormula: formula, newCursorPos: cursorPos ?? 0 };
  }

  const regex = /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?\$?[A-Za-z]{1,3}\$?[0-9]{1,5}/g;
  const matches: { text: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(formula)) !== null) {
    matches.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  if (matches.length === 0) {
    return { newFormula: formula, newCursorPos: cursorPos ?? formula.length };
  }

  let target = matches[matches.length - 1];
  if (cursorPos !== undefined && cursorPos !== null) {
    const found = matches.find((item) => cursorPos >= item.start && cursorPos <= item.end);
    if (found) {
      target = found;
    } else {
      const preceding = matches.filter((item) => item.end <= cursorPos);
      if (preceding.length > 0) {
        target = preceding[preceding.length - 1];
      }
    }
  }

  const cycled = cycleSingleCellRef(target.text);
  const before = formula.slice(0, target.start);
  const after = formula.slice(target.end);
  const newFormula = before + cycled + after;
  const delta = cycled.length - target.text.length;
  const newCursorPos = cursorPos !== undefined ? Math.max(0, cursorPos + delta) : newFormula.length;

  return { newFormula, newCursorPos };
}

/**
 * Handles clicking a cell while formula editing is active.
 * - If last token before cursor is an operator or delimiter (=, +, -, *, /, (, ,, :), appends cell coordinate.
 * - If last token before cursor is ALREADY a cell reference, replaces it with the newly clicked coordinate (standard Excel behavior).
 */
export function insertOrReplaceCellInFormula(
  currentFormula: string,
  clickedRef: string,
  clickedTabName?: string,
  activeTabName?: string,
  cursorPos?: number
): { newFormula: string; newCursorPos: number } {
  let fullRef = clickedRef;
  if (clickedTabName && activeTabName && clickedTabName !== activeTabName) {
    fullRef = `'${clickedTabName}'!${clickedRef}`;
  }

  if (!currentFormula || !currentFormula.startsWith('=')) {
    return { newFormula: `=${fullRef}`, newCursorPos: fullRef.length + 1 };
  }

  const pos = cursorPos !== undefined && cursorPos !== null ? cursorPos : currentFormula.length;
  const textBefore = currentFormula.slice(0, pos);
  const textAfter = currentFormula.slice(pos);

  // If textBefore ends with a cell reference (e.g. user previously clicked A1, now clicks B1 without an operator)
  const cellRefEndMatch = textBefore.match(
    /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?\$?[A-Za-z]{1,3}\$?[0-9]{1,5}$/
  );

  if (cellRefEndMatch) {
    const replaceStart = textBefore.length - cellRefEndMatch[0].length;
    const newFormula = currentFormula.slice(0, replaceStart) + fullRef + textAfter;
    const newCursorPos = replaceStart + fullRef.length;
    return { newFormula, newCursorPos };
  }

  // Otherwise, append fullRef directly at cursor
  const newFormula = textBefore + fullRef + textAfter;
  const newCursorPos = textBefore.length + fullRef.length;
  return { newFormula, newCursorPos };
}

/**
 * Extracts and maps all cell references in a formula to visual color styles for grid highlights.
 */
export function extractCellReferencesFromFormula(formula: string): FormulaCellReference[] {
  if (!formula || typeof formula !== 'string' || !formula.startsWith('=')) {
    return [];
  }

  const regex = /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?\$?([A-Za-z]{1,3})\$?([0-9]{1,5})/g;
  const refs: FormulaCellReference[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = regex.exec(formula)) !== null) {
    const raw = m[0];
    const sheetName = m[1] || m[2];
    const cleanRef = `${m[3].toUpperCase()}${m[4]}`;
    const dedupeKey = sheetName ? `${sheetName}!${cleanRef}` : cleanRef;

    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      const colorStyle = FORMULA_REF_COLORS[idx % FORMULA_REF_COLORS.length];
      refs.push({
        raw,
        cleanRef,
        sheetName,
        ...colorStyle,
        index: idx++,
      });
    }
  }

  return refs;
}

