/**
 * The kinds of document the editor handles. Each has its own table templates (the tables offered when adding a table, and
 * the ones "save as template" stores): SEC filings use the financial statement tables, scripts use the script tables.
 * Mirrors `DocumentType` in the backend's models/sec_filings/sec_filing_model.py.
 */
export type DocumentType = 'sec-filing' | 'script';

export const DEFAULT_DOCUMENT_TYPE: DocumentType = 'sec-filing';

export const DOCUMENT_TYPES: { id: DocumentType; label: string; description: string }[] = [
  { id: 'sec-filing', label: 'SEC Filing', description: 'Filings, reports and checklists with financial statement tables' },
  { id: 'script', label: 'Script', description: 'Video scripts: details and a Time / Visual / Voiceover / On-screen text table' },
];

/** The template id and form type of the Social Media Script document (see data/socialMediaScriptTemplate.ts). */
export const SCRIPT_TEMPLATE_ID = 'social-media-script';
export const SCRIPT_FORM_TYPE = 'Social Media Script';

/** The font of a script page (the Social Media portal's script document is set in Arial). */
export const SCRIPT_FONT_FAMILY = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

/** What kind of document this is, from what the document or its list entry says about itself. */
export function documentTypeOf(doc?: { templateType?: string | null; formType?: string | null } | null): DocumentType {
  return doc?.templateType === SCRIPT_TEMPLATE_ID || doc?.formType === SCRIPT_FORM_TYPE ? 'script' : DEFAULT_DOCUMENT_TYPE;
}

/**
 * What each kind of document does and offers (mirrors the backend's services/sec_filings/document_types.py). Code that
 * differs by kind asks this instead of comparing names, so a new kind gets its own controls in one place.
 */
export interface DocumentTypeConfig {
  /** An open editor re-reads the document when the server says someone else changed it. */
  liveSync: boolean;
  /** The document has a review (roles, invites, check-ins, routing, decisions): the review bar is shown. */
  reviewControls: boolean;
}

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, DocumentTypeConfig> = {
  'sec-filing': { liveSync: true, reviewControls: false },
  script: { liveSync: true, reviewControls: true },
};
