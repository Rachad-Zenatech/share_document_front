import { activeDocumentType } from '../../../hooks/useFinancialTableTemplates';
import { SCRIPT_FONT_FAMILY } from '../../../types/documentType';

/**
 * What runs along the top and bottom of every page of the open document depends on its kind: an SEC filing carries the
 * filing's title and period; a script carries nothing on top and, at the foot, the draft notice and its page number (as in the
 * Social Media portal's scripts).
 */

/** Whether the open document is a script (dialogs and labels then speak of scripts, not SEC filings). */
export const isScriptDocument = (): boolean => activeDocumentType() === 'script';

/** What the open document is called in titles and hints. */
export const documentKindLabel = (): string => (isScriptDocument() ? 'Script' : 'SEC Filing');

/** A block type as people read it: a script's table is a script table, not a financial one. */
export const blockTypeLabel = (type: string): string =>
  isScriptDocument() && type === 'financial_table' ? 'script table' : type.replace('_', ' ');

/** Heading of the table-layout menu. */
export const tableTemplatesTitle = (): string => (isScriptDocument() ? 'Script Table Templates' : 'Financial Statement Templates');

/** The title along the top of a page (nothing for a script). */
export function DocumentRunningTitle() {
  if (activeDocumentType() === 'script') return null;
  return <>ZenaTech, Inc. — Form 6-K Interim Report</>;
}

/** The period label at the right of the top of a page (`fallback` is the filing's own). */
export function documentPeriodLabel(fallback: string): string {
  return activeDocumentType() === 'script' ? '' : fallback;
}

/** The font of the pages: a script is set in Arial, as in the Social Media portal; filings keep the Word look (Calibri). */
export function documentFontFamily(viewMode?: string): string | undefined {
  if (activeDocumentType() === 'script') return SCRIPT_FONT_FAMILY;
  return viewMode === 'word' ? 'Calibri, "Segoe UI", Arial, sans-serif' : undefined;
}

/** The foot of a page. */
export function DocumentPageFooter({ page, pages, className = '' }: { page: number; pages: number; className?: string }) {
  const script = activeDocumentType() === 'script';
  return (
    <div className={`pt-6 mt-8 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans select-none relative z-10 ${className}`}>
      <span className="italic">{script ? 'Internal draft. Needs Comms/IR review before publishing.' : 'Confidential — Review Copy (v22)'}</span>
      <span className="font-bold text-[#0E2841] dark:text-blue-400">Page {page}{script ? '' : ` of ${pages}`}</span>
      <span>{script ? '' : 'Unaudited'}</span>
    </div>
  );
}
