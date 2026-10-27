import type { SpreadsheetTab } from './secFiling';

export type SpreadsheetCellValue =string | number | boolean | undefined;

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

/** Status of a row or column slot when comparing a re-uploaded workbook against the current one. */
export type ReuploadSlotStatus = 'matched' | 'added' | 'deleted';

/** Status of a single cell inside a matched row and matched column. */
export type ReuploadCellStatus = 'unchanged' | 'added' | 'deleted' | 'modified';

/** One aligned row or column; indices are 1-based and null on the side where the slot does not exist. */
export interface ReuploadAxisSlot {
  status: ReuploadSlotStatus;
  baseIndex: number | null;
  nextIndex: number | null;
}

export interface ReuploadTabDiff {
  name: string;
  status: 'matched' | 'added' | 'deleted';
  baseTab: SpreadsheetTab | null;
  nextTab: SpreadsheetTab | null;
  rows: ReuploadAxisSlot[];
  cols: ReuploadAxisSlot[];
  addedRows: number;
  deletedRows: number;
  addedCols: number;
  deletedCols: number;
  addedCells: number;
  deletedCells: number;
  modifiedCells: number;
  hasChanges: boolean;
}

export interface WorkbookReuploadDiff {
  tabs: ReuploadTabDiff[];
  hasChanges: boolean;
}
