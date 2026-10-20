import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { AttachedSpreadsheet, SpreadsheetTab } from '../../../types/secFiling';
import {
  colToLetter,
  formatCellValue,
  parseCellRef,
  ensureSpreadsheetTabs
} from '../../../utils/documentVariables';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  FileSpreadsheet,
  Download,
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export interface EmbeddedSpreadsheetDiffViewerProps {
  baseSpreadsheet?: AttachedSpreadsheet | null;
  proposedSpreadsheet?: AttachedSpreadsheet | null;
  spreadsheetDiffs?: Array<{
    id: string;
    tabName?: string;
    cellRef: string;
    oldValue: any;
    newValue: any;
    oldFormatted: string;
    newFormatted: string;
    status: 'modified' | 'added' | 'deleted';
  }>;
  onOpenFullModal?: () => void;
  initialCellRef?: string;
  initialTabName?: string;
  className?: string;
}

export const EmbeddedSpreadsheetDiffViewer: React.FC<EmbeddedSpreadsheetDiffViewerProps> = ({
  baseSpreadsheet: rawBase,
  proposedSpreadsheet: rawProp,
  spreadsheetDiffs = [],
  onOpenFullModal,
  initialCellRef,
  initialTabName,
  className = ''
}) => {
  // Ensure tabs exist
  const baseSheet = useMemo(() => (rawBase ? ensureSpreadsheetTabs(rawBase) : null), [rawBase]);
  const propSheet = useMemo(
    () => ensureSpreadsheetTabs(rawProp || rawBase),
    [rawProp, rawBase]
  );

  const tabs: SpreadsheetTab[] = useMemo(() => {
    if (propSheet.tabs && propSheet.tabs.length > 0) return propSheet.tabs;
    if (baseSheet?.tabs && baseSheet.tabs.length > 0) return baseSheet.tabs;
    return [{ id: 'Sheet1', name: 'Sheet1', rowCount: 30, colCount: 15, maxRow: 30, maxCol: 'O', headers: [], cells: {} }];
  }, [propSheet, baseSheet]);

  // Active Tab State
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (initialTabName) {
      const match = tabs.find(
        (t) => t.name.toLowerCase() === initialTabName.toLowerCase() || t.id.toLowerCase() === initialTabName.toLowerCase()
      );
      if (match) return match.id;
    }
    return propSheet.activeTabId || tabs[0]?.id || 'Sheet1';
  });

  const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const currentTabName = currentTab?.name || 'Sheet1';

  // Base and Proposed cells for the active tab
  const propCells = currentTab?.cells || {};

  // Selected Cell State
  const [selectedCellRef, setSelectedCellRef] = useState<string>(() => {
    return initialCellRef?.trim().toUpperCase() || 'A1';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVar, setCopiedVar] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [jumpRowInput, setJumpRowInput] = useState('');

  // Map of modified cells in the current tab
  const tabDiffMap = useMemo(() => {
    const map = new Map<
      string,
      {
        oldValue: any;
        newValue: any;
        oldFormatted: string;
        newFormatted: string;
        status: 'modified' | 'added' | 'deleted';
      }
    >();

    for (const diff of spreadsheetDiffs) {
      const cleanRef = diff.cellRef.replace(/^.*!/, '').replace(/^@+/, '').trim().toUpperCase();
      const diffTab = diff.tabName ? diff.tabName.trim().toLowerCase() : '';
      const curTab = currentTabName.trim().toLowerCase();
      if (!diffTab || diffTab === curTab || tabs.length === 1) {
        map.set(cleanRef, diff);
        map.set(diff.cellRef.toUpperCase(), diff);
      }
    }
    return map;
  }, [spreadsheetDiffs, currentTabName, tabs.length]);

  // List of all modified cell references in current tab for quick jump
  const tabDiffCellRefs = useMemo(() => Array.from(tabDiffMap.keys()), [tabDiffMap]);
  const [currentDiffIdx, setCurrentDiffIdx] = useState(0);

  // Grid dimensions
  const totalRows = Math.max(30, currentTab?.rowCount || 30);
  const totalCols = Math.max(15, currentTab?.colCount || 15);
  const headers = currentTab?.headers || [];

  const colLetters = useMemo(() => {
    return Array.from({ length: totalCols }, (_, i) => colToLetter(i + 1));
  }, [totalCols]);

  const ROW_HEIGHT = 28;
  const COL_WIDTH = 120;
  const ROW_OVERSCAN = 6;
  const COL_OVERSCAN = 4;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);
  const [containerWidth, setContainerWidth] = useState(1100);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerHeight(scrollContainerRef.current.clientHeight || 500);
      setContainerWidth(scrollContainerRef.current.clientWidth || 1100);
    }
  }, []);

  // Scroll to a specific cell
  const scrollToCell = useCallback((cellRef: string) => {
    if (!scrollContainerRef.current) return;
    const parsed = parseCellRef(cellRef);
    if (!parsed) return;
    const targetY = Math.max(0, (parsed.rowIndex - 4) * ROW_HEIGHT);
    const targetX = Math.max(0, (parsed.colIndex - 3) * COL_WIDTH);
    scrollContainerRef.current.scrollTo({ top: targetY, left: targetX, behavior: 'smooth' });
  }, []);

  const scrollToRow = useCallback((rowNumber: number) => {
    if (!scrollContainerRef.current) return;
    const targetY = Math.max(0, (rowNumber - 4) * ROW_HEIGHT);
    scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
  }, []);

  // Jump to initial cell on load
  useEffect(() => {
    if (initialCellRef) {
      const clean = initialCellRef.trim().toUpperCase();
      setSelectedCellRef(clean);
      const timer = setTimeout(() => scrollToCell(clean), 150);
      return () => clearTimeout(timer);
    } else if (tabDiffCellRefs.length > 0) {
      setSelectedCellRef(tabDiffCellRefs[0]);
      const timer = setTimeout(() => scrollToCell(tabDiffCellRefs[0]), 150);
      return () => clearTimeout(timer);
    }
  }, [initialCellRef, tabDiffCellRefs, scrollToCell]);

  // Selected cell diff information
  const selectedDiff = tabDiffMap.get(selectedCellRef);
  const selectedPropVal = propCells[selectedCellRef];
  const selectedDisplayVal = formatCellValue(selectedPropVal);

  const parsedSelected = parseCellRef(selectedCellRef);
  const selectedRow = parsedSelected?.rowIndex || 1;
  const selectedCol = parsedSelected?.colLetter || 'A';

  // 2D Virtualization calculations
  const startRowIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - ROW_OVERSCAN);
  const endRowIndex = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + ROW_OVERSCAN
  );

  const topSpacerHeight = startRowIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endRowIndex) * ROW_HEIGHT);

  const visibleRowNumbers: number[] = [];
  for (let r = startRowIndex + 1; r <= endRowIndex; r++) {
    visibleRowNumbers.push(r);
  }

  const startColIndex = Math.max(0, Math.floor(scrollLeft / COL_WIDTH) - COL_OVERSCAN);
  const endColIndex = Math.min(
    totalCols,
    Math.ceil((scrollLeft + containerWidth) / COL_WIDTH) + COL_OVERSCAN
  );

  const leftSpacerWidth = startColIndex * COL_WIDTH;
  const rightSpacerWidth = Math.max(0, (totalCols - endColIndex) * COL_WIDTH);

  const visibleColIndices: number[] = [];
  for (let c = startColIndex; c < endColIndex; c++) {
    visibleColIndices.push(c);
  }

  const handleCopyTag = () => {
    const tag = `{{@@${currentTabName}!${selectedCellRef}}}`;
    navigator.clipboard.writeText(tag);
    setCopiedVar(true);
    setTimeout(() => setCopiedVar(false), 2000);
    toast.success(`Copied variable tag: ${tag}`);
  };

  const handleCopyValue = () => {
    navigator.clipboard.writeText(String(selectedDisplayVal || ''));
    setCopiedValue(true);
    setTimeout(() => setCopiedValue(false), 2000);
    toast.success(`Copied cell value: ${selectedDisplayVal}`);
  };

  const handleStepDiff = (direction: 'next' | 'prev') => {
    if (tabDiffCellRefs.length === 0) return;
    let nextIdx = direction === 'next' ? currentDiffIdx + 1 : currentDiffIdx - 1;
    if (nextIdx >= tabDiffCellRefs.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = tabDiffCellRefs.length - 1;
    setCurrentDiffIdx(nextIdx);
    const cell = tabDiffCellRefs[nextIdx];
    setSelectedCellRef(cell);
    scrollToCell(cell);
  };

  return (
    <div className={`w-full flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* 1. Header Toolbar (Image 2 style) */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#107C41] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {propSheet.fileName || 'Attached Spreadsheet.xlsx'}
              </h3>
              <Badge
                variant="outline"
                className="font-mono text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300"
              >
                {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-slate-600 dark:text-zinc-400">
                Tab: {currentTabName} ({totalRows} rows × {totalCols} cols)
              </Badge>
              {spreadsheetDiffs.length > 0 ? (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-[10px] px-2 py-0.5 shadow-2xs">
                  {spreadsheetDiffs.length} Changed Cell{spreadsheetDiffs.length === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">
                  0 Cell Diffs • Baseline Unchanged
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review live spreadsheet changes and formula links synchronized with this filing.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenFullModal && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenFullModal}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Open in Full Editor</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.info('Exporting workbook to .xlsx...')}
            className="h-8 text-xs gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export .xlsx</span>
          </Button>
        </div>
      </div>

      {/* 2. Sub-Toolbar (Image 2 style) */}
      <div className="px-4 py-2 bg-slate-100/80 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap text-xs">
        {/* Left: Active Tab Badge & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            ACTIVE TAB ({currentTabName}):
          </span>

          <div className="flex items-center bg-white dark:bg-zinc-900 rounded-md border border-slate-300 dark:border-zinc-700 p-0.5 shadow-2xs text-[11px]">
            <button
              type="button"
              onClick={() => scrollToRow(1)}
              className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium cursor-pointer"
            >
              Top
            </button>
            <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700 mx-0.5" />
            <button
              type="button"
              onClick={() => scrollToRow(totalRows)}
              className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium cursor-pointer"
            >
              Bottom
            </button>
          </div>

          {/* Quick Jump to Changed Cells Stepper (if any) */}
          {tabDiffCellRefs.length > 0 && (() => {
            const curRef = tabDiffCellRefs[currentDiffIdx] || tabDiffCellRefs[0];
            const curDiff = tabDiffMap.get(curRef);
            const curStatus = curDiff?.status || 'modified';
            const isAdd = curStatus === 'added';
            const isDel = curStatus === 'deleted';

            return (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                  isAdd
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : isDel
                    ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                    : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <span className="text-[11px] font-bold">
                  {isAdd ? '+ Added Cell:' : isDel ? '- Deleted Cell:' : '~ Changed Cell:'}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepDiff('prev')}
                  className="p-0.5 hover:opacity-75 rounded cursor-pointer"
                  title="Previous changed cell"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-xs px-1">
                  @{curRef} ({currentDiffIdx + 1}/{tabDiffCellRefs.length})
                </span>
                <button
                  type="button"
                  onClick={() => handleStepDiff('next')}
                  className="p-0.5 hover:opacity-75 rounded cursor-pointer"
                  title="Next changed cell"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}
        </div>

        {/* Right: Search / Jump to Cell */}
        <div className="flex items-center gap-2">
          <div className="relative w-52 sm:w-64">
            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchQuery.trim().toUpperCase();
                  const match = q.match(/^([A-Z]+)([0-9]+)$/);
                  if (match) {
                    setSelectedCellRef(q);
                    scrollToCell(q);
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

      {/* 3. Selected Cell Formula & Value Inspector Bar (Image 2 style) */}
      <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-xs text-slate-500">Cell:</span>
            <Badge className="bg-[#0E2841] text-white font-bold text-xs px-2 py-0.5">
              {currentTabName}!{selectedCellRef}
            </Badge>
          </div>

          {/* Value Display / Formula Bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-md">
            <span className="text-xs font-mono font-bold text-slate-500 shrink-0">=</span>
            <Input
              readOnly
              value={String(selectedPropVal ?? '')}
              placeholder="Cell value or formula"
              className="h-7 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 font-mono text-slate-900 dark:text-zinc-100"
            />
          </div>

          {/* Row / Col Info Pills */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded p-0.5 text-[10px] font-mono font-semibold text-slate-500">
            <span className="px-1.5">R{selectedRow}</span>
            <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700" />
            <span className="px-1.5">Col {selectedCol}</span>
          </div>

          <div className="text-xs text-slate-600 dark:text-zinc-300 truncate max-w-xs">
            <span className="text-slate-400">Current: </span>
            <strong className="text-slate-800 dark:text-zinc-100 font-mono">{selectedDisplayVal || '(Empty)'}</strong>
          </div>

          {/* If cell is modified in proposal, show old -> new pill */}
          {selectedDiff && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs border ${
                selectedDiff.status === 'added'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : selectedDiff.status === 'deleted'
                  ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }`}
            >
              <span className="text-[10px] font-bold uppercase">
                {selectedDiff.status === 'added' ? '+ Added:' : selectedDiff.status === 'deleted' ? '- Deleted:' : '~ Changed:'}
              </span>
              {selectedDiff.status === 'modified' && (
                <>
                  <span className="line-through text-slate-500 dark:text-zinc-400 font-mono text-xs">
                    {selectedDiff.oldFormatted || 'empty'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-amber-950 dark:text-amber-100 font-mono text-xs">
                    {selectedDiff.newFormatted || 'empty'}
                  </span>
                </>
              )}
              {selectedDiff.status === 'added' && (
                <span className="font-bold text-emerald-800 dark:text-emerald-200 font-mono text-xs">
                  {selectedDiff.newFormatted || 'empty'}
                </span>
              )}
              {selectedDiff.status === 'deleted' && (
                <span className="line-through text-red-700 dark:text-red-300 font-mono text-xs">
                  {selectedDiff.oldFormatted || 'empty'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Copy Tag & Copy Value Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyTag}
            className="h-7 text-xs gap-1 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 cursor-pointer"
            title={`Copy dynamic variable tag: {{@@${currentTabName}!${selectedCellRef}}}`}
          >
            {copiedVar ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-blue-600" />}
            <span>Copy @{selectedCellRef}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyValue}
            className="h-7 text-xs gap-1 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 cursor-pointer"
            title="Copy current formatted value"
          >
            {copiedValue ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-purple-600" />}
            <span>Copy Tagged Value</span>
          </Button>
        </div>
      </div>

      {/* 4. Full Excel-Style Interactive Virtualized Grid (Image 2 style) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-auto bg-slate-50 dark:bg-zinc-950 select-none max-h-[580px] min-h-[460px] focus:outline-none"
      >
        <table className="border-separate border-spacing-0 text-xs table-fixed w-max">
          {/* Sticky Header: Column Letters */}
          <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-zinc-900 shadow-xs">
            <tr>
              <th className="sticky left-0 z-40 w-12 min-w-[48px] max-w-[48px] h-7 bg-slate-200 dark:bg-zinc-800 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[11px] text-slate-500">
                #
              </th>
              {leftSpacerWidth > 0 && (
                <th
                  style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, maxWidth: leftSpacerWidth }}
                  className="h-7 border-b border-slate-300 dark:border-zinc-700 p-0"
                />
              )}
              {visibleColIndices.map((cIdx) => {
                const colLetter = colLetters[cIdx];
                return (
                  <th
                    key={colLetter}
                    className="w-32 min-w-[120px] max-w-[120px] h-7 px-2 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[11px] text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900"
                  >
                    {colLetter}
                  </th>
                );
              })}
              {rightSpacerWidth > 0 && (
                <th
                  style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, maxWidth: rightSpacerWidth }}
                  className="h-7 border-b border-slate-300 dark:border-zinc-700 p-0"
                />
              )}
            </tr>

            {/* Optional Header Row (Hdr) from workbook headers */}
            {headers.length > 0 && (
              <tr>
                <th className="sticky left-0 z-40 w-12 min-w-[48px] max-w-[48px] h-7 bg-slate-200 dark:bg-zinc-800 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono font-bold text-[10px] text-slate-500">
                  Hdr
                </th>
                {leftSpacerWidth > 0 && (
                  <th
                    style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, maxWidth: leftSpacerWidth }}
                    className="h-7 border-b border-slate-300 dark:border-zinc-700 p-0"
                  />
                )}
                {visibleColIndices.map((cIdx) => {
                  const hdr = headers[cIdx] || '';
                  return (
                    <th
                      key={`hdr-${cIdx}`}
                      className="w-32 min-w-[120px] max-w-[120px] h-7 px-2 border-r border-b border-slate-300 dark:border-zinc-700 text-left font-sans font-semibold text-[11px] text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900 truncate"
                      title={hdr}
                    >
                      {hdr}
                    </th>
                  );
                })}
                {rightSpacerWidth > 0 && (
                  <th
                    style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, maxWidth: rightSpacerWidth }}
                    className="h-7 border-b border-slate-300 dark:border-zinc-700 p-0"
                  />
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {topSpacerHeight > 0 && (
              <tr style={{ height: topSpacerHeight }}>
                <td colSpan={visibleColIndices.length + 3} className="p-0 border-none bg-transparent" />
              </tr>
            )}
            {visibleRowNumbers.map((rowNumber) => {
              return (
                <tr key={rowNumber}>
                  {/* Sticky Row Number Column */}
                  <td className="sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px] h-7 bg-slate-100 dark:bg-zinc-900 border-r border-b border-slate-300 dark:border-zinc-700 text-center font-mono text-[10px] text-slate-500 font-semibold select-none">
                    {rowNumber}
                  </td>

                  {/* Left spacer for horizontal virtualization */}
                  {leftSpacerWidth > 0 && (
                    <td
                      style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, maxWidth: leftSpacerWidth }}
                      className="h-7 p-0 border-r border-b border-slate-200 dark:border-zinc-800 bg-transparent"
                    />
                  )}

                  {/* Visible Cell Columns */}
                  {visibleColIndices.map((cIdx) => {
                    const colLetter = colLetters[cIdx];
                    const cellRef = `${colLetter}${rowNumber}`;
                    const diff = tabDiffMap.get(cellRef) || tabDiffMap.get(`@${cellRef}`) || tabDiffMap.get(`${currentTabName}!${cellRef}`);
                    const status = diff?.status;
                    const isDiff = !!diff;
                    const rawVal = isDiff && diff?.newValue !== undefined && diff?.newValue !== null
                      ? diff.newValue
                      : propCells[cellRef];
                    const displayVal = formatCellValue(rawVal);
                    const isSelected = selectedCellRef === cellRef;
                    const isNumeric = typeof rawVal === 'number' || (!isNaN(Number(displayVal)) && displayVal.trim() !== '');

                    // Determine cell styling according to diff status:
                    // - status === 'modified': Yellow/Amber
                    // - status === 'added': Green/Emerald
                    // - status === 'deleted': Red/Rose with line-through
                    let cellClasses = 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-800 hover:bg-slate-50/80';
                    let cornerTagColor = '';

                    if (status === 'modified') {
                      cellClasses = isSelected
                        ? 'bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-black border-amber-500 ring-2 ring-blue-600 ring-inset shadow-xs z-20'
                        : 'bg-amber-100 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100 font-extrabold border-amber-400 ring-2 ring-amber-500/80 ring-inset shadow-xs z-10';
                      cornerTagColor = 'border-t-amber-500';
                    } else if (status === 'added') {
                      cellClasses = isSelected
                        ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 font-black border-emerald-500 ring-2 ring-blue-600 ring-inset shadow-xs z-20'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100 font-extrabold border-emerald-400 ring-2 ring-emerald-500 ring-inset shadow-xs z-10';
                      cornerTagColor = 'border-t-emerald-600';
                    } else if (status === 'deleted') {
                      cellClasses = isSelected
                        ? 'bg-red-100 dark:bg-red-900/90 text-red-900 dark:text-red-100 line-through border-red-500 ring-2 ring-blue-600 ring-inset shadow-xs z-20'
                        : 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 line-through border-red-300 ring-1 ring-red-400 ring-inset z-10';
                      cornerTagColor = 'border-t-red-500';
                    } else if (isSelected) {
                      cellClasses = 'bg-blue-100/90 dark:bg-blue-900/60 ring-2 ring-blue-600 ring-inset font-bold text-blue-950 dark:text-white border-blue-400 z-10';
                    }

                    return (
                      <td
                        key={cellRef}
                        onClick={() => setSelectedCellRef(cellRef)}
                        className={`w-32 min-w-[120px] max-w-[120px] h-7 px-2 border-r border-b text-xs truncate transition-all cursor-pointer relative ${cellClasses} ${
                          isNumeric ? 'text-right font-mono' : 'text-left'
                        }`}
                        title={
                          status === 'modified'
                            ? `Changed Cell @${cellRef}: was "${diff?.oldFormatted || 'empty'}" → proposed "${diff?.newFormatted || 'empty'}"`
                            : status === 'added'
                            ? `Added Cell @${cellRef}: new value "${diff?.newFormatted || 'empty'}"`
                            : status === 'deleted'
                            ? `Deleted Cell @${cellRef}: was "${diff?.oldFormatted || 'empty'}"`
                            : `@${cellRef}: ${displayVal || '(empty)'}`
                        }
                      >
                        {/* Diff status corner tag */}
                        {cornerTagColor && (
                          <span
                            className={`absolute top-0 right-0 w-0 h-0 border-t-[9px] ${cornerTagColor} border-l-[9px] border-l-transparent z-10`}
                            title={`Status: ${status}`}
                          />
                        )}
                        <span>{displayVal}</span>
                      </td>
                    );
                  })}

                  {/* Right spacer for horizontal virtualization */}
                  {rightSpacerWidth > 0 && (
                    <td
                      style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, maxWidth: rightSpacerWidth }}
                      className="h-7 p-0 border-r border-b border-slate-200 dark:border-zinc-800 bg-transparent"
                    />
                  )}
                </tr>
              );
            })}
            {bottomSpacerHeight > 0 && (
              <tr style={{ height: bottomSpacerHeight }}>
                <td colSpan={visibleColIndices.length + 3} className="p-0 border-none bg-transparent" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Bottom Sheet Tabs Bar & Legend (Image 2 style) */}
      <div className="px-4 py-2.5 bg-slate-100/90 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Worksheet Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            SHEETS:
          </span>
          {tabs.map((tab) => {
            const tabModCount = spreadsheetDiffs.filter(
              (d) => (d.tabName || '').toLowerCase() === tab.name.toLowerCase()
            ).length;
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border-emerald-500 shadow-2xs font-bold'
                    : 'bg-transparent text-slate-600 dark:text-zinc-400 border-transparent hover:bg-slate-200/60'
                }`}
              >
                <span>{tab.name} ({tab.rowCount || 30}×{tab.colCount || 10})</span>
                {tabModCount > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    }`}
                  >
                    {tabModCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend for Word Doc Diff Colors */}
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-3 py-1 rounded-md border border-slate-200 dark:border-zinc-800 text-[11px] font-medium shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-500" />
            <span className="text-amber-950 dark:text-amber-300 font-semibold">Yellow = Changed Value</span>
          </div>
          <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-600" />
            <span className="text-emerald-950 dark:text-emerald-300 font-semibold">Green = Added Row / Col / Cell</span>
          </div>
          <div className="w-px h-3 bg-slate-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400 border border-red-500 line-through" />
            <span className="text-red-800 dark:text-red-400 font-semibold">Red = Deleted</span>
          </div>
        </div>

        {/* Row Range Indicator & Go to row */}
        <div className="flex items-center gap-3 text-slate-500 font-sans text-xs">
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            • Rows {startRowIndex + 1}-{endRowIndex} of {totalRows} • Cols A-{colLetters[colLetters.length - 1]}
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Go to row:</span>
            <Input
              type="number"
              min={1}
              max={totalRows}
              value={jumpRowInput}
              onChange={(e) => setJumpRowInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const r = parseInt(jumpRowInput, 10);
                  if (!isNaN(r)) scrollToRow(r);
                }
              }}
              placeholder="Row"
              className="w-16 h-6 text-xs px-1.5 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 font-mono"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const r = parseInt(jumpRowInput, 10);
                if (!isNaN(r)) scrollToRow(r);
              }}
              className="h-6 text-[11px] px-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-pointer"
            >
              Go
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
