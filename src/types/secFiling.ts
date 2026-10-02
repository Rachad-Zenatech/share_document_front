export type SecBlockType =
  | 'heading'
  | 'paragraph'
  | 'financial_table'
  | 'callout'
  | 'signature'
  | 'divider'
  | 'metadata'
  | 'image';

export type SecHeadingLevel = 1 | 2 | 3 | 4;

export type SecBlockSpacing = 'compact' | 'normal' | 'relaxed' | 'loose';

export interface SecHeadingBlock {
  id: string;
  type: 'heading';
  section: string;
  level: SecHeadingLevel;
  text: string;
  alignment: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  lineSpacing?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecParagraphBlock {
  id: string;
  type: 'paragraph';
  section: string;
  text: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  noteNumber?: string;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  lineSpacing?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecTableRow {
  id: string;
  type: 'header' | 'category_header' | 'section_title' | 'data' | 'subtotal' | 'total' | 'blank';
  cells: string[];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  doubleUnderline?: boolean;
  shading?: string;
  indent?: number; // 0, 1, 2, 3 indentation level
  /**
   * Per-row horizontal alignment override. When set it wins over the column's own
   * alignment for every cell in the row, which is how a comparative-period caption
   * row ("2026" / "2025") gets centered above right-aligned figure columns.
   */
  align?: 'left' | 'center' | 'right';
  /** Per-cell horizontal alignment overrides: row 5 col 2 can be centered individually. */
  cellAlignments?: ('left' | 'center' | 'right' | null | undefined)[];
}

/** Centered multi-line comparative reporting-period label above one value column. */
export interface SecTablePeriodHeader {
  columnIndex: number;
  lines: string[];
}

export interface SecFinancialTableBlock {
  id: string;
  type: 'financial_table';
  section: string;
  title?: string;
  headers: string[];
  periodHeaders?: SecTablePeriodHeader[];
  headerShading?: string;
  columnAlignments: ('left' | 'center' | 'right')[];
  columnWidths?: string[];
  rows: SecTableRow[];
  footnotes?: string[];
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecCalloutBlock {
  id: string;
  type: 'callout';
  section: string;
  variant: 'info' | 'warning' | 'notice' | 'unaudited' | 'success';
  title?: string;
  content: string;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export type ESignProvider = 'docusign' | 'dropbox_sign';
export type ESignDeliveryMethod = 'SMS' | 'WhatsApp' | 'Email_and_SMS';

export interface SecSignatureOfficer {
  id: string;
  name: string;
  title: string;
  date: string;
  signatureText?: string;
  signed: boolean;
  phoneNumber?: string;
  email?: string;
  provider?: ESignProvider;
  deliveryMethod?: ESignDeliveryMethod;
  envelopeId?: string;
  status?: 'pending_signature' | 'sent_sms' | 'signed' | 'declined';
  signedAt?: string;
  signedVia?: string;
  signatureImageUrl?: string;
  auditTrailId?: string;
  ipAddress?: string;
}

export interface SecSignatureBlock {
  id: string;
  type: 'signature';
  section: string;
  title?: string;
  officers: SecSignatureOfficer[];
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecDividerBlock {
  id: string;
  type: 'divider';
  section: string;
  pageBreak: boolean;
  label?: string;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecMetadataBlock {
  id: string;
  type: 'metadata';
  section: string;
  companyName: string;
  symbol: string;
  cik: string;
  formType: string;
  periodEnded: string;
  currency: string;
  fiscalYear: string;
  filingDate: string;
  documentTitle: string;
  jurisdiction: string;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export interface SecImageBlock {
  id: string;
  type: 'image';
  section: string;
  url: string;
  alt?: string;
  caption?: string;
  alignment: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  spacing?: SecBlockSpacing;
  spacingTop?: number;
  spacingBottom?: number;
  updatedAt?: string;
  modifiedBy?: string;
}

export type SecBlock =
  | SecHeadingBlock
  | SecParagraphBlock
  | SecFinancialTableBlock
  | SecCalloutBlock
  | SecSignatureBlock
  | SecDividerBlock
  | SecMetadataBlock
  | SecImageBlock;

export interface SpreadsheetTab {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  maxCol: string; // e.g. "AW"
  colLetters?: string[];
  headers?: string[];
  cells: Record<string, string | number | boolean>;
}

export interface AttachedSpreadsheet {
  id: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  colCount: number;
  maxCol: string; // e.g. "AW"
  colLetters?: string[]; // e.g. ["A", "B", ... "AW"]
  headers?: string[]; // e.g. Column headers
  cells: Record<string, string | number | boolean>; // e.g. { "A1": "ZenaTech...", "B8": 639739.32 }
  tabs?: SpreadsheetTab[];
  activeTabId?: string;
  updatedAt?: string;
  assignedDocIds?: string[]; // IDs of documents linked to this spreadsheet
  description?: string;
}

export interface SecFilingDocument {
  id: string;
  title: string;
  symbol: string;
  formType: string;
  period: string;
  currency: string;
  status: 'draft' | 'under_review' | 'approved' | 'filed';
  version: string;
  versionNumber: number;
  blocks: SecBlock[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
  lockedBy?: string | null;
  attachedSpreadsheetId?: string;
  attachedSpreadsheet?: AttachedSpreadsheet | null;
}

export interface SecChangeProposal {
  id: string;
  title: string;
  author: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'pending_review' | 'merged' | 'rejected';
  baseVersion: string;
  baseVersionNumber: number;
  blocks: SecBlock[];
  changeSummary: {
    addedCount: number;
    modifiedCount: number;
    deletedCount: number;
    description: string;
  };
  assignedSection?: string;
  inviteToken?: string;
  submissionNotes?: string;
  submittedAt?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SecVersionSnapshot {
  id: string;
  version: string;
  versionNumber: number;
  timestamp: string;
  author: string;
  description: string;
  blocks: SecBlock[];
  proposalId?: string;
}

export type SecChangeCategory =
  | 'spacing'
  | 'typography'
  | 'content'
  | 'structure'
  | 'financial_data'
  | 'signature'
  | 'metadata';

export interface SecChangeTag {
  category: SecChangeCategory;
  label: string;
  detail?: string;
}

export interface SecTableCellDiff {
  rowIndex: number;
  colIndex: number;
  rowId?: string;
  rowLabel?: string;
  headerLabel?: string;
  oldValue: string;
  newValue: string;
  status: 'cell_modified' | 'row_added' | 'row_deleted';
}

export interface SecBlockDiff {
  blockId: string;
  status: 'unchanged' | 'added' | 'modified' | 'deleted';
  changeCategories?: SecChangeCategory[];
  changeTags?: SecChangeTag[];
  isSpacingOnly?: boolean;
  isTypographyOnly?: boolean;
  isContentModified?: boolean;
  originalBlock?: SecBlock;
  proposedBlock?: SecBlock;
  fieldDiffs?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  tableCellDiffs?: SecTableCellDiff[];
}

export interface SecDocumentSummary {
  id: string;
  title: string;
  formType: string;
  period?: string;
  updatedAt: string;
  createdAt: string;
  owner: string;
  isShared: boolean;
  version: string;
  versionNumber?: number;
  blocksCount: number;
  templateType?: string;
}

