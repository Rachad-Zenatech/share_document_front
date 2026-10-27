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

/**
 * Status of a single cell inside a matched row and matched column. `formula`: same value,
 * but the formula behind it was changed, added or removed.
 */
export type ReuploadCellStatus = 'unchanged' | 'added' | 'deleted' | 'modified' | 'formula';

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
  /** Displayed values by cell ref (formulas evaluated); the tabs above keep the raw formulas. */
  baseValues: Record<string, string | number | boolean>;
  nextValues: Record<string, string | number | boolean>;
  rows: ReuploadAxisSlot[];
  cols: ReuploadAxisSlot[];
  addedRows: number;
  deletedRows: number;
  addedCols: number;
  deletedCols: number;
  addedCells: number;
  deletedCells: number;
  modifiedCells: number;
  /** Cells whose formula changed (also counted above when their value changed too). */
  formulaCells: number;
  hasChanges: boolean;
}

export interface WorkbookReuploadDiff {
  tabs: ReuploadTabDiff[];
  hasChanges: boolean;
}
