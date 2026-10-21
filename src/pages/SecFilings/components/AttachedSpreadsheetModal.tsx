import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  X,
  Table2,
} from 'lucide-react';
import type { AttachedSpreadsheet, SecBlock } from '../../../types/secFiling';
import {
  colToLetter,
  letterToCol,
  parseCellRef,
  shiftSingleCellRef,
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
  shiftBlocksCellReferences,
  copyCellWithSmartOffset,
  cycleCellRefAbsolute,
  insertOrReplaceCellInFormula,
  extractCellReferencesFromFormula,
  type FormulaCellReference
} from '../../../utils/documentVariables';
import { DEFAULT_TRIAL_BALANCE_SHEET } from '../../../data/defaultTrialBalanceSheet';
import { toast } from 'sonner';

export interface AttachedSpreadsheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spreadsheet?: AttachedSpreadsheet | null;
  onUpdateSpreadsheet: (sheet: AttachedSpreadsheet, shiftedBlocks?: SecBlock[]) => void;
  onUpdateCell: (cellRef: string, newValue: any, updatedSheet?: AttachedSpreadsheet) => number;
  blocks: SecBlock[];
  onSelectBlock?: (blockId: string) => void;
  mode?: 'manage' | 'picker';
  onInsertVariable?: (cellRef: string, displayVal: string) => void;
  targetBlockTitle?: string;
  initialCellRef?: string;
  initialTabName?: string;
}

interface MemoizedGridCellProps {
  cellRef: string;
  rawVal: any;
  display: string;
  isFormula: boolean;
  isSelected: boolean;
  isLinked: boolean;
  isSearchHit: boolean;
  isInlineEditing: boolean;
  currentTabName?: string;
  isPickerMode: boolean;
  inlineEditingValue: string;
  onInlineChange: (val: string) => void;
  onInlineKeyDown: (e: React.KeyboardEvent, cellRef: string) => void;
  onInlineBlur: (cellRef: string) => void;
  inlineInputRef: React.RefObject<HTMLInputElement | null>;
  onFillHandleDoubleClick?: () => void;
  formulaHighlight?: FormulaCellReference;
}

