import type { SecFinancialTableTemplate } from '../types/secFilingTemplate';
import { SCRIPT_BAND_FILL, SCRIPT_COLUMN_WIDTHS, SCRIPT_HEADER_FILL, SCRIPT_TABLE_HEADERS } from './socialMediaScriptTemplate';

/**
 * The table template of a script document (the "script" document type): the beats table, with the navy header and white text,
 * banded rows, bold on-screen text and the column widths of the Social Media portal's scripts. It is offered, and used by
 * "save as template", for script documents only; SEC filings have their own (data/financialTableTemplates.ts). It is shaped
 * like the templates the API returns, so the editor treats both the same; a template saved on the server with the same key
 * replaces this one.
 */
const now = '1970-01-01T00:00:00.000Z';

export const SCRIPT_BEATS_TEMPLATE: SecFinancialTableTemplate = {
  id: 'script_beats',
  templateKey: 'script_beats',
  name: 'Script (beats)',
  description: 'Time, what is seen, what is said and the text on screen, as in the Social Media scripts',
  icon: 'table',
  color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-zinc-800',
  sortOrder: 1,
  isBuiltin: true,
  documentType: 'script',
  createdAt: now,
  updatedAt: now,
  block: {
    title: 'Script',
    headers: SCRIPT_TABLE_HEADERS,
    headerShading: SCRIPT_HEADER_FILL,
    headerTextColor: '#FFFFFF',
    boldColumns: [3],
    columnAlignments: ['left', 'left', 'left', 'left'],
    columnWidths: SCRIPT_COLUMN_WIDTHS,
    rows: [
      ...[1, 2, 3, 4, 5].map((n) => ({
        id: `sb-r${n}`, type: 'data' as const, cells: ['', '', '', ''], ...(n % 2 === 0 ? { shading: SCRIPT_BAND_FILL } : {}),
      })),
    ],
  },
};

/** The script tables (only the beats table for now). */
export const SCRIPT_TABLE_TEMPLATES: SecFinancialTableTemplate[] = [SCRIPT_BEATS_TEMPLATE];
