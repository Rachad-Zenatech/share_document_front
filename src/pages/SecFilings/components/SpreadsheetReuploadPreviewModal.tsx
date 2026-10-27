import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { FileSpreadsheet, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { AttachedSpreadsheet } from '../../../types/secFiling';
import type { ReuploadAxisSlot, ReuploadTabDiff, WorkbookReuploadDiff } from '../../../types/spreadsheet';
import { colToLetter, formatCellValue } from '../../../utils/documentVariables';
import {
  computeWorkbookReuploadDiff,
  getReuploadCellChange
} from '../../../utils/spreadsheetReuploadDiff';

interface SpreadsheetReuploadPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSpreadsheet: AttachedSpreadsheet;
  uploadedSpreadsheet: AttachedSpreadsheet;
  uploadedFileName: string;
  /** Omit for a read-only preview (only a Close button). */
  onApply?: (diff: WorkbookReuploadDiff) => void;
  title?: string;
  /** Replaces the default "X will replace the contents of Y" description. */
  description?: React.ReactNode;
  applyLabel?: string;
  currentLabel?: string;
  uploadedLabel?: string;
  /** Allow applying even when no differences are detected. */
  allowApplyWithoutChanges?: boolean;
}

/**
 * Hard cap on rendered grid rows to keep very large workbooks responsive. Uploads are
 * parsed to at most 800 rows, so the whole sheet (plus deleted rows) normally fits.
 */
const MAX_RENDER_ROWS = 1200;
/** Unchanged rows kept around each change when "changes only" is on. */
const CONTEXT_ROWS = 1;

type DisplayRow = { kind: 'row'; slot: ReuploadAxisSlot } | { kind: 'gap'; count: number };

const ADDED_CLS = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
const DELETED_CLS = 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 line-through';
const MODIFIED_CLS = 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200';
const FORMULA_CLS = 'bg-violet-50 dark:bg-violet-950/50 text-violet-900 dark:text-violet-200';
/** Excel-like light gridlines and header borders. */
const GRID_BORDER = 'border-[#e1e1e1] dark:border-zinc-800';
const HEADER_BORDER = 'border-[#c6c6c6] dark:border-zinc-700';
const EXCEL_FONT = 'Calibri, "Segoe UI", Arial, sans-serif';

const isNumericValue = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(/[$,%()]/g, ''))));

const rowKey = (slot: ReuploadAxisSlot) => `${slot.baseIndex ?? '-'}:${slot.nextIndex ?? '-'}`;

const slotLabel = (slot: ReuploadAxisSlot, toLabel: (i: number) => string) =>
  slot.status === 'deleted' ? toLabel(slot.baseIndex!) : toLabel(slot.nextIndex!);

const TabSummary: React.FC<{ tab: ReuploadTabDiff }> = ({ tab }) => {
  if (tab.status === 'added') return <span className="text-emerald-600 dark:text-emerald-400">new tab</span>;
  if (tab.status === 'deleted') return <span className="text-red-600 dark:text-red-400">removed tab</span>;
  if (!tab.hasChanges) return <span className="text-slate-400">no changes</span>;
  const parts: React.ReactNode[] = [];
  if (tab.addedRows) parts.push(<span key="ar" className="text-emerald-600 dark:text-emerald-400">+{tab.addedRows}R</span>);
  if (tab.deletedRows) parts.push(<span key="dr" className="text-red-600 dark:text-red-400">−{tab.deletedRows}R</span>);
  if (tab.addedCols) parts.push(<span key="ac" className="text-emerald-600 dark:text-emerald-400">+{tab.addedCols}C</span>);
  if (tab.deletedCols) parts.push(<span key="dc" className="text-red-600 dark:text-red-400">−{tab.deletedCols}C</span>);
  const cellChanges = tab.addedCells + tab.deletedCells + tab.modifiedCells;
  if (cellChanges) parts.push(<span key="mc" className="text-amber-600 dark:text-amber-400">~{cellChanges}</span>);
  if (tab.formulaCells) parts.push(<span key="fc" className="text-violet-600 dark:text-violet-400">ƒ{tab.formulaCells}</span>);
  return <span className="flex items-center gap-1">{parts}</span>;
};

