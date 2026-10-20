import type { SecBlock } from '../../types/secFiling';
import { compactFinancialTableBlock } from './secFilingDiff';

/**
 * Sanitizes and compacts block data, ensuring financial tables are compact
 * and stripped of redundant whitespace/cells before saving to storage or parsing.
 */
export function sanitizeAndCompactBlocks(blocks: SecBlock[]): SecBlock[] {
  return blocks.map((b) => {
    if (b.type === 'financial_table' && b.rows) {
      return compactFinancialTableBlock(b);
    }
    return b;
  });
}
