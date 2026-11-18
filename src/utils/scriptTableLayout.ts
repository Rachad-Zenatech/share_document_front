import type { SecFinancialTableBlock } from '../types/secFiling';

export const SCRIPT_ROW_HANDLE_WIDTH = 36;

/** Space for a full header, its menu, and at least one readable word in each cell. */
export function scriptColumnMinimums(block: SecFinancialTableBlock): number[] {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const context = canvas?.getContext('2d');
  const measure = (text: string) => context ? context.measureText(text).width : text.length * 7;
  if (context) context.font = 'bold 13px Arial';
  return block.headers.map((header, index) => {
    const headerWidth = measure(header) + 44;
    const words = block.rows.flatMap((row) => (row.cells[index] || '').split(/\s+/));
    const wordWidth = Math.max(0, ...words.map((word) => measure(word)));
    return Math.ceil(Math.max(88, headerWidth, Math.min(192, wordWidth + 24)));
  });
}

/** Fit saved proportions without making a narrow column smaller than its readable minimum. */
export function fitScriptColumns(weights: number[], minimums: number[], available: number): number[] {
  const result = Array<number>(weights.length).fill(0);
  const pending = new Set(weights.map((_, index) => index));
  let remaining = Math.max(available, minimums.reduce((sum, width) => sum + width, 0));
  while (pending.size) {
    const weight = [...pending].reduce((sum, index) => sum + weights[index], 0);
    const constrained = [...pending].filter((index) => remaining * weights[index] / weight < minimums[index]);
    if (!constrained.length) {
      for (const index of pending) result[index] = remaining * weights[index] / weight;
      break;
    }
    for (const index of constrained) {
      result[index] = minimums[index];
      remaining -= result[index];
      pending.delete(index);
    }
  }
  return result;
}
