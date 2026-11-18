import { useEffect, useRef, type PointerEvent } from 'react';
import type { SecFinancialTableBlock } from '../types/secFiling';

export function scriptColumnWidths(widths: string[] | undefined, count: number): number[] {
  const defaults = count === 4 ? [7, 29, 40, 24] : Array<number>(count).fill(100 / count);
  const values = defaults.map((fallback, index) => {
    const width = widths?.[index];
    const parsed = width?.endsWith('%') ? Number.parseFloat(width) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  });
  const total = values.reduce((sum, width) => sum + width, 0);
  return values.map((width) => width * 100 / total);
}

export function resizedScriptColumns(widths: number[], index: number, delta: number, minimum: number | number[]): number[] {
  if (widths.length < 2) return widths;
  const neighbor = index === widths.length - 1 ? index - 1 : index + 1;
  const pair = widths[index] + widths[neighbor];
  const ownMinimum = typeof minimum === 'number' ? minimum : minimum[index];
  const neighborMinimum = typeof minimum === 'number' ? minimum : minimum[neighbor];
  const scale = Math.min(1, pair / (ownMinimum + neighborMinimum));
  const lower = ownMinimum * scale;
  const upper = pair - neighborMinimum * scale;
  const next = [...widths];
  next[index] = Math.max(lower, Math.min(upper, widths[index] + delta));
  next[neighbor] = pair - next[index];
  return next;
}

export function useScriptColumnResize(block: SecFinancialTableBlock, onUpdate: (update: Partial<SecFinancialTableBlock>) => void) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return (event: PointerEvent<HTMLSpanElement>, index: number) => {
    if (event.button !== 0 || block.headers.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const table = event.currentTarget.closest('table');
    if (!table) return;
    const columns = Array.from(table.querySelectorAll<HTMLTableColElement>('col[data-script-column]'));
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('th[data-script-column]'));
    const pixels = headers.map((header) => header.getBoundingClientRect().width);
    const total = pixels.reduce((sum, width) => sum + width, 0);
    if (!total) return;
    const widths = pixels.map((width) => width / total * 100);
    const minimums = columns.map((column) => Number(column.dataset.minWidth || 88) / total * 100);
    const start = event.clientX;
    let next = widths;
    const cursor = document.body.style.cursor;
    const selection = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const restore = () => columns.forEach((column, i) => { column.style.width = `${pixels[i]}px`; });
    const dispose = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      document.body.style.cursor = cursor;
      document.body.style.userSelect = selection;
      cleanup.current = null;
    };
    const move = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      next = resizedScriptColumns(widths, index, (pointer.clientX - start) / total * 100, minimums);
      columns.forEach((column, i) => { column.style.width = `${next[i] / 100 * total}px`; });
    };
    const finish = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      move(pointer);
      dispose();
      if (pointer.clientX !== start) onUpdate({ columnWidths: next.map((width) => `${width.toFixed(4)}%`) });
    };
    const cancel = () => { restore(); dispose(); };
    cleanup.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
  };
}
