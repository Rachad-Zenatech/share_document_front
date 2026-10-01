import type { SecFinancialTableBlock } from './secFiling';

/**
 * The structure a template copies into a `financial_table` block. Matches
 * `SecFinancialTableBlockPayload` in the backend's `models/sec_filing_model.py`;
 * keep the two in step.
 */
export type SecFinancialTableTemplateBlock = Pick<
  SecFinancialTableBlock,
  'title' | 'headers' | 'headerShading' | 'columnAlignments' | 'columnWidths' | 'rows' | 'footnotes'
  | 'periodHeaders'
>;

/** A template as returned by `GET /api/sec-filings/table-templates`. */
export interface SecFinancialTableTemplate {
  id: string;
  templateKey: string;
  name: string;
  description?: string;
  badge?: string;
  /** Icon name resolved to a lucide component by the frontend. */
  icon: string;
  color?: string;
  sortOrder: number;
  /** Seeded templates can be edited but not deleted. */
  isBuiltin: boolean;
  block: SecFinancialTableTemplateBlock;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface SecFinancialTableTemplateList {
  templates: SecFinancialTableTemplate[];
  total: number;
}

export interface SecFinancialTableTemplateCreate {
  name: string;
  description?: string;
  badge?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  templateKey?: string;
  block: SecFinancialTableTemplateBlock;
}

export type SecFinancialTableTemplateUpdate = Partial<
  Omit<SecFinancialTableTemplateCreate, 'templateKey'>
>;

export interface SecFinancialTableTemplateDeleteResult {
  id: string;
  deleted: boolean;
}
