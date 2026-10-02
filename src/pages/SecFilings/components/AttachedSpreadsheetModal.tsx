import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  FileSpreadsheet,
  Search,
  Upload,
  Download,
  Copy,
  Check,
  Save,
  Link2,
  Plus,
  Minus,
  Sparkles,
  Info,
  ArrowRight,
  Trash2,
  Maximize2,
  FilePlus,
  RefreshCw,
  Edit2,
  CopyPlus,
  Columns,
  Rows,
  CornerDownLeft,
  X
} from 'lucide-react';
import type { AttachedSpreadsheet, SecBlock } from '../../../types/secFiling';
import {
  colToLetter,
  parseCellRef,
  formatCellValue,
  CELL_VARIABLE_REGEX,
  parseExcelFileToSpreadsheet,
  exportSpreadsheetToExcel,
  createBlankSpreadsheet,
  addRowsToSpreadsheet,
  removeRowsFromSpreadsheet,
  addColumnsToSpreadsheet,
  removeColumnsFromSpreadsheet,
  resizeSpreadsheetGrid,
  ensureSpreadsheetTabs,
  switchActiveTab,
  addTabToSpreadsheet,
  removeTabFromSpreadsheet,
  renameTabInSpreadsheet,
  updateActiveTabCells,
  createCellVariableToken,
  insertRowAtIndex,
  deleteRowAtIndex,
  insertColAtIndex,
  deleteColAtIndex,
  updateTabHeader,
  duplicateTab,
  pasteDataIntoGrid,
  shiftCellsRight,
  shiftCellsDown,
  shiftCellsLeft,
  shiftCellsUp,
  type CellShiftOperation,
  shiftBlocksCellReferences
} from '../../../utils/documentVariables';
import { DEFAULT_TRIAL_BALANCE_SHEET } from '../../../data/defaultTrialBalanceSheet';
import { toast } from 'sonner';

export interface AttachedSpreadsheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spreadsheet?: AttachedSpreadsheet | null;
  onUpdateSpreadsheet: (sheet: AttachedSpreadsheet, shiftedBlocks?: SecBlock[]) => void;
  onUpdateCell: (cellRef: string, newValue: any) => number;
  blocks: SecBlock[];
  onSelectBlock?: (blockId: string) => void;
  mode?: 'manage' | 'picker';
  onInsertVariable?: (cellRef: string, displayVal: string) => void;
  targetBlockTitle?: string;
}

