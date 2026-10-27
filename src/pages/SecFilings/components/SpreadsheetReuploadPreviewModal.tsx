import React, { useMemo, useState } from 'react';
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
import { FileSpreadsheet, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { AttachedSpreadsheet } from '../../../types/secFiling';
import type { ReuploadAxisSlot, ReuploadTabDiff, WorkbookReuploadDiff } from '../../../types/spreadsheet';
import { colToLetter, formatCellValue } from '../../../utils/documentVariables';
import {
  computeWorkbookReuploadDiff,
  getReuploadCellStatus
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

/** Hard cap on rendered grid rows to keep very large workbooks responsive. */
const MAX_RENDER_ROWS = 400;
/** Unchanged rows kept around each change when "changes only" is on. */
const CONTEXT_ROWS = 1;

type DisplayRow = { kind: 'row'; slot: ReuploadAxisSlot } | { kind: 'gap'; count: number };

const ADDED_CLS = 'bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
const DELETED_CLS = 'bg-red-100/80 dark:bg-red-950/50 text-red-700 dark:text-red-300 line-through';
const MODIFIED_CLS = 'bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200';

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
  const [changesOnly, setChangesOnly] = useState(true);

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
      addedTabs: diff.tabs.filter((t) => t.status === 'added').length,
      deletedTabs: diff.tabs.filter((t) => t.status === 'deleted').length
    };
  }, [diff]);

  const baseCells = tab?.baseTab?.cells || {};
  const nextCells = tab?.nextTab?.cells || {};
  const baseValue = (row: number, col: number) => baseCells[colToLetter(col) + row];
  const nextValue = (row: number, col: number) => nextCells[colToLetter(col) + row];

  /** Whether a row contains anything that differs between the two versions. */
  const rowHasChange = (slot: ReuploadAxisSlot): boolean => {
    if (!tab) return false;
    if (slot.status !== 'matched') return true;
    return tab.cols.some((c) => {
      if (c.status === 'added') return formatCellValue(nextValue(slot.nextIndex!, c.nextIndex!)) !== '';
      if (c.status === 'deleted') return formatCellValue(baseValue(slot.baseIndex!, c.baseIndex!)) !== '';
      return (
        getReuploadCellStatus(baseValue(slot.baseIndex!, c.baseIndex!), nextValue(slot.nextIndex!, c.nextIndex!)) !==
        'unchanged'
      );
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

  const renderCell = (row: ReuploadAxisSlot, col: ReuploadAxisSlot) => {
    let cls: string;
    let content: React.ReactNode;
    let title: string;

    if (row.status === 'deleted' || col.status === 'deleted') {
      const v = row.baseIndex && col.baseIndex ? formatCellValue(baseValue(row.baseIndex, col.baseIndex)) : '';
      cls = DELETED_CLS;
      content = v;
      title = v ? `Removed: ${v}` : 'Removed';
    } else if (row.status === 'added' || col.status === 'added') {
      const v = row.nextIndex && col.nextIndex ? formatCellValue(nextValue(row.nextIndex, col.nextIndex)) : '';
      cls = ADDED_CLS;
      content = v;
      title = v ? `New: ${v}` : 'New';
    } else {
      const before = baseValue(row.baseIndex!, col.baseIndex!);
      const after = nextValue(row.nextIndex!, col.nextIndex!);
      const status = getReuploadCellStatus(before, after);
      const b = formatCellValue(before);
      const a = formatCellValue(after);
      if (status === 'added') {
        cls = ADDED_CLS;
        content = a;
        title = `New value: ${a}`;
      } else if (status === 'deleted') {
        cls = DELETED_CLS;
        content = b;
        title = `Cleared: ${b}`;
      } else if (status === 'modified') {
        cls = MODIFIED_CLS;
        content = (
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] line-through text-red-600/80 dark:text-red-400/80 truncate">{b}</span>
            <span className="truncate">{a}</span>
          </span>
        );
        title = `${b} → ${a}`;
      } else {
        cls = 'text-slate-700 dark:text-zinc-300';
        content = a;
        title = a;
      }
    }

    return (
      <td
        key={`${col.baseIndex ?? '-'}:${col.nextIndex ?? '-'}`}
        title={title}
        className={`h-8 min-w-[110px] max-w-[160px] px-1.5 border-r border-b border-slate-200 dark:border-zinc-800 font-mono text-[11px] truncate ${cls}`}
      >
        {content}
      </td>
    );
  };

  const axisHeaderCls = (slot: ReuploadAxisSlot) =>
    slot.status === 'added'
      ? 'bg-emerald-500 text-white'
      : slot.status === 'deleted'
        ? 'bg-red-500 text-white line-through'
        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400';

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

        {/* Diff grid */}
        <div className="flex-1 overflow-auto">
          {!tab || (changesOnly && renderedRows.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 p-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No changes in this tab</div>
              <div className="text-xs">{uploadedLabel} and {currentLabel.toLowerCase()} versions of this worksheet match.</div>
            </div>
          ) : (
            <table className="border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 w-12 min-w-12 h-7 bg-slate-100 dark:bg-zinc-800 border-r border-b border-slate-200 dark:border-zinc-700" />
                  {tab.cols.map((c) => (
                    <th
                      key={`${c.baseIndex ?? '-'}:${c.nextIndex ?? '-'}`}
                      className={`h-7 px-1.5 border-r border-b border-slate-200 dark:border-zinc-700 text-[10px] font-semibold text-center ${axisHeaderCls(c)}`}
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
                        className="h-6 px-3 text-[10px] italic text-slate-400 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800"
                      >
                        ··· {dr.count} unchanged row{dr.count === 1 ? '' : 's'}
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${dr.slot.baseIndex ?? '-'}:${dr.slot.nextIndex ?? '-'}`}>
                      <th
                        className={`sticky left-0 z-[5] w-12 min-w-12 h-8 border-r border-b border-slate-200 dark:border-zinc-700 text-[10px] font-semibold text-center ${axisHeaderCls(dr.slot)}`}
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