const MemoizedGridCell = React.memo<MemoizedGridCellProps>(
  ({
    cellRef,
    rawVal,
    display,
    isFormula,
    isSelected,
    isLinked,
    isSearchHit,
    isInlineEditing,
    currentTabName,
    isPickerMode,
    inlineEditingValue,
    onInlineChange,
    onInlineKeyDown,
    onInlineBlur,
    inlineInputRef,
    onFillHandleDoubleClick,
    formulaHighlight
  }) => {
    const isNumeric = !isFormula ? typeof rawVal === 'number' : !isNaN(Number(display));

    let cellVisualClasses = 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-800';
    if (isSelected) {
      cellVisualClasses = 'bg-blue-100/90 dark:bg-blue-900/60 ring-2 ring-blue-600 ring-inset font-bold text-blue-950 dark:text-white border-blue-400 z-10';
    } else if (formulaHighlight) {
      cellVisualClasses = `${formulaHighlight.bgClass} ${formulaHighlight.ringClass} font-semibold ${formulaHighlight.textClass} ${formulaHighlight.borderClass} z-10`;
    } else if (isSearchHit) {
      cellVisualClasses = 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 font-bold border-amber-400';
    } else if (isLinked) {
      cellVisualClasses = 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-slate-200 dark:border-zinc-800';
    }

    return (
      <td
        key={cellRef}
        data-cell-ref={cellRef}
        className={`w-32 min-w-[128px] max-w-[128px] h-7 px-1.5 border-r border-b text-xs truncate transition-all cursor-cell relative ${cellVisualClasses} ${
          isNumeric && !isInlineEditing ? 'text-right font-mono' : 'text-left'
        }`}
        title={`${currentTabName ? `${currentTabName}!` : ''}${cellRef}${isFormula ? ` [Formula: ${rawVal}]` : ''}: ${display || '(empty)'}${
          isLinked ? ' (Linked in document)' : ''
        }${isPickerMode ? ' (Click to select, double-click to link)' : ' (Double-click or Enter to edit directly)'}`}
      >
        {isInlineEditing ? (
          <input
            ref={inlineInputRef}
            autoFocus
            type="text"
            value={inlineEditingValue}
            onChange={(e) => onInlineChange(e.target.value)}
            onKeyDown={(e) => onInlineKeyDown(e, cellRef)}
            onBlur={() => onInlineBlur(cellRef)}
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
            {/* Formula Reference Tag Badge */}
            {formulaHighlight && !isSelected && (
              <span
                style={{ backgroundColor: formulaHighlight.color }}
                className="absolute top-0 right-0 px-1 py-0 text-[8px] font-mono font-bold text-white leading-tight rounded-bl shadow-2xs z-20 pointer-events-none"
              >
                {cellRef}
              </span>
            )}
            <span>{display}</span>
            {/* Autofill handle for selected cell */}
            {isSelected && !isInlineEditing && (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onFillHandleDoubleClick?.();
                }}
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-600 border border-white dark:border-zinc-900 cursor-crosshair z-20 hover:scale-125 transition-transform"
                title="Double-click fill handle to autofill down with formula adjustment"
              />
            )}
          </>
        )}
      </td>
    );
  },
  (prev, next) => {
    return (
      prev.rawVal === next.rawVal &&
      prev.display === next.display &&
      prev.isFormula === next.isFormula &&
      prev.isSelected === next.isSelected &&
      prev.isLinked === next.isLinked &&
      prev.isSearchHit === next.isSearchHit &&
      prev.isInlineEditing === next.isInlineEditing &&
      (!prev.isInlineEditing || prev.inlineEditingValue === next.inlineEditingValue) &&
      prev.isPickerMode === next.isPickerMode &&
      prev.currentTabName === next.currentTabName &&
      prev.formulaHighlight?.raw === next.formulaHighlight?.raw
    );
  }
);

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
  initialCellRef,
  initialTabName,
}) => {
  const isPickerMode = mode === 'picker';
  const [activeTab, setActiveTab] = useState<'grid' | 'variables'>('grid');

  const modalContentRef = useRef<HTMLDivElement>(null);

  // Multi-Tab state resolution with local optimistic state for instant UI reaction
  const [localSpreadsheet, setLocalSpreadsheet] = useState<AttachedSpreadsheet>(() => ensureSpreadsheetTabs(rawSpreadsheet));
  useEffect(() => {
    setLocalSpreadsheet(ensureSpreadsheetTabs(rawSpreadsheet));
  }, [rawSpreadsheet]);
  const spreadsheet = localSpreadsheet;
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
  const formulaCacheRef = useRef<Map<string, number | string>>(new Map());
  const cellDisplayCacheRef = useRef<Map<string, { raw: string | number | undefined; display: string; isFormula: boolean }>>(new Map());
  // Active formula bar drafting state and confirmation ref
  const [isFormulaBarEditing, setIsFormulaBarEditing] = useState<boolean>(false);
  const confirmFormulaRef = useRef<((direction?: 'down' | 'up' | 'right' | 'left' | 'none') => void) | null>(null);

  // Active Formula Editing Mode (starts with '=')
  const isFormulaEditing = useMemo(() => {
    const isInlineFormula = inlineEditingCellRef !== null && inlineEditingValue.trim().startsWith('=');
    const isBarFormula = isFormulaBarEditing && editingValue.trim().startsWith('=');
    return isInlineFormula || isBarFormula;
  }, [inlineEditingCellRef, inlineEditingValue, isFormulaBarEditing, editingValue]);

  // Invalidate formula and cell display cache when cell values or active tab change
  useEffect(() => {
    formulaCacheRef.current.clear();
    cellDisplayCacheRef.current.clear();
  }, [currentCells, activeTabId]);

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

  const getContextMenuCoords = useCallback((e: React.MouseEvent) => {
    const rect = modalContentRef.current?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : e.clientX;
    const offsetY = rect ? e.clientY - rect.top : e.clientY;
    const maxX = (rect?.width || window.innerWidth) - 224;
    const maxY = (rect?.height || window.innerHeight) - 440;
    return {
      x: Math.max(8, Math.min(offsetX, maxX)),
      y: Math.max(8, Math.min(offsetY, maxY))
    };
  }, []);

  // Right-click Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    cellRef: string;
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // Spreadsheet Insert Dialog state (Shift cells right / down / Entire row / Entire col)
  const [isInsertDialogOpen, setIsInsertDialogOpen] = useState<boolean>(false);
  const [insertOption, setInsertOption] = useState<
    'shift_right' | 'shift_down' | 'entire_row_above' | 'entire_row_below' | 'entire_col_left' | 'entire_col_right' | 'entire_row' | 'entire_col'
  >('entire_row_above');

  // Spreadsheet Delete Dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [deleteOption, setDeleteOption] = useState<'shift_left' | 'shift_up' | 'entire_row' | 'entire_col'>('entire_row');

  // Cell copy/paste state for smart relative/absolute formula adjustment
  const [copiedCell, setCopiedCell] = useState<{
    ref: string;
    value: any;
    tabId: string;
  } | null>(null);

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

  // Update searchable text for browser find (Ctrl+F) debounced so it does not block modal open or rendering
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const lines = Object.entries(currentCells).map(([ref, val]) => {
        const formatted = formatCellValue(val);
        return `${ref}: ${formatted}`;
      });
      setSearchableText(lines.join('\n'));
    }, 1200);
    return () => clearTimeout(timer);
  }, [open, currentCells]);

  // Dismiss context menu on any click outside.
  // We defer registering the listener by one tick so the right-click event
  // that opened the menu doesn't immediately close it.
  useEffect(() => {
    if (!contextMenu?.open) return;
    const handleCloseContextMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const timerId = setTimeout(() => {
      window.addEventListener('click', handleCloseContextMenu);
      window.addEventListener('contextmenu', handleCloseContextMenu);
      window.addEventListener('keydown', handleKeyDown);
    }, 0);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('click', handleCloseContextMenu);
      window.removeEventListener('contextmenu', handleCloseContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu?.open]);

  // Spreadsheet Keyboard Shortcuts: Ctrl+Shift+= (Insert), Ctrl+- (Delete), Ctrl+Z (Undo), Ctrl+Y (Redo)
  // We use refs to avoid referencing handleUndo/handleRedo before they are declared.
  const undoHandlerRef = useRef<(() => void) | null>(null);
  const redoHandlerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const handleSpreadsheetShortcuts = (e: KeyboardEvent) => {
      if (editingColIdx !== null || isEditingWorkbookName || editingTabId !== null) return;
      if (e.key === 'Enter') {
        if (isFormulaEditing || inlineEditingCellRef) {
          e.preventDefault();
          confirmFormulaRef.current?.(e.shiftKey ? 'up' : 'down');
          return;
        }
      } else if (e.key === 'Tab') {
        if (isFormulaEditing || inlineEditingCellRef) {
          e.preventDefault();
          confirmFormulaRef.current?.(e.shiftKey ? 'left' : 'right');
          return;
        }
      }
      if (inlineEditingCellRef) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoHandlerRef.current?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoHandlerRef.current?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setInsertOption('entire_row_above');
        setIsInsertDialogOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setDeleteOption('entire_row');
        setIsDeleteDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleSpreadsheetShortcuts);
    return () => window.removeEventListener('keydown', handleSpreadsheetShortcuts);
  }, [inlineEditingCellRef, editingColIdx, isFormulaEditing, isEditingWorkbookName, editingTabId]);

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

  // Jump smoothly to a specific cell
  const scrollToCell = useCallback((cellRef: string) => {
    if (!scrollContainerRef.current) return;
    const parsed = parseCellRef(cellRef);
    if (!parsed) return;
    const targetY = Math.max(0, (parsed.rowIndex - 3) * ROW_HEIGHT);
    const targetX = Math.max(0, (parsed.colIndex - 2) * COL_WIDTH);
    scrollContainerRef.current.scrollTo({ top: targetY, left: targetX, behavior: 'smooth' });
  }, [ROW_HEIGHT, COL_WIDTH]);

  // Jump to initial tab and initial cell on modal open
  useEffect(() => {
    if (!open) return;

    if (initialTabName && spreadsheet.tabs && spreadsheet.tabs.length > 0) {
      const cleanTarget = initialTabName.trim().toLowerCase();
      const matchTab = spreadsheet.tabs.find(
        (t) => t.name.trim().toLowerCase() === cleanTarget || t.id.toLowerCase() === cleanTarget
      );
      if (matchTab && matchTab.id !== spreadsheet.activeTabId) {
        onUpdateSpreadsheet(switchActiveTab(spreadsheet, matchTab.id));
      }
    }

    if (initialCellRef && initialCellRef.trim()) {
      const cleanCell = initialCellRef.trim().toUpperCase();
      setSelectedCellRef(cleanCell);
      const val = currentCells[cleanCell];
      setEditingValue(val !== undefined && val !== null ? String(val) : '');
      const timer = setTimeout(() => {
        scrollToCell(cleanCell);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, initialCellRef, initialTabName]);

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

  // Only re-scan document variable tokens when open and the actual set of referenced cell tokens in blocks changes
  const tokensSignature = useMemo(() => {
    if (!open) return '';
    let sig = '';
    const regex = new RegExp(CELL_VARIABLE_REGEX);
    for (const b of blocks) {
      sig += b.id + ':';
      const scan = (str: string | undefined) => {
        if (!str || !str.includes('@')) return;
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(str)) !== null) {
          const tab = m[1] || m[2];
          const cell = m[3].toUpperCase();
          sig += (tab ? `${tab}!${cell}` : cell) + ',';
        }
      };
      if (b.type === 'paragraph' || b.type === 'heading') {
        scan(b.text);
      } else if (b.type === 'callout') {
        scan(b.content);
        scan(b.title);
      } else if (b.type === 'financial_table' && Array.isArray(b.rows)) {
        for (const r of b.rows) {
          if (Array.isArray(r.cells)) {
            for (const c of r.cells) {
              if (typeof c === 'string') scan(c);
            }
          }
        }
      }
      sig += ';';
    }
    return sig;
  }, [open, blocks]);

  // 1. Scan document for referenced variable tokens (only changes when tokensSignature changes)
  const usedVariableTokens = useMemo(() => {
    if (!open || !tokensSignature) return [];
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
      if (!text || typeof text !== 'string' || !text.includes('@')) return;
      const regex = new RegExp(CELL_VARIABLE_REGEX);
      regex.lastIndex = 0;
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
  }, [open, tokensSignature, blocks]);

  // Set of cell references used in document (fast lookup for green triangle corner)
  const usedCellSet = useMemo(() => {
    if (!open || usedVariableTokens.length === 0) return new Set<string>();
    const set = new Set<string>();
    for (const v of usedVariableTokens) {
      set.add(v.cellRef);
      set.add(v.cellRef.replace(/\$/g, ''));
    }
    return set;
  }, [open, usedVariableTokens]);

  // Full used variables with live values for the Variables tab (only calculated when Variables tab is active)
  const usedVariables = useMemo(() => {
    if (activeTab !== 'variables') return [];
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
  }, [activeTab, usedVariableTokens, safeSheet.tabs, safeSheet.cells, currentCells]);

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
  const handleSelectCell = (ref: string, cellsOverride?: Record<string, any>) => {
    setSelectedCellRef(ref);
    const cellsToUse = cellsOverride || currentCells;
    const val = cellsToUse[ref];
    setEditingValue(val !== undefined && val !== null ? String(val) : '');
    setIsFormulaBarEditing(false);
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
    advanceDirection: 'down' | 'up' | 'right' | 'left' | 'none' = 'none'
  ) => {
    pushHistory(spreadsheet); // snapshot before cell edit
    const cleanVal = rawVal.trim();
    let parsed: any = cleanVal;
    if (cleanVal !== '' && !cleanVal.startsWith('=') && !isNaN(Number(cleanVal))) {
      parsed = Number(cleanVal);
    }
    const cleanRef = ref.toUpperCase();
    const nextCells = { ...currentCells, [cleanRef]: parsed };
    const next = updateActiveTabCells(spreadsheet, nextCells);
    setLocalSpreadsheet(next);

    // Invalidate formula cache on cell edit
    formulaCacheRef.current.clear();
    cellDisplayCacheRef.current.clear();

    // Unified single update: updates the sheet AND synchronizes document blocks without duplicate saves
    let count = 0;
    if (onUpdateCell) {
      count = onUpdateCell(cleanRef, parsed, next);
    } else {
      onUpdateSpreadsheet(next);
    }

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
          handleSelectCell(nextRef, nextCells);
          scrollToRow(nextRow);
        } else if (advanceDirection === 'up') {
          const prevRow = Math.max(1, parsedRef.rowIndex - 1);
          const nextRef = `${parsedRef.colLetter}${prevRow}`;
          handleSelectCell(nextRef, nextCells);
          scrollToRow(prevRow);
        } else if (advanceDirection === 'right') {
          const nextCol = Math.min(totalCols, parsedRef.colIndex + 1);
          const nextRef = `${colToLetter(nextCol)}${parsedRef.rowIndex}`;
          handleSelectCell(nextRef, nextCells);
        } else if (advanceDirection === 'left') {
          const prevCol = Math.max(1, parsedRef.colIndex - 1);
          const nextRef = `${colToLetter(prevCol)}${parsedRef.rowIndex}`;
          handleSelectCell(nextRef, nextCells);
        }
      }
    } else {
      handleSelectCell(cleanRef, nextCells);
    }
  };

  // Clear value in selected cell
  const handleClearSelectedCell = () => {
    commitCellValue(selectedCellRef, '', 'none');
    setEditingValue('');
    toast.info(`Cleared cell ${selectedCellRef}`);
  };

  // Smart Copy cell
  const handleCopyCell = useCallback((targetRef = selectedCellRef) => {
    const rawVal = currentCells[targetRef];
    setCopiedCell({ ref: targetRef, value: rawVal, tabId: activeTabId });
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(rawVal !== undefined && rawVal !== null ? String(rawVal) : '');
    }
    toast.success(`Copied cell ${targetRef}`);
  }, [selectedCellRef, currentCells, activeTabId]);

  // Smart Paste cell with relative/absolute formula shifting
  const handlePasteCell = useCallback((targetRef = selectedCellRef) => {
    if (!copiedCell) {
      toast.info('No cell copied yet. Press Ctrl+C on a cell first.');
      return;
    }
    const smartValue = copyCellWithSmartOffset(copiedCell.ref, targetRef, copiedCell.value);
    commitCellValue(targetRef, smartValue !== undefined && smartValue !== null ? String(smartValue) : '', 'none');
    setEditingValue(smartValue !== undefined && smartValue !== null ? String(smartValue) : '');
    if (typeof copiedCell.value === 'string' && copiedCell.value.startsWith('=')) {
      toast.success(`Pasted formula into ${targetRef}: ${smartValue}`);
    } else {
      toast.success(`Pasted into ${targetRef}`);
    }
  }, [copiedCell, selectedCellRef, commitCellValue]);

  // Fill Down from cell above (Ctrl+D)
  const handleFillDown = useCallback(() => {
    const parsed = parseCellRef(selectedCellRef);
    if (!parsed || parsed.rowIndex <= 1) return;
    const sourceRef = `${parsed.colLetter}${parsed.rowIndex - 1}`;
    const sourceVal = currentCells[sourceRef];
    if (sourceVal === undefined) return;
    const smartVal = copyCellWithSmartOffset(sourceRef, selectedCellRef, sourceVal);
    commitCellValue(selectedCellRef, smartVal !== undefined && smartVal !== null ? String(smartVal) : '', 'down');
    toast.success(`Filled down from ${sourceRef} to ${selectedCellRef}`);
  }, [selectedCellRef, currentCells, commitCellValue]);

  // Fill Right from cell to left (Ctrl+R)
  const handleFillRight = useCallback(() => {
    const parsed = parseCellRef(selectedCellRef);
    if (!parsed || parsed.colIndex <= 1) return;
    const sourceRef = `${colToLetter(parsed.colIndex - 1)}${parsed.rowIndex}`;
    const sourceVal = currentCells[sourceRef];
    if (sourceVal === undefined) return;
    const smartVal = copyCellWithSmartOffset(sourceRef, selectedCellRef, sourceVal);
    commitCellValue(selectedCellRef, smartVal !== undefined && smartVal !== null ? String(smartVal) : '', 'right');
    toast.success(`Filled right from ${sourceRef} to ${selectedCellRef}`);
  }, [selectedCellRef, currentCells, commitCellValue]);

  // Autofill down to next row on double click fill handle
  const handleAutofillDown = useCallback(() => {
    const parsed = parseCellRef(selectedCellRef);
    if (!parsed || parsed.rowIndex >= totalRows) return;
    const targetRef = `${parsed.colLetter}${parsed.rowIndex + 1}`;
    const sourceVal = currentCells[selectedCellRef];
    const smartVal = copyCellWithSmartOffset(selectedCellRef, targetRef, sourceVal);
    commitCellValue(targetRef, smartVal !== undefined && smartVal !== null ? String(smartVal) : '', 'none');
    handleSelectCell(targetRef);
    toast.success(`Autofilled to ${targetRef}: ${smartVal}`);
  }, [selectedCellRef, totalRows, currentCells, commitCellValue, handleSelectCell]);

  // Helper to apply spreadsheet changes and synchronize all linked document cell references
  const applySpreadsheetShift = (
    nextSpreadsheet: AttachedSpreadsheet,
    op: CellShiftOperation,
    successMessage: string,
    targetCellRefToSelect?: string
  ) => {
    pushHistory(spreadsheet); // snapshot before change
    formulaCacheRef.current.clear();
    cellDisplayCacheRef.current.clear();

    const { updatedBlocks, shiftedCount } = shiftBlocksCellReferences(
      blocks,
      op,
      currentTab?.name,
      nextSpreadsheet
    );

    // Track or select the target cell through the shift
    if (targetCellRefToSelect) {
      setSelectedCellRef(targetCellRefToSelect);
      const activeTabObj = (nextSpreadsheet.tabs || []).find((t) => t.id === nextSpreadsheet.activeTabId) || nextSpreadsheet.tabs?.[0];
      const newRaw = activeTabObj?.cells?.[targetCellRefToSelect] ?? nextSpreadsheet.cells?.[targetCellRefToSelect];
      setEditingValue(newRaw !== undefined && newRaw !== null ? String(newRaw) : '');
    } else if (parsedSelected) {
      const shifted = shiftSingleCellRef(parsedSelected.colIndex, parsedSelected.rowIndex, op);
      const activeTabObj = (nextSpreadsheet.tabs || []).find((t) => t.id === nextSpreadsheet.activeTabId) || nextSpreadsheet.tabs?.[0];
      const validRef = shifted !== '#REF!' ? shifted : 'A1';
      setSelectedCellRef(validRef);
      const newRaw = activeTabObj?.cells?.[validRef] ?? nextSpreadsheet.cells?.[validRef];
      setEditingValue(newRaw !== undefined && newRaw !== null ? String(newRaw) : '');
    }

    setLocalSpreadsheet(nextSpreadsheet);
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
  //   =PRODUCT, =POWER, =MOD, =MEDIAN, =IF, =ROUND, arithmetic, cell refs,
  //   absolute references like $A$1, ranges like A1:A5 or $A$1:$B$5, cross-tab refs)
  // -----------------------------------------------------------------------
  const evaluateFormula = useCallback((formula: string, depth = 0): string | number => {
    if (!formula.startsWith('=')) return formula;
    if (depth > 30) return '#CYCLE!';
    const cached = formulaCacheRef.current.get(formula);
    if (cached !== undefined) return cached;

    const expr = formula.slice(1).trim();
    const cells = currentCells;

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

      let targetCells = cells;
      if (tabName && spreadsheet.tabs) {
        const foundTab = spreadsheet.tabs.find(
          (t) => t.name.trim().toLowerCase() === tabName!.trim().toLowerCase()
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
          const sub = evaluateFormula(v, depth + 1);
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

      const m = cleanRange.match(/^(\$?)([A-Z]+)(\$?)([0-9]+):(\$?)([A-Z]+)(\$?)([0-9]+)$/i);
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
      // Cell reference (with optional sheet and optional $)
      if (/^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+$/i.test(e)) return resolveCell(e);
      // Range (returns first value — use inside function args)
      if (/^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(e)) return expandRange(e)[0] ?? 0;
      // Function call
      const fnMatch = e.match(/^([A-Z_]+)\((.*)\)$/i);
      if (fnMatch) {
        const fn = fnMatch[1].toUpperCase();
        const innerArgs = splitArgs(fnMatch[2]);
        const numArgs = innerArgs.flatMap(a => /^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(a.trim()) ? expandRange(a.trim()) : [Number(evalExpr(a))]);
        switch (fn) {
          case 'SUM':     return numArgs.reduce((s, v) => s + v, 0);
          case 'AVERAGE': return numArgs.length ? numArgs.reduce((s, v) => s + v, 0) / numArgs.length : 0;
          case 'MIN':     return numArgs.length ? Math.min(...numArgs) : 0;
          case 'MAX':     return numArgs.length ? Math.max(...numArgs) : 0;
          case 'PRODUCT': return numArgs.length ? numArgs.reduce((s, v) => s * v, 1) : 0;
          case 'COUNT':   return numArgs.filter(v => !isNaN(v)).length;
          case 'COUNTA':  return innerArgs.flatMap(a => /^(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Z]+\$?[0-9]+:\$?[A-Z]+\$?[0-9]+$/i.test(a.trim()) ? expandRange(a.trim()) : [evalExpr(a)]).filter(v => v !== '' && v !== 0).length;
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
          case 'CONCATENATE': return innerArgs.map(a => String(evalExpr(a))).join('');
          default: return `#NAME?`;
        }
      }
      // Arithmetic: replace all cell refs (including $, and tab! refs)
      let withRefs = e.replace(/(?:(?:'[^']+'|[A-Za-z0-9_.\- ]+?)!)?\$?[A-Za-z]+\$?[0-9]+/gi, (match) => String(resolveCell(match)));
      // Percentage support like 15% -> (15/100)
      withRefs = withRefs.replace(/([0-9.]+)\s*%/g, '($1/100)');
      // Power / Exponentiation support like 2^3 -> 2**3
      withRefs = withRefs.replace(/\^/g, '**');

      try {
        if (/^[0-9+\-*/().\s*]+$/.test(withRefs)) {
          // eslint-disable-next-line no-new-func
          return Function(`"use strict"; return (${withRefs})`)() as number;
        }
      } catch { /**/ }
      return `#ERROR`;
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
      formulaCacheRef.current.set(formula, finalResult);
      return finalResult;
    } catch {
      formulaCacheRef.current.set(formula, '#ERROR');
      return '#ERROR';
    }
  }, [currentCells, spreadsheet.tabs]);

  // Resolve displayed value for a cell — evaluates formulas on the fly with display caching
  const resolveCellDisplay = useCallback((cellRef: string): { raw: string | number | undefined; display: string; isFormula: boolean } => {
    const cached = cellDisplayCacheRef.current.get(cellRef);
    if (cached !== undefined) return cached;

    const rawAny = currentCells[cellRef];
    if (rawAny === undefined || rawAny === null) {
      const emptyRes = { raw: undefined, display: '', isFormula: false };
      cellDisplayCacheRef.current.set(cellRef, emptyRes);
      return emptyRes;
    }
    const raw = (typeof rawAny === 'boolean' ? (rawAny ? 1 : 0) : rawAny) as string | number;
    const strVal = String(rawAny);
    if (strVal.startsWith('=')) {
      const result = evaluateFormula(strVal);
      const formulaRes = { raw, display: String(result), isFormula: true };
      cellDisplayCacheRef.current.set(cellRef, formulaRes);
      return formulaRes;
    }
    const valRes = { raw, display: formatCellValue(rawAny), isFormula: false };
    cellDisplayCacheRef.current.set(cellRef, valRes);
    return valRes;
  }, [currentCells, evaluateFormula]);

  // Reference to formula bar input for focus and selection preservation
  const formulaBarInputRef = useRef<HTMLInputElement>(null);


  // Confirm and commit formula (Enter key like Excel)
  const handleConfirmFormula = useCallback(
    (direction: 'down' | 'up' | 'right' | 'left' | 'none' = 'down') => {
      const targetRef = inlineEditingCellRef || selectedCellRef;
      const formulaVal = inlineEditingCellRef !== null ? inlineEditingValue : editingValue;

      // Clean dangling trailing operator if user typed e.g. "=A1+"
      let cleanFormula = formulaVal.trim();
      if (cleanFormula.startsWith('=')) {
        if (cleanFormula === '=') {
          cleanFormula = '';
        } else {
          // Remove trailing binary operator +, -, *, /, or comma before confirmation
          cleanFormula = cleanFormula.replace(new RegExp('[-+*/,]\\s*$'), '').trim();
        }
      }

      commitCellValue(targetRef, cleanFormula, direction);
      setInlineEditingCellRef(null);
      setIsFormulaBarEditing(false);
      formulaBarInputRef.current?.blur();
      setTimeout(() => {
        scrollContainerRef.current?.focus();
      }, 20);

      const evaluated = cleanFormula.startsWith('=') ? evaluateFormula(cleanFormula) : cleanFormula;
      toast.success(`Confirmed ${targetRef} = ${evaluated}`);
    },
    [inlineEditingCellRef, selectedCellRef, inlineEditingValue, editingValue, commitCellValue, evaluateFormula]
  );

  confirmFormulaRef.current = handleConfirmFormula;

  // Save edited cell value from Formula Bar
  const handleSaveCell = () => {
    if (isFormulaEditing) {
      handleConfirmFormula('down');
    } else {
      commitCellValue(selectedCellRef, editingValue, 'down');
      setIsFormulaBarEditing(false);
      formulaBarInputRef.current?.blur();
      setTimeout(() => {
        scrollContainerRef.current?.focus();
      }, 20);
      toast.success(
        `Saved ${currentTab?.name}!${selectedCellRef} = ${editingValue}`
      );
    }
  };

  const activeFormula = inlineEditingCellRef !== null ? inlineEditingValue : editingValue;

  // Extract all referenced cells in the formula for colored visual highlights in the grid
  const activeFormulaRefs = useMemo(
    () => extractCellReferencesFromFormula(activeFormula),
    [activeFormula]
  );

  // Map of clean cell coordinates -> visual color styles
  const formulaHighlightMap = useMemo(() => {
    const map = new Map<string, FormulaCellReference>();
    if (!isFormulaEditing) return map;
    for (const ref of activeFormulaRefs) {
      if (!ref.sheetName || ref.sheetName.toLowerCase() === (currentTab?.name || '').toLowerCase()) {
        map.set(ref.cleanRef, ref);
      }
    }
    return map;
  }, [activeFormulaRefs, isFormulaEditing, currentTab?.name]);

  // Live evaluation preview as formula is being composed
  const liveFormulaPreview = useMemo(() => {
    if (!activeFormula.startsWith('=')) return null;
    if (activeFormula.trim() === '=') return null;
    try {
      const res = evaluateFormula(activeFormula);
      return String(res);
    } catch {
      return '#ERROR';
    }
  }, [activeFormula, evaluateFormula]);

  // Excel Click-to-Reference: Clicking any cell in the grid while formula editing
  const handleCellReferenceClick = useCallback((clickedRef: string) => {
    if (clickedRef === selectedCellRef) {
      return; // Don't self-reference
    }

    const curFormula = inlineEditingCellRef !== null ? inlineEditingValue : editingValue;
    const inputEl = inlineEditingCellRef !== null ? inlineInputRef.current : formulaBarInputRef.current;
    const cursorPos = inputEl?.selectionStart ?? curFormula.length;

    const { newFormula, newCursorPos } = insertOrReplaceCellInFormula(
      curFormula,
      clickedRef,
      currentTab?.name,
      currentTab?.name,
      cursorPos
    );

    setEditingValue(newFormula);
    if (inlineEditingCellRef !== null) {
      setInlineEditingValue(newFormula);
    } else {
      setIsFormulaBarEditing(true);
    }

    setTimeout(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  }, [selectedCellRef, inlineEditingCellRef, inlineEditingValue, editingValue, currentTab?.name]);

  // Excel F4 Cycle: Toggles A1 -> $A$1 -> A$1 -> $A1 -> A1
  const handleCycleAbsolute = useCallback(() => {
    const curFormula = inlineEditingCellRef !== null ? inlineEditingValue : editingValue;
    if (!curFormula.startsWith('=')) return;

    const inputEl = inlineEditingCellRef !== null ? inlineInputRef.current : formulaBarInputRef.current;
    const cursorPos = inputEl?.selectionStart ?? curFormula.length;

    const { newFormula, newCursorPos } = cycleCellRefAbsolute(curFormula, cursorPos);

    setEditingValue(newFormula);
    if (inlineEditingCellRef !== null) {
      setInlineEditingValue(newFormula);
    } else {
      setIsFormulaBarEditing(true);
    }

    setTimeout(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  }, [inlineEditingCellRef, inlineEditingValue, editingValue]);

  // Append operator or function template to formula
  const handleAppendOperator = useCallback((token: string) => {
    let cur = inlineEditingCellRef !== null ? inlineEditingValue : editingValue;
    if (!cur.startsWith('=')) {
      cur = '=' + cur;
    }

    const inputEl = inlineEditingCellRef !== null ? inlineInputRef.current : formulaBarInputRef.current;
    const cursorPos = inputEl?.selectionStart ?? cur.length;

    const isFn = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'IF'].includes(token);
    const insertion = isFn ? `${token}(` : ` ${token} `;

    const before = cur.slice(0, cursorPos);
    const after = cur.slice(cursorPos);
    const next = before + insertion + after;
    const nextPos = cursorPos + insertion.length;

    setEditingValue(next);
    if (inlineEditingCellRef !== null) {
      setInlineEditingValue(next);
    } else {
      setIsFormulaBarEditing(true);
    }

    setTimeout(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  }, [inlineEditingCellRef, inlineEditingValue, editingValue]);

  // Contextual Row Insert / Delete
  const handleInsertRowAbove = (overrideRow?: number | unknown) => {
    const targetRow = typeof overrideRow === 'number' ? overrideRow : selectedRow;
    const next = insertRowAtIndex(spreadsheet, targetRow, 'above');
    const op: CellShiftOperation = { type: 'insert_row', targetRow };
    applySpreadsheetShift(
      next,
      op,
      `Inserted blank row above row ${targetRow}`,
      `${selectedColLetter}${targetRow}`
    );
  };

  const handleInsertRowBelow = (overrideRow?: number | unknown) => {
    const targetRow = typeof overrideRow === 'number' ? overrideRow : selectedRow;
    const next = insertRowAtIndex(spreadsheet, targetRow, 'below');
    const op: CellShiftOperation = { type: 'insert_row', targetRow: targetRow + 1 };
    applySpreadsheetShift(
      next,
      op,
      `Inserted blank row below row ${targetRow}`,
      `${selectedColLetter}${targetRow + 1}`
    );
  };

  const handleDeleteSelectedRow = (overrideRow?: number | unknown) => {
    const targetRow = typeof overrideRow === 'number' ? overrideRow : selectedRow;
    if (totalRows <= 1) {
      toast.error('Cannot delete the last row in tab');
      return;
    }
    const next = deleteRowAtIndex(spreadsheet, targetRow);
    const op: CellShiftOperation = { type: 'delete_row', targetRow };
    const nextRow = Math.min(next.rowCount, targetRow);
    applySpreadsheetShift(
      next,
      op,
      `Deleted row ${targetRow} (Total: ${next.rowCount})`,
      `${selectedColLetter}${nextRow}`
    );
  };

  // Contextual Column Insert / Delete
  const handleInsertColLeft = (overrideCol?: number | unknown) => {
    const targetCol = typeof overrideCol === 'number' ? overrideCol : selectedCol;
    const next = insertColAtIndex(spreadsheet, targetCol, 'left');
    const op: CellShiftOperation = { type: 'insert_col', targetCol };
    applySpreadsheetShift(
      next,
      op,
      `Inserted blank column left of column ${colToLetter(targetCol)}`,
      `${colToLetter(targetCol)}${selectedRow}`
    );
  };

  const handleInsertColRight = (overrideCol?: number | unknown) => {
    const targetCol = typeof overrideCol === 'number' ? overrideCol : selectedCol;
    const next = insertColAtIndex(spreadsheet, targetCol, 'right');
    const op: CellShiftOperation = { type: 'insert_col', targetCol: targetCol + 1 };
    applySpreadsheetShift(
      next,
      op,
      `Inserted blank column right of column ${colToLetter(targetCol)}`,
      `${colToLetter(targetCol + 1)}${selectedRow}`
    );
  };

  const handleDeleteSelectedCol = (overrideCol?: number | unknown) => {
    const targetCol = typeof overrideCol === 'number' ? overrideCol : selectedCol;
    if (totalCols <= 1) {
      toast.error('Cannot delete the last column in tab');
      return;
    }
    const next = deleteColAtIndex(spreadsheet, targetCol);
    const op: CellShiftOperation = { type: 'delete_col', targetCol };
    const nextCol = Math.min(next.colCount, targetCol);
    applySpreadsheetShift(
      next,
      op,
      `Deleted column ${colToLetter(targetCol)} (Total: ${next.colCount})`,
      `${colToLetter(nextCol)}${selectedRow}`
    );
  };

  // Spreadsheet Dialog Execution Handlers
  const handleExecuteInsert = (
    option:
      | 'shift_right'
      | 'shift_down'
      | 'entire_row_above'
      | 'entire_row_below'
      | 'entire_col_left'
      | 'entire_col_right'
      | 'entire_row'
      | 'entire_col',
    targetColOverride?: number,
    targetRowOverride?: number
  ) => {
    const parsed = parseCellRef(selectedCellRef);
    const targetCol = targetColOverride !== undefined ? targetColOverride : (parsed?.colIndex || 1);
    const targetRow = targetRowOverride !== undefined ? targetRowOverride : (parsed?.rowIndex || 1);

    let next: AttachedSpreadsheet;
    let op: CellShiftOperation;
    let msg: string;
    let targetSelect: string;

    if (option === 'shift_right') {
      next = shiftCellsRight(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_right', targetCol, targetRow };
      msg = `Shifted cells right at column ${colToLetter(targetCol)} row ${targetRow}`;
      targetSelect = `${colToLetter(targetCol)}${targetRow}`;
    } else if (option === 'shift_down') {
      next = shiftCellsDown(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_down', targetCol, targetRow };
      msg = `Shifted cells down at column ${colToLetter(targetCol)} row ${targetRow}`;
      targetSelect = `${colToLetter(targetCol)}${targetRow}`;
    } else if (option === 'entire_row_below') {
      next = insertRowAtIndex(spreadsheet, targetRow, 'below');
      op = { type: 'insert_row', targetRow: targetRow + 1 };
      msg = `Inserted blank row below row ${targetRow}`;
      targetSelect = `${colToLetter(targetCol)}${targetRow + 1}`;
    } else if (option === 'entire_row' || option === 'entire_row_above') {
      next = insertRowAtIndex(spreadsheet, targetRow, 'above');
      op = { type: 'insert_row', targetRow };
      msg = `Inserted blank row above row ${targetRow}`;
      targetSelect = `${colToLetter(targetCol)}${targetRow}`;
    } else if (option === 'entire_col_right') {
      next = insertColAtIndex(spreadsheet, targetCol, 'right');
      op = { type: 'insert_col', targetCol: targetCol + 1 };
      msg = `Inserted blank column right of column ${colToLetter(targetCol)}`;
      targetSelect = `${colToLetter(targetCol + 1)}${targetRow}`;
    } else {
      next = insertColAtIndex(spreadsheet, targetCol, 'left');
      op = { type: 'insert_col', targetCol };
      msg = `Inserted blank column left of column ${colToLetter(targetCol)}`;
      targetSelect = `${colToLetter(targetCol)}${targetRow}`;
    }

    applySpreadsheetShift(next, op, msg, targetSelect);
    setIsInsertDialogOpen(false);
  };

  const handleExecuteDelete = (
    option: 'shift_left' | 'shift_up' | 'entire_row' | 'entire_col',
    targetColOverride?: number,
    targetRowOverride?: number
  ) => {
    const parsed = parseCellRef(selectedCellRef);
    const targetCol = targetColOverride !== undefined ? targetColOverride : (parsed?.colIndex || 1);
    const targetRow = targetRowOverride !== undefined ? targetRowOverride : (parsed?.rowIndex || 1);

    let next: AttachedSpreadsheet;
    let op: CellShiftOperation;
    let msg: string;

    if (option === 'shift_left') {
      next = shiftCellsLeft(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_left', targetCol, targetRow };
      msg = `Shifted cells left at column ${colToLetter(targetCol)} row ${targetRow}`;
    } else if (option === 'shift_up') {
      next = shiftCellsUp(spreadsheet, targetCol, targetRow);
      op = { type: 'shift_up', targetCol, targetRow };
      msg = `Shifted cells up at column ${colToLetter(targetCol)} row ${targetRow}`;
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
    if (isEditingWorkbookName || editingTabId !== null || editingColIdx !== null) return;

    if (e.key === 'Enter') {
      if (isFormulaEditing || inlineEditingCellRef) {
        e.preventDefault();
        handleConfirmFormula(e.shiftKey ? 'up' : 'down');
        return;
      }
    } else if (e.key === 'Tab') {
      if (isFormulaEditing || inlineEditingCellRef) {
        e.preventDefault();
        handleConfirmFormula(e.shiftKey ? 'left' : 'right');
        return;
      }
    }

    if (inlineEditingCellRef) return; // Allow input to handle keys when editing

    const parsed = parseCellRef(selectedCellRef);
    if (!parsed) return;

    if (e.key === 'F4') {
      e.preventDefault();
      handleCycleAbsolute();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      setInsertOption('entire_row_above');
      setIsInsertDialogOpen(true);
      return;
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      setDeleteOption('entire_row');
      setIsDeleteDialogOpen(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      handleCopyCell();
      return;
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      if (copiedCell) {
        e.preventDefault();
        handlePasteCell();
        return;
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      handleFillDown();
      return;
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      handleFillRight();
      return;
    } else if (e.key === 'ArrowUp') {
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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const delta = e.shiftKey ? -1 : 1;
      const nextCol = Math.max(1, Math.min(totalCols, parsed.colIndex + delta));
      const nextRef = `${colToLetter(nextCol)}${parsed.rowIndex}`;
      handleSelectCell(nextRef);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isFormulaEditing) {
        handleConfirmFormula(e.shiftKey ? 'up' : 'down');
      } else {
        handleStartInlineEdit(selectedCellRef);
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      handleStartInlineEdit(selectedCellRef);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleClearSelectedCell();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into active cell
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

  // Upload spreadsheet file handler
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

  // Export current spreadsheet (.xlsx)
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

  const visibleRows = useMemo(() => {
    const list: number[] = [];
    for (let r = startRowIndex + 1; r <= endRowIndex; r++) {
      list.push(r);
    }
    return list;
  }, [startRowIndex, endRowIndex]);

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

  const cleanSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Display human-readable range (1-indexed) currently in the viewport
  const firstVisibleRow = Math.min(totalRows, Math.max(1, Math.floor(scrollTop / ROW_HEIGHT) + 1));
  const lastVisibleRow = Math.min(
    totalRows,
    Math.max(firstVisibleRow, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT))
  );

  const selectedVal = currentCells[selectedCellRef];
  const { display: selectedFormatted, isFormula: selectedIsFormula } = resolveCellDisplay(selectedCellRef);
  // Formula bar shows raw formula (e.g. =SUM(A1:A5)); other bars show the resolved value

  const handleInlineChange = useCallback((val: string) => {
    setInlineEditingValue(val);
    setEditingValue(val);
  }, []);

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent, cellRef: string) => {
      if (e.key === 'F4') {
        e.preventDefault();
        handleCycleAbsolute();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inlineEditingValue.trim().startsWith('=')) {
          handleConfirmFormula(e.shiftKey ? 'up' : 'down');
        } else {
          commitCellValue(cellRef, inlineEditingValue, e.shiftKey ? 'up' : 'down');
          setInlineEditingCellRef(null);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (inlineEditingValue.trim().startsWith('=')) {
          handleConfirmFormula(e.shiftKey ? 'left' : 'right');
        } else {
          commitCellValue(cellRef, inlineEditingValue, e.shiftKey ? 'left' : 'right');
          setInlineEditingCellRef(null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setInlineEditingCellRef(null);
        setIsFormulaBarEditing(false);
        const val = currentCells[cellRef];
        setEditingValue(val !== undefined && val !== null ? String(val) : '');
        scrollContainerRef.current?.focus();
      }
    },
    [inlineEditingValue, currentCells, handleCycleAbsolute, commitCellValue, handleConfirmFormula]
  );

  const handleInlineBlur = useCallback(
    (cellRef: string) => {
      // If user is actively typing a formula and clicking around cells to add references, don't dismiss inline input
      if (inlineEditingValue.startsWith('=')) {
        return;
      }
      commitCellValue(cellRef, inlineEditingValue, 'none');
      setInlineEditingCellRef(null);
    },
    [inlineEditingValue, commitCellValue]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={modalContentRef} className="relative w-[96vw] max-w-[96vw] sm:max-w-[96vw] xl:max-w-[1440px] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 shadow-2xl">
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

            {/* Upload Spreadsheet Button */}
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

            {/* Export Spreadsheet Button */}
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

            {/* Spreadsheet Insert Dialog Trigger */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInsertOption('entire_row_above');
                setIsInsertDialogOpen(true);
              }}
              className="h-7 text-[11px] gap-1 bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer font-medium"
              title="Insert cells, row, or column (Right-click cell or Ctrl+Shift+=)"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Insert...</span>
            </Button>

            {/* Contextual Row Operations (Direct Above/Below Insertion) */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs">
              <span className="text-[10px] font-mono font-semibold px-1 text-slate-500 flex items-center gap-0.5" title={`Selected Row ${selectedRow}`}>
                <Rows className="w-3 h-3 text-emerald-600" />
                R{selectedRow}:
              </span>
              <button
                type="button"
                onClick={handleInsertRowAbove}
                className="px-1.5 py-0.5 text-[10px] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold rounded cursor-pointer transition-colors"
                title={`Insert blank row above row ${selectedRow}`}
              >
                +Above
              </button>
              <button
                type="button"
                onClick={handleInsertRowBelow}
                className="px-1.5 py-0.5 text-[10px] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold rounded cursor-pointer transition-colors"
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

            {/* Contextual Column Operations (Direct Left/Right Insertion) */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs">
              <span className="text-[10px] font-mono font-semibold px-1 text-slate-500 flex items-center gap-0.5" title={`Selected Column ${selectedColLetter}`}>
                <Columns className="w-3 h-3 text-blue-600" />
                Col {selectedColLetter}:
              </span>
              <button
                type="button"
                onClick={handleInsertColLeft}
                className="px-1.5 py-0.5 text-[10px] hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold rounded cursor-pointer transition-colors"
                title={`Insert blank column left of column ${selectedColLetter}`}
              >
                +Left
              </button>
              <button
                type="button"
                onClick={handleInsertColRight}
                className="px-1.5 py-0.5 text-[10px] hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold rounded cursor-pointer transition-colors"
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

            {/* Append / Trim Rows & Columns at Sheet Boundary */}
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-md border border-slate-300 dark:border-zinc-700 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleAddRow(1)}
                title="Append 1 row to the bottom of active tab"
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[10px] text-slate-700 dark:text-zinc-300 rounded font-medium cursor-pointer"
              >
                +End Row
              </button>
              <button
                type="button"
                onClick={() => handleAddRow(5)}
                title="Append 5 rows to the bottom of active tab"
                className="px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[9px] text-slate-500 font-mono rounded cursor-pointer"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => handleRemoveRow(1)}
                title="Remove 1 row from bottom of active tab"
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-red-600 rounded cursor-pointer"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={() => handleAddColumn(1)}
                title="Append 1 column to the right of active tab"
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[10px] text-slate-700 dark:text-zinc-300 rounded font-medium cursor-pointer"
              >
                +End Col
              </button>
              <button
                type="button"
                onClick={() => handleRemoveColumn(1)}
                title="Remove 1 column from right of active tab"
                className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-red-600 rounded cursor-pointer"
              >
                <Minus className="w-2.5 h-2.5" />
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
            <div className="flex items-center gap-1.5 flex-1 min-w-[280px] max-w-2xl flex-wrap sm:flex-nowrap">
              {/* fx button: click to toggle '=' formula mode */}
              <button
                type="button"
                onClick={() => {
                  setIsFormulaBarEditing(true);
                  if (!editingValue.startsWith('=')) {
                    const next = '=' + editingValue;
                    setEditingValue(next);
                  }
                  formulaBarInputRef.current?.focus();
                }}
                className={`w-6 h-7 rounded text-xs font-mono font-bold flex items-center justify-center cursor-pointer transition-colors ${
                  isFormulaEditing
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700'
                }`}
                title="Formula mode (=). Type or click cells to add references."
              >
                fx
              </button>

              <div className="relative flex-1 min-w-[180px]">
                <Input
                  ref={formulaBarInputRef}
                  value={editingValue}
                  onFocus={() => {
                    if (editingValue.trim().startsWith('=')) {
                      setIsFormulaBarEditing(true);
                    }
                  }}
                  onChange={(e) => {
                    setEditingValue(e.target.value);
                    if (e.target.value.trim().startsWith('=')) {
                      setIsFormulaBarEditing(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmFormula(e.shiftKey ? 'up' : 'down');
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      handleConfirmFormula(e.shiftKey ? 'left' : 'right');
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      const orig = currentCells[selectedCellRef];
                      setEditingValue(orig !== undefined && orig !== null ? String(orig) : '');
                      setIsFormulaBarEditing(false);
                      if (inlineEditingCellRef) setInlineEditingCellRef(null);
                      formulaBarInputRef.current?.blur();
                      scrollContainerRef.current?.focus();
                    } else if (e.key === 'F4') {
                      e.preventDefault();
                      handleCycleAbsolute();
                    }
                  }}
                  placeholder="Value or formula (e.g. 500, =A1+B1, =SUM(A1:A5))..."
                  className={`h-7 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 font-mono pr-20 ${
                    isFormulaEditing
                      ? 'ring-1 ring-violet-500 border-violet-500 text-violet-950 dark:text-violet-100 font-bold'
                      : selectedIsFormula
                      ? 'text-violet-700 dark:text-violet-300'
                      : ''
                  }`}
                />
                {/* Live calculation preview badge */}
                {liveFormulaPreview !== null && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        liveFormulaPreview === '#ERROR' || liveFormulaPreview === '#DIV/0!'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      = {liveFormulaPreview}
                    </span>
                  </div>
                )}
              </div>

              {/* Commit / Cancel Buttons */}
              {isFormulaEditing ? (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleConfirmFormula('down')}
                    title="Confirm formula (Enter)"
                    className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-bold shadow-xs gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enter</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const orig = currentCells[selectedCellRef];
                      setEditingValue(orig !== undefined && orig !== null ? String(orig) : '');
                      setIsFormulaBarEditing(false);
                      if (inlineEditingCellRef) setInlineEditingCellRef(null);
                      formulaBarInputRef.current?.blur();
                      scrollContainerRef.current?.focus();
                    }}
                    title="Cancel formula (Esc)"
                    className="h-7 px-1.5 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCell}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 font-medium"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </Button>
              )}

              {/* Quick Formula Tools: Operators, F4 Absolute, Functions */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={handleCycleAbsolute}
                  title="Cycle Absolute Reference ($A$1 -> A$1 -> $A1 -> A1). Shortcut: F4"
                  className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 rounded border border-violet-200 dark:border-violet-800 cursor-pointer transition-colors"
                >
                  $ (F4)
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => handleAppendOperator('+')}
                  title="Add (+)"
                  className="w-5 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('-')}
                  title="Subtract (-)"
                  className="w-5 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('*')}
                  title="Multiply (*)"
                  className="w-5 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('/')}
                  title="Divide (/)"
                  className="w-5 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  ÷
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('(')}
                  title="Open Parenthesis ("
                  className="w-4 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  (
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator(')')}
                  title="Close Parenthesis )"
                  className="w-4 h-5 flex items-center justify-center text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  )
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => handleAppendOperator('SUM')}
                  title="Insert =SUM(...)"
                  className="px-1 py-0.5 text-[9px] font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  SUM
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('AVERAGE')}
                  title="Insert =AVERAGE(...)"
                  className="px-1 py-0.5 text-[9px] font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  AVG
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendOperator('IF')}
                  title="Insert =IF(...)"
                  className="px-1 py-0.5 text-[9px] font-mono font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-purple-600 dark:text-purple-400 cursor-pointer"
                >
                  IF
                </button>
              </div>
            </div>

            {/* Active Formula References Colored Tokens */}
            {activeFormulaRefs.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-mono">Refs:</span>
                {activeFormulaRefs.map((r, i) => (
                  <span
                    key={i}
                    style={{ borderColor: r.color }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${r.bgClass} ${r.textClass}`}
                  >
                    {r.sheetName ? `${r.sheetName}!` : ''}{r.raw}
                  </span>
                ))}
              </div>
            )}

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

            {/* Smart Copy & Autofill Operations */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleCopyCell()}
                className="px-2 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer flex items-center gap-1"
                title="Copy cell value or formula (Ctrl+C)"
              >
                <Copy className="w-2.5 h-2.5 text-blue-600" />
                <span>Copy</span>
              </button>
              <button
                type="button"
                disabled={!copiedCell}
                onClick={() => handlePasteCell()}
                className="px-2 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                title={copiedCell ? `Paste from ${copiedCell.ref} with smart formula adjustment (Ctrl+V)` : 'Copy a cell first'}
              >
                <span>Paste</span>
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={handleFillDown}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title="Fill down from row above with formula adjustment (Ctrl+D)"
              >
                Fill ↓
              </button>
              <button
                type="button"
                onClick={handleFillRight}
                className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                title="Fill right from column to left with formula adjustment (Ctrl+R)"
              >
                Fill →
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
                  size="sm"
                  onClick={handleConfirmInsert}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-sm cursor-pointer"
                  title="Link selected cell into document"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>
                    Link{' '}
                    {createCellVariableToken(
                      selectedCellRef,
                      undefined,
                      currentTab?.name,
                      isMultiTab
                    )}{' '}
                    to Document
                  </span>
                </Button>
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
                      {visibleColLetters.map((col) => {
                        const isColActive = selectedColLetter === col;
                        return (
                          <th
                            key={col}
                            onClick={() => {
                              const newRef = `${col}${selectedRow || 1}`;
                              handleSelectCell(newRef);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newRef = `${col}${selectedRow || 1}`;
                              handleSelectCell(newRef);
                              const parsed = parseCellRef(newRef);
                              const coords = getContextMenuCoords(e);
                              setContextMenu({
                                open: true,
                                x: coords.x,
                                y: coords.y,
                                cellRef: newRef,
                                rowIndex: selectedRow || 1,
                                colIndex: parsed?.colIndex || 1
                              });
                            }}
                            className={`w-32 min-w-[128px] max-w-[128px] h-7 px-2 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[11px] cursor-pointer transition-colors ${
                              isColActive
                                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                                : 'text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800'
                            }`}
                            title={`Column ${col}. Click to select column.`}
                          >
                            {col}
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
                    onMouseDown={(e) => {
                      if (isFormulaEditing) {
                        const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                        if (td && td.dataset.cellRef) {
                          // Prevent blurring the formula input or resetting selection range when clicking cells
                          e.preventDefault();
                        }
                      }
                    }}
                    onClick={(e) => {
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        const clickedRef = td.dataset.cellRef;
                        if (isFormulaEditing) {
                          handleCellReferenceClick(clickedRef);
                        } else {
                          handleSelectCell(clickedRef);
                        }
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (isFormulaEditing) return;
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        handleCellDoubleClick(td.dataset.cellRef);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const td = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-cell-ref]');
                      if (td && td.dataset.cellRef) {
                        const ref = td.dataset.cellRef;
                        handleSelectCell(ref);
                        const parsed = parseCellRef(ref);
                        const coords = getContextMenuCoords(e);
                        setContextMenu({
                          open: true,
                          x: coords.x,
                          y: coords.y,
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
                        {/* Sticky Left: Row Number Header with Click and Right-Click Support */}
                        <td
                          onClick={() => {
                            const newRef = `${selectedColLetter || 'A'}${row}`;
                            handleSelectCell(newRef);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newRef = `${selectedColLetter || 'A'}${row}`;
                            handleSelectCell(newRef);
                            const parsed = parseCellRef(newRef);
                            const coords = getContextMenuCoords(e);
                            setContextMenu({
                              open: true,
                              x: coords.x,
                              y: coords.y,
                              cellRef: newRef,
                              rowIndex: row,
                              colIndex: parsed?.colIndex || 1
                            });
                          }}
                          className={`sticky left-0 z-20 w-14 min-w-[56px] max-w-[56px] h-7 border-r border-b border-slate-300 dark:border-zinc-800 text-center font-mono font-semibold text-[11px] cursor-pointer transition-colors ${
                            selectedRow === row
                              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                              : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800'
                          }`}
                          title={`Row ${row}. Click to select row.`}
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
                          const isSearchHit = Boolean(
                            cleanSearch &&
                            (cellRef.toLowerCase() === cleanSearch ||
                              (display && display.toLowerCase().includes(cleanSearch)))
                          );
                          const isInlineEditing = inlineEditingCellRef === cellRef;
                          const formulaHighlight = formulaHighlightMap.get(cellRef);

                          return (
                            <MemoizedGridCell
                              key={cellRef}
                              cellRef={cellRef}
                              rawVal={val}
                              display={display}
                              isFormula={isFormula}
                              isSelected={isSelected}
                              isLinked={isLinked}
                              isSearchHit={isSearchHit}
                              isInlineEditing={isInlineEditing}
                              currentTabName={currentTab?.name}
                              isPickerMode={isPickerMode}
                              inlineEditingValue={inlineEditingValue}
                              onInlineChange={handleInlineChange}
                              onInlineKeyDown={handleInlineKeyDown}
                              onInlineBlur={handleInlineBlur}
                              inlineInputRef={inlineInputRef}
                              onFillHandleDoubleClick={handleAutofillDown}
                              formulaHighlight={formulaHighlight}
                            />
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

              {/* Multi-Tab Strip at the bottom of the grid */}
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

        {/* SPREADSHEET RIGHT-CLICK CONTEXT MENU — rendered via portal to document.body so it is
             fully outside the Dialog's CSS transform stacking context. This fixes the bug
             where position:fixed coords (e.clientX/Y) were offset by the dialog's origin. */}
        {contextMenu?.open && (
          <div
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            className="absolute z-[9999] w-52 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md shadow-2xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-75"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-2 py-1 text-[10px] font-mono text-slate-400 font-semibold border-b border-slate-100 dark:border-zinc-800 mb-1 flex items-center justify-between">
              <span>CELL {contextMenu.cellRef}</span>
              <span>R{contextMenu.rowIndex} C{contextMenu.colIndex}</span>
            </div>

            {/* Insert Row Above */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const row = contextMenu.rowIndex;
                setContextMenu(null);
                handleInsertRowAbove(row);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Rows className="w-3.5 h-3.5 text-emerald-600" />
                <span>Insert Row Above</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Row {contextMenu.rowIndex}</span>
            </button>

            {/* Insert Row Below */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const row = contextMenu.rowIndex;
                setContextMenu(null);
                handleInsertRowBelow(row);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Rows className="w-3.5 h-3.5 text-emerald-600" />
                <span>Insert Row Below</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Row {contextMenu.rowIndex + 1}</span>
            </button>

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            {/* Insert Column Left */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const col = contextMenu.colIndex;
                setContextMenu(null);
                handleInsertColLeft(col);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                <span>Insert Column Left</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Col {colToLetter(contextMenu.colIndex)}</span>
            </button>

            {/* Insert Column Right */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const col = contextMenu.colIndex;
                setContextMenu(null);
                handleInsertColRight(col);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                <span>Insert Column Right</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Col {colToLetter(contextMenu.colIndex + 1)}</span>
            </button>

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            {/* Delete Row */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const row = contextMenu.rowIndex;
                setContextMenu(null);
                handleDeleteSelectedRow(row);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete Row {contextMenu.rowIndex}</span>
              </span>
            </button>

            {/* Delete Column */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const col = contextMenu.colIndex;
                setContextMenu(null);
                handleDeleteSelectedCol(col);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete Column {colToLetter(contextMenu.colIndex)}</span>
              </span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                setDeleteOption('entire_row');
                setIsDeleteDialogOpen(true);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left text-rose-700 dark:text-rose-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Dialog...</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+-</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const ref = contextMenu.cellRef;
                setContextMenu(null);
                handleCopyCell(ref);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Copy Cell</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+C</span>
            </button>

            <button
              type="button"
              disabled={!copiedCell}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const ref = contextMenu.cellRef;
                setContextMenu(null);
                handlePasteCell(ref);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <span>Paste (Smart Formula Shift)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+V</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                handleFillDown();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Rows className="w-3.5 h-3.5 text-slate-400" />
                <span>Fill Down from Above</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+D</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                handleFillRight();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Columns className="w-3.5 h-3.5 text-slate-400" />
                <span>Fill Right from Left</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Ctrl+R</span>
            </button>

            <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1" />

            {/* Link Cell directly into Document */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const ref = contextMenu.cellRef;
                setContextMenu(null);
                handleSelectCell(ref);
                const val = currentCells[ref];
                const token = createCellVariableToken(
                  ref,
                  formatCellValue(val),
                  currentTab?.name,
                  isMultiTab
                );
                if (onInsertVariable) {
                  onInsertVariable(token, formatCellValue(val));
                  onOpenChange(false);
                  toast.success(`Linked ${token} into document!`);
                } else {
                  if (navigator?.clipboard) {
                    navigator.clipboard.writeText(token);
                  }
                  toast.success(`Copied formula link: ${token}`, {
                    description: 'Paste into any table cell or document block to link live data.'
                  });
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-left text-emerald-800 dark:text-emerald-200 font-semibold cursor-pointer border border-emerald-200/80 dark:border-emerald-800/80 mb-1"
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Link Cell ({contextMenu.cellRef}) to Document</span>
            </button>

            {/* Copy Formula Token */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const ref = contextMenu.cellRef;
                setContextMenu(null);
                const val = currentCells[ref];
                const token = createCellVariableToken(
                  ref,
                  formatCellValue(val),
                  currentTab?.name,
                  isMultiTab
                );
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(token);
                  toast.success(`Copied formula token: ${token}`);
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Table2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Copy Formula Token (@{contextMenu.cellRef})</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                if (navigator?.clipboard) {
                  navigator.clipboard.writeText(contextMenu.cellRef);
                  toast.success(`Copied cell reference: ${contextMenu.cellRef}`);
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Copy Cell Coordinate ({contextMenu.cellRef})</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                handleClearSelectedCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Contents</span>
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SPREADSHEET INSERT DIALOG                    */}
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
                const order: (
                  | 'shift_right'
                  | 'shift_down'
                  | 'entire_row_above'
                  | 'entire_row_below'
                  | 'entire_col_left'
                  | 'entire_col_right'
                )[] = [
                  'shift_right',
                  'shift_down',
                  'entire_row_above',
                  'entire_row_below',
                  'entire_col_left',
                  'entire_col_right'
                ];
                const curr = order.indexOf(insertOption as any);
                setInsertOption(order[(curr + 1) % order.length]);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const order: (
                  | 'shift_right'
                  | 'shift_down'
                  | 'entire_row_above'
                  | 'entire_row_below'
                  | 'entire_col_left'
                  | 'entire_col_right'
                )[] = [
                  'shift_right',
                  'shift_down',
                  'entire_row_above',
                  'entire_row_below',
                  'entire_col_left',
                  'entire_col_right'
                ];
                const curr = order.indexOf(insertOption as any);
                setInsertOption(order[(curr - 1 + order.length) % order.length]);
              } else if (e.key === 'r' || e.key === 'R') {
                setInsertOption('shift_right');
              } else if (e.key === 'd' || e.key === 'D') {
                setInsertOption('shift_down');
              } else if (e.key === 'a' || e.key === 'A') {
                setInsertOption('entire_row_above');
              } else if (e.key === 'b' || e.key === 'B') {
                setInsertOption('entire_row_below');
              } else if (e.key === 'l' || e.key === 'L') {
                setInsertOption('entire_col_left');
              } else if (e.key === 'g' || e.key === 'G') {
                setInsertOption('entire_col_right');
              }
            }}
            tabIndex={-1}
          >
            <div
              className="w-[260px] bg-[#fcfcfc] dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg shadow-2xl overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-100"
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
                      toast.info('Insert cells, rows above/below, or columns left/right at the selection.')
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
                    Insert Option
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

                    <div className="h-px bg-slate-200 dark:bg-zinc-700 my-1" />

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_row_above' || insertOption === 'entire_row'}
                        onChange={() => setInsertOption('entire_row_above')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 flex items-center justify-between w-full">
                        <span>Insert row <span className="underline font-medium">a</span>bove</span>
                        <span className="text-[10px] text-slate-400 font-mono">Row {selectedRow}</span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_row_below'}
                        onChange={() => setInsertOption('entire_row_below')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 flex items-center justify-between w-full">
                        <span>Insert row <span className="underline font-medium">b</span>elow</span>
                        <span className="text-[10px] text-slate-400 font-mono">Row {selectedRow + 1}</span>
                      </span>
                    </label>

                    <div className="h-px bg-slate-200 dark:bg-zinc-700 my-1" />

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_col_left' || insertOption === 'entire_col'}
                        onChange={() => setInsertOption('entire_col_left')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 flex items-center justify-between w-full">
                        <span>Insert column <span className="underline font-medium">l</span>eft</span>
                        <span className="text-[10px] text-slate-400 font-mono">Col {selectedColLetter}</span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="insertOption"
                        checked={insertOption === 'entire_col_right'}
                        onChange={() => setInsertOption('entire_col_right')}
                        className="w-3.5 h-3.5 accent-[#0067b8] text-[#0067b8]"
                      />
                      <span className="text-[12px] text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 flex items-center justify-between w-full">
                        <span>Insert column ri<span className="underline font-medium">g</span>ht</span>
                        <span className="text-[10px] text-slate-400 font-mono">Col {colToLetter(selectedCol + 1)}</span>
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
        {/* SPREADSHEET DELETE DIALOG                    */}
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