export const AttachedSpreadsheetModal: React.FC<AttachedSpreadsheetModalProps> = ({
  open,
  onOpenChange,
  spreadsheet: rawSpreadsheet,
  onUpdateSpreadsheet,
  onUpdateCell,
  blocks,
  onSelectBlock,
  mode = 'manage',
  onInsertVariable,
  targetBlockTitle,
}) => {
  const isPickerMode = mode === 'picker';
  const [activeTab, setActiveTab] = useState<'grid' | 'variables'>('grid');

  // Multi-Tab state resolution
  const spreadsheet = useMemo(() => ensureSpreadsheetTabs(rawSpreadsheet), [rawSpreadsheet]);
  const safeSheet = spreadsheet;
  const tabs = safeSheet.tabs || [];
  const currentTab = tabs.find((t) => t.id === safeSheet.activeTabId) || tabs[0];
  const activeTabId = currentTab?.id;
  const isMultiTab = tabs.length > 1;

  const currentCells = useMemo(() => currentTab?.cells || {}, [currentTab?.cells]);
  const currentHeaders = currentTab?.headers || [];

  const [selectedCellRef, setSelectedCellRef] = useState<string>('A1');
  const [editingValue, setEditingValue] = useState<string>('');
  const [searchableText, setSearchableText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isCopiedTag, setIsCopiedTag] = useState<boolean>(false);

  // In-cell direct editing state
  const [inlineEditingCellRef, setInlineEditingCellRef] = useState<string | null>(null);
  const [inlineEditingValue, setInlineEditingValue] = useState<string>('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Column header editing state
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editingColHeader, setEditingColHeader] = useState<string>('');

  // Workbook filename editing state
  const [isEditingWorkbookName, setIsEditingWorkbookName] = useState<boolean>(false);
  const [editingWorkbookName, setEditingWorkbookName] = useState<string>('');

  const parsedSelected = useMemo(() => parseCellRef(selectedCellRef), [selectedCellRef]);
  const selectedRow = parsedSelected?.rowIndex || 1;
  const selectedCol = parsedSelected?.colIndex || 1;
  const selectedColLetter = parsedSelected?.colLetter || 'A';

  // Tab renaming inline state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>('');

  // Virtualized continuous 2D scrolling ("only load what is showing in viewport")
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(600);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const [jumpRowInput, setJumpRowInput] = useState<string>('');
  const rafIdRef = useRef<number | null>(null);

  // Right-click Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    cellRef: string;
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // Excel Style Insert Dialog state (Shift cells right / down / Entire row / Entire col)
  const [isInsertDialogOpen, setIsInsertDialogOpen] = useState<boolean>(false);
  const [insertOption, setInsertOption] = useState<'shift_right' | 'shift_down' | 'entire_row' | 'entire_col'>('entire_row');

  // Excel Style Delete Dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [deleteOption, setDeleteOption] = useState<'shift_left' | 'shift_up' | 'entire_row' | 'entire_col'>('entire_row');

  const ROW_HEIGHT = 28; // Exact row height in pixels (h-7 = 1.75rem = 28px)
  const COL_WIDTH = 128; // Standard column width in pixels (w-32 = 8rem = 128px)
  const ROW_OVERSCAN = 6; // Extra buffer rows above and below viewport
  const COL_OVERSCAN = 3; // Extra buffer columns left and right of viewport

  const totalRows = Math.max(1, currentTab?.rowCount || 20);
  const totalCols = Math.max(1, currentTab?.colCount || 10);

  // Throttled scroll handler using requestAnimationFrame to prevent layout thrashing
  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setScrollTop(top);
      setScrollLeft(left);
      rafIdRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Update searchable text for browser find (Ctrl+F)
  useEffect(() => {
    const lines = Object.entries(currentCells).map(([ref, val]) => {
      const formatted = formatCellValue(val);
      return `${ref}: ${formatted}`;
    });
    setSearchableText(lines.join('\n'));
  }, [currentCells]);

  // Dismiss context menu on any click outside.
  // We defer registering the listener by one tick so the right-click event
  // that opened the menu doesn't immediately close it.
  useEffect(() => {
    if (!contextMenu?.open) return;
    let timerId: ReturnType<typeof setTimeout>;
    const handleCloseContextMenu = () => setContextMenu(null);
    timerId = setTimeout(() => {
      window.addEventListener('click', handleCloseContextMenu);
      window.addEventListener('contextmenu', handleCloseContextMenu);
    }, 0);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('click', handleCloseContextMenu);
      window.removeEventListener('contextmenu', handleCloseContextMenu);
    };
  }, [contextMenu?.open]);

  // Excel-style Keyboard Shortcuts: Ctrl+Shift+= (Insert), Ctrl+- (Delete), Ctrl+Z (Undo), Ctrl+Y (Redo)
  // We use refs to avoid referencing handleUndo/handleRedo before they are declared.
  const undoHandlerRef = useRef<(() => void) | null>(null);
  const redoHandlerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handleSpreadsheetShortcuts = (e: KeyboardEvent) => {
      if (inlineEditingCellRef || editingColIdx !== null) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoHandlerRef.current?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoHandlerRef.current?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setInsertOption('entire_row');
        setIsInsertDialogOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setDeleteOption('entire_row');
        setIsDeleteDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleSpreadsheetShortcuts);
    return () => window.removeEventListener('keydown', handleSpreadsheetShortcuts);
  }, [inlineEditingCellRef, editingColIdx]);

  // Measure container height and width dynamically on resize
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, activeTab]);

  // Jump smoothly to a specific row
  const scrollToRow = (rowNumber: number) => {
    if (!scrollContainerRef.current) return;
    const clampedRow = Math.max(1, Math.min(totalRows, rowNumber));
    const targetY = Math.max(0, (clampedRow - 1) * ROW_HEIGHT);
    scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // ---------- Version History (Undo / Redo) ----------
  // Each entry is a snapshot of the full spreadsheet at that point in time.
  const MAX_HISTORY = 50;
  const undoStack = useRef<AttachedSpreadsheet[]>([]);
  const redoStack = useRef<AttachedSpreadsheet[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Push the current spreadsheet onto the undo stack before applying a change. */
  const pushHistory = useCallback((before: AttachedSpreadsheet) => {
    undoStack.current = [before, ...undoStack.current].slice(0, MAX_HISTORY);
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current[0];
    redoStack.current = [spreadsheet, ...redoStack.current].slice(0, MAX_HISTORY);
    undoStack.current = undoStack.current.slice(1);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    onUpdateSpreadsheet(prev, blocks);
    toast.info('Undo');
  }, [spreadsheet, blocks, onUpdateSpreadsheet]);

  const handleRedo = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current[0];
    undoStack.current = [spreadsheet, ...undoStack.current].slice(0, MAX_HISTORY);
    redoStack.current = redoStack.current.slice(1);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    onUpdateSpreadsheet(next, blocks);
    toast.info('Redo');
  }, [spreadsheet, blocks, onUpdateSpreadsheet]);

  // Wire refs so the keyboard shortcut handler (defined above) can call them
  undoHandlerRef.current = handleUndo;
  redoHandlerRef.current = handleRedo;


  // Dialog states for dynamic sheet creation and resizing
  const [isCreateNewOpen, setIsCreateNewOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState('Operating Metrics');
  const [newSheetTab, setNewSheetTab] = useState('Sheet1');
  const [newSheetRows, setNewSheetRows] = useState('30');
  const [newSheetCols, setNewSheetCols] = useState('10');

  const [isResizeOpen, setIsResizeOpen] = useState(false);
  const [resizeRows, setResizeRows] = useState(String(totalRows));
  const [resizeCols, setResizeCols] = useState(String(totalCols));

  // 1. Scan document for referenced variable tokens (only changes when blocks change)
  const usedVariableTokens = useMemo(() => {
    const map = new Map<
      string,
      {
        cellRef: string;
        tabName?: string;
        fullRef: string;
        usages: { blockId: string; blockType: string; section: string; snippet: string }[];
      }
    >();

    const checkText = (text: string, b: SecBlock) => {
      if (!text || typeof text !== 'string') return;
      const regex = new RegExp(CELL_VARIABLE_REGEX);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const tab = match[1] || match[2];
        const cell = match[3].toUpperCase();
        const fullKey = tab ? `${tab}!${cell}` : cell;

        if (!map.has(fullKey)) {
          map.set(fullKey, {
            cellRef: cell,
            tabName: tab,
            fullRef: fullKey,
            usages: [],
          });
        }
        const snippet = text.length > 80 ? text.slice(0, 80) + '...' : text;
        map.get(fullKey)!.usages.push({
          blockId: b.id,
          blockType: b.type,
          section: b.section || 'General',
          snippet,
        });
      }
    };

    blocks.forEach((b) => {
      if (b.type === 'paragraph' || b.type === 'heading') {
        checkText(b.text, b);
      } else if (b.type === 'callout') {
        checkText(b.content, b);
        if (b.title) checkText(b.title, b);
      } else if (b.type === 'financial_table' && Array.isArray(b.rows)) {
        b.rows.forEach((r) => {
          if (Array.isArray(r.cells)) {
            r.cells.forEach((c) => checkText(c, b));
          }
        });
      }
    });

    return Array.from(map.values());
  }, [blocks]);

  // Set of cell references used in document (fast lookup for green triangle corner)
  const usedCellSet = useMemo(() => {
    return new Set(usedVariableTokens.map((v) => v.cellRef));
  }, [usedVariableTokens]);

  // Full used variables with live values for the Variables tab
  const usedVariables = useMemo(() => {
    return usedVariableTokens
      .map((token) => {
        let cellVal: any;
        if (token.tabName && safeSheet.tabs) {
          const cleanT = token.tabName.trim().toLowerCase();
          const foundTab = safeSheet.tabs.find((t) => t.name.trim().toLowerCase() === cleanT);
          cellVal = foundTab?.cells?.[token.cellRef];
        } else {
          cellVal = currentCells[token.cellRef] ?? safeSheet.cells?.[token.cellRef];
        }
        return {
          ...token,
          currentVal: cellVal,
        };
      })
      .sort((a, b) => a.fullRef.localeCompare(b.fullRef, undefined, { numeric: true }));
  }, [usedVariableTokens, safeSheet.tabs, safeSheet.cells, currentCells]);

  // Tab Switching
  const handleSwitchTab = (tabId: string) => {
    const next = switchActiveTab(spreadsheet, tabId);
    onUpdateSpreadsheet(next);
    setSelectedCellRef('A1');
    scrollToRow(1);
    setScrollTop(0);
    const newTab = next.tabs?.find((t) => t.id === tabId);
    setEditingValue(newTab?.cells?.['A1'] !== undefined ? String(newTab.cells['A1']) : '');
  };

  const handleAddTab = () => {
    const next = addTabToSpreadsheet(spreadsheet, `Sheet${tabs.length + 1}`, 30, 10);
    onUpdateSpreadsheet(next);
    setSelectedCellRef('A1');
    setEditingValue('');
    scrollToRow(1);
    setScrollTop(0);
    toast.success(`Added new worksheet tab "${next.sheetName}"`);
  };

  const handleRemoveTab = (tabId: string, tabName: string) => {
    if (tabs.length <= 1) {
      toast.error('Cannot remove the only tab in the workbook');
      return;
    }
    if (confirm(`Delete worksheet tab "${tabName}" and its cells?`)) {
      const next = removeTabFromSpreadsheet(spreadsheet, tabId);
      onUpdateSpreadsheet(next);
      scrollToRow(1);
      setScrollTop(0);
      toast.info(`Deleted tab "${tabName}"`);
    }
  };

  const handleStartRenameTab = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditingTabName(currentName);
  };

  const handleFinishRenameTab = () => {
    if (editingTabId && editingTabName.trim()) {
      const next = renameTabInSpreadsheet(spreadsheet, editingTabId, editingTabName.trim());
      onUpdateSpreadsheet(next);
      toast.success(`Renamed tab to "${editingTabName.trim()}"`);
    }
    setEditingTabId(null);
  };

  // Cell selection
  const handleSelectCell = (ref: string) => {
    setSelectedCellRef(ref);
    const val = currentCells[ref];
    setEditingValue(val !== undefined && val !== null ? String(val) : '');
  };

  // Start in-cell inline editing (double click, Enter, F2, or character key)
  const handleStartInlineEdit = (ref: string) => {
    setSelectedCellRef(ref);
    const val = currentCells[ref];
    const strVal = val !== undefined && val !== null ? String(val) : '';
    setEditingValue(strVal);
    setInlineEditingValue(strVal);
    setInlineEditingCellRef(ref);
  };

  // Double click cell
  const handleCellDoubleClick = (ref: string) => {
    if (isPickerMode && onInsertVariable) {
      handleSelectCell(ref);
      const val = currentCells[ref];
      const token = createCellVariableToken(ref, formatCellValue(val), currentTab?.name, isMultiTab);
      onInsertVariable(token, formatCellValue(val));
      onOpenChange(false);
      toast.success(`Linked ${token} to document!`);
    } else {
      handleStartInlineEdit(ref);
    }
  };

  // Commit edited cell value and propagate to doc
  const commitCellValue = (
    ref: string,
    rawVal: string,
    advanceDirection: 'down' | 'right' | 'left' | 'none' = 'none'
  ) => {
    pushHistory(spreadsheet); // snapshot before cell edit
    const cleanVal = rawVal.trim();
    let parsed: any = cleanVal;
    if (cleanVal !== '' && !isNaN(Number(cleanVal))) {
      parsed = Number(cleanVal);
    }
    const cleanRef = ref.toUpperCase();
    const nextCells = { ...currentCells, [cleanRef]: parsed };
    const next = updateActiveTabCells(spreadsheet, nextCells);
    onUpdateSpreadsheet(next);

    const count = onUpdateCell(cleanRef, parsed);
    if (count > 0) {
      toast.success(`Updated ${count} linked document value${count > 1 ? 's' : ''}`);
    }

    // Advance selection if requested
    if (advanceDirection !== 'none') {
      const parsedRef = parseCellRef(cleanRef);
      if (parsedRef) {
        if (advanceDirection === 'down') {
          const nextRow = Math.min(totalRows, parsedRef.rowIndex + 1);
          const nextRef = `${parsedRef.colLetter}${nextRow}`;
          handleSelectCell(nextRef);
        } else if (advanceDirection === 'right') {
          const nextCol = Math.min(totalCols, parsedRef.colIndex + 1);
          const nextRef = `${colToLetter(nextCol)}${parsedRef.rowIndex}`;
          handleSelectCell(nextRef);
        } else if (advanceDirection === 'left') {
          const prevCol = Math.max(1, parsedRef.colIndex - 1);
          const nextRef = `${colToLetter(prevCol)}${parsedRef.rowIndex}`;
          handleSelectCell(nextRef);
        }
      }
    }
  };

  // Save edited cell value from Formula Bar
  const handleSaveCell = () => {
    commitCellValue(selectedCellRef, editingValue, 'none');
    toast.success(
      `Saved ${currentTab?.name}!${selectedCellRef} = ${editingValue}`
    );
  };

  // Clear value in selected cell
  const handleClearSelectedCell = () => {
    commitCellValue(selectedCellRef, '', 'none');
    setEditingValue('');
    toast.info(`Cleared cell ${selectedCellRef}`);
  };

  // Helper to apply spreadsheet changes and synchronize all linked document cell references
  const applySpreadsheetShift = (
    nextSpreadsheet: AttachedSpreadsheet,
    op: CellShiftOperation,
    successMessage: string
  ) => {
    pushHistory(spreadsheet); // snapshot before change
    const { updatedBlocks, shiftedCount } = shiftBlocksCellReferences(
      blocks,
      op,
      currentTab?.name
    );

    onUpdateSpreadsheet(nextSpreadsheet, updatedBlocks);

    if (shiftedCount > 0) {
      toast.success(
        `${successMessage} (Auto-updated ${shiftedCount} linked document reference${shiftedCount > 1 ? 's' : ''})`
      );
    } else {
      toast.success(successMessage);
    }
  };

  // -----------------------------------------------------------------------
  // Lightweight Formula Evaluator (=SUM, =AVERAGE, =MIN, =MAX, =COUNT,
  //   =IF, =ROUND, arithmetic, cell refs, ranges like A1:A5)
  // -----------------------------------------------------------------------
  const evaluateFormula = useCallback((formula: string): string | number => {
    if (!formula.startsWith('=')) return formula;
    const expr = formula.slice(1).trim();
    const cells = currentCells;

    // Resolve a single cell ref like A1 => its value
    const resolveCell = (ref: string): number => {
      const v = cells[ref.toUpperCase()];
      if (v === undefined || v === null || v === '') return 0;
      if (typeof v === 'number') return v;
      const n = Number(String(v).replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    // Expand a range like A1:B3 into individual ref values
    const expandRange = (rangeStr: string): number[] => {
      const m = rangeStr.match(/^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/i);
      if (!m) return [resolveCell(rangeStr)];
      const startCol = m[1].toUpperCase(); const startRow = parseInt(m[2]);
      const endCol   = m[3].toUpperCase(); const endRow   = parseInt(m[4]);
      const colToIdx = (c: string) => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
      const idxToCol = (n: number) => { let s = ''; while (n > 0) { s = String.fromCharCode(((n-1)%26)+65)+s; n=Math.floor((n-1)/26); } return s; };
      const sc = colToIdx(startCol); const ec = colToIdx(endCol);
      const vals: number[] = [];
      for (let r = startRow; r <= endRow; r++) for (let c = sc; c <= ec; c++) vals.push(resolveCell(`${idxToCol(c)}${r}`));
      return vals;
    };

    // Parse comma-separated args, respecting nested parens
    const splitArgs = (s: string): string[] => {
      const args: string[] = []; let depth = 0; let cur = '';
      for (const ch of s) {
        if (ch === '(' ) depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) args.push(cur.trim());
      return args;
    };

    // Recursively evaluate a sub-expression
    const evalExpr = (e: string): number | string => {
      e = e.trim();
      // String literal
      if ((e.startsWith('"') && e.endsWith('"')) || (e.startsWith("'") && e.endsWith("'"))) return e.slice(1,-1);
      // Number literal
      if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(e)) return parseFloat(e);
      // Cell reference
      if (/^[A-Z]+[0-9]+$/i.test(e)) return resolveCell(e);
      // Range (returns first value — use inside function args)
      if (/^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/i.test(e)) return expandRange(e)[0] ?? 0;
      // Function call
      const fnMatch = e.match(/^([A-Z]+)\((.*)\)$/i);
      if (fnMatch) {
        const fn = fnMatch[1].toUpperCase();
        const innerArgs = splitArgs(fnMatch[2]);
        const numArgs = innerArgs.flatMap(a => /^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/i.test(a.trim()) ? expandRange(a.trim()) : [Number(evalExpr(a))]);
        switch (fn) {
          case 'SUM':     return numArgs.reduce((s,v)=>s+v,0);
          case 'AVERAGE': return numArgs.length ? numArgs.reduce((s,v)=>s+v,0)/numArgs.length : 0;
          case 'MIN':     return Math.min(...numArgs);
          case 'MAX':     return Math.max(...numArgs);
          case 'COUNT':   return numArgs.filter(v=>!isNaN(v)).length;
          case 'COUNTA':  return innerArgs.flatMap(a => /^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/i.test(a.trim()) ? expandRange(a.trim()) : [evalExpr(a)]).filter(v => v !== '' && v !== 0).length;
          case 'ROUND':   return Math.round(Number(evalExpr(innerArgs[0])) * Math.pow(10, Number(evalExpr(innerArgs[1] ?? '0')))) / Math.pow(10, Number(evalExpr(innerArgs[1] ?? '0')));
          case 'ABS':     return Math.abs(Number(evalExpr(innerArgs[0])));
          case 'SQRT':    return Math.sqrt(Number(evalExpr(innerArgs[0])));
          case 'INT':     return Math.floor(Number(evalExpr(innerArgs[0])));
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
          case 'CONCATENATE': return innerArgs.map(a => String(evalExpr(a))).join('');
          default: return `#NAME?`;
        }
      }
      // Arithmetic: simple left-to-right with operator precedence via JS eval
      // Replace cell refs first
      const withRefs = e.replace(/([A-Z]+[0-9]+)/gi, (_, r) => String(resolveCell(r)));
      try {
        // Safe eval: only allow numbers, operators, parens, dots
        if (/^[0-9+\-*/().\s]+$/.test(withRefs)) {
          // eslint-disable-next-line no-new-func
          return Function(`"use strict"; return (${withRefs})`)() as number;
        }
      } catch { /**/ }
      return `#ERROR`;
    };

    try {
      const result = evalExpr(expr);
      if (typeof result === 'number') {
        if (!isFinite(result)) return '#DIV/0!';
        // Format: strip unnecessary decimal zeros
        return parseFloat(result.toFixed(10));
      }
      return String(result);
    } catch {
      return '#ERROR';
    }
  }, [currentCells]);

  // Resolve displayed value for a cell — evaluates formulas on the fly
  const resolveCellDisplay = useCallback((cellRef: string): { raw: string | number | undefined; display: string; isFormula: boolean } => {
    const rawAny = currentCells[cellRef];
    if (rawAny === undefined || rawAny === null) return { raw: undefined, display: '', isFormula: false };
    const raw = (typeof rawAny === 'boolean' ? (rawAny ? 1 : 0) : rawAny) as string | number;
    const strVal = String(rawAny);
    if (strVal.startsWith('=')) {
      const result = evaluateFormula(strVal);
      return { raw, display: String(result), isFormula: true };
    }
    return { raw, display: formatCellValue(rawAny), isFormula: false };
  }, [currentCells, evaluateFormula]);

  // Contextual Row Insert / Delete
  const handleInsertRowAbove = () => {
    const next = insertRowAtIndex(spreadsheet, selectedRow, 'above');
    const op: CellShiftOperation = { type: 'insert_row', targetRow: selectedRow };
    applySpreadsheetShift(next, op, `Inserted blank row above row ${selectedRow}`);
  };

  const handleInsertRowBelow = () => {
    const next = insertRowAtIndex(spreadsheet, selectedRow, 'below');
    const op: CellShiftOperation = { type: 'insert_row', targetRow: selectedRow + 1 };
    applySpreadsheetShift(next, op, `Inserted blank row below row ${selectedRow}`);
  };

  const handleDeleteSelectedRow = () => {
    if (totalRows <= 1) {
      toast.error('Cannot delete the last row in tab');
      return;
    }
    const next = deleteRowAtIndex(spreadsheet, selectedRow);
    const op: CellShiftOperation = { type: 'delete_row', targetRow: selectedRow };
    applySpreadsheetShift(next, op, `Deleted row ${selectedRow} (Total: ${next.rowCount})`);
  };

  // Contextual Column Insert / Delete
  const handleInsertColLeft = () => {
    const next = insertColAtIndex(spreadsheet, selectedCol, 'left');
    const op: CellShiftOperation = { type: 'insert_col', targetCol: selectedCol };
    applySpreadsheetShift(next, op, `Inserted blank column left of column ${selectedColLetter}`);
  };

  const handleInsertColRight = () => {
    const next = insertColAtIndex(spreadsheet, selectedCol, 'right');
    const op: CellShiftOperation = { type: 'insert_col', targetCol: selectedCol + 1 };
    applySpreadsheetShift(next, op, `Inserted blank column right of column ${selectedColLetter}`);
  };

  const handleDeleteSelectedCol = () => {
    if (totalCols <= 1) {
      toast.error('Cannot delete the last column in tab');
      return;
    }
    const next = deleteColAtIndex(spreadsheet, selectedCol);
    const op: CellShiftOperation = { type: 'delete_col', targetCol: selectedCol };
    applySpreadsheetShift(next, op, `Deleted column ${selectedColLetter} (Total: ${next.colCount})`);
  };

  // Excel Dialog Execution Handlers
  const handleExecuteInsert = (
    option: 'shift_right' | 'shift_down' | 'entire_row' | 'entire_col'
  ) => {
    const parsed = parseCellRef(selectedCellRef);
    const targetCol = parsed?.colIndex || 1;
    const targetRow = parsed?.rowIndex || 1;

    let next: AttachedSpreadsheet;
    let op: CellShiftOperation;
    let msg: string;

    if (option === 'shift_right') {
      next = shiftCellsRight(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_right', targetCol, targetRow };
      msg = `Shifted cells right at ${selectedCellRef}`;
    } else if (option === 'shift_down') {
      next = shiftCellsDown(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_down', targetCol, targetRow };
      msg = `Shifted cells down at ${selectedCellRef}`;
    } else if (option === 'entire_row') {
      next = insertRowAtIndex(spreadsheet, targetRow, 'above');
      op = { type: 'insert_row', targetRow };
      msg = `Inserted blank row at row ${targetRow}`;
    } else {
      next = insertColAtIndex(spreadsheet, targetCol, 'left');
      op = { type: 'insert_col', targetCol };
      msg = `Inserted blank column at column ${colToLetter(targetCol)}`;
    }

    applySpreadsheetShift(next, op, msg);
    setIsInsertDialogOpen(false);
  };

  const handleExecuteDelete = (
    option: 'shift_left' | 'shift_up' | 'entire_row' | 'entire_col'
  ) => {
    const parsed = parseCellRef(selectedCellRef);
    const targetCol = parsed?.colIndex || 1;
    const targetRow = parsed?.rowIndex || 1;

    let next: AttachedSpreadsheet;
    let op: CellShiftOperation;
    let msg: string;

    if (option === 'shift_left') {
      next = shiftCellsLeft(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_left', targetCol, targetRow };
      msg = `Shifted cells left at ${selectedCellRef}`;
    } else if (option === 'shift_up') {
      next = shiftCellsUp(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_up', targetCol, targetRow };
      msg = `Shifted cells up at ${selectedCellRef}`;
    } else if (option === 'entire_row') {
      next = deleteRowAtIndex(spreadsheet, targetRow);
      op = { type: 'delete_row', targetRow };
      msg = `Deleted row ${targetRow}`;
    } else {
      next = deleteColAtIndex(spreadsheet, targetCol);
      op = { type: 'delete_col', targetCol };
      msg = `Deleted column ${colToLetter(targetCol)}`;
    }

    applySpreadsheetShift(next, op, msg);
    setIsDeleteDialogOpen(false);
  };

  // Column Header Rename
  const handleStartRenameHeader = (colIdx: number, currentTitle: string) => {
    setEditingColIdx(colIdx);
    setEditingColHeader(currentTitle);
  };

  const handleFinishRenameHeader = () => {
    if (editingColIdx !== null && editingColHeader.trim()) {
      const next = updateTabHeader(spreadsheet, editingColIdx + 1, editingColHeader.trim());
      onUpdateSpreadsheet(next);
      toast.success(`Renamed header for Column ${colToLetter(editingColIdx + 1)} to "${editingColHeader.trim()}"`);
    }
    setEditingColIdx(null);
  };

  // Tab Duplicate
  const handleDuplicateTab = (tabId: string) => {
    const next = duplicateTab(spreadsheet, tabId);
    onUpdateSpreadsheet(next);
    toast.success('Duplicated worksheet tab!');
  };

  // Keyboard navigation & quick edit on grid
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (inlineEditingCellRef) return; // Allow input to handle keys when editing
    if (isEditingWorkbookName || editingTabId !== null || editingColIdx !== null) return;

    const parsed = parseCellRef(selectedCellRef);
    if (!parsed) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = Math.max(1, parsed.rowIndex - 1);
      const nextRef = `${parsed.colLetter}${prevRow}`;
      handleSelectCell(nextRef);
      if (prevRow <= startRowIndex + 1) {
        scrollToRow(prevRow);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = Math.min(totalRows, parsed.rowIndex + 1);
      const nextRef = `${parsed.colLetter}${nextRow}`;
      handleSelectCell(nextRef);
      if (nextRow >= endRowIndex - 1) {
        scrollToRow(nextRow);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = Math.max(1, parsed.colIndex - 1);
      const nextRef = `${colToLetter(prevCol)}${parsed.rowIndex}`;
      handleSelectCell(nextRef);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = Math.min(totalCols, parsed.colIndex + 1);
      const nextRef = `${colToLetter(nextCol)}${parsed.rowIndex}`;
      handleSelectCell(nextRef);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      handleStartInlineEdit(selectedCellRef);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleClearSelectedCell();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into cell like Excel
      setSelectedCellRef(selectedCellRef);
      setEditingValue(e.key);
      setInlineEditingValue(e.key);
      setInlineEditingCellRef(selectedCellRef);
    }
  };

  // Clipboard TSV / CSV paste
  const handleGridPaste = (e: React.ClipboardEvent) => {
    if (inlineEditingCellRef) return;
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const result = pasteDataIntoGrid(spreadsheet, selectedCellRef, text);
    if (result.cellsUpdated > 0) {
      e.preventDefault();
      onUpdateSpreadsheet(result.spreadsheet);
      toast.success(`Pasted ${result.cellsUpdated} cells into grid starting at ${selectedCellRef}!`);
    }
  };

  // Copy syntax to clipboard
  const handleCopyVar = (withValueFallback: boolean) => {
    const val = currentCells[selectedCellRef];
    const textToCopy = createCellVariableToken(
      selectedCellRef,
      withValueFallback ? formatCellValue(val) : undefined,
      currentTab?.name,
      isMultiTab
    );
    navigator.clipboard.writeText(textToCopy);
    if (withValueFallback) {
      setIsCopiedTag(true);
      setTimeout(() => setIsCopiedTag(false), 1800);
    } else {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    }
    toast.success(`Copied "${textToCopy}" to clipboard! Paste into any document block.`);
  };

  // Link selected cell to document (picker mode)
  const handleConfirmInsert = () => {
    if (onInsertVariable) {
      const val = currentCells[selectedCellRef];
      const token = createCellVariableToken(
        selectedCellRef,
        formatCellValue(val),
        currentTab?.name,
        isMultiTab
      );
      onInsertVariable(token, formatCellValue(val));
      onOpenChange(false);
      toast.success(`Linked ${token} to document!`);
    }
  };

  // Dynamic Maker Handlers
  const handleAddRow = (count = 1) => {
    const next = addRowsToSpreadsheet(spreadsheet, count);
    onUpdateSpreadsheet(next);
    toast.success(`Added ${count} row${count > 1 ? 's' : ''} to "${currentTab?.name}" (Total: ${next.rowCount})`);
  };

  const handleRemoveRow = (count = 1) => {
    if ((currentTab?.rowCount || 1) <= 1) {
      toast.error('Cannot remove last row');
      return;
    }
    const next = removeRowsFromSpreadsheet(spreadsheet, count);
    onUpdateSpreadsheet(next);
    toast.info(`Removed row from "${currentTab?.name}" (Total: ${next.rowCount})`);
  };

  const handleAddColumn = (count = 1) => {
    const next = addColumnsToSpreadsheet(spreadsheet, count);
    onUpdateSpreadsheet(next);
    toast.success(`Added column to "${currentTab?.name}" (Total: ${next.colCount} cols up to ${next.maxCol})`);
  };

  const handleRemoveColumn = (count = 1) => {
    if ((currentTab?.colCount || 1) <= 1) {
      toast.error('Cannot remove last column');
      return;
    }
    const next = removeColumnsFromSpreadsheet(spreadsheet, count);
    onUpdateSpreadsheet(next);
    toast.info(`Removed column from "${currentTab?.name}" (Total: ${next.colCount})`);
  };

  const handleApplyResize = () => {
    const r = parseInt(resizeRows, 10);
    const c = parseInt(resizeCols, 10);
    if (isNaN(r) || isNaN(c) || r < 1 || c < 1) {
      toast.error('Please enter valid row and column numbers');
      return;
    }
    const next = resizeSpreadsheetGrid(spreadsheet, r, c);
    onUpdateSpreadsheet(next);
    setIsResizeOpen(false);
    toast.success(`Resized "${currentTab?.name}" to ${next.rowCount} rows × ${next.colCount} columns`);
  };

  const handleCreateNewBlankSheet = () => {
    const r = parseInt(newSheetRows, 10) || 30;
    const c = parseInt(newSheetCols, 10) || 10;
    const blank = createBlankSpreadsheet(
      newSheetName.trim() || 'Custom Sheet',
      newSheetTab.trim() || 'Sheet1',
      r,
      c
    );
    onUpdateSpreadsheet(blank);
    setIsCreateNewOpen(false);
    setSelectedCellRef('A1');
    setEditingValue('');
    scrollToRow(1);
    setScrollTop(0);
    toast.success(`Created dynamic sheet "${blank.fileName}" with tab "${blank.sheetName}"!`);
  };

  const handleLoadDefaultTrialBalance = () => {
    if (
      confirm(
        'Load the 272-row Trial Balance template (06.30.26 TB)? Existing custom cells will be replaced.'
      )
    ) {
      onUpdateSpreadsheet(JSON.parse(JSON.stringify(DEFAULT_TRIAL_BALANCE_SHEET)));
      setSelectedCellRef('A1');
      setEditingValue('');
      scrollToRow(1);
      setScrollTop(0);
      toast.success('Loaded Trial Balance template (Rows 1-272, Cols A-AW)');
    }
  };

  const handleClearCells = () => {
    if (confirm(`Clear all cells in the current tab "${currentTab?.name}"? Dimensions will remain preserved.`)) {
      const next = updateActiveTabCells(spreadsheet, {});
      onUpdateSpreadsheet(next);
      setEditingValue('');
      toast.info(`Cleared all cells in tab "${currentTab?.name}"`);
    }
  };

  // Upload Excel file handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsed = await parseExcelFileToSpreadsheet(file);
      onUpdateSpreadsheet(parsed);
      setSelectedCellRef('A1');
      const firstVal = parsed.cells?.['A1'];
      setEditingValue(firstVal !== undefined && firstVal !== null ? String(firstVal) : '');
      scrollToRow(1);
      setScrollTop(0);
      const tabCount = parsed.tabs?.length || 1;
      toast.success(
        `Imported "${file.name}" with ${tabCount} worksheet tab${
          tabCount > 1 ? 's' : ''
        } (${Object.keys(parsed.cells).length} cells in active tab)!`
      );
    } catch (err: any) {
      console.error('Failed to parse excel file', err);
      toast.error(err.message || 'Failed to parse Excel workbook');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export current spreadsheet to Excel
  const handleExport = async () => {
    try {
      const blob = await exportSpreadsheetToExcel(spreadsheet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = spreadsheet.fileName || `${currentTab?.name || 'Spreadsheet'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Exported all workbook tabs to Excel (.xlsx)!');
    } catch (err) {
      console.error('Export error', err);
      toast.error('Failed to export spreadsheet');
    }
  };

  // Memoized column letters list
  const colLetters = useMemo(() => {
    const list: string[] = [];
    for (let c = 1; c <= totalCols; c++) {
      list.push(colToLetter(c));
    }
    return list;
  }, [totalCols]);

  // Virtualized row windowing: only render rows currently inside viewport (+ overscan buffer)
  const startRowIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_OVERSCAN);
  const endRowIndex = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + ROW_OVERSCAN
  );

  const topSpacerHeight = startRowIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endRowIndex) * ROW_HEIGHT);

  const visibleRows: number[] = [];
  for (let r = startRowIndex + 1; r <= endRowIndex; r++) {
    visibleRows.push(r);
  }

  // Virtualized column windowing: only render columns currently inside viewport (+ overscan buffer)
  const startColIndex = Math.max(0, Math.floor(scrollLeft / COL_WIDTH) - COL_OVERSCAN);
  const endColIndex = Math.min(
    totalCols,
    Math.ceil((scrollLeft + containerWidth) / COL_WIDTH) + COL_OVERSCAN
  );

  const leftSpacerWidth = startColIndex * COL_WIDTH;
  const rightSpacerWidth = Math.max(0, (totalCols - endColIndex) * COL_WIDTH);

  const visibleColLetters = useMemo(() => {
    return colLetters.slice(startColIndex, endColIndex);
  }, [colLetters, startColIndex, endColIndex]);

  // Display human-readable range (1-indexed) currently in the viewport
  const firstVisibleRow = Math.min(totalRows, Math.max(1, Math.floor(scrollTop / ROW_HEIGHT) + 1));
  const lastVisibleRow = Math.min(
    totalRows,
    Math.max(firstVisibleRow, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT))
  );

  const selectedVal = currentCells[selectedCellRef];
  const { display: selectedFormatted, isFormula: selectedIsFormula } = resolveCellDisplay(selectedCellRef);
  // Formula bar shows raw formula (e.g. =SUM(A1:A5)); other bars show the resolved value

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] xl:max-w-[1440px] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 shadow-2xl">
        {/* Interactive Cell Picker Banner */}
        {isPickerMode && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-between text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse shrink-0" />
              <span className="font-semibold">
                Cell Picker Mode — Click any cell in tab{' '}
                <span className="underline font-bold font-mono">[{currentTab?.name}]</span> to link it
                into {targetBlockTitle ? `"${targetBlockTitle}"` : 'your document'}.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-400/40 text-emerald-200 text-xs">
                {createCellVariableToken(
                  selectedCellRef,
                  formatCellValue(currentCells[selectedCellRef]),
                  currentTab?.name,
                  isMultiTab
                )}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmInsert}
                className="h-6 text-xs bg-white text-emerald-900 hover:bg-emerald-50 font-bold shadow-xs cursor-pointer"
              >
                Insert Selected Cell ↗
              </Button>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <DialogHeader className="px-5 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/50 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingWorkbookName ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingWorkbookName}
                    onChange={(e) => setEditingWorkbookName(e.target.value)}
                    onBlur={() => {
                      if (editingWorkbookName.trim()) {
                        onUpdateSpreadsheet({
                          ...spreadsheet,
                          fileName: editingWorkbookName.trim()
                        });
                        toast.success(`Renamed workbook to "${editingWorkbookName.trim()}"`);
                      }
                      setIsEditingWorkbookName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setIsEditingWorkbookName(false);
                      }
                    }}
                    className="text-base font-bold text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-blue-500 rounded px-1.5 py-0.5 outline-none font-sans"
                  />
                ) : (
                  <div
                    onClick={() => {
                      setEditingWorkbookName(spreadsheet.fileName || 'Attached Spreadsheet.xlsx');
                      setIsEditingWorkbookName(true);
                    }}
                    className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-zinc-800/60 rounded px-1 py-0.5 group"
                    title="Click to rename workbook"
                  >
                    <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
                      {spreadsheet.fileName || 'Attached Spreadsheet'}
                    </DialogTitle>
                    <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                )}
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300"
                >
                  {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Tab: {currentTab?.name} ({totalRows} rows × {totalCols} cols)
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                {isPickerMode
                  ? 'Select any cell across all workbook tabs to insert a dynamic link.'
                  : 'Manage multiple workbook tabs, edit live cells, and link formulas to your document.'}
              </DialogDescription>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Create Blank Sheet */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setNewSheetName('Operating Model');
                setNewSheetTab('Sheet1');
                setNewSheetRows('30');
                setNewSheetCols('10');
                setIsCreateNewOpen(true);
              }}
              className="h-8 text-xs gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
              title="Create a brand new blank spreadsheet"
            >
              <FilePlus className="w-3.5 h-3.5 text-blue-600" />
              <span>New Sheet</span>
            </Button>

            {/* Upload Excel Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
              title="Upload multi-sheet .xlsx workbook"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isUploading ? 'Parsing...' : 'Upload .xlsx'}</span>
            </Button>

            {/* Export Excel Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
              title="Export all tabs to Excel"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export .xlsx</span>
            </Button>

            {/* Grid / Variables View Toggle */}
            <div className="flex items-center bg-slate-200/80 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('grid')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeTab === 'grid'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                Grid View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('variables')}
                className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'variables'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                <span>Linked Variables</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                  {usedVariables.length}
                </span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Dynamic Maker Sub-Toolbar */}
        <div className="px-5 py-2 bg-slate-100/80 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Left: Row & Column Dynamic Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Active Tab ({currentTab?.name}):
            </span>

            {/* Undo / Redo */}
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-md border border-slate-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                title="Undo last change (Ctrl+Z)"
                className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium flex items-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.87 6.04"/></svg>
                <span>Undo</span>
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                disabled={!canRedo}
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium flex items-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.13 6.04"/></svg>
                <span>Redo</span>
              </button>
            </div>

            {/* Excel Insert Dialog Trigger */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInsertOption('entire_row');
                setIsInsertDialogOpen(true);
              }}
              className="h-7 text-[11px] gap-1 bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer font-medium"
              title="Insert cells, row, or column (Right-click cell or Ctrl+Shift+=)"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Insert...</span>
            </Button>

            {/* Add / Remove Rows */}
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-md border border-slate-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleAddRow(1)}
                title="Add 1 Row at bottom of active tab"
                className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>Row</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddRow(5)}
                title="Add 5 Rows at bottom"
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded text-[10px] font-mono cursor-pointer"
              >
                +5
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={() => handleRemoveRow(1)}
                title="Remove bottom Row"
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-red-600 rounded cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>

            {/* Add / Remove Columns */}
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-md border border-slate-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleAddColumn(1)}
                title="Add 1 Column at right of active tab"
                className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-blue-600" />
                <span>Col</span>
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={() => handleRemoveColumn(1)}
                title="Remove rightmost Column"
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-red-600 rounded cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>

            {/* Exact Grid Resize Dialog Trigger */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setResizeRows(String(totalRows));
                setResizeCols(String(totalCols));
                setIsResizeOpen(true);
              }}
              className="h-7 text-[11px] gap-1 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 cursor-pointer"
              title="Resize grid dimensions for active tab"
            >
              <Maximize2 className="w-3 h-3 text-purple-600" />
              <span>Resize Tab Grid</span>
            </Button>

            {/* Clear All Data */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearCells}
              className="h-7 text-[11px] gap-1 text-slate-500 hover:text-red-600 cursor-pointer"
              title="Clear all cell values in active tab"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Tab Cells</span>
            </Button>

            {/* Load Default Sample */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadDefaultTrialBalance}
              className="h-7 text-[11px] gap-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
              title="Load full 06.30.26 TB Starter Sample"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sample TB Template</span>
            </Button>
          </div>

          {/* Right: Search / Jump to Cell */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = searchQuery.trim().toUpperCase();
                    const match = q.match(/^([A-Z]+)([0-9]+)$/);
                    if (match) {
                      handleSelectCell(q);
                      scrollToRow(parseInt(match[2], 10));
                    }
                  }
                }}
                placeholder="Jump to cell (e.g. A5, B8) or text..."
                className="h-7 pl-7 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
              />
            </div>
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="h-7 text-xs px-2"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Selected Cell Action & Inspector Bar */}
        <div className="px-5 py-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-xs text-slate-500">Cell:</span>
              <Badge className="bg-[#0E2841] text-white font-bold text-xs px-2 py-0.5">
                {currentTab?.name ? `${currentTab.name}!` : ''}
                {selectedCellRef}
              </Badge>
            </div>

            {/* Inline Value Input / Formula Bar */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-md">
              <span className={`text-xs font-mono font-bold shrink-0 ${selectedIsFormula ? 'text-violet-600' : 'text-slate-500'}`}>
                {selectedIsFormula ? 'fx' : '='}
              </span>
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCell();
                }}
                placeholder="Value or formula (e.g. 500, Cash, =SUM(A1:A5))..."
                className={`h-7 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 font-mono ${selectedIsFormula ? 'text-violet-700 dark:text-violet-300' : ''}`}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCell}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 font-medium"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </Button>
              {selectedIsFormula && (
                <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 rounded shrink-0">
                  = {selectedFormatted}
                </span>
              )}
            </div>

            {/* Direct In-Cell Edit Trigger */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleStartInlineEdit(selectedCellRef)}
              className="h-7 text-xs bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 gap-1 cursor-pointer"
              title="Double-click cell or press Enter to edit directly inside grid"
            >
              <CornerDownLeft className="w-3 h-3 text-blue-600" />
              <span>Edit In-Cell</span>
            </Button>

            {/* Clear Cell */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearSelectedCell}
              className="h-7 text-xs text-slate-500 hover:text-red-600 px-2 cursor-pointer"
              title="Clear selected cell value"
            >
              <Trash2 className="w-3 h-3" />
            </Button>

            <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 mx-1 hidden lg:block" />

            {/* Contextual Row Operations */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs">
              <span className="text-[10px] font-mono font-semibold px-1 text-slate-500 flex items-center gap-0.5">
                <Rows className="w-3 h-3 text-emerald-600" />
                R{selectedRow}:
              </span>
              <button
                type="button"
                onClick={handleInsertRowAbove}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title={`Insert blank row above row ${selectedRow}`}
              >
                +Above
              </button>
              <button
                type="button"
                onClick={handleInsertRowBelow}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title={`Insert blank row below row ${selectedRow}`}
              >
                +Below
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedRow}
                className="px-1 py-0.5 text-[10px] hover:bg-red-50 text-slate-400 hover:text-red-600 rounded font-medium cursor-pointer"
                title={`Delete row ${selectedRow}`}
              >
                Del
              </button>
            </div>

            {/* Contextual Column Operations */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs">
              <span className="text-[10px] font-mono font-semibold px-1 text-slate-500 flex items-center gap-0.5">
                <Columns className="w-3 h-3 text-blue-600" />
                Col {selectedColLetter}:
              </span>
              <button
                type="button"
                onClick={handleInsertColLeft}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title={`Insert blank column left of column ${selectedColLetter}`}
              >
                +Left
              </button>
              <button
                type="button"
                onClick={handleInsertColRight}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title={`Insert blank column right of column ${selectedColLetter}`}
              >
                +Right
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedCol}
                className="px-1 py-0.5 text-[10px] hover:bg-red-50 text-slate-400 hover:text-red-600 rounded font-medium cursor-pointer"
                title={`Delete column ${selectedColLetter}`}
              >
                Del
              </button>
            </div>

            {/* Current value preview badge */}
            {selectedVal !== undefined && selectedVal !== null && (
              <div className="text-xs text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                <span className="text-slate-400">Current:</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-white max-w-[200px] truncate">
                  {selectedFormatted}
                </span>
                {usedCellSet.has(selectedCellRef) && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/40"
                  >
                    Linked in Document
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Quick Copy / Link Actions */}
          <div className="flex items-center gap-2">
            {isPickerMode ? (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmInsert}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-sm cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  Insert{' '}
                  {createCellVariableToken(
                    selectedCellRef,
                    undefined,
                    currentTab?.name,
                    isMultiTab
                  )}{' '}
                  into Document
                </span>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVar(false)}
                  className="h-7 text-xs gap-1 bg-white dark:bg-zinc-800"
                  title="Copy reference syntax"
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>
                    Copy{' '}
                    {createCellVariableToken(
                      selectedCellRef,
                      undefined,
                      currentTab?.name,
                      isMultiTab
                    )}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVar(true)}
                  className="h-7 text-xs gap-1 bg-white dark:bg-zinc-800"
                  title="Copy with tagged value fallback"
                >
                  {isCopiedTag ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-blue-600" />
                  )}
                  <span>Copy Tagged Value</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeTab === 'grid' ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Spreadsheet Grid Container with 2D Virtual Scrolling */}
              <div
                ref={scrollContainerRef}
                tabIndex={0}
                onKeyDown={handleGridKeyDown}
                onPaste={handleGridPaste}
                onScroll={handleContainerScroll}
                className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-zinc-950 font-sans select-none focus:outline-none focus:ring-1 focus:ring-blue-500/20"
              >
                <table className="border-separate border-spacing-0 text-xs table-fixed w-max">
                  {/* Sticky Top Header: Column Letters & Headers */}
                  <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-zinc-900 shadow-xs">
                    {/* Row 1: Column Letters */}
                    <tr>
                      <th className="sticky left-0 z-40 w-14 min-w-[56px] max-w-[56px] h-7 bg-slate-200 dark:bg-zinc-800 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[11px] text-slate-500">
                        #
                      </th>
                      {leftSpacerWidth > 0 && (
                        <th
                          style={{ width: `${leftSpacerWidth}px`, minWidth: `${leftSpacerWidth}px` }}
                          className="p-0 border-b border-slate-300 dark:border-zinc-700 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                      {visibleColLetters.map((col) => (
                        <th
                          key={col}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const ref = `${col}1`;
                            handleSelectCell(ref);
                            const parsed = parseCellRef(ref);
                            setContextMenu({
                              open: true,
                              x: Math.min(e.clientX, window.innerWidth - 220),
                              y: Math.min(e.clientY, window.innerHeight - 260),
                              cellRef: ref,
                              rowIndex: 1,
                              colIndex: parsed?.colIndex || 1
                            });
                          }}
                          className="w-32 min-w-[128px] max-w-[128px] h-7 px-2 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[11px] text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 cursor-context-menu"
                        >
                          {col}
                        </th>
                      ))}
                      {rightSpacerWidth > 0 && (
                        <th
                          style={{ width: `${rightSpacerWidth}px`, minWidth: `${rightSpacerWidth}px` }}
                          className="p-0 border-b border-slate-300 dark:border-zinc-700 pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                    </tr>

                    {/* Row 2: Header Labels */}
                    {currentHeaders.length > 0 && (
                      <tr className="bg-slate-50 dark:bg-zinc-900/80">
                        <th className="sticky left-0 z-40 w-14 min-w-[56px] max-w-[56px] h-6 bg-slate-200/90 dark:bg-zinc-800/90 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono text-[9px] text-slate-400">
                          Hdr
                        </th>
                        {leftSpacerWidth > 0 && (
                          <th
                            style={{ width: `${leftSpacerWidth}px`, minWidth: `${leftSpacerWidth}px` }}
                            className="p-0 border-b border-slate-300 dark:border-zinc-700 pointer-events-none"
                            aria-hidden="true"
                          />
                        )}
                        {visibleColLetters.map((col, idx) => {
                          const colIdx = startColIndex + idx;
                          const headerTitle = currentHeaders[colIdx] || `Column ${col}`;
                          const isEditingThisHeader = editingColIdx === colIdx;

                          return (
                            <th
                              key={`hdr-${col}`}
                              onDoubleClick={() => handleStartRenameHeader(colIdx, headerTitle)}
                              className="group w-32 min-w-[128px] max-w-[128px] h-6 px-1.5 border-r border-b border-slate-300 dark:border-zinc-700 text-left font-normal text-[10px] text-slate-500 dark:text-zinc-400 truncate relative cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800"
                              title={`Header for Column ${col}. Double-click to rename.`}
                            >
                              {isEditingThisHeader ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingColHeader}
                                  onChange={(e) => setEditingColHeader(e.target.value)}
                                  onBlur={handleFinishRenameHeader}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleFinishRenameHeader();
                                    if (e.key === 'Escape') setEditingColIdx(null);
                                  }}
                                  className="w-full h-5 px-1 text-[10px] bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-blue-500 rounded outline-none"
                                />
                              ) : (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate">{headerTitle}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRenameHeader(colIdx, headerTitle);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-600 rounded text-slate-400 cursor-pointer"
                                    title="Rename column header"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                            </th>
                          );
                        })}
                        {rightSpacerWidth > 0 && (
                          <th
                            style={{ width: `${rightSpacerWidth}px`, minWidth: `${rightSpacerWidth}px` }}
                            className="p-0 border-b border-slate-300 dark:border-zinc-700 pointer-events-none"
                            aria-hidden="true"
                          />
                        )}
                      </tr>
                    )}
                  </thead>

                  {/* Body: Virtualized Data Cells with Event Delegation */}
                  <tbody
                    onClick={(e) => {
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        handleSelectCell(td.dataset.cellRef);
                      }
                    }}
                    onDoubleClick={(e) => {
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        handleCellDoubleClick(td.dataset.cellRef);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        const ref = td.dataset.cellRef;
                        handleSelectCell(ref);
                        const parsed = parseCellRef(ref);
                        setContextMenu({
                          open: true,
                          x: Math.min(e.clientX, window.innerWidth - 220),
                          y: Math.min(e.clientY, window.innerHeight - 260),
                          cellRef: ref,
                          rowIndex: parsed?.rowIndex || 1,
                          colIndex: parsed?.colIndex || 1
                        });
                      }
                    }}
                  >
                    {/* Top spacer row preserving scroll height for offscreen rows above */}
                    {topSpacerHeight > 0 && (
                      <tr style={{ height: `${topSpacerHeight}px` }} aria-hidden="true">
                        <td
                          colSpan={visibleColLetters.length + 1 + (leftSpacerWidth > 0 ? 1 : 0) + (rightSpacerWidth > 0 ? 1 : 0)}
                          className="p-0 m-0 border-0 pointer-events-none"
                        />
                      </tr>
                    )}

                    {visibleRows.map((row) => (
                      <tr
                        key={row}
                        className="h-7 hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {/* Sticky Left: Row Number Header with Right-Click Support */}
                        <td
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const ref = `A${row}`;
                            handleSelectCell(ref);
                            setContextMenu({
                              open: true,
                              x: Math.min(e.clientX, window.innerWidth - 220),
                              y: Math.min(e.clientY, window.innerHeight - 260),
                              cellRef: ref,
                              rowIndex: row,
                              colIndex: 1
                            });
                          }}
                          className="sticky left-0 z-20 w-14 min-w-[56px] max-w-[56px] h-7 bg-slate-100 dark:bg-zinc-900 border-r border-b border-slate-300 dark:border-zinc-800 text-center font-mono font-semibold text-[11px] text-slate-500 cursor-context-menu"
                        >
                          {row}
                        </td>

                        {/* Left column spacer */}
                        {leftSpacerWidth > 0 && (
                          <td
                            style={{ width: `${leftSpacerWidth}px`, minWidth: `${leftSpacerWidth}px` }}
                            className="p-0 border-b border-slate-200 dark:border-zinc-800 pointer-events-none"
                            aria-hidden="true"
                          />
                        )}

                        {/* Visible Columns for this row */}
                        {visibleColLetters.map((col) => {
                          const cellRef = `${col}${row}`;
                          const { raw: val, display, isFormula } = resolveCellDisplay(cellRef);
                          const isSelected = selectedCellRef === cellRef;
                          const isLinked = usedCellSet.has(cellRef);
                          const resolvedNum = !isFormula ? typeof val === 'number' : !isNaN(Number(display));
                          const isNumeric = resolvedNum;

                          const isSearchHit =
                            searchQuery.trim() !== '' &&
                            (cellRef.toLowerCase() === searchQuery.toLowerCase() ||
                              (display &&
                                display.toLowerCase().includes(searchQuery.toLowerCase())));

                          const isInlineEditing = inlineEditingCellRef === cellRef;

                          return (
                            <td
                              key={cellRef}
                              data-cell-ref={cellRef}
                              className={`w-32 min-w-[128px] max-w-[128px] h-7 px-1.5 border-r border-b text-xs truncate transition-colors cursor-cell relative ${
                                isSelected
                                  ? 'bg-blue-100/90 dark:bg-blue-900/60 ring-2 ring-blue-600 ring-inset font-bold text-blue-950 dark:text-white border-blue-400'
                                  : isSearchHit
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 font-bold border-amber-400'
                                  : isLinked
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-slate-200 dark:border-zinc-800'
                                  : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-800'
                              } ${isNumeric && !isInlineEditing ? 'text-right font-mono' : 'text-left'}`}
                              title={`${currentTab?.name ? `${currentTab.name}!` : ''}${cellRef}${isFormula ? ` [Formula: ${val}]` : ''}: ${display || '(empty)'}${
                                isLinked ? ' (Linked in document)' : ''
                              }${isPickerMode ? ' (Click to select, double-click to link)' : ' (Double-click or Enter to edit directly)'}`}
                            >

                              {isInlineEditing ? (
                                <input
                                  ref={inlineInputRef}
                                  autoFocus
                                  type="text"
                                  value={inlineEditingValue}
                                  onChange={(e) => {
                                    setInlineEditingValue(e.target.value);
                                    setEditingValue(e.target.value);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitCellValue(cellRef, inlineEditingValue, 'down');
                                      setInlineEditingCellRef(null);
                                    } else if (e.key === 'Tab') {
                                      e.preventDefault();
                                      commitCellValue(cellRef, inlineEditingValue, e.shiftKey ? 'left' : 'right');
                                      setInlineEditingCellRef(null);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setInlineEditingCellRef(null);
                                      setEditingValue(val !== undefined && val !== null ? String(val) : '');
                                    }
                                  }}
                                  onBlur={() => {
                                    commitCellValue(cellRef, inlineEditingValue, 'none');
                                    setInlineEditingCellRef(null);
                                  }}
                                  className="w-full h-6 px-1 text-xs font-mono bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none ring-2 ring-blue-600 rounded-xs shadow-inner"
                                />
                              ) : (
                                <>
                                  {/* Green corner triangle for linked cells */}
                                  {isLinked && (
                                    <span className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-emerald-600 border-l-[6px] border-l-transparent" />
                                  )}
                                  {/* Purple corner triangle for formula cells */}
                                  {isFormula && !isLinked && (
                                    <span className="absolute top-0 left-0 w-0 h-0 border-t-[5px] border-t-violet-500 border-r-[5px] border-r-transparent" />
                                  )}
                                  <span>{display}</span>
                                </>
                              )}
                            </td>
                          );
                        })}

                        {/* Right column spacer */}
                        {rightSpacerWidth > 0 && (
                          <td
                            style={{ width: `${rightSpacerWidth}px`, minWidth: `${rightSpacerWidth}px` }}
                            className="p-0 border-b border-slate-200 dark:border-zinc-800 pointer-events-none"
                            aria-hidden="true"
                          />
                        )}
                      </tr>
                    ))}

                    {/* Bottom spacer row preserving scroll height for offscreen rows below */}
                    {bottomSpacerHeight > 0 && (
                      <tr style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true">
                        <td
                          colSpan={visibleColLetters.length + 1 + (leftSpacerWidth > 0 ? 1 : 0) + (rightSpacerWidth > 0 ? 1 : 0)}
                          className="p-0 m-0 border-0 pointer-events-none"
                        />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Excel-Style Multi-Tab Strip at the bottom of the grid */}
              <div className="flex items-center justify-between border-t border-slate-300 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 px-3 py-1 overflow-x-auto select-none gap-2">
                <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 py-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono mr-1 shrink-0">
                    Sheets:
                  </span>

                  {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    const isEditingThisTab = editingTabId === tab.id;

                    return (
                      <div
                        key={tab.id}
                        onClick={() => !isEditingThisTab && handleSwitchTab(tab.id)}
                        onDoubleClick={() => handleStartRenameTab(tab.id, tab.name)}
                        title={`Tab "${tab.name}" (${tab.rowCount} rows × ${tab.colCount} cols). Double-click to rename.`}
                        className={`group relative flex items-center gap-1.5 px-3 py-1 text-xs rounded-t-md border-t-2 transition-all cursor-pointer shrink-0 ${
                          isActive
                            ? 'bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 border-t-emerald-600 font-bold shadow-xs'
                            : 'bg-slate-200/80 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 border-t-transparent hover:bg-white/60 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {isEditingThisTab ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingTabName}
                            onChange={(e) => setEditingTabName(e.target.value)}
                            onBlur={handleFinishRenameTab}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishRenameTab();
                              if (e.key === 'Escape') setEditingTabId(null);
                            }}
                            className="w-24 px-1 py-0 text-xs bg-white text-slate-900 border border-emerald-500 rounded focus:outline-none"
                          />
                        ) : (
                          <>
                            <span className="truncate max-w-[140px]">{tab.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({tab.rowCount}×{tab.colCount})
                            </span>

                            {/* Rename Icon */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRenameTab(tab.id, tab.name);
                              }}
                              title="Rename tab"
                              className="opacity-0 group-hover:opacity-100 hover:text-emerald-600 p-0.5 rounded transition-opacity cursor-pointer"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>

                            {/* Duplicate Tab */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTab(tab.id);
                              }}
                              title="Duplicate worksheet tab"
                              className="opacity-0 group-hover:opacity-100 hover:text-blue-600 p-0.5 rounded transition-opacity cursor-pointer"
                            >
                              <CopyPlus className="w-2.5 h-2.5" />
                            </button>

                            {/* Tab Delete */}
                            {tabs.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTab(tab.id, tab.name);
                                }}
                                title="Delete tab"
                                className="opacity-0 group-hover:opacity-100 hover:text-red-600 p-0.5 rounded transition-opacity text-[11px] leading-none font-bold"
                              >
                                ×
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Add New Tab Button */}
                  <button
                    type="button"
                    onClick={handleAddTab}
                    title="Add new worksheet tab"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 dark:text-zinc-400 hover:text-emerald-700 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded font-medium transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Add Tab</span>
                  </button>
                </div>

                {/* Right: Active Tab Indicator */}
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono shrink-0 pl-3">
                  Active Tab:{' '}
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {currentTab?.name}
                  </span>{' '}
                  ({tabs.length} tabs in workbook)
                </div>
              </div>

              {/* Bottom Live Status Bar: Virtual Range & Fast Jump */}
              <div className="px-5 py-2 bg-slate-50 dark:bg-zinc-950/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      Showing rows <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{firstVisibleRow}</strong>–<strong className="text-slate-800 dark:text-zinc-200 font-semibold">{lastVisibleRow}</strong> of <strong className="text-slate-800 dark:text-zinc-200">{totalRows}</strong>
                    </span>
                  </div>
                  <span>•</span>
                  <span>
                    {totalCols} Columns (A through {colToLetter(totalCols)})
                  </span>
                  <span>•</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Only {visibleRows.length} rows × {visibleColLetters.length} cols rendered in DOM
                  </span>
                </div>

                {/* Quick Row Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scrollToRow(1)}
                    className="h-7 text-xs px-2.5 cursor-pointer"
                    title="Jump to Top (Row 1)"
                  >
                    Top
                  </Button>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const r = parseInt(jumpRowInput, 10);
                      if (!isNaN(r) && r >= 1 && r <= totalRows) {
                        scrollToRow(r);
                      } else {
                        toast.error(`Enter a row between 1 and ${totalRows}`);
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-slate-500 text-[11px]">Go to row:</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalRows}
                      placeholder="Row #"
                      value={jumpRowInput}
                      onChange={(e) => setJumpRowInput(e.target.value)}
                      className="w-16 h-7 text-xs px-2 font-mono"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-2 cursor-pointer font-medium"
                    >
                      Go
                    </Button>
                  </form>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scrollToRow(totalRows)}
                    className="h-7 text-xs px-2.5 cursor-pointer"
                    title={`Jump to Bottom (Row ${totalRows})`}
                  >
                    Bottom
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Linked Variables Tab */
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Document Linked Variables ({usedVariables.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live variables found across document blocks linked to spreadsheet cells.
                  </p>
                </div>
              </div>

              {usedVariables.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <Info className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    No variables linked yet
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Click "Link Cell" in any block or right-click text to link any spreadsheet cell.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {usedVariables.map((item) => (
                    <div
                      key={item.fullRef}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5 shadow-2xs hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-white font-mono font-bold text-xs">
                            @{item.fullRef}
                          </Badge>
                          <span className="font-semibold text-slate-900 dark:text-zinc-100 font-mono text-sm">
                            = {formatCellValue(item.currentVal) || '<empty>'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (item.tabName) {
                              const found = tabs.find(
                                (t) => t.name.toLowerCase() === item.tabName?.toLowerCase()
                              );
                              if (found) handleSwitchTab(found.id);
                            }
                            setSelectedCellRef(item.cellRef);
                            setActiveTab('grid');
                            const match = item.cellRef.match(/^([A-Z]+)([0-9]+)$/i);
                            if (match) {
                              const rowNum = parseInt(match[2], 10);
                              setTimeout(() => scrollToRow(rowNum), 50);
                            }
                          }}
                          className="h-6 text-xs text-blue-600 hover:text-blue-700"
                        >
                          View in Grid →
                        </Button>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800 text-xs">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Used in {item.usages.length} block{item.usages.length > 1 ? 's' : ''}:
                        </div>
                        {item.usages.map((u, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-50 dark:bg-zinc-800/60 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Badge variant="outline" className="text-[9px] uppercase px-1">
                                  {u.blockType}
                                </Badge>
                                <span>Section: {u.section}</span>
                              </div>
                              <div className="text-xs text-slate-800 dark:text-zinc-200 italic truncate mt-0.5">
                                "{u.snippet}"
                              </div>
                            </div>
                            {onSelectBlock && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onSelectBlock(u.blockId);
                                  onOpenChange(false);
                                }}
                                className="h-6 text-[10px] shrink-0 gap-1"
                              >
                                <span>Go to Block</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialog for Creating a New Blank Sheet */}
        <Dialog open={isCreateNewOpen} onOpenChange={setIsCreateNewOpen}>
          <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-blue-600" />
                Create New Blank Spreadsheet
              </DialogTitle>
              <DialogDescription className="text-xs">
                Initialize a clean dynamic spreadsheet with tab support.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Spreadsheet Title
                </label>
                <Input
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="e.g. Q2 Operational Model, Audit Working Sheet..."
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  First Tab Name
                </label>
                <Input
                  value={newSheetTab}
                  onChange={(e) => setNewSheetTab(e.target.value)}
                  placeholder="Sheet1"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Initial Rows
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={newSheetRows}
                    onChange={(e) => setNewSheetRows(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Initial Columns
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={newSheetCols}
                    onChange={(e) => setNewSheetCols(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateNewOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewBlankSheet}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Create Sheet
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog for Resizing the Active Tab Grid */}
        <Dialog open={isResizeOpen} onOpenChange={setIsResizeOpen}>
          <DialogContent className="max-w-xs bg-white dark:bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-purple-600" />
                Resize Tab Grid ({currentTab?.name})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set exact total rows and columns for this worksheet tab.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Total Rows (1 to 2000)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={2000}
                  value={resizeRows}
                  onChange={(e) => setResizeRows(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Total Columns (1 to 100)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={resizeCols}
                  onChange={(e) => setResizeCols(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResizeOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyResize}
                className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                Apply Resize
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* EXCEL RIGHT-CLICK CONTEXT MENU — rendered via portal to document.body so it is
             fully outside the Dialog's CSS transform stacking context. This fixes the bug
             where position:fixed coords (e.clientX/Y) were offset by the dialog's origin. */}
        {contextMenu?.open && createPortal(
          <div
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            className="fixed z-[9999] w-52 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md shadow-2xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-75"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-2 py-1 text-[10px] font-mono text-slate-400 font-semibold border-b border-slate-100 dark:border-zinc-800 mb-1 flex items-center justify-between">
              <span>CELL {contextMenu.cellRef}</span>
              <span>R{contextMenu.rowIndex} C{contextMenu.colIndex}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                setInsertOption('entire_row');
                setIsInsertDialogOpen(true);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Insert...</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+Shift+=</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleExecuteInsert('entire_row');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Rows className="w-3.5 h-3.5 text-slate-400" />
              <span>Insert Entire Row</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleExecuteInsert('entire_col');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Columns className="w-3.5 h-3.5 text-slate-400" />
              <span>Insert Entire Column</span>
            </button>

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                setDeleteOption('entire_row');
                setIsDeleteDialogOpen(true);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete...</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+-</span>
            </button>

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(contextMenu.cellRef);
                  toast.success(`Copied cell reference: ${contextMenu.cellRef}`);
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Cell Ref ({contextMenu.cellRef})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleClearSelectedCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Contents</span>
            </button>
          </div>,
          document.body
        )}

        {/* ------------------------------------------------------------- */}
        {/* EXACT MICROSOFT EXCEL STYLE "INSERT" DIALOG                    */}
        {/* ------------------------------------------------------------- */}
        {isInsertDialogOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-[0.5px]"
            onClick={() => setIsInsertDialogOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExecuteInsert(insertOption);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsInsertDialogOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const order: ('shift_right' | 'shift_down' | 'entire_row' | 'entire_col')[] = [
                  'shift_right',
                  'shift_down',
                  'entire_row',
                  'entire_col'
                ];
                const curr = order.indexOf(insertOption);
                setInsertOption(order[(curr + 1) % order.length]);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const order: ('shift_right' | 'shift_down' | 'entire_row' | 'entire_col')[] = [
                  'shift_right',
                  'shift_down',
                  'entire_row',
                  'entire_col'
                ];
                const curr = order.indexOf(insertOption);
                setInsertOption(order[(curr - 1 + order.length) % order.length]);
              } else if (e.key === 'r' || e.key === 'R') {
                setInsertOption('shift_right');
              } else if (e.key === 'd' || e.key === 'D') {
                setInsertOption('shift_down');
              } else if (e.key === 'w' || e.key === 'W') {
                setInsertOption('entire_row');
              } else if (e.key === 'c' || e.key === 'C') {
                setInsertOption('entire_col');
              }
            }}
            tabIndex={-1}
          >
            <div
              className="w-[220px] bg-[#fcfcfc] dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg shadow-2xl overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#f5f5f5] dark:bg-zinc-800/90 border-b border-slate-200/80 dark:border-zinc-700">
                <span className="text-[13px] font-medium text-slate-800 dark:text-zinc-200">
                  Insert
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      toast.info('Insert cells, rows, or columns at the currently selected cell.')
                    }
                    className="w-5 h-5 flex items-center justify-center text-[12px] font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/70 dark:hover:bg-zinc-700 rounded-sm cursor-pointer"
                    title="Help"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInsertDialogOpen(false)}
                    className="w-5 h-5 flex items-center justify-center text-[12px] text-slate-500 hover:text-white dark:text-zinc-400 hover:bg-red-500 dark:hover:bg-red-600 rounded-sm cursor-pointer transition-colors"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Fieldset Box */}
              <div className="px-3 pb-2 pt-1.5">
                <fieldset className="border border-slate-300 dark:border-zinc-600 rounded px-2.5 py-1.5 bg-white dark:bg-zinc-900/60">
                  <legend className="px-1 text-[11px] text-slate-600 dark:text-zinc-400 font-normal">
                    Insert
                  </legend>
                  <div className="space-y-1.5 py-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'shift_right'}
                        onChange={() => setInsertOption('shift_right')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Shift cells <span className="underline font-medium">r</span>ight
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'shift_down'}
                        onChange={() => setInsertOption('shift_down')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Shift cells <span className="underline font-medium">d</span>own
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_row'}
                        onChange={() => setInsertOption('entire_row')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Entire <span className="underline font-medium">r</span>ow
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_col'}
                        onChange={() => setInsertOption('entire_col')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Entire <span className="underline font-medium">c</span>olumn
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

              {/* OK & Cancel Buttons */}
              <div className="flex items-center justify-center gap-2.5 px-3 pb-3 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleExecuteInsert(insertOption)}
                  className="min-w-[72px] h-[24px] px-2 bg-[#f0f0f0] dark:bg-zinc-700 hover:bg-[#e4e4e4] dark:hover:bg-zinc-600 active:bg-[#d8d8d8] border border-[#707070] dark:border-zinc-500 rounded text-[11px] font-medium text-slate-900 dark:text-zinc-100 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsInsertDialogOpen(false)}
                  className="min-w-[72px] h-[24px] px-2 bg-[#f0f0f0] dark:bg-zinc-700 hover:bg-[#e4e4e4] dark:hover:bg-zinc-600 active:bg-[#d8d8d8] border border-[#707070] dark:border-zinc-500 rounded text-[11px] font-medium text-slate-900 dark:text-zinc-100 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* EXACT MICROSOFT EXCEL STYLE "DELETE" DIALOG                    */}
        {/* ------------------------------------------------------------- */}
        {isDeleteDialogOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-[0.5px]"
            onClick={() => setIsDeleteDialogOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExecuteDelete(deleteOption);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsDeleteDialogOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const order: ('shift_left' | 'shift_up' | 'entire_row' | 'entire_col')[] = [
                  'shift_left',
                  'shift_up',
                  'entire_row',
                  'entire_col'
                ];
                const curr = order.indexOf(deleteOption);
                setDeleteOption(order[(curr + 1) % order.length]);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const order: ('shift_left' | 'shift_up' | 'entire_row' | 'entire_col')[] = [
                  'shift_left',
                  'shift_up',
                  'entire_row',
                  'entire_col'
                ];
                const curr = order.indexOf(deleteOption);
                setDeleteOption(order[(curr - 1 + order.length) % order.length]);
              }
            }}
            tabIndex={-1}
          >
            <div
              className="w-[220px] bg-[#fcfcfc] dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg shadow-2xl overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#f5f5f5] dark:bg-zinc-800/90 border-b border-slate-200/80 dark:border-zinc-700">
                <span className="text-[13px] font-medium text-slate-800 dark:text-zinc-200">
                  Delete
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      toast.info('Delete cells, rows, or columns at the currently selected cell.')
                    }
                    className="w-5 h-5 flex items-center justify-center text-[12px] font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-200/70 dark:hover:bg-zinc-700 rounded-sm cursor-pointer"
                    title="Help"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    className="w-5 h-5 flex items-center justify-center text-[12px] text-slate-500 hover:text-white dark:text-zinc-400 hover:bg-red-500 dark:hover:bg-red-600 rounded-sm cursor-pointer transition-colors"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Fieldset Box */}
              <div className="px-3 pb-2 pt-1.5">
                <fieldset className="border border-slate-300 dark:border-zinc-600 rounded px-2.5 py-1.5 bg-white dark:bg-zinc-900/60">
                  <legend className="px-1 text-[11px] text-slate-600 dark:text-zinc-400 font-normal">
                    Delete
                  </legend>
                  <div className="space-y-1.5 py-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={deleteOption === 'shift_left'}
                        onChange={() => setDeleteOption('shift_left')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Shift cells <span className="underline font-medium">l</span>eft
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={deleteOption === 'shift_up'}
                        onChange={() => setDeleteOption('shift_up')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Shift cells <span className="underline font-medium">u</span>p
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={deleteOption === 'entire_row'}
                        onChange={() => setDeleteOption('entire_row')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Entire <span className="underline font-medium">r</span>ow
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="deleteOption"
                        checked={deleteOption === 'entire_col'}
                        onChange={() => setDeleteOption('entire_col')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        Entire <span className="underline font-medium">c</span>olumn
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

              {/* OK & Cancel Buttons */}
              <div className="flex items-center justify-center gap-2.5 px-3 pb-3 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleExecuteDelete(deleteOption)}
                  className="min-w-[72px] h-[24px] px-2 bg-[#f0f0f0] dark:bg-zinc-700 hover:bg-[#e4e4e4] dark:hover:bg-zinc-600 active:bg-[#d8d8d8] border border-[#707070] dark:border-zinc-500 rounded text-[11px] font-medium text-slate-900 dark:text-zinc-100 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="min-w-[72px] h-[24px] px-2 bg-[#f0f0f0] dark:bg-zinc-700 hover:bg-[#e4e4e4] dark:hover:bg-zinc-600 active:bg-[#d8d8d8] border border-[#707070] dark:border-zinc-500 rounded text-[11px] font-medium text-slate-900 dark:text-zinc-100 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      {/* Hidden searchable text for browser find (Ctrl+F) */}
      <div style={{position: 'absolute', left: '-10000px', top: '-10000px', visibility: 'hidden'}}>
        {searchableText}
      </div>
    </Dialog>
  );
};
