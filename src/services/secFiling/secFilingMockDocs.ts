import type { SecFilingDocument, SecBlock } from '../../types/secFiling';
import { INITIAL_SEC_FILING_DOC } from '../../data/initialSecFilingData';
import { compactFinancialTableBlock } from './secFilingDiff';

export function sanitizeAndCompactBlocks(blocks: SecBlock[]): SecBlock[] {
  return blocks.map((b) => {
    if (b.type === 'financial_table' && b.rows) {
      return compactFinancialTableBlock(b);
    }
    return b;
  });
}

export function generateSarahJenkinsMergedDoc(
  title = 'ZenaTech_SEC_Filing_v24_(Merged_Sarah_Jenkins)'
): SecFilingDocument {
  const base = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
  const blocks = base.blocks.map((b: any) => {
    if (b.text && b.text.includes('The Company maintains term loan facilities')) {
      return {
        ...b,
        text:
          b.text +
          ' During Q2 2026, additional loan borrowings of $3,300,000 were drawn down to support specialized aerial hardware manufacturing equipment. All financial covenants remained in full compliance as of June 30, 2026.',
        updatedAt: '2026-08-15T11:45:00Z',
        modifiedBy: 'Sarah Jenkins'
      };
    }
    return b;
  });
  return {
    ...base,
    id: 'sec-doc-zenatech-v24-sarah-jenkins',
    title,
    formType: 'Form 10-Q / Interim Consolidated',
    period: 'For the Six Months Ended June 30, 2026 and June 30, 2025',
    version: 'v24 (Merged Sarah Jenkins)',
    versionNumber: 24,
    blocks,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: 'Sarah Jenkins, CPA'
  };
}
