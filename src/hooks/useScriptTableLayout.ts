import { useLayoutEffect, useMemo, useState } from 'react';
import type { SecFinancialTableBlock } from '../types/secFiling';
import { scriptColumnWidths } from './useScriptColumnResize';
import { fitScriptColumns, scriptColumnMinimums, SCRIPT_ROW_HANDLE_WIDTH } from '../utils/scriptTableLayout';

export function useScriptTableLayout(block: SecFinancialTableBlock, enabled: boolean) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(742);
  const minimums = useMemo(() => enabled ? scriptColumnMinimums(block) : [], [block, enabled]);
  useLayoutEffect(() => {
    const element = container;
    if (!enabled || !element) return;
    const update = () => setAvailable(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, container]);
  const widths = enabled ? fitScriptColumns(scriptColumnWidths(block.columnWidths, block.headers.length), minimums, available - SCRIPT_ROW_HANDLE_WIDTH) : [];
  return { setContainer, widths, minimums, minWidth: minimums.reduce((sum, width) => sum + width, SCRIPT_ROW_HANDLE_WIDTH) };
}