export const SpreadsheetReuploadPreviewModal: React.FC<SpreadsheetReuploadPreviewModalProps> = ({
  open,
  onOpenChange,
  currentSpreadsheet,
  uploadedSpreadsheet,
  uploadedFileName,
  onApply,
  title: dialogTitle = 'Review Re-upload Changes',
  description,
  applyLabel = 'Apply Re-upload',
  currentLabel = 'Current',
  uploadedLabel = 'Uploaded',
  allowApplyWithoutChanges = false
}) => {
  const diff = useMemo(
    () => computeWorkbookReuploadDiff(currentSpreadsheet, uploadedSpreadsheet),
    [currentSpreadsheet, uploadedSpreadsheet]
  );

  const [activeTabName, setActiveTabName] = useState<string>('');
  // The whole sheet by default: changes read more clearly in place than as snippets.
  const [changesOnly, setChangesOnly] = useState(false);
  const [changeCursor, setChangeCursor] = useState(-1);
  const gridRef = useRef<HTMLDivElement>(null);

  // Until the user picks a tab, open on the first tab that actually changed
  const tab =
    diff.tabs.find((t) => t.name === activeTabName) || diff.tabs.find((t) => t.hasChanges) || diff.tabs[0];

  const totals = useMemo(() => {
    const sum = (key: keyof ReuploadTabDiff) =>
      diff.tabs.reduce((acc, t) => acc + (typeof t[key] === 'number' ? (t[key] as number) : 0), 0);
    return {
      addedRows: sum('addedRows'),
      deletedRows: sum('deletedRows'),
      addedCols: sum('addedCols'),
      deletedCols: sum('deletedCols'),
      changedCells: sum('addedCells') + sum('deletedCells') + sum('modifiedCells'),
      formulaCells: sum('formulaCells'),
      addedTabs: diff.tabs.filter((t) => t.status === 'added').length,
      deletedTabs: diff.tabs.filter((t) => t.status === 'deleted').length
    };
  }, [diff]);

  // Displayed values (formulas evaluated); getReuploadCellChange also reads the formulas.
  const baseCells = tab?.baseValues || {};
  const nextCells = tab?.nextValues || {};
  const baseValue = (row: number, col: number) => baseCells[colToLetter(col) + row];
  const nextValue = (row: number, col: number) => nextCells[colToLetter(col) + row];

  /** Whether a row contains anything that differs between the two versions. */
  const rowHasChange = (slot: ReuploadAxisSlot): boolean => {
    if (!tab) return false;
    if (slot.status !== 'matched') return true;
    return tab.cols.some((c) => {
      if (c.status === 'added') return formatCellValue(nextValue(slot.nextIndex!, c.nextIndex!)) !== '';
      if (c.status === 'deleted') return formatCellValue(baseValue(slot.baseIndex!, c.baseIndex!)) !== '';
      return getReuploadCellChange(tab, slot.baseIndex!, c.baseIndex!, slot.nextIndex!, c.nextIndex!).status !== 'unchanged';
    });
  };

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (!tab) return [];
    if (!changesOnly) return tab.rows.map((slot) => ({ kind: 'row', slot }));

    const changed = tab.rows.map(rowHasChange);
    const keep = changed.map((_, i) => {
      for (let k = Math.max(0, i - CONTEXT_ROWS); k <= Math.min(changed.length - 1, i + CONTEXT_ROWS); k++) {
        if (changed[k]) return true;
      }
      return false;
    });

    const out: DisplayRow[] = [];
    let gap = 0;
    tab.rows.forEach((slot, i) => {
      if (keep[i]) {
        if (gap) out.push({ kind: 'gap', count: gap });
        gap = 0;
        out.push({ kind: 'row', slot });
      } else {
        gap++;
      }
    });
    if (gap && out.length) out.push({ kind: 'gap', count: gap });
    return out;
    // rowHasChange only depends on tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, changesOnly]);

  const renderedRows = displayRows.slice(0, MAX_RENDER_ROWS);
  const hiddenRowCount = displayRows.length - renderedRows.length;

  /** Keys of rendered rows that contain a change, in display order (for next/previous). */
  const changedRowKeys = useMemo(
    () =>
      displayRows
        .slice(0, MAX_RENDER_ROWS)
        .filter((dr): dr is Extract<DisplayRow, { kind: 'row' }> => dr.kind === 'row' && rowHasChange(dr.slot))
        .map((dr) => rowKey(dr.slot)),
    // rowHasChange only depends on tab, which displayRows already tracks
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayRows]
  );

  useEffect(() => setChangeCursor(-1), [tab?.name, changesOnly]);

  // Clicked cell, shown in full (values and formulas, before and after) in the details bar.
  const [selected, setSelected] = useState<{ row: ReuploadAxisSlot; col: ReuploadAxisSlot } | null>(null);
  useEffect(() => setSelected(null), [tab?.name]);

  const selectedDetail = useMemo(() => {
    if (!tab || !selected) return null;
    const { row, col } = selected;
    const rawFormula = (cells: Record<string, unknown> | undefined, ref: string) => {
      const v = cells?.[ref];
      return typeof v === 'string' && v.startsWith('=') ? v : undefined;
    };
    const baseRef = row.baseIndex && col.baseIndex ? colToLetter(col.baseIndex) + row.baseIndex : null;
    const nextRef = row.nextIndex && col.nextIndex ? colToLetter(col.nextIndex) + row.nextIndex : null;
    const removed = row.status === 'deleted' || col.status === 'deleted';
    const added = row.status === 'added' || col.status === 'added';
    const change =
      !removed && !added
        ? getReuploadCellChange(tab, row.baseIndex!, col.baseIndex!, row.nextIndex!, col.nextIndex!)
        : null;
    return {
      ref: removed ? baseRef : nextRef,
      movedFrom: change && baseRef !== nextRef ? baseRef : null,
      label: removed
        ? `Removed ${row.status === 'deleted' ? 'row' : 'column'}`
        : added
          ? `New ${row.status === 'added' ? 'row' : 'column'}`
          : change!.status === 'unchanged'
            ? 'No change'
            : change!.status === 'formula'
              ? 'Formula changed (same value)'
              : change!.formulaChanged
                ? 'Value and formula changed'
                : change!.status === 'added'
                  ? 'Value added'
                  : change!.status === 'deleted'
                    ? 'Value cleared'
                    : 'Value changed',
      before: added ? null : formatCellValue(baseRef ? baseValue(row.baseIndex!, col.baseIndex!) : ''),
      beforeFormula: added || !baseRef ? undefined : rawFormula(tab.baseTab?.cells, baseRef),
      after: removed ? null : formatCellValue(nextRef ? nextValue(row.nextIndex!, col.nextIndex!) : ''),
      afterFormula: removed || !nextRef ? undefined : rawFormula(tab.nextTab?.cells, nextRef)
    };
    // baseValue/nextValue read from tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selected]);

  /** Every cell of this tab whose formula changed, with its old and new formula. */
  const formulaChanges = useMemo(() => {
    if (!tab || tab.status !== 'matched' || tab.formulaCells === 0) return [];
    const list: Array<{ rowKey: string; ref: string; before: string; after: string; beforeFormula?: string; afterFormula?: string }> = [];
    for (const r of tab.rows) {
      if (r.status !== 'matched') continue;
      for (const c of tab.cols) {
        if (c.status !== 'matched') continue;
        const change = getReuploadCellChange(tab, r.baseIndex!, c.baseIndex!, r.nextIndex!, c.nextIndex!);
        if (!change.formulaChanged) continue;
        list.push({
          rowKey: rowKey(r),
          ref: colToLetter(c.nextIndex!) + r.nextIndex,
          before: formatCellValue(change.before),
          after: formatCellValue(change.after),
          beforeFormula: change.beforeFormula,
          afterFormula: change.afterFormula
        });
      }
    }
    return list;
  }, [tab]);
  const [showFormulaList, setShowFormulaList] = useState(true);

  const jumpToRow = (key: string) => {
    const idx = changedRowKeys.indexOf(key);
    if (idx >= 0) setChangeCursor(idx);
    gridRef.current?.querySelector(`[data-row-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const jumpToChange = (step: 1 | -1) => {
    if (changedRowKeys.length === 0) return;
    const next = (changeCursor + step + changedRowKeys.length) % changedRowKeys.length;
    setChangeCursor(next);
    gridRef.current
      ?.querySelector(`[data-row-key="${changedRowKeys[next]}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderCell = (row: ReuploadAxisSlot, col: ReuploadAxisSlot) => {
    let cls = '';
    let content: React.ReactNode;
    let title: string;
    // Excel alignment: numbers right, text left.
    let numeric: boolean;
    let formulaMark = false;

    if (row.status === 'deleted' || col.status === 'deleted') {
      const raw = row.baseIndex && col.baseIndex ? baseValue(row.baseIndex, col.baseIndex) : '';
      const v = formatCellValue(raw);
      numeric = isNumericValue(raw);
      cls = DELETED_CLS;
      content = v;
      title = v ? `Removed: ${v}` : 'Removed';
    } else if (row.status === 'added' || col.status === 'added') {
      const raw = row.nextIndex && col.nextIndex ? nextValue(row.nextIndex, col.nextIndex) : '';
      const v = formatCellValue(raw);
      numeric = isNumericValue(raw);
      cls = ADDED_CLS;
      content = v;
      title = v ? `New: ${v}` : 'New';
    } else {
      const change = getReuploadCellChange(tab!, row.baseIndex!, col.baseIndex!, row.nextIndex!, col.nextIndex!);
      const b = formatCellValue(change.before);
      const a = formatCellValue(change.after);
      const bf = change.beforeFormula ?? 'no formula';
      const af = change.afterFormula ?? 'no formula';
      numeric = isNumericValue(change.after) || (a === '' && isNumericValue(change.before));
      formulaMark = change.formulaChanged;
      // The cell shows the number, as in Excel; formulas are in the formula bar and tooltip.
      const formulaNote =
        change.beforeFormula || change.afterFormula
          ? change.beforeFormula === change.afterFormula
            ? `\nFormula: ${af}`
            : `\nFormula: ${bf} → ${af}`
          : '';
      if (change.status === 'added') {
        cls = ADDED_CLS;
        content = a;
        title = `New value: ${a}${formulaNote}`;
      } else if (change.status === 'deleted') {
        cls = DELETED_CLS;
        content = b;
        title = `Cleared: ${b}${formulaNote}`;
      } else if (change.status === 'modified') {
        cls = MODIFIED_CLS;
        content = (
          <>
            <span className="text-[10px] line-through text-red-600/80 dark:text-red-400/80 mr-1">{b}</span>
            {a}
          </>
        );
        title = change.formulaChanged ? `${b} → ${a}\nFormula changed: ${bf} → ${af}` : `${b} → ${a}${formulaNote}`;
      } else if (change.status === 'formula') {
        cls = FORMULA_CLS;
        content = a;
        title = `Formula changed (same value ${a}):\n${bf} → ${af}`;
      } else {
        content = a;
        title = `${a}${formulaNote}`;
      }
    }

    const isSelected = selected !== null && rowKey(selected.row) === rowKey(row) && rowKey(selected.col) === rowKey(col);
    return (
      <td
        key={`${col.baseIndex ?? '-'}:${col.nextIndex ?? '-'}`}
        title={title}
        onClick={() => setSelected(isSelected ? null : { row, col })}
        className={`relative h-[22px] min-w-[96px] max-w-[180px] px-1 border-r border-b ${GRID_BORDER} text-[12px] leading-[21px] whitespace-nowrap overflow-hidden text-ellipsis cursor-cell ${
          numeric ? 'text-right tabular-nums' : 'text-left'
        } ${cls || 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100'} ${
          isSelected ? 'outline-2 outline-[#217346] -outline-offset-2 z-[1]' : ''
        }`}
      >
        {/* Excel-style corner marker for a cell whose formula changed */}
        {formulaMark && (
          <span
            className="absolute top-0 left-0 w-0 h-0 border-t-[7px] border-r-[7px] border-t-violet-600 border-r-transparent"
            aria-hidden="true"
          />
        )}
        {content}
      </td>
    );
  };

  /** Excel's grey headers; inserted/deleted rows and columns tinted, the selected cell's headers highlighted. */
  const axisHeaderCls = (slot: ReuploadAxisSlot, isActive: boolean) =>
    slot.status === 'added'
      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
      : slot.status === 'deleted'
        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 line-through'
        : isActive
          ? 'bg-[#d3f0e0] dark:bg-[#1e3a2c] text-[#217346] dark:text-emerald-300'
          : 'bg-[#f3f3f3] dark:bg-zinc-800 text-[#444] dark:text-zinc-400';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] xl:max-w-[1280px] h-[88vh] p-0 gap-0 overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-600" />
            <span>{dialogTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
            {description ?? (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="font-mono">{uploadedFileName}</span>
                <span>will replace the contents of</span>
                <span className="font-mono">{currentSpreadsheet.fileName}</span>
                <span>(workbook links and document assignments are kept).</span>
              </>
            )}
          </DialogDescription>

          {/* Totals + legend */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-0 font-mono">
                +{totals.addedRows} rows
              </Badge>
              <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-0 font-mono">
                −{totals.deletedRows} rows
              </Badge>
              <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-0 font-mono">
                +{totals.addedCols} cols
              </Badge>
              <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-0 font-mono">
                −{totals.deletedCols} cols
              </Badge>
              <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-0 font-mono">
                {totals.changedCells} cells changed
              </Badge>
              {totals.formulaCells > 0 && (
                <Badge className="bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 border-0 font-mono">
                  {totals.formulaCells} formulas changed
                </Badge>
              )}
              {totals.addedTabs > 0 && (
                <Badge className="bg-emerald-600 text-white border-0 font-mono">+{totals.addedTabs} tabs</Badge>
              )}
              {totals.deletedTabs > 0 && (
                <Badge className="bg-red-600 text-white border-0 font-mono">−{totals.deletedTabs} tabs</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400">
              <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${ADDED_CLS}`} />New</span>
              <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${DELETED_CLS}`} />Deleted</span>
              <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${MODIFIED_CLS}`} />Changed</span>
              <span className="flex items-center gap-1">
                <span className="relative w-3 h-3 rounded-sm bg-white border border-[#e1e1e1] overflow-hidden">
                  <span className="absolute top-0 left-0 w-0 h-0 border-t-[6px] border-r-[6px] border-t-violet-600 border-r-transparent" />
                </span>
                Formula changed
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Tab strip */}
        <div className="flex items-center justify-between gap-3 px-5 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {diff.tabs.map((t) => (
              <button
                key={`${t.status}-${t.name}`}
                type="button"
                onClick={() => setActiveTabName(t.name)}
                className={`shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono cursor-pointer transition-colors ${
                  t.name === tab?.name
                    ? 'bg-white dark:bg-zinc-900 border-emerald-500 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'bg-transparent border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900'
                } ${t.status === 'deleted' ? 'line-through' : ''}`}
              >
                <span>{t.name}</span>
                <span className="text-[10px] no-underline"><TabSummary tab={t} /></span>
              </button>
            ))}
          </div>
          {tab && (
            <span
              className="shrink-0 text-[11px] font-mono text-slate-500 dark:text-zinc-400"
              title="Used range (last populated row × column) of each version of this tab"
            >
              {currentLabel} {tab.rows.filter((s) => s.baseIndex !== null).length}×
              {tab.cols.filter((s) => s.baseIndex !== null).length}
              {currentSpreadsheet.updatedAt
                ? ` (saved ${new Date(currentSpreadsheet.updatedAt).toLocaleString()})`
                : ''}
              {' → '}{uploadedLabel} {tab.rows.filter((s) => s.nextIndex !== null).length}×
              {tab.cols.filter((s) => s.nextIndex !== null).length}
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {changedRowKeys.length > 0 && (
              <div className="flex items-center gap-1 mr-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => jumpToChange(-1)}
                  className="h-7 w-7 p-0"
                  title="Previous change"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => jumpToChange(1)}
                  className="h-7 w-7 p-0"
                  title="Next change"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 min-w-[64px]">
                  {changeCursor >= 0 ? `${changeCursor + 1} / ` : ''}
                  {changedRowKeys.length} changed
                </span>
              </div>
            )}
            <Checkbox
              id="reupload-changes-only"
              checked={changesOnly}
              onCheckedChange={(v) => setChangesOnly(v === true)}
            />
            <Label htmlFor="reupload-changes-only" className="text-xs cursor-pointer">
              Show changed rows only
            </Label>
          </div>
        </div>

        {/* Formula changes, spelled out (cells show values; this shows what the math became) */}
        {formulaChanges.length > 0 && (
          <div className="px-5 py-2 border-b border-slate-200 dark:border-zinc-800 bg-violet-50/60 dark:bg-violet-950/20">
            <button
              type="button"
              onClick={() => setShowFormulaList((v) => !v)}
              className="text-xs font-semibold text-violet-800 dark:text-violet-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="font-bold italic">ƒ</span>
              {formulaChanges.length} formula{formulaChanges.length === 1 ? '' : 's'} changed in this tab
              {showFormulaList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showFormulaList && (
              <ul className="mt-1.5 max-h-32 overflow-auto space-y-0.5 font-mono text-[11px]">
                {formulaChanges.map((f) => (
                  <li key={f.ref}>
                    <button
                      type="button"
                      onClick={() => jumpToRow(f.rowKey)}
                      className="w-full text-left flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40 cursor-pointer"
                      title="Show this cell"
                    >
                      <span className="w-12 shrink-0 font-bold text-violet-800 dark:text-violet-300">{f.ref}</span>
                      <span className="text-red-700 dark:text-red-400 line-through truncate">{f.beforeFormula ?? 'no formula'}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-700 dark:text-emerald-400 truncate">{f.afterFormula ?? 'no formula'}</span>
                      <span className="ml-auto shrink-0 text-slate-500 dark:text-zinc-400">
                        {f.before === f.after ? `= ${f.after}` : `${f.before} → ${f.after}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Formula bar (Excel layout: name box | fx | contents), for the clicked cell */}
        <div className="px-3 py-1.5 border-b border-slate-200 dark:border-zinc-800 bg-[#f8f9fa] dark:bg-zinc-950/60 text-[12px]" style={{ fontFamily: EXCEL_FONT }}>
          <div className="flex items-stretch gap-1.5">
            <div
              className="w-24 shrink-0 px-2 py-0.5 bg-white dark:bg-zinc-900 border border-[#c6c6c6] dark:border-zinc-700 text-slate-900 dark:text-zinc-100 truncate"
              title={selectedDetail?.movedFrom ? `Was ${selectedDetail.movedFrom}` : undefined}
            >
              {selectedDetail?.ref ?? ''}
              {selectedDetail?.movedFrom && <span className="text-slate-400 text-[10px]"> ←{selectedDetail.movedFrom}</span>}
            </div>
            <div className="shrink-0 px-1.5 flex items-center italic font-serif text-slate-500 dark:text-zinc-400">fx</div>
            <div className="flex-1 min-w-0 px-2 py-0.5 bg-white dark:bg-zinc-900 border border-[#c6c6c6] dark:border-zinc-700 text-slate-900 dark:text-zinc-100 truncate">
              {selectedDetail
                ? selectedDetail.after !== null
                  ? selectedDetail.afterFormula ?? selectedDetail.after
                  : selectedDetail.beforeFormula ?? selectedDetail.before
                : <span className="text-slate-400">Click a cell to see its value and formula before and after.</span>}
            </div>
          </div>
          {selectedDetail && (
            <div className="flex items-center gap-4 flex-wrap mt-1 pl-1 text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-zinc-300">{selectedDetail.label}</span>
              {selectedDetail.before !== null && (
                <span>
                  <span className="text-slate-500">{currentLabel}: </span>
                  <span className="text-red-700 dark:text-red-400 tabular-nums">{selectedDetail.before || '(empty)'}</span>
                  {selectedDetail.beforeFormula && <span className="text-slate-500"> {selectedDetail.beforeFormula}</span>}
                </span>
              )}
              {selectedDetail.after !== null && (
                <span>
                  <span className="text-slate-500">{uploadedLabel}: </span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{selectedDetail.after || '(empty)'}</span>
                  {selectedDetail.afterFormula && <span className="text-slate-500"> {selectedDetail.afterFormula}</span>}
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Diff grid */}
        <div ref={gridRef} className="flex-1 overflow-auto">
          {!tab || (changesOnly && renderedRows.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 p-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No changes in this tab</div>
              <div className="text-xs">{uploadedLabel} and {currentLabel.toLowerCase()} versions of this worksheet match.</div>
            </div>
          ) : (
            <table className="border-separate border-spacing-0 text-left bg-white dark:bg-zinc-900" style={{ fontFamily: EXCEL_FONT }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {/* Excel's select-all corner */}
                  <th className={`sticky left-0 z-20 w-11 min-w-11 h-[22px] bg-[#f3f3f3] dark:bg-zinc-800 border-r border-b ${HEADER_BORDER} relative`}>
                    <span className="absolute right-0.5 bottom-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-b-[8px] border-b-[#b4b4b4]" aria-hidden="true" />
                  </th>
                  {tab.cols.map((c) => (
                    <th
                      key={`${c.baseIndex ?? '-'}:${c.nextIndex ?? '-'}`}
                      className={`h-[22px] px-1 border-r border-b ${HEADER_BORDER} text-[12px] font-normal text-center ${axisHeaderCls(
                        c,
                        selected !== null && rowKey(selected.col) === rowKey(c)
                      )} ${selected !== null && rowKey(selected.col) === rowKey(c) ? 'border-b-2 border-b-[#217346]' : ''}`}
                      title={
                        c.status === 'matched' && c.baseIndex !== c.nextIndex
                          ? `Was column ${colToLetter(c.baseIndex!)}`
                          : undefined
                      }
                    >
                      {slotLabel(c, colToLetter)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderedRows.map((dr, idx) =>
                  dr.kind === 'gap' ? (
                    <tr key={`gap-${idx}`}>
                      <td
                        colSpan={tab.cols.length + 1}
                        className={`h-[22px] px-3 text-[11px] italic text-slate-400 bg-[#f8f9fa] dark:bg-zinc-950/60 border-b ${GRID_BORDER}`}
                      >
                        ··· {dr.count} unchanged row{dr.count === 1 ? '' : 's'}
                      </td>
                    </tr>
                  ) : (
                    <tr key={rowKey(dr.slot)} data-row-key={rowKey(dr.slot)}>
                      <th
                        className={`sticky left-0 z-[5] w-11 min-w-11 h-[22px] border-r border-b ${HEADER_BORDER} text-[12px] font-normal text-center ${axisHeaderCls(
                          dr.slot,
                          selected !== null && rowKey(selected.row) === rowKey(dr.slot)
                        )} ${selected !== null && rowKey(selected.row) === rowKey(dr.slot) ? 'border-r-2 border-r-[#217346]' : ''} ${
                          changeCursor >= 0 && changedRowKeys[changeCursor] === rowKey(dr.slot)
                            ? 'ring-2 ring-inset ring-[#217346]'
                            : ''
                        }`}
                        title={
                          dr.slot.status === 'matched' && dr.slot.baseIndex !== dr.slot.nextIndex
                            ? `Was row ${dr.slot.baseIndex}`
                            : undefined
                        }
                      >
                        {slotLabel(dr.slot, String)}
                      </th>
                      {tab.cols.map((c) => renderCell(dr.slot, c))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
          {hiddenRowCount > 0 && (
            <div className="px-4 py-2 text-[11px] text-slate-500 italic">
              Showing the first {MAX_RENDER_ROWS} rows of the preview ({hiddenRowCount} more not displayed).
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-slate-500">
            {diff.hasChanges
              ? `Row and column numbers show the ${uploadedLabel.toLowerCase()} layout. Hover a cell for details.`
              : `No differences found between the ${uploadedLabel.toLowerCase()} and ${currentLabel.toLowerCase()} workbooks.`}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              {onApply ? 'Cancel' : 'Close'}
            </Button>
            {onApply && (
              <Button
                type="button"
                size="sm"
                disabled={!diff.hasChanges && !allowApplyWithoutChanges}
                onClick={() => onApply(diff)}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {applyLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
