export type SpreadsheetCellValue = string | number | boolean | undefined;

export interface SpreadsheetChange {
  cellRef: string;
  before: SpreadsheetCellValue;
  after: SpreadsheetCellValue;
}

export interface SpreadsheetProposal {
  id: string;
  title: string;
  author: { name: string; email?: string };
  changes: SpreadsheetChange[];
  status: 'draft' | 'pending_review' | 'merged' | 'rejected';
  createdAt: string;
  mergedAt?: string;
}
