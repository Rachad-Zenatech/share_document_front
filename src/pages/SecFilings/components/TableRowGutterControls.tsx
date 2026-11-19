import React from 'react';
import { Pin, Plus } from 'lucide-react';
import type { SecTableRow } from '../../../types/secFiling';

const MIN_ROW_HEIGHT = 28;
const MAX_ROW_HEIGHT = 480;

/** Insert new rows before the first pinned footer row so footers stay anchored at the bottom. */
export function nextInsertIndexForAddRow(rows: SecTableRow[]): number {
  const firstFooter = rows.findIndex((r) => r.isFooter);
  return firstFooter === -1 ? rows.length : firstFooter;
}

/**
 * Fancy row-gutter overlays for financial & script tables:
 * - Pinned footer badge
 * - Hover line between rows with a "+" button to insert a row right there
 * - Drag handle at the bottom edge of the row to resize row height (double-click resets to auto)
 */
export function TableRowGutterOverlays({
  rowIdx,
  isFooter,
  isLastRow,
  onInsertAt,
  onResizeHeight,
}: {
  rowIdx: number;
  isFooter?: boolean;
  isLastRow?: boolean;
  onInsertAt: (targetIdx: number) => void;
  onResizeHeight: (height: number | undefined) => void;
}) {
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const tr = event.currentTarget.closest('tr');
    const startHeight = tr ? tr.getBoundingClientRect().height : 36;
    const startY = event.clientY;
    let latest = Math.round(startHeight);

    const onMove = (moveEvent: PointerEvent) => {
      latest = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(startHeight + (moveEvent.clientY - startY))));
      if (tr) tr.style.height = `${latest}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onResizeHeight(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {isFooter && (
        <span title="Pinned footer row" className="absolute left-0.5 top-0.5 text-blue-600 dark:text-blue-400">
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Drag to resize row height (double-click to reset)"
        onPointerDown={startResize}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onResizeHeight(undefined);
        }}
        className={`group/insert absolute inset-x-0 ${isLastRow ? 'bottom-0' : '-bottom-1.5'} z-20 flex h-3 cursor-row-resize items-center justify-center touch-none`}
      >
        <span className="pointer-events-none h-0.5 w-full rounded-full bg-transparent transition-colors group-hover/insert:bg-blue-500" />
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onInsertAt(isFooter ? rowIdx : rowIdx + 1);
          }}
          title={isFooter ? 'Insert row above footer' : 'Insert row below'}
          aria-label={isFooter ? 'Insert row above footer' : 'Insert row below'}
          className="absolute left-1/2 -translate-x-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 ring-1 ring-white shadow-sm transition-opacity group-hover/row:opacity-80 group-hover/insert:!opacity-100 hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      </div>
    </>
  );
}
