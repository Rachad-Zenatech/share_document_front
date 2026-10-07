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
export const CELL_VARIABLE_REGEX = /@(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3}\d{1,4})(?:\{([^}]*)\})?/g;

/**
 * Check if a string contains any spreadsheet variable reference.
 */
export function hasDocumentVariables(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /@(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+)!)?[A-Za-z]{1,3}\d{1,4}/i.test(text);
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

/**
 * Formats a cell value into a human-readable display string.
 */
export function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '0';
    if (Number.isInteger(val)) {
      return val.toLocaleString('en-US');
    }
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
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
 * Resolves a cell reference like 'A1' or 'Sheet1!B8' or ''06.30.26 TB'!C12'
 * from an attached spreadsheet.
 */
export function getCellValue(
  cellRef: string,
  spreadsheet?: AttachedSpreadsheet | null,
  specifiedTabName?: string
): any {
  if (!spreadsheet) return undefined;

  let targetTabName = specifiedTabName;
  let targetCell = cellRef.trim();

  // If cellRef itself contains sheet prefix: 'Sheet'!Cell or Sheet!Cell
  const match = targetCell.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3}\d{1,4})$/i);
  if (match) {
    if (match[1] || match[2]) {
      targetTabName = match[1] || match[2];
    }
    targetCell = match[3];
  }

  const upperCell = targetCell.toUpperCase();

  // 1. If tabName specified, find that tab
  if (targetTabName && spreadsheet.tabs && spreadsheet.tabs.length > 0) {
    const cleanTarget = targetTabName.trim().toLowerCase();
    const foundTab = spreadsheet.tabs.find(
      (t) => t.name.trim().toLowerCase() === cleanTarget || t.id.toLowerCase() === cleanTarget
    );
    if (foundTab && foundTab.cells && foundTab.cells[upperCell] !== undefined) {
      return foundTab.cells[upperCell];
    }
  }

  // 2. Search active tab if tabs exist
  if (spreadsheet.tabs && spreadsheet.tabs.length > 0) {
    const activeTab =
      spreadsheet.tabs.find((t) => t.id === spreadsheet.activeTabId) || spreadsheet.tabs[0];
    if (activeTab && activeTab.cells && activeTab.cells[upperCell] !== undefined) {
      return activeTab.cells[upperCell];
    }
  }

  // 3. Fallback to top-level cells object
  if (spreadsheet.cells && spreadsheet.cells[upperCell] !== undefined) {
    return spreadsheet.cells[upperCell];
  }

  return undefined;
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

  return text.replace(CELL_VARIABLE_REGEX, (match, qTab, uTab, cellRef) => {
    const tabName = qTab || uTab;
    const upperRef = cellRef.toUpperCase();
    const liveVal = getCellValue(upperRef, spreadsheet, tabName);
    const prefix = tabName ? (qTab ? `@'${tabName}'!` : `@${tabName}!`) : '@';
    if (liveVal !== undefined && liveVal !== null) {
      return `${prefix}${upperRef}{${formatCellValue(liveVal)}}`;
    }
    return match;
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

  const initialTab: SpreadsheetTab = {
    id: `tab-main-${Date.now()}`,
    name: sheet.sheetName || 'Sheet1',
    rowCount: sheet.rowCount || 30,
    colCount: sheet.colCount || 10,
    maxCol: sheet.maxCol || 'J',
    colLetters: sheet.colLetters,
    headers: sheet.headers,
    cells: { ...(sheet.cells || {}) }
  };

  return {
    ...sheet,
    tabs: [initialTab],
    activeTabId: initialTab.id
  };
}

/**
 * Switches the active tab and synchronizes the active tab's metadata into top-level properties.
 */
export function switchActiveTab(sheet: AttachedSpreadsheet, tabId: string): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const targetTab = withTabs.tabs?.find((t) => t.id === tabId) || withTabs.tabs?.[0];
  if (!targetTab) return sheet;

  return {
    ...withTabs,
    activeTabId: targetTab.id,
    sheetName: targetTab.name,
    rowCount: targetTab.rowCount,
    colCount: targetTab.colCount,
    maxCol: targetTab.maxCol,
    colLetters: targetTab.colLetters,
    headers: targetTab.headers,
    cells: targetTab.cells,
    updatedAt: new Date().toISOString()
  };
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    updatedAt: new Date().toISOString()
  };
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    updatedAt: new Date().toISOString()
  };
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    updatedAt: new Date().toISOString()
  };
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    updatedAt: new Date().toISOString()
  };
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];

  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    updatedAt: new Date().toISOString()
  };
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
 * Parses a cell reference like "A1" or "AW272" into column letters, 1-based column index, and 1-based row index.
 */
export function parseCellRef(ref: string): { colLetter: string; colIndex: number; rowIndex: number } | null {
  const match = (ref || '').trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colLetter = match[1];
  const rowIndex = parseInt(match[2], 10);
  const colIndex = letterToCol(colLetter);
  return { colLetter, colIndex, rowIndex };
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
 * Returns the shifted cell ref (e.g. "B9") or "#REF!" if the cell was deleted.
 */
export function shiftSingleCellRef(
  colIndex: number,
  rowIndex: number,
  op: CellShiftOperation
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

  return `${colToLetter(newCol)}${newRow}`;
}

/**
 * Shifts any cell references inside a formula string (e.g. "=B8*1.1" -> "=B9*1.1").
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
    /(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3})(\d{1,4})/g,
    (match, qTab, uTab, colLetters, rowDigits) => {
      const tab = qTab || uTab;
      if (tab && targetTabName) {
        if (tab.trim().toLowerCase() !== targetTabName.trim().toLowerCase()) {
          return match;
        }
      }
      const col = letterToCol(colLetters);
      const row = parseInt(rowDigits, 10);
      const shifted = shiftSingleCellRef(col, row, op);
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
  targetTabName?: string
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

      const shifted = shiftSingleCellRef(parsed.colIndex, parsed.rowIndex, op);

      if (shifted === '#REF!') {
        shiftedCount++;
        const tabPrefix = tab ? (qTab ? `'${tab}'!` : `${tab}!`) : '';
        return `@${tabPrefix}#REF!{#REF!}`;
      }

      if (shifted !== cellRef.toUpperCase()) {
        shiftedCount++;
        const tabPrefix = tab ? (qTab ? `'${tab}'!` : `${tab}!`) : '';
        const fallbackPart = fallback !== undefined && fallback !== '' ? `{${fallback}}` : '';
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Deletes a column at the specified 1-based column index in the active tab.
 */
export function deleteColAtIndex(
  sheet: AttachedSpreadsheet,
  targetCol: number
): AttachedSpreadsheet {
  const withTabs = ensureSpreadsheetTabs(sheet);
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    colCount: activeTab.colCount,
    maxCol: activeTab.maxCol,
    colLetters: activeTab.colLetters,
    headers: activeTab.headers,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    rowCount: activeTab.rowCount,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
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
  const activeId = withTabs.activeTabId;
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

  const activeTab = updatedTabs.find((t) => t.id === activeId) || updatedTabs[0];
  return {
    ...withTabs,
    tabs: updatedTabs,
    cells: activeTab.cells,
    updatedAt: new Date().toISOString()
  };
}

