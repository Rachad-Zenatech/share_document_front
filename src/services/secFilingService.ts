import type {
  SecFilingDocument,
  SecChangeProposal,
  SecVersionSnapshot,
  SecBlock,
  SecBlockDiff,
  SecTableCellDiff,
  SecChangeCategory,
  SecChangeTag,
  SecDocumentSummary,
  AttachedSpreadsheet,
  AttachedSpreadsheetPayload,
  AttachedSpreadsheetRecord,
  AttachedSpreadsheetResponse
} from '../types/secFiling';
import { INITIAL_SEC_FILING_DOC, INITIAL_PROPOSALS, INITIAL_VERSION_HISTORY } from '../data/initialSecFilingData';
import { DEFAULT_TRIAL_BALANCE_SHEET } from '../data/defaultTrialBalanceSheet';
import { colToLetter, formatCellValue } from '../utils/documentVariables';
import {
  generateOnboardingChecklistDoc,
  generateOffboardingChecklistDoc,
  generateBlankDocument,
  generate10QDoc,
  generate10KDoc,
  generate8KDoc,
  generateProjectProposalDoc
} from '../data/secDocumentTemplates';
import type { ContributorPermissions } from '../types/collaborator';
import { apiClient } from './apiClient';


export function compactFinancialTableBlock(table: SecBlock): SecBlock {
  if (table.type !== 'financial_table' || !table.rows) return table;

  let inSection = false;
  const rows = table.rows.map((r: any, idx: number) => {
    let indent = r.indent;
    if (indent === undefined || indent === null) {
      const firstCell = (r.cells && r.cells[0]) ? String(r.cells[0]).trim() : '';
      const isSection =
        r.type === 'section_title' ||
        r.type === 'category_header' ||
        (r.shading && r.cells.slice(1).every((c: any) => !c || String(c).trim() === '' || String(c).trim() === '-'));
      const isTotal =
        r.type === 'total' ||
        r.doubleUnderline ||
        /^total\b/i.test(firstCell) ||
        /^net\s+(loss|income|comprehensive)/i.test(firstCell) ||
        /^cash\s+(used|provided)\b/i.test(firstCell);
      const isSubtotal = r.type === 'subtotal' || r.underline;
      const isHeader =
        r.type === 'header' ||
        (!firstCell && idx < 4) ||
        /^(assets|liabilities|equity|revenue|operating activities)/i.test(firstCell);

      if (isSection) {
        inSection = true;
        indent = 0;
      } else if (isTotal) {
        indent = 2;
      } else if (isSubtotal) {
        indent = 1;
      } else if (isHeader) {
        indent = 0;
      } else if (r.type === 'data') {
        indent = inSection || firstCell ? 1 : 0;
      } else {
        indent = 0;
      }
    }

    return {
      ...r,
      cells: [...(r.cells || [])],
      indent: indent ?? 0,
    };
  });

  return {
    ...table,
    headers: [...(table.headers || [])],
    columnAlignments: [...(table.columnAlignments || [])],
    rows,
  } as any;
}

export function computeFinancialTableCellDiffs(
  orig: SecBlock,
  proposed: SecBlock
): {
  tableCellDiffs: SecTableCellDiff[];
  changeTags: SecChangeTag[];
  cellCount: number;
} {
  if (orig.type !== 'financial_table' || proposed.type !== 'financial_table') {
    return { tableCellDiffs: [], changeTags: [], cellCount: 0 };
  }

  const tableCellDiffs: SecTableCellDiff[] = [];
  const origRows = orig.rows || [];
  const propRows = proposed.rows || [];
  const origHeaders = orig.headers || [];
  const propHeaders = proposed.headers || [];

  const maxR = Math.max(origRows.length, propRows.length);
  for (let r = 0; r < maxR; r++) {
    const origR = origRows[r];
    const propR = propRows[r];

    if (!origR && propR) {
      // Entire row added in proposal
      const rowLabel = propR.cells?.[0] || `Row ${r + 1}`;
      tableCellDiffs.push({
        rowIndex: r,
        colIndex: 0,
        rowId: propR.id,
        rowLabel,
        headerLabel: 'Full Row',
        oldValue: '',
        newValue: propR.cells?.filter(Boolean).join(' | ') || '(New Row Added)',
        status: 'row_added'
      });
    } else if (origR && !propR) {
      // Entire row deleted in proposal
      const rowLabel = origR.cells?.[0] || `Row ${r + 1}`;
      tableCellDiffs.push({
        rowIndex: r,
        colIndex: 0,
        rowId: origR.id,
        rowLabel,
        headerLabel: 'Full Row',
        oldValue: origR.cells?.filter(Boolean).join(' | ') || '(Row Deleted)',
        newValue: '',
        status: 'row_deleted'
      });
    } else if (origR && propR) {
      const maxC = Math.max(origR.cells?.length || 0, propR.cells?.length || 0);
      const rowLabel = (propR.cells?.[0] || origR.cells?.[0] || `Row ${r + 1}`).trim();

      for (let c = 0; c < maxC; c++) {
        const rawOld = origR.cells?.[c] ?? '';
        const rawNew = propR.cells?.[c] ?? '';
        if (rawOld.trim() !== rawNew.trim()) {
          const headerLabel = (propHeaders[c] || origHeaders[c] || `Column ${c + 1}`).trim();
          tableCellDiffs.push({
            rowIndex: r,
            colIndex: c,
            rowId: propR.id || origR.id,
            rowLabel,
            headerLabel,
            oldValue: rawOld,
            newValue: rawNew,
            status: 'cell_modified'
          });
        }
      }
    }
  }

  // Also check if headers were modified
  const maxH = Math.max(origHeaders.length, propHeaders.length);
  for (let c = 0; c < maxH; c++) {
    const rawOld = origHeaders[c] ?? '';
    const rawNew = propHeaders[c] ?? '';
    if (rawOld.trim() !== rawNew.trim()) {
      tableCellDiffs.push({
        rowIndex: -1,
        colIndex: c,
        rowLabel: 'Table Header',
        headerLabel: `Column ${c + 1}`,
        oldValue: rawOld,
        newValue: rawNew,
        status: 'cell_modified'
      });
    }
  }

  const changeTags: SecChangeTag[] = [];
  const modifiedCells = tableCellDiffs.filter((d) => d.status === 'cell_modified');
  const addedRows = tableCellDiffs.filter((d) => d.status === 'row_added');
  const deletedRows = tableCellDiffs.filter((d) => d.status === 'row_deleted');

  if (modifiedCells.length > 0) {
    if (modifiedCells.length === 1) {
      const single = modifiedCells[0];
      changeTags.push({
        category: 'financial_data',
        label: `${single.rowLabel}: "${single.oldValue || 'empty'}" → "${single.newValue || 'empty'}"`,
        detail: `${single.rowLabel} [${single.headerLabel}]: "${single.oldValue}" → "${single.newValue}"`
      });
    } else if (modifiedCells.length <= 3) {
      const labels = Array.from(new Set(modifiedCells.map((c) => c.rowLabel).filter(Boolean)));
      changeTags.push({
        category: 'financial_data',
        label: `Table cells: ${labels.join(', ')}`,
        detail: modifiedCells.map((c) => `${c.rowLabel} [${c.headerLabel}]: "${c.oldValue}" → "${c.newValue}"`).join('; ')
      });
    } else {
      changeTags.push({
        category: 'financial_data',
        label: `Financial Table: ${modifiedCells.length} cells modified`,
        detail: modifiedCells.map((c) => `${c.rowLabel} [${c.headerLabel}]: "${c.oldValue}" → "${c.newValue}"`).join('; ')
      });
    }
  }

  if (addedRows.length > 0) {
    changeTags.push({
      category: 'structure',
      label: `Table: ${addedRows.length} row(s) added`
    });
  }

  if (deletedRows.length > 0) {
    changeTags.push({
      category: 'structure',
      label: `Table: ${deletedRows.length} row(s) deleted`
    });
  }

  return {
    tableCellDiffs,
    changeTags,
    cellCount: tableCellDiffs.length
  };
}

export function sanitizeAndCompactBlocks(blocks: SecBlock[]): SecBlock[] {
  return blocks.map((b) => {
    if (b.type === 'financial_table' && b.rows) {
      return compactFinancialTableBlock(b);
    }
    return b;
  });
}

export function generateSarahJenkinsMergedDoc(title = 'ZenaTech_SEC_Filing_v24_(Merged_Sarah_Jenkins)'): SecFilingDocument {
  const base = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
  const blocks = base.blocks.map((b: any) => {
    if (b.text && b.text.includes('The Company maintains term loan facilities')) {
      return {
        ...b,
        text: b.text + ' During Q2 2026, additional loan borrowings of $3,300,000 were drawn down to support specialized aerial hardware manufacturing equipment. All financial covenants remained in full compliance as of June 30, 2026.',
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

const STORAGE_KEYS = {
  MAIN_DOC: 'sec_filing_main_doc_v4_compact',
  PROPOSALS: 'sec_filing_proposals_v4_compact',
  VERSION_HISTORY: 'sec_filing_versions_v4_compact',
  DOCUMENTS_LIST: 'sec_filing_documents_list_v2',
  ACTIVE_DOC_ID: 'sec_filing_active_doc_id',
  SPREADSHEETS: 'sec_filing_spreadsheets_registry_v2',
};

// In-memory caches to avoid blocking the main thread with repetitive 2MB JSON.parse/stringify
let cachedSpreadsheetsList: AttachedSpreadsheet[] | null = null;
let cachedDocumentsList: SecDocumentSummary[] | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.SPREADSHEETS) {
      cachedSpreadsheetsList = null;
    }
    if (e.key === STORAGE_KEYS.DOCUMENTS_LIST || (e.key && e.key.startsWith('sec_doc_content_'))) {
      cachedDocumentsList = null;
    }
  });
}


// Cross-tab synchronization via BroadcastChannel (single reused instance)
let syncBroadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel !== 'undefined') {
    if (!syncBroadcastChannel) {
      try {
        syncBroadcastChannel = new BroadcastChannel('sec_filing_sync_channel');
      } catch (e) {
        console.warn('BroadcastChannel init error', e);
      }
    }
    return syncBroadcastChannel;
  }
  return null;
}

function broadcastSync(type: string, payload?: any) {
  try {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage({ type, ...payload, timestamp: Date.now() });
    }
  } catch (e) {
    console.warn('BroadcastChannel sync error', e);
  }
}

// Debounced Disk I/O: prevents synchronous localStorage serialization freezes on every keystroke
let saveMainDocTimer: any = null;
let pendingMainDocToSave: SecFilingDocument | null = null;

let saveProposalsTimer: any = null;
let pendingProposalsToSave: SecChangeProposal[] | null = null;

// --------------------------------------------------------------------------
// Storage quota handling
//
// Every merge pushes a full copy of the document into version history and every
// contributor invite copies the whole block list into a proposal, so this filing
// outgrows the ~5 MB localStorage budget quickly (uploaded logos are inlined as
// base64 data URLs, which makes it worse). When that happened the write threw,
// the error was only logged, and the pending in-memory buffer was cleared anyway
// -- so a submitted draft silently reverted to whatever was last on disk.
// --------------------------------------------------------------------------

/** Version snapshots retained on disk; older ones are historical and reclaimable. */
const MAX_RETAINED_SNAPSHOTS = 5;
/** Snapshots kept when storage is already full and space must be reclaimed. */
const MIN_RETAINED_SNAPSHOTS = 2;
/** Closed (merged/rejected) proposals kept when reclaiming space. */
const MAX_RETAINED_CLOSED_PROPOSALS = 5;

export type StorageFailure = {
  key: string;
  /** True when space was reclaimed and the write eventually went through. */
  recovered: boolean;
  /** Total bytes localStorage is holding, when the failure was a quota error. */
  totalBytes?: number;
  /** The single largest key, so the UI can name what is filling the budget. */
  largestKey?: string | null;
};

let storageFailureListener: ((failure: StorageFailure) => void) | null = null;

/** Lets the UI surface storage-quota problems instead of only logging them. */
export function setStorageFailureListener(
  listener: ((failure: StorageFailure) => void) | null
): void {
  storageFailureListener = listener;
}

function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22
    );
  }
  return !!err && typeof err === 'object' && (err as any).name === 'QuotaExceededError';
}

/**
 * Frees room taken by purely historical filing data, one escalating round at a
 * time. Returns false once there is nothing left that is safe to drop.
 */
/**
 * Superseded key generations. They are still read as fallbacks by
 * getMainDocument/getProposals, but once the current key holds data they are
 * dead weight -- each one can hold another full copy of a ~0.5 MB document.
 */
const LEGACY_KEYS: { legacy: string; supersededBy: string }[] = [
  { legacy: 'sec_filing_main_doc_v2_full', supersededBy: STORAGE_KEYS.MAIN_DOC },
  { legacy: 'sec_filing_main_doc', supersededBy: STORAGE_KEYS.MAIN_DOC },
  { legacy: 'sec_filing_proposals_v1', supersededBy: STORAGE_KEYS.PROPOSALS },
  { legacy: 'sec_filing_proposals', supersededBy: STORAGE_KEYS.PROPOSALS },
  { legacy: 'sec_filing_versions_v2_full', supersededBy: STORAGE_KEYS.VERSION_HISTORY }
];

/** Byte size of every localStorage entry, largest first. */
export function describeStorageUsage(): { key: string; bytes: number }[] {
  const entries: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Both the key and the value count toward the quota.
      entries.push({ key, bytes: (localStorage.getItem(key) || '').length + key.length });
    }
  } catch (e) {
    console.warn('Could not measure storage usage', e);
  }
  return entries.sort((a, b) => b.bytes - a.bytes);
}

function logStorageBreakdown(): { totalBytes: number; largestKey: string | null } {
  const entries = describeStorageUsage();
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.warn(
    `Browser storage is full. ${mb(totalBytes)} in use across ${entries.length} keys:\n` +
      entries.map((e) => `  ${mb(e.bytes).padStart(9)}  ${e.key}`).join('\n')
  );
  return { totalBytes, largestKey: entries.length > 0 ? entries[0].key : null };
}

function readProposalsForReclaim(): any[] | null {
  const source =
    pendingProposalsToSave ||
    JSON.parse(localStorage.getItem(STORAGE_KEYS.PROPOSALS) || 'null');
  return Array.isArray(source) ? source : null;
}

function writeProposalsForReclaim(next: any[]): void {
  if (pendingProposalsToSave) {
    pendingProposalsToSave = next;
  }
  localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(next));
}

function trimHistoryTo(limit: number): boolean {
  const raw = localStorage.getItem(STORAGE_KEYS.VERSION_HISTORY);
  if (!raw) return false;
  const history = JSON.parse(raw);
  if (!Array.isArray(history) || history.length <= limit) return false;
  // Newest snapshots are appended, so keep the tail.
  localStorage.setItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(history.slice(-limit)));
  return true;
}

/** Drops closed proposals beyond `keep`, newest first. Live work is never touched. */
function trimClosedProposalsTo(keep: number): boolean {
  const source = readProposalsForReclaim();
  if (!source) return false;
  const isClosed = (p: any) => p?.status === 'merged' || p?.status === 'rejected';
  const closed = source.filter(isClosed);
  if (closed.length <= keep) return false;
  // Proposals are unshifted, so the newest come first.
  const kept = new Set(closed.slice(0, keep).map((p: any) => p.id));
  writeProposalsForReclaim(source.filter((p: any) => !isClosed(p) || kept.has(p.id)));
  return true;
}

function reclaimStorageSpace(round: number): boolean {
  try {
    switch (round) {
      case 0: {
        // Superseded key generations first: pure dead weight, nothing to lose.
        let freed = false;
        for (const { legacy, supersededBy } of LEGACY_KEYS) {
          if (localStorage.getItem(legacy) === null) continue;
          // Never drop a legacy copy unless the current key actually holds data.
          if (!localStorage.getItem(supersededBy)) continue;
          localStorage.removeItem(legacy);
          freed = true;
        }
        return freed;
      }
      case 1:
        return trimHistoryTo(MAX_RETAINED_SNAPSHOTS);
      case 2:
        return trimClosedProposalsTo(MAX_RETAINED_CLOSED_PROPOSALS);
      case 3:
        return trimHistoryTo(MIN_RETAINED_SNAPSHOTS);
      case 4:
        return trimClosedProposalsTo(1);
      case 5:
        // Only the version the document is currently on.
        return trimHistoryTo(1);
      case 6:
        // Merged proposals are already folded into the main document and
        // rejected ones are dead, so the last thing to go is all of them.
        return trimClosedProposalsTo(0);
      default:
        return false;
    }
  } catch (e) {
    console.warn('Could not reclaim SEC filing storage space', e);
    return false;
  }
}

/**
 * Writes to localStorage, reclaiming historical data and retrying if the browser
 * reports the quota as exceeded. Returns false when the value could not be stored.
 */
function safeSetItem(key: string, value: string): boolean {
  for (let round = 0; ; round++) {
    try {
      localStorage.setItem(key, value);
      if (round > 0) {
        storageFailureListener?.({ key, recovered: true });
      }
      return true;
    } catch (err) {
      if (!isQuotaError(err)) {
        console.error(`Failed to write ${key} to storage`, err);
        storageFailureListener?.({ key, recovered: false });
        return false;
      }
      if (!reclaimStorageSpace(round)) {
        // Nothing left that is safe to drop. Print what is actually using the
        // budget so the cause is visible rather than guessed at.
        const { totalBytes, largestKey } = logStorageBreakdown();
        console.error(`Browser storage is full; could not write ${key}`, err);
        storageFailureListener?.({ key, recovered: false, totalBytes, largestKey });
        return false;
      }
    }
  }
}

/** Returns true when nothing is left buffered, i.e. every pending write landed. */
export function flushPendingSaves(): boolean {
  if (pendingMainDocToSave) {
    if (saveMainDocTimer) clearTimeout(saveMainDocTimer);
    saveMainDocTimer = null;
    const doc = pendingMainDocToSave;
    if (safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(doc))) {
      pendingMainDocToSave = null;
      broadcastSync("MAIN_DOC_SAVED", { version: doc.version });
    }
    // On failure the buffer is deliberately kept: reads go through it, so the
    // session keeps serving the real document instead of stale on-disk content.
  }

  if (pendingProposalsToSave) {
    if (saveProposalsTimer) clearTimeout(saveProposalsTimer);
    saveProposalsTimer = null;
    const proposals = pendingProposalsToSave;
    if (safeSetItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals))) {
      pendingProposalsToSave = null;
      broadcastSync("PROPOSALS_SAVED", { count: proposals.length });
    }
  }

  return pendingMainDocToSave === null && pendingProposalsToSave === null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingSaves);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSaves();
    }
  });
}

export function getProposalInviteUrl(proposal: SecChangeProposal): string {
  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? `${window.location.origin}/sec-filings/contribute`
      : '/sec-filings/contribute';
  const queryParams = new URLSearchParams({
    contributor: 'true',
    proposalId: proposal.id,
    name: proposal.author.name,
    role: proposal.author.role,
    section: proposal.assignedSection || 'ALL',
    title: proposal.title,
    ...(proposal.changeSummary?.description ? { desc: proposal.changeSummary.description } : {})
  });
  if (proposal.inviteToken) {
    queryParams.set('token', proposal.inviteToken);
  }
  if (proposal.permissions) {
    queryParams.set('docEdit', String(proposal.permissions.canEditDocument));
    queryParams.set('sheetEdit', String(proposal.permissions.canEditSpreadsheet));
  }
  return `${baseUrl}?${queryParams.toString()}`;
}

// ---------------------------------------------------------------------------
// Backend persistence of document <-> spreadsheet links (sec_attached_spreadsheets)
// ---------------------------------------------------------------------------

const SPREADSHEET_SYNC_DEBOUNCE_MS = 800;
const pendingSpreadsheetPushes = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; payload: AttachedSpreadsheetPayload }
>();
// Last write (PUT/DELETE) issued per document, so reads can wait for it to land.
const inFlightSpreadsheetWrites = new Map<string, Promise<unknown>>();

function trackSpreadsheetWrite(docId: string, write: Promise<unknown>, failureMessage: string): void {
  const tracked = write.catch((err) => console.warn(failureMessage, err));
  inFlightSpreadsheetWrites.set(docId, tracked);
  tracked.finally(() => {
    if (inFlightSpreadsheetWrites.get(docId) === tracked) inFlightSpreadsheetWrites.delete(docId);
  });
}

function sendSpreadsheetPush(docId: string, payload: AttachedSpreadsheetPayload): void {
  trackSpreadsheetWrite(
    docId,
    apiClient.put(spreadsheetEndpoint(docId), payload, { skipGlobalLoading: true }),
    `Failed to save spreadsheet link for ${docId} to backend`
  );
}

/** Sends any debounced push now and waits for outstanding writes for this document. */
async function settleSpreadsheetWrites(docId: string): Promise<void> {
  const pending = pendingSpreadsheetPushes.get(docId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingSpreadsheetPushes.delete(docId);
    sendSpreadsheetPush(docId, pending.payload);
  }
  await inFlightSpreadsheetWrites.get(docId);
}

function spreadsheetEndpoint(docId: string): string {
  return `/api/sec-filings/documents/${encodeURIComponent(docId)}/spreadsheet`;
}

function toSpreadsheetPayload(sheet: AttachedSpreadsheet): AttachedSpreadsheetPayload {
  const letters = sheet.colLetters?.length
    ? sheet.colLetters
    : Array.from({ length: sheet.colCount || 0 }, (_, i) => colToLetter(i + 1));
  return {
    name: sheet.fileName,
    sheetName: sheet.sheetName,
    totalRows: sheet.rowCount,
    totalColumns: sheet.colCount,
    columns: letters.map((key, i) => ({ key, title: String(sheet.headers?.[i] ?? key) })),
    cells: sheet.cells || {},
    tabs: sheet.tabs || [],
    activeTabId: sheet.activeTabId,
    sourceSheetId: sheet.id
  };
}

function fromSpreadsheetRecord(record: AttachedSpreadsheetRecord): AttachedSpreadsheet {
  const colLetters = (record.columns || []).map((c) => c.key);
  return {
    id: record.sourceSheetId || record.id,
    fileName: record.name,
    sheetName: record.sheetName,
    rowCount: record.totalRows,
    colCount: record.totalColumns,
    maxCol: colLetters[colLetters.length - 1] || colToLetter(record.totalColumns || 1),
    colLetters: colLetters.length ? colLetters : undefined,
    headers: colLetters.length ? record.columns.map((c) => c.title) : undefined,
    cells: record.cells || {},
    tabs: record.tabs?.length ? record.tabs : undefined,
    activeTabId: record.activeTabId || undefined,
    updatedAt: record.updatedAt || undefined
  };
}

/** Debounced upsert so rapid cell edits collapse into one PUT per document. */
function queueSpreadsheetPush(docId: string, sheet: AttachedSpreadsheet): void {
  const existing = pendingSpreadsheetPushes.get(docId);
  if (existing) clearTimeout(existing.timer);
  const payload = toSpreadsheetPayload(sheet);
  const timer = setTimeout(() => {
    pendingSpreadsheetPushes.delete(docId);
    sendSpreadsheetPush(docId, payload);
  }, SPREADSHEET_SYNC_DEBOUNCE_MS);
  pendingSpreadsheetPushes.set(docId, { timer, payload });
}

function removeSpreadsheetFromBackend(docId: string): void {
  const existing = pendingSpreadsheetPushes.get(docId);
  if (existing) {
    clearTimeout(existing.timer);
    pendingSpreadsheetPushes.delete(docId);
  }
  trackSpreadsheetWrite(
    docId,
    apiClient.delete(spreadsheetEndpoint(docId), { skipGlobalLoading: true }),
    `Failed to remove spreadsheet link for ${docId} from backend`
  );
}

export const secFilingService = {
  flushPendingSaves,

  getMainDocument(): SecFilingDocument {
    if (pendingMainDocToSave) {
      const allSheets = this.getAllSpreadsheets();
      const match = allSheets.find((s) => s.id === pendingMainDocToSave!.attachedSpreadsheetId || s.assignedDocIds?.includes(pendingMainDocToSave!.id));
      if (match) {
        pendingMainDocToSave.attachedSpreadsheetId = match.id;
        pendingMainDocToSave.attachedSpreadsheet = match;
      } else if (!pendingMainDocToSave.attachedSpreadsheetId) {
        pendingMainDocToSave.attachedSpreadsheet = null;
      }
      return pendingMainDocToSave;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.MAIN_DOC) || localStorage.getItem('sec_filing_main_doc_v2_full') || localStorage.getItem('sec_filing_main_doc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.blocks)) {
          // If this is the default review copy and was corrupted by earlier compaction (lost 4th column or was truncated)
          if (parsed.id === 'sec-doc-zenatech-2026-q2') {
            const firstTable = parsed.blocks.find((b: any) => b.type === 'financial_table');
            if (parsed.blocks.length < 50 || (firstTable && firstTable.headers?.length < 4)) {
              safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(INITIAL_SEC_FILING_DOC));
              return JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
            }
          }
          const allSheets = this.getAllSpreadsheets();
          if (parsed.attachedSpreadsheetId) {
            const match = allSheets.find((s) => s.id === parsed.attachedSpreadsheetId);
            parsed.attachedSpreadsheet = match || null;
          } else {
            const match = allSheets.find((s) => s.assignedDocIds?.includes(parsed.id));
            if (match) {
              parsed.attachedSpreadsheetId = match.id;
              parsed.attachedSpreadsheet = match;
            } else {
              parsed.attachedSpreadsheet = null;
            }
          }
          parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse main document from storage', e);
      }
    }
    const defaultDoc = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
    const allSheets = this.getAllSpreadsheets();
    const match = allSheets.find((s) => s.assignedDocIds?.includes(defaultDoc.id) || s.id === defaultDoc.attachedSpreadsheetId);
    if (match) {
      defaultDoc.attachedSpreadsheetId = match.id;
      defaultDoc.attachedSpreadsheet = match;
    } else {
      defaultDoc.attachedSpreadsheet = null;
    }
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(defaultDoc));
    return defaultDoc;
  },

  saveMainDocument(doc: SecFilingDocument, immediate = false): boolean {
    pendingMainDocToSave = doc;

    // Update documents list summary
    try {
      const list = this.getDocumentsList();
      const existing = list.find((d) => d.id === doc.id);
      if (existing) {
        existing.title = doc.title;
        existing.updatedAt = doc.updatedAt || new Date().toISOString();
        existing.blocksCount = doc.blocks?.length || 0;
        existing.formType = doc.formType;
        this.saveDocumentsList(list);
      }
      safeSetItem(`sec_doc_content_${doc.id}`, JSON.stringify(doc));
    } catch (e) {
      console.warn('Could not update document summary', e);
    }

    if (immediate) {
      return flushPendingSaves();
    } else {
      if (saveMainDocTimer) clearTimeout(saveMainDocTimer);
      saveMainDocTimer = setTimeout(flushPendingSaves, 350);
    }
    return true;
  },

  getDocumentsList(): SecDocumentSummary[] {
    if (cachedDocumentsList) {
      return cachedDocumentsList;
    }
    const mainDoc = this.getMainDocument();
    const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS_LIST);
    let list: SecDocumentSummary[] = [];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {
        console.error('Failed to parse documents list', e);
      }
    }

    if (list.length === 0) {
      list = [
        {
          id: 'sec-doc-zenatech-v24-sarah-jenkins',
          title: 'ZenaTech_SEC_Filing_v24_(Merged_Sarah_Jenkins)',
          formType: 'Form 10-Q / Interim Consolidated',
          period: 'For the Six Months Ended June 30, 2026 and June 30, 2025',
          updatedAt: new Date().toISOString(),
          createdAt: '2026-08-15T11:45:00.000Z',
          owner: 'Sarah Jenkins, CPA',
          isShared: true,
          version: 'v24 (Merged Sarah Jenkins)',
          blocksCount: 42,
          templateType: '10-q',
        },
        {
          id: mainDoc.id || 'sec-doc-zenatech-2026-q2',
          title: mainDoc.title || 'ZenaTech, Inc. Consolidated Financial Statements — June 30, 2026 (v22 REVIEW COPY)',
          formType: mainDoc.formType || 'Form 6-K / Interim Consolidated',
          period: mainDoc.period || 'For the Six Months Ended June 30, 2026 and June 30, 2025',
          updatedAt: mainDoc.updatedAt || new Date().toISOString(),
          createdAt: mainDoc.createdAt || '2026-06-30T08:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: mainDoc.version || 'v22 Review Copy',
          blocksCount: mainDoc.blocks?.length || 42,
          templateType: '10-q',
        },
        {
          id: 'sec-doc-zenatech-10q-q2',
          title: 'ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)',
          formType: 'Form 10-Q',
          period: 'Q2 2026',
          updatedAt: '2026-09-29T16:45:00.000Z',
          createdAt: '2026-09-20T10:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: 'v1.0',
          blocksCount: 18,
          templateType: '10-q',
        },
        {
          id: 'sec-doc-zenatech-2025-10k',
          title: 'ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)',
          formType: 'Form 10-K',
          period: 'FY 2025',
          updatedAt: '2026-09-28T14:30:00.000Z',
          createdAt: '2026-09-15T09:00:00.000Z',
          owner: 'Ali Hassan Sharif',
          isShared: true,
          version: 'v1.2',
          blocksCount: 64,
          templateType: '10-k',
        },
        {
          id: 'sec-doc-zenatech-8k-acq',
          title: 'ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)',
          formType: 'Form 8-K',
          period: 'Current',
          updatedAt: '2026-09-25T11:20:00.000Z',
          createdAt: '2026-09-24T09:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: 'v1.0',
          blocksCount: 12,
          templateType: '8-k',
        },
      ];
    } else {
      // Ensure the Sarah Jenkins v24 document is registered in the list if not already present
      const hasSarahV24 = list.some((d) => d.id === 'sec-doc-zenatech-v24-sarah-jenkins' || d.title.includes('Sarah_Jenkins') || d.title.includes('v24'));
      if (!hasSarahV24) {
        list.splice(1, 0, {
          id: 'sec-doc-zenatech-v24-sarah-jenkins',
          title: 'ZenaTech_SEC_Filing_v24_(Merged_Sarah_Jenkins)',
          formType: 'Form 10-Q / Interim Consolidated',
          period: 'For the Six Months Ended June 30, 2026 and June 30, 2025',
          updatedAt: new Date().toISOString(),
          createdAt: '2026-08-15T11:45:00.000Z',
          owner: 'Sarah Jenkins, CPA',
          isShared: true,
          version: 'v24 (Merged Sarah Jenkins)',
          blocksCount: 42,
          templateType: '10-q',
        });
      }
    }

    // Scan localStorage for any custom doc keys: sec_doc_content_*
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sec_doc_content_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const doc = JSON.parse(raw);
                if (doc && doc.id && doc.title) {
                  const existsIdx = list.findIndex((d) => d.id === doc.id);
                  if (existsIdx >= 0) {
                    list[existsIdx].title = doc.title;
                    list[existsIdx].updatedAt = doc.updatedAt || list[existsIdx].updatedAt;
                    list[existsIdx].blocksCount = doc.blocks?.length || list[existsIdx].blocksCount;
                  } else {
                    list.push({
                      id: doc.id,
                      title: doc.title,
                      formType: doc.formType || 'SEC Filing',
                      period: doc.period,
                      updatedAt: doc.updatedAt || new Date().toISOString(),
                      createdAt: doc.createdAt || new Date().toISOString(),
                      owner: 'me',
                      isShared: true,
                      version: doc.version || 'v1.0',
                      blocksCount: doc.blocks?.length || 0,
                      templateType: '10-q',
                    });
                  }
                }
              } catch {
                // Ignore parse error on individual item
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error scanning custom docs in localStorage', e);
      }
    }

    // Synchronize active mainDoc summary if matching ID exists
    const existingIdx = list.findIndex((d) => d.id === mainDoc.id);
    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        title: mainDoc.title,
        formType: mainDoc.formType,
        period: mainDoc.period,
        updatedAt: mainDoc.updatedAt || list[existingIdx].updatedAt,
        blocksCount: mainDoc.blocks?.length || list[existingIdx].blocksCount,
      };
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    const deduplicatedList: SecDocumentSummary[] = [];
    for (const item of list) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        deduplicatedList.push(item);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS_LIST, JSON.stringify(deduplicatedList));
    } catch (e) {
      console.warn('Could not save documents list', e);
    }
    cachedDocumentsList = deduplicatedList;
    return deduplicatedList;
  },

  getDocumentPreview(id: string): SecBlock[] {
    const mainDoc = this.getMainDocument();
    if (id === mainDoc.id || id === 'sec-doc-zenatech-2026-q2') {
      return mainDoc.blocks.slice(0, 15);
    }
    if (id === 'sec-doc-zenatech-v24-sarah-jenkins') {
      return generateSarahJenkinsMergedDoc().blocks.slice(0, 15);
    }
    const customKey = `sec_doc_content_${id}`;
    const customSaved = localStorage.getItem(customKey);
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          return parsed.blocks.slice(0, 15);
        }
      } catch {
        // Fallback to defaults
      }
    }
    if (id === 'sec-doc-zenatech-10q-q2') {
      return generate10QDoc('ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)').blocks.slice(0, 15);
    }
    if (id === 'sec-doc-zenatech-2025-10k') {
      return generate10KDoc('ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)').blocks.slice(0, 15);
    }
    if (id === 'sec-doc-zenatech-8k-acq') {
      return generate8KDoc('ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)').blocks.slice(0, 15);
    }
    if (id === 'doc-onboarding-1') {
      return generateOnboardingChecklistDoc('Onboarding').blocks.slice(0, 15);
    }
    if (id === 'doc-offboarding-2') {
      return generateOffboardingChecklistDoc('Offboarding Checklist').blocks.slice(0, 15);
    }
    return mainDoc.blocks.slice(0, 15);
  },

  saveDocumentsList(list: SecDocumentSummary[]): void {
    cachedDocumentsList = list;
    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS_LIST, JSON.stringify(list));
      broadcastSync('DOCUMENTS_LIST_UPDATED', { count: list.length });
    } catch (e) {
      console.warn('Could not save documents list', e);
    }
  },

  getAllDocuments(): SecDocumentSummary[] {
    return this.getDocumentsList();
  },

  setActiveDocumentId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, id);
    }
  },

  getDocumentContent(id: string): SecFilingDocument {
    if (id === this.getActiveDocumentId() || id === 'sec-doc-zenatech-2026-q2') {
      // Only short-circuit when the main doc really is this document; otherwise
      // fall through so we don't hand back another doc (and its spreadsheet link).
      const main = this.getMainDocument();
      if (main.id === id) return main;
    }
    const customKey = `sec_doc_content_${id}`;
    const customSaved = typeof localStorage !== 'undefined' ? localStorage.getItem(customKey) : null;
    let doc: SecFilingDocument | null = null;
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          doc = parsed;
        }
      } catch {
        // Ignore JSON parse errors from corrupted storage keys
      }
    }
    if (!doc) {
      if (id === 'sec-doc-zenatech-v24-sarah-jenkins') doc = generateSarahJenkinsMergedDoc();
      else if (id === 'sec-doc-zenatech-10q-q2') doc = generate10QDoc('ZenaTech, Inc. Form 10-Q');
      else if (id === 'sec-doc-zenatech-2025-10k') doc = generate10KDoc('ZenaTech, Inc. Form 10-K');
      else if (id === 'sec-doc-zenatech-8k-acq') doc = generate8KDoc('ZenaTech, Inc. Form 8-K');
      else if (id === 'doc-onboarding-1') doc = generateOnboardingChecklistDoc('Onboarding');
      else if (id === 'doc-offboarding-2') doc = generateOffboardingChecklistDoc('Offboarding Checklist');
      else doc = generateBlankDocument('Untitled Document');
    }
    // Resolve attached spreadsheet from central Hub registry
    const allSheets = this.getAllSpreadsheets();
    if (doc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === doc.attachedSpreadsheetId);
      if (match) {
        doc.attachedSpreadsheet = match;
      }
    } else {
      // Check if any sheet in Hub is explicitly assigned to this document ID
      const match = allSheets.find((s) => s.assignedDocIds?.includes(doc.id));
      if (match) {
        doc.attachedSpreadsheetId = match.id;
        doc.attachedSpreadsheet = match;
      } else {
        doc.attachedSpreadsheet = null;
      }
    }
    return doc;
  },

  getAllSpreadsheets(): AttachedSpreadsheet[] {
    if (cachedSpreadsheetsList) {
      return cachedSpreadsheetsList;
    }
    if (typeof localStorage === 'undefined') {
      return [{
        ...DEFAULT_TRIAL_BALANCE_SHEET,
        id: 'sheet-tb-master-2026',
        fileName: 'TB_Consolidated_Master_Q2_2026_FINAL.xlsx',
        assignedDocIds: ['sec-doc-zenatech-2026-q2', 'sec-doc-zenatech-10q-q2'],
        description: 'Master Consolidated Trial Balance for Q2 2026 reporting.'
      }];
    }

    const saved = localStorage.getItem(STORAGE_KEYS.SPREADSHEETS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedSpreadsheetsList = parsed;
          return parsed;
        }
      } catch {
        // Fallback
      }
    }

    const initialList: AttachedSpreadsheet[] = [
      {
        ...DEFAULT_TRIAL_BALANCE_SHEET,
        id: 'sheet-tb-master-2026',
        fileName: 'TB_Consolidated_Master_Q2_2026_FINAL.xlsx',
        assignedDocIds: ['sec-doc-zenatech-2026-q2', 'sec-doc-zenatech-10q-q2'],
        description: 'Master Consolidated Trial Balance for Q2 2026 reporting.'
      }
    ];

    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(initialList));
    } catch {
      // Ignore storage error
    }
    cachedSpreadsheetsList = initialList;
    return initialList;
  },

  getSpreadsheetById(id: string): AttachedSpreadsheet | null {
    const list = this.getAllSpreadsheets();
    return list.find((s) => s.id === id) || null;
  },

  saveSpreadsheet(sheet: AttachedSpreadsheet): void {
    const list = this.getAllSpreadsheets();
    const existingIdx = list.findIndex((s) => s.id === sheet.id);
    const updatedSheet: AttachedSpreadsheet = {
      ...sheet,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = updatedSheet;
    } else {
      list.unshift(updatedSheet);
    }

    cachedSpreadsheetsList = list;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    // Sync to all assigned documents in local storage and the backend
    if (sheet.assignedDocIds && sheet.assignedDocIds.length > 0) {
      for (const docId of sheet.assignedDocIds) {
        queueSpreadsheetPush(docId, updatedSheet);
        try {
          const docKey = `sec_doc_content_${docId}`;
          const savedDoc = localStorage.getItem(docKey);
          if (savedDoc) {
            const parsedDoc = JSON.parse(savedDoc);
            parsedDoc.attachedSpreadsheet = updatedSheet;
            parsedDoc.attachedSpreadsheetId = sheet.id;
            localStorage.setItem(docKey, JSON.stringify(parsedDoc));
          }
        } catch {
          // Ignore
        }
      }
    }

    const mainDoc = this.getMainDocument();
    if (mainDoc.attachedSpreadsheetId === sheet.id || sheet.assignedDocIds?.includes(mainDoc.id)) {
      mainDoc.attachedSpreadsheet = updatedSheet;
      mainDoc.attachedSpreadsheetId = sheet.id;
      this.saveMainDocument(mainDoc, true);
    }

    broadcastSync('SPREADSHEET_UPDATED', { sheetId: sheet.id });
  },

  deleteSpreadsheet(sheetId: string): void {
    const allSheets = this.getAllSpreadsheets();
    for (const docId of allSheets.find((s) => s.id === sheetId)?.assignedDocIds || []) {
      removeSpreadsheetFromBackend(docId);
    }
    const list = allSheets.filter((s) => s.id !== sheetId);
    cachedSpreadsheetsList = list;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not update spreadsheet registry', e);
    }

    // Unassign from all documents
    const docSummaries = this.getAllDocuments();
    for (const docSummary of docSummaries) {
      try {
        const docKey = `sec_doc_content_${docSummary.id}`;
        const savedDoc = localStorage.getItem(docKey);
        if (savedDoc) {
          const parsedDoc = JSON.parse(savedDoc);
          if (parsedDoc.attachedSpreadsheetId === sheetId) {
            parsedDoc.attachedSpreadsheetId = undefined;
            parsedDoc.attachedSpreadsheet = null;
            localStorage.setItem(docKey, JSON.stringify(parsedDoc));
          }
        }
      } catch {
        // Ignore
      }
    }

    const mainDoc = this.getMainDocument();
    if (mainDoc.attachedSpreadsheetId === sheetId) {
      mainDoc.attachedSpreadsheetId = undefined;
      mainDoc.attachedSpreadsheet = null;
      this.saveMainDocument(mainDoc, true);
    }

    broadcastSync('SPREADSHEET_DELETED', { sheetId });
  },

  assignSpreadsheetToDocuments(sheetId: string, targetDocIds: string[]): void {
    const list = this.getAllSpreadsheets();
    const sheetIdx = list.findIndex((s) => s.id === sheetId);
    if (sheetIdx < 0) return;

    const sheet = list[sheetIdx];
    const previousDocIds = sheet.assignedDocIds || [];
    sheet.assignedDocIds = targetDocIds;
    sheet.updatedAt = new Date().toISOString();
    list[sheetIdx] = sheet;
    cachedSpreadsheetsList = list;

    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    // Update all documents
    const allDocs = this.getAllDocuments();
    for (const docSummary of allDocs) {
      try {
        const docKey = `sec_doc_content_${docSummary.id}`;
        const savedDoc = localStorage.getItem(docKey);
        if (savedDoc) {
          const parsedDoc = JSON.parse(savedDoc);
          if (targetDocIds.includes(docSummary.id)) {
            parsedDoc.attachedSpreadsheetId = sheetId;
            parsedDoc.attachedSpreadsheet = sheet;
          } else if (parsedDoc.attachedSpreadsheetId === sheetId) {
            parsedDoc.attachedSpreadsheetId = undefined;
            parsedDoc.attachedSpreadsheet = null;
          }
          localStorage.setItem(docKey, JSON.stringify(parsedDoc));
        }
      } catch {
        // Ignore
      }
    }

    const mainDoc = this.getMainDocument();
    if (targetDocIds.includes(mainDoc.id)) {
      mainDoc.attachedSpreadsheetId = sheetId;
      mainDoc.attachedSpreadsheet = sheet;
      this.saveMainDocument(mainDoc, true);
    } else if (mainDoc.attachedSpreadsheetId === sheetId) {
      mainDoc.attachedSpreadsheetId = undefined;
      mainDoc.attachedSpreadsheet = null;
      this.saveMainDocument(mainDoc, true);
    }

    for (const docId of targetDocIds) {
      queueSpreadsheetPush(docId, sheet);
    }
    for (const docId of previousDocIds) {
      if (!targetDocIds.includes(docId)) removeSpreadsheetFromBackend(docId);
    }

    broadcastSync('SPREADSHEET_ASSIGNMENT_CHANGED', { sheetId, targetDocIds });
  },

  assignSpreadsheetToDocument(
    docId: string,
    sheetId: string | null,
    options: { syncBackend?: boolean } = {}
  ): void {
    const { syncBackend = true } = options;
    const allSheets = this.getAllSpreadsheets();
    const assignedSheet = sheetId ? allSheets.find((s) => s.id === sheetId) || null : null;
    const updatedSheets = allSheets.map((s) => {
      const assigned = new Set(s.assignedDocIds || []);
      if (s.id === sheetId) {
        assigned.add(docId);
      } else {
        assigned.delete(docId);
      }
      return { ...s, assignedDocIds: Array.from(assigned) };
    });

    cachedSpreadsheetsList = updatedSheets;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(updatedSheets));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    const docKey = `sec_doc_content_${docId}`;
    let targetDoc: SecFilingDocument | null = null;
    const savedDoc = typeof localStorage !== 'undefined' ? localStorage.getItem(docKey) : null;
    if (savedDoc) {
      try {
        targetDoc = JSON.parse(savedDoc);
      } catch {
        targetDoc = null;
      }
    }
    if (!targetDoc) {
      if (docId === 'sec-doc-zenatech-v24-sarah-jenkins') {
        targetDoc = generateSarahJenkinsMergedDoc();
      } else if (docId === 'sec-doc-zenatech-10q-q2') {
        targetDoc = generate10QDoc('ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)');
        targetDoc.id = docId;
      } else if (docId === 'sec-doc-zenatech-2025-10k') {
        targetDoc = generate10KDoc('ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)');
        targetDoc.id = docId;
      } else if (docId === 'sec-doc-zenatech-8k-acq') {
        targetDoc = generate8KDoc('ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)');
        targetDoc.id = docId;
      } else if (docId === 'doc-onboarding-1') {
        targetDoc = generateOnboardingChecklistDoc('Onboarding');
        targetDoc.id = docId;
      } else if (docId === 'doc-offboarding-2') {
        targetDoc = generateOffboardingChecklistDoc('Offboarding Checklist');
        targetDoc.id = docId;
      } else if (docId === 'sec-doc-zenatech-2026-q2') {
        targetDoc = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
      } else {
        targetDoc = generateBlankDocument('Untitled Document');
        targetDoc.id = docId;
      }
    }
    const finalTargetDoc: SecFilingDocument = targetDoc || generateBlankDocument('Untitled Document');
    finalTargetDoc.id = docId;

    if (sheetId && assignedSheet) {
      finalTargetDoc.attachedSpreadsheetId = sheetId;
      finalTargetDoc.attachedSpreadsheet = assignedSheet;
    } else {
      finalTargetDoc.attachedSpreadsheetId = undefined;
      finalTargetDoc.attachedSpreadsheet = null;
    }
    safeSetItem(docKey, JSON.stringify(finalTargetDoc));

    const activeDocId = this.getActiveDocumentId();
    const currentMain = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.MAIN_DOC) : null;
    let mainObj: any = null;
    if (currentMain) {
      try {
        mainObj = JSON.parse(currentMain);
      } catch {
        mainObj = null;
      }
    }

    if (docId === activeDocId || (mainObj && mainObj.id === docId) || (pendingMainDocToSave && pendingMainDocToSave.id === docId)) {
      safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(finalTargetDoc));
      pendingMainDocToSave = finalTargetDoc;
    }

    if (syncBackend) {
      if (sheetId && assignedSheet) {
        queueSpreadsheetPush(docId, assignedSheet);
      } else {
        removeSpreadsheetFromBackend(docId);
      }
    }

    broadcastSync('SPREADSHEET_ASSIGNMENT_CHANGED', { docId, sheetId });
  },

  getAttachedSpreadsheet(docId?: string): AttachedSpreadsheet | null {
    const allSheets = this.getAllSpreadsheets();
    const targetId = docId || this.getActiveDocumentId();

    const matchByDoc = allSheets.find((s) => s.assignedDocIds?.includes(targetId));
    if (matchByDoc) return matchByDoc;

    const doc = docId ? this.getDocumentContent(docId) : this.getMainDocument();
    if (doc.attachedSpreadsheet) return doc.attachedSpreadsheet;
    if (doc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === doc.attachedSpreadsheetId);
      if (match) return match;
    }
    return null;
  },

  /**
   * Reads the document's linked spreadsheet from the backend.
   * Resolves null when nothing is linked; rejects when the backend is unreachable.
   */
  async fetchAttachedSpreadsheetFromBackend(docId: string): Promise<AttachedSpreadsheet | null> {
    await settleSpreadsheetWrites(docId);
    const res = await apiClient.get<AttachedSpreadsheetResponse>(spreadsheetEndpoint(docId), {
      skipGlobalLoading: true
    });
    return res?.spreadsheet ? fromSpreadsheetRecord(res.spreadsheet) : null;
  },

  /** Pushes the locally linked sheet for a document to the backend (used to backfill old links). */
  pushAttachedSpreadsheetToBackend(docId: string, sheet: AttachedSpreadsheet): void {
    queueSpreadsheetPush(docId, sheet);
  },

  /**
   * Makes the backend's link the local one: upserts the sheet into the Hub registry
   * and attaches it to the document. Returns the sheet that is now attached.
   */
  applyBackendSpreadsheet(docId: string, remote: AttachedSpreadsheet): AttachedSpreadsheet {
    const list = this.getAllSpreadsheets();
    const idx = list.findIndex((s) => s.id === remote.id);
    const local = idx >= 0 ? list[idx] : null;

    // Keep a newer local copy (e.g. edits made while offline) and push it up instead.
    const localIsNewer =
      !!local?.updatedAt && !!remote.updatedAt && new Date(local.updatedAt) > new Date(remote.updatedAt);
    const merged: AttachedSpreadsheet = localIsNewer
      ? { ...local! }
      : { ...local, ...remote, description: local?.description };
    merged.assignedDocIds = Array.from(new Set([...(local?.assignedDocIds || []), docId]));

    if (idx >= 0) list[idx] = merged;
    else list.unshift(merged);
    cachedSpreadsheetsList = list;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    this.assignSpreadsheetToDocument(docId, merged.id, { syncBackend: false });
    if (localIsNewer) queueSpreadsheetPush(docId, merged);
    return merged;
  },

  updateAttachedSpreadsheet(
    sheet: AttachedSpreadsheet,
    docId?: string,
    shiftedBlocks?: SecBlock[]
  ): SecFilingDocument {
    // Save to central Spreadsheet Hub registry
    this.saveSpreadsheet(sheet);

    const doc = docId ? this.getDocumentContent(docId) : this.getMainDocument();
    doc.attachedSpreadsheet = sheet;
    doc.attachedSpreadsheetId = sheet.id;
    if (shiftedBlocks && Array.isArray(shiftedBlocks)) {
      doc.blocks = shiftedBlocks;
    }
    doc.updatedAt = new Date().toISOString();
    this.saveMainDocument(doc, true);
    broadcastSync('SPREADSHEET_UPDATED', { sheetId: sheet.id });

    // Background sync to PostgreSQL backend (debounced; deduped with saveSpreadsheet's push)
    queueSpreadsheetPush(docId || doc.id || this.getActiveDocumentId(), sheet);

    return doc;
  },

  updateSpreadsheetCellAndSyncDoc(
    cellRef: string,
    newValue: any,
    docId?: string
  ): { updatedDoc: SecFilingDocument; updatedCount: number } {
    const doc = docId ? this.getDocumentContent(docId) : this.getMainDocument();
    const spreadsheet = doc.attachedSpreadsheet;
    if (!spreadsheet) {
      return { updatedDoc: doc, updatedCount: 0 };
    }

    const cleanRef = cellRef.trim().toUpperCase();
    spreadsheet.cells[cleanRef] = newValue;
    spreadsheet.updatedAt = new Date().toISOString();

    // Persist in central Spreadsheet Hub registry
    this.saveSpreadsheet(spreadsheet);

    // Background sync to PostgreSQL backend. A full (debounced) upsert rather than the
    // cells PATCH, which would create a blank placeholder row when none exists yet.
    queueSpreadsheetPush(docId || doc.id || this.getActiveDocumentId(), spreadsheet);

    const formattedVal = formatCellValue(newValue);
    let updatedCount = 0;

    // Pattern to match @Cell or @'Sheet'!Cell or @Sheet!Cell with optional {...}
    let bareCell = cleanRef;
    let tabPrefixPattern = '(?:(?:\'[^\']+\'|[A-Za-z0-9_.\\- ]+)!)?';
    const tabMatch = cleanRef.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3}\d{1,4})$/i);
    if (tabMatch) {
      bareCell = tabMatch[3].toUpperCase();
      const specificTab = tabMatch[1] || tabMatch[2];
      if (specificTab) {
        const escapedTab = specificTab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        tabPrefixPattern = `(?:'${escapedTab}'|${escapedTab})!`;
      }
    }
    const regex = new RegExp(`@(${tabPrefixPattern}${bareCell})(?:\\{[^}]*\\})?`, 'gi');

    // Update all occurrences across document blocks
    if (Array.isArray(doc.blocks)) {
      doc.blocks = doc.blocks.map((block) => {
        if (block.type === 'paragraph' || block.type === 'heading') {
          if (regex.test(block.text)) {
            const matches = block.text.match(regex);
            updatedCount += matches ? matches.length : 0;
            return {
              ...block,
              text: block.text.replace(regex, `@$1{${formattedVal}}`),
              updatedAt: new Date().toISOString()
            };
          }
        } else if (block.type === 'callout') {
          let updated = false;
          let content = block.content;
          let title = block.title;
          if (content && regex.test(content)) {
            const matches = content.match(regex);
            updatedCount += matches ? matches.length : 0;
            content = content.replace(regex, `@$1{${formattedVal}}`);
            updated = true;
          }
          if (title && regex.test(title)) {
            const matches = title.match(regex);
            updatedCount += matches ? matches.length : 0;
            title = title.replace(regex, `@$1{${formattedVal}}`);
            updated = true;
          }
          if (updated) {
            return { ...block, content, title, updatedAt: new Date().toISOString() };
          }
        } else if (block.type === 'financial_table' && Array.isArray(block.rows)) {
          let tableUpdated = false;
          const rows = block.rows.map((r) => {
            if (Array.isArray(r.cells)) {
              let rowUpdated = false;
              const cells = r.cells.map((c) => {
                if (typeof c === 'string' && regex.test(c)) {
                  const matches = c.match(regex);
                  updatedCount += matches ? matches.length : 0;
                  rowUpdated = true;
                  tableUpdated = true;
                  return c.replace(regex, `@$1{${formattedVal}}`);
                }
                return c;
              });
              if (rowUpdated) return { ...r, cells };
            }
            return r;
          });
          if (tableUpdated) {
            return { ...block, rows, updatedAt: new Date().toISOString() };
          }
        }
        return block;
      });
    }

    doc.updatedAt = new Date().toISOString();
    this.saveMainDocument(doc, true);
    broadcastSync('SPREADSHEET_UPDATED', { cellRef: cleanRef, value: newValue });

    return { updatedDoc: doc, updatedCount };
  },

  getActiveDocumentId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_ID) || 'sec-doc-zenatech-2026-q2';
  },

  openDocument(id: string): SecFilingDocument {
    pendingMainDocToSave = null;
    this.setActiveDocumentId(id);

    const customKey = `sec_doc_content_${id}`;
    let doc: SecFilingDocument | null = null;
    const customSaved = typeof localStorage !== 'undefined' ? localStorage.getItem(customKey) : null;
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
          doc = parsed;
        }
      } catch (e) {
        console.error('Failed to parse doc', e);
      }
    }

    if (!doc) {
      const savedMain = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.MAIN_DOC) : null;
      if (savedMain) {
        try {
          const parsed = JSON.parse(savedMain);
          if (parsed && parsed.id === id && Array.isArray(parsed.blocks)) {
            parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
            doc = parsed;
          }
        } catch {
          // Ignore
        }
      }
    }

    if (!doc) {
      if (id === 'sec-doc-zenatech-v24-sarah-jenkins') {
        doc = generateSarahJenkinsMergedDoc();
      } else if (id === 'sec-doc-zenatech-10q-q2') {
        doc = generate10QDoc('ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-2025-10k') {
        doc = generate10KDoc('ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-8k-acq') {
        doc = generate8KDoc('ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)');
        doc.id = id;
      } else if (id === 'doc-onboarding-1') {
        doc = generateOnboardingChecklistDoc('Onboarding');
        doc.id = id;
      } else if (id === 'doc-offboarding-2') {
        doc = generateOffboardingChecklistDoc('Offboarding Checklist');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-2026-q2') {
        doc = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
      } else {
        doc = generateBlankDocument('Untitled Document');
        doc.id = id;
      }
    }

    const finalDoc: SecFilingDocument = doc || generateBlankDocument('Untitled Document');
    finalDoc.id = id;

    // Resolve attached spreadsheet from central Hub registry
    const allSheets = this.getAllSpreadsheets();
    if (finalDoc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === finalDoc.attachedSpreadsheetId);
      if (match) {
        finalDoc.attachedSpreadsheet = match;
      } else {
        const fallbackMatch = allSheets.find((s) => s.assignedDocIds?.includes(finalDoc.id));
        if (fallbackMatch) {
          finalDoc.attachedSpreadsheetId = fallbackMatch.id;
          finalDoc.attachedSpreadsheet = fallbackMatch;
        } else {
          finalDoc.attachedSpreadsheetId = undefined;
          finalDoc.attachedSpreadsheet = null;
        }
      }
    } else {
      const match = allSheets.find((s) => s.assignedDocIds?.includes(finalDoc.id));
      if (match) {
        finalDoc.attachedSpreadsheetId = match.id;
        finalDoc.attachedSpreadsheet = match;
      } else {
        finalDoc.attachedSpreadsheet = null;
      }
    }

    safeSetItem(customKey, JSON.stringify(finalDoc));
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(finalDoc));
    pendingMainDocToSave = finalDoc;
    return finalDoc;
  },


  createDocumentFromTemplate(templateId: string, customTitle?: string): SecFilingDocument {
    let newDoc: SecFilingDocument;
    const title = customTitle || (templateId === 'blank' ? 'Untitled Document' : `New ${templateId.toUpperCase()} Document`);

    switch (templateId) {
      case 'onboarding':
        newDoc = generateOnboardingChecklistDoc(title);
        break;
      case 'offboarding':
        newDoc = generateOffboardingChecklistDoc(title);
        break;
      case '10-q':
        newDoc = generate10QDoc(title);
        break;
      case '10-k':
        newDoc = generate10KDoc(title);
        break;
      case '8-k':
        newDoc = generate8KDoc(title);
        break;
      case 'proposal':
        newDoc = generateProjectProposalDoc(title);
        break;
      case 'blank':
      default:
        newDoc = generateBlankDocument(title);
        break;
    }

    // Save document content
    safeSetItem(`sec_doc_content_${newDoc.id}`, JSON.stringify(newDoc));
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(newDoc));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, newDoc.id);
    pendingMainDocToSave = newDoc;

    // Add to documents list
    const list = this.getDocumentsList();
    const summary: SecDocumentSummary = {
      id: newDoc.id,
      title: newDoc.title,
      formType: newDoc.formType,
      period: newDoc.period,
      updatedAt: newDoc.updatedAt,
      createdAt: newDoc.createdAt,
      owner: 'me',
      isShared: false,
      version: newDoc.version,
      blocksCount: newDoc.blocks.length,
      templateType: templateId,
    };

    list.unshift(summary);
    this.saveDocumentsList(list);
    return newDoc;
  },

  duplicateDocument(id: string): SecFilingDocument | null {
    const list = this.getDocumentsList();
    const item = list.find((d) => d.id === id);
    if (!item) return null;

    let baseDoc: SecFilingDocument;
    const customSaved = localStorage.getItem(`sec_doc_content_${id}`);
    if (customSaved) {
      baseDoc = JSON.parse(customSaved);
    } else if (id === 'sec-doc-zenatech-2026-q2') {
      baseDoc = this.getMainDocument();
    } else if (item.templateType === 'onboarding') {
      baseDoc = generateOnboardingChecklistDoc(item.title);
    } else if (item.templateType === 'offboarding') {
      baseDoc = generateOffboardingChecklistDoc(item.title);
    } else {
      baseDoc = generateBlankDocument(item.title);
    }

    const newId = `doc-copy-${Date.now()}`;
    const newDoc: SecFilingDocument = {
      ...baseDoc,
      id: newId,
      title: `Copy of ${item.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 'v1.0.0',
      versionNumber: 1,
      blocks: JSON.parse(JSON.stringify(baseDoc.blocks || [])),
    };

    safeSetItem(`sec_doc_content_${newId}`, JSON.stringify(newDoc));

    const newSummary: SecDocumentSummary = {
      ...item,
      id: newId,
      title: newDoc.title,
      updatedAt: newDoc.updatedAt,
      createdAt: newDoc.createdAt,
      owner: 'me',
      isShared: false,
    };

    list.unshift(newSummary);
    this.saveDocumentsList(list);
    return newDoc;
  },

  renameDocument(id: string, newTitle: string): boolean {
    if (!newTitle.trim()) return false;
    const list = this.getDocumentsList();
    const item = list.find((d) => d.id === id);
    if (item) {
      item.title = newTitle.trim();
      item.updatedAt = new Date().toISOString();
      this.saveDocumentsList(list);
    }

    // Also update document content if present
    const customKey = `sec_doc_content_${id}`;
    const saved = localStorage.getItem(customKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.title = newTitle.trim();
        parsed.updatedAt = new Date().toISOString();
        safeSetItem(customKey, JSON.stringify(parsed));
      } catch (e) {
        console.error('Rename error', e);
      }
    }

    if (id === this.getActiveDocumentId()) {
      const main = this.getMainDocument();
      main.title = newTitle.trim();
      main.updatedAt = new Date().toISOString();
      this.saveMainDocument(main, true);
    }

    return true;
  },

  deleteDocument(id: string): boolean {
    const list = this.getDocumentsList();
    const filtered = list.filter((d) => d.id !== id);
    this.saveDocumentsList(filtered);
    try {
      localStorage.removeItem(`sec_doc_content_${id}`);
    } catch (e) {
      console.warn('Remove doc error', e);
    }
    return true;
  },


  getProposals(): SecChangeProposal[] {
    if (pendingProposalsToSave) {
      return pendingProposalsToSave;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.PROPOSALS) || localStorage.getItem('sec_filing_proposals_v1') || localStorage.getItem('sec_filing_proposals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: SecChangeProposal) => ({
            ...p,
            blocks: sanitizeAndCompactBlocks(p.blocks || [])
          }));
        }
      } catch (e) {
        console.error('Failed to parse proposals from storage', e);
      }
    }
    safeSetItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(INITIAL_PROPOSALS));
    return JSON.parse(JSON.stringify(INITIAL_PROPOSALS));
  },

  saveProposals(proposals: SecChangeProposal[], immediate = false): boolean {
    pendingProposalsToSave = proposals;
    if (immediate) {
      return flushPendingSaves();
    }
    if (saveProposalsTimer) clearTimeout(saveProposalsTimer);
    saveProposalsTimer = setTimeout(flushPendingSaves, 350);
    return true;
  },

  createProposal(
    title: string,
    author: { id: string; name: string; email: string; role: string },
    description: string,
    baseDoc: SecFilingDocument,
    assignedSection?: string
  ): SecChangeProposal {
    const proposals = this.getProposals();
    const newProposal: SecChangeProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: baseDoc.version,
      baseVersionNumber: baseDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(baseDoc.blocks)),
      assignedSection: assignedSection && assignedSection !== 'ALL' ? assignedSection : undefined,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: description || 'New proposed branch created'
      }
    };

    proposals.unshift(newProposal);
    this.saveProposals(proposals);
    broadcastSync("PROPOSAL_CREATED", { proposalId: newProposal.id, title: newProposal.title });
    return newProposal;
  },

  createContributorInvite(params: {
    title: string;
    contributorName: string;
    contributorRole: string;
    contributorEmail?: string;
    assignedSection?: string;
    description?: string;
    permissions?: ContributorPermissions;
    baseDoc: SecFilingDocument;
  }): { proposal: SecChangeProposal; inviteUrl: string } {
    const proposals = this.getProposals();
    const propId = `prop-contrib-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const token = `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    const author = {
      id: `usr-contrib-${Date.now().toString(36)}`,
      name: params.contributorName,
      email: params.contributorEmail || `${params.contributorName.toLowerCase().replace(/\s+/g, '.')}@zenatech.com`,
      role: params.contributorRole
    };

    const newProposal: SecChangeProposal = {
      id: propId,
      title: params.title || `${params.contributorName}'s ${params.assignedSection || 'Filing'} Revisions`,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: params.baseDoc.version,
      baseVersionNumber: params.baseDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(params.baseDoc.blocks)),
      assignedSection: params.assignedSection && params.assignedSection !== 'ALL' ? params.assignedSection : undefined,
      inviteToken: token,
      permissions: params.permissions,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft assigned section workspace for ${params.contributorName}`
      }
    };

    proposals.unshift(newProposal);
    this.saveProposals(proposals);

    const inviteUrl = getProposalInviteUrl(newProposal);

    broadcastSync("CONTRIBUTOR_INVITED", { proposalId: newProposal.id, name: params.contributorName });
    return { proposal: newProposal, inviteUrl };
  },

  getOrCreateContributorProposal(params: {
    id: string;
    title?: string;
    name?: string;
    role?: string;
    email?: string;
    section?: string;
    description?: string;
    permissions?: ContributorPermissions;
  }): SecChangeProposal {
    const proposals = this.getProposals();
    const existing = proposals.find((p) => p.id === params.id);
    if (existing) {
      return existing;
    }

    const mainDoc = this.getMainDocument();
    const author = {
      id: `contrib-${Date.now()}`,
      name: params.name || 'External Contributor',
      email: params.email || `${(params.name || 'contributor').toLowerCase().replace(/\s+/g, '.')}@zenatech.com`,
      role: params.role || 'Contributor'
    };

    const newProposal: SecChangeProposal = {
      id: params.id,
      title: params.title || `Contributor Draft - ${author.name}`,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: mainDoc.version,
      baseVersionNumber: mainDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(mainDoc.blocks)),
      assignedSection: params.section && params.section !== 'ALL' ? params.section : undefined,
      inviteToken: `inv-${Date.now().toString(36)}`,
      permissions: params.permissions,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft contributor session for ${author.name}`
      }
    };

    proposals.unshift(newProposal);
    this.saveProposals(proposals);
    return newProposal;
  },

  forkProposalFromMerged(
    sourceProposalId: string,
    customBlocks?: SecBlock[],
    customTitle?: string
  ): SecChangeProposal {
    const proposals = this.getProposals();
    const source = proposals.find((p) => p.id === sourceProposalId);
    if (!source) {
      throw new Error(`Source proposal ${sourceProposalId} not found`);
    }

    const currentMain = this.getMainDocument();
    const newPropId = `prop-contrib-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const roundMatch = source.title.match(/\((?:Round|Revision)\s*(\d+)\)/i);
    let nextTitle = customTitle || source.title;
    if (!customTitle) {
      if (roundMatch) {
        const nextNum = parseInt(roundMatch[1], 10) + 1;
        nextTitle = source.title.replace(/\((?:Round|Revision)\s*\d+\)/i, `(Round ${nextNum})`);
      } else {
        nextTitle = `${source.title} (Round 2)`;
      }
    }

    const blocksToUse = customBlocks ? JSON.parse(JSON.stringify(customBlocks)) : JSON.parse(JSON.stringify(currentMain.blocks));
    const diffs = this.calculateDiffs(currentMain.blocks, blocksToUse);

    const newProposal: SecChangeProposal = {
      id: newPropId,
      title: nextTitle,
      author: { ...source.author },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: currentMain.version,
      baseVersionNumber: currentMain.versionNumber,
      blocks: blocksToUse,
      assignedSection: source.assignedSection,
      inviteToken: `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      changeSummary: {
        addedCount: diffs.filter((d) => d.status === 'added').length,
        modifiedCount: diffs.filter((d) => d.status === 'modified').length,
        deletedCount: diffs.filter((d) => d.status === 'deleted').length,
        description: `Follow-up revisions based on ${currentMain.version}`
      }
    };

    proposals.unshift(newProposal);
    this.saveProposals(proposals, true);
    broadcastSync("PROPOSAL_UPDATED", { proposalId: newProposal.id });
    return newProposal;
  },

  updateProposal(proposal: SecChangeProposal): void {
    const proposals = this.getProposals();
    const idx = proposals.findIndex((p) => p.id === proposal.id);
    if (idx !== -1) {
      proposals[idx] = {
        ...proposal,
        updatedAt: new Date().toISOString()
      };
      this.saveProposals(proposals);
      broadcastSync("PROPOSAL_UPDATED", { proposalId: proposal.id });
    }
  },

  submitProposalForReview(
    proposalId: string,
    notes?: string
  ): { ok: boolean; reason?: 'not_found' | 'storage_full' } {
    const proposals = this.getProposals();
    const p = proposals.find((x) => x.id === proposalId);
    if (!p) {
      return { ok: false, reason: 'not_found' };
    }
    p.status = 'pending_review';
    p.submissionNotes = notes;
    p.submittedAt = new Date().toISOString();
    p.updatedAt = new Date().toISOString();
    // Write through immediately. The broadcast below makes other tabs re-read storage
    // at once, so a debounced write would have them reload a proposal list that does
    // not contain the submission yet.
    const persisted = this.saveProposals(proposals, true);
    if (!persisted) {
      // The submission is live in this session but did not reach storage, so the
      // Lead Controller would never see it. Report it instead of claiming success.
      return { ok: false, reason: 'storage_full' };
    }
    broadcastSync("PROPOSAL_SUBMITTED", { author: p.author.name, proposalId: p.id, title: p.title });
    return { ok: true };
  },

  mergeSelectiveChanges(
    proposalId: string,
    acceptedBlockIds: string[],
    reviewerName: string,
    reviewNotes?: string
  ): { updatedDoc: SecFilingDocument; newSnapshot: SecVersionSnapshot } {
    const proposals = this.getProposals();
    const proposal = proposals.find((x) => x.id === proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const currentMain = this.getMainDocument();
    const diffs = this.calculateDiffs(currentMain.blocks, proposal.blocks);
    const acceptedSet = new Set(acceptedBlockIds);

    let mergedBlocks: SecBlock[] = JSON.parse(JSON.stringify(currentMain.blocks));

    for (const diff of diffs) {
      if (acceptedSet.has(diff.blockId)) {
        if (diff.status === 'modified' && diff.proposedBlock) {
          const idx = mergedBlocks.findIndex((b) => b.id === diff.blockId);
          if (idx !== -1) {
            mergedBlocks[idx] = JSON.parse(JSON.stringify(diff.proposedBlock));
          }
        } else if (diff.status === 'deleted') {
          mergedBlocks = mergedBlocks.filter((b) => b.id !== diff.blockId);
        }
      }
    }

    for (const diff of diffs) {
      if (diff.status === 'added' && diff.proposedBlock && acceptedSet.has(diff.blockId)) {
        const propIndex = proposal.blocks.findIndex((b) => b.id === diff.blockId);
        let insertIndex = mergedBlocks.length;
        if (propIndex > 0) {
          const prevPropBlock = proposal.blocks[propIndex - 1];
          const mainPrevIdx = mergedBlocks.findIndex((b) => b.id === prevPropBlock.id);
          if (mainPrevIdx !== -1) {
            insertIndex = mainPrevIdx + 1;
          }
        }
        mergedBlocks.splice(insertIndex, 0, JSON.parse(JSON.stringify(diff.proposedBlock)));
      }
    }

    const nextVersionNumber = currentMain.versionNumber + 1;
    const nextVersionLabel = `v${nextVersionNumber} (Merged ${proposal.author.name})`;
    const versionHistory = this.getVersionHistory();

    const updatedMain: SecFilingDocument = {
      ...currentMain,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      blocks: mergedBlocks,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: reviewerName
    };

    // Write the merged document through immediately and abort the merge if it does not
    // reach storage, so the proposal is never marked merged against a document that was
    // silently rolled back.
    if (!this.saveMainDocument(updatedMain, true)) {
      throw new Error(
        'Browser storage is full, so the merged document could not be saved. Clear older version history or merged drafts for this filing, then merge again.'
      );
    }

    const newSnapshot: SecVersionSnapshot = {
      id: `snap-v${nextVersionNumber}-${Date.now()}`,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      timestamp: new Date().toISOString(),
      author: reviewerName,
      description: `Confirmed and merged ${acceptedBlockIds.length} changes from "${proposal.title}" by ${proposal.author.name}. ${reviewNotes || ''}`,
      blocks: JSON.parse(JSON.stringify(mergedBlocks)),
      proposalId: proposal.id
    };
    versionHistory.push(newSnapshot);
    this.saveVersionHistory(versionHistory);

    proposal.status = 'merged';
    proposal.reviewedBy = reviewerName;
    proposal.reviewedAt = new Date().toISOString();
    proposal.reviewNotes = reviewNotes;
    this.saveProposals(proposals, true);
    broadcastSync("DOC_MERGED", { reviewer: reviewerName, proposalId: proposal.id });

    return { updatedDoc: updatedMain, newSnapshot };
  },

  mergeProposalIntoMain(
    proposalId: string,
    reviewerName: string,
    reviewNotes?: string
  ): { updatedDoc: SecFilingDocument; newSnapshot: SecVersionSnapshot } {
    const proposals = this.getProposals();
    const proposal = proposals.find((x) => x.id === proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    const allDiffs = this.calculateDiffs(this.getMainDocument().blocks, proposal.blocks);
    const allChangedIds = allDiffs.filter((d) => d.status !== 'unchanged').map((d) => d.blockId);
    return this.mergeSelectiveChanges(proposalId, allChangedIds, reviewerName, reviewNotes);
  },

  rejectProposal(proposalId: string, reviewerName: string, reviewNotes: string): void {
    const proposals = this.getProposals();
    const p = proposals.find((x) => x.id === proposalId);
    if (p) {
      p.status = 'rejected';
      p.reviewedBy = reviewerName;
      p.reviewedAt = new Date().toISOString();
      p.reviewNotes = reviewNotes;
      this.saveProposals(proposals);
    }
  },

  getVersionHistory(): SecVersionSnapshot[] {
    const saved = localStorage.getItem(STORAGE_KEYS.VERSION_HISTORY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse version history', e);
      }
    }
    safeSetItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(INITIAL_VERSION_HISTORY));
    return JSON.parse(JSON.stringify(INITIAL_VERSION_HISTORY));
  },

  saveVersionHistory(history: SecVersionSnapshot[]): void {
    // Each snapshot carries a full copy of the document, so cap the history here
    // rather than letting it grow until it exhausts the storage quota.
    const capped =
      history.length > MAX_RETAINED_SNAPSHOTS ? history.slice(-MAX_RETAINED_SNAPSHOTS) : history;
    safeSetItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(capped));
  },

  restoreVersion(snapshotId: string, restoredBy: string): SecFilingDocument {
    const history = this.getVersionHistory();
    const snapshot = history.find((s) => s.id === snapshotId);
    if (!snapshot) throw new Error('Snapshot not found');

    const currentMain = this.getMainDocument();
    const nextVersionNumber = currentMain.versionNumber + 1;
    const nextVersionLabel = `v${nextVersionNumber} (Restored from ${snapshot.version})`;

    const updatedMain: SecFilingDocument = {
      ...currentMain,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
      updatedAt: new Date().toISOString(),
      lastModifiedBy: `${restoredBy} (Restored from ${snapshot.version})`
    };

    if (!this.saveMainDocument(updatedMain, true)) {
      throw new Error(
        'Browser storage is full, so the restored document could not be saved. Clear older version history for this filing, then restore again.'
      );
    }

    const newSnapshot: SecVersionSnapshot = {
      id: `snap-v${nextVersionNumber}-${Date.now()}`,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      timestamp: new Date().toISOString(),
      author: restoredBy,
      description: `Restored document state from ${snapshot.version}`,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks))
    };
    history.push(newSnapshot);
    this.saveVersionHistory(history);

    return updatedMain;
  },

  calculateDiffs(baseBlocks: SecBlock[], proposedBlocks: SecBlock[], originSnapshotBlocks?: SecBlock[]): SecBlockDiff[] {
    const diffs: SecBlockDiff[] = [];
    const baseMap = new Map<string, SecBlock>(baseBlocks.map((b) => [b.id, b]));
    const proposedMap = new Map<string, SecBlock>(proposedBlocks.map((b) => [b.id, b]));

    for (const pBlock of proposedBlocks) {
      const orig = baseMap.get(pBlock.id);
      if (!orig) {
        diffs.push({
          blockId: pBlock.id,
          status: 'added',
          proposedBlock: pBlock,
          changeCategories: ['structure', 'content'],
          changeTags: [
            { category: 'structure', label: `New ${pBlock.type.replace('_', ' ')} block added` }
          ]
        });
      } else if (orig === pBlock) {
        // FAST-PATH: Pointer equality confirms 0 changes in O(1) time
        diffs.push({
          blockId: pBlock.id,
          status: 'unchanged',
          originalBlock: orig,
          proposedBlock: pBlock
        });
      } else {
        const isSame = JSON.stringify(orig) === JSON.stringify(pBlock);
        if (isSame) {
          diffs.push({
            blockId: pBlock.id,
            status: 'unchanged',
            originalBlock: orig,
            proposedBlock: pBlock
          });
        } else {
          const fieldDiffs: { field: string; oldValue: any; newValue: any }[] = [];
          const changeTags: SecChangeTag[] = [];
          const categorySet = new Set<SecChangeCategory>();

          // 1. Spacing changes
          const origSpacingTop = orig.spacingTop ?? 0;
          const propSpacingTop = pBlock.spacingTop ?? 0;
          if (origSpacingTop !== propSpacingTop) {
            fieldDiffs.push({ field: 'spacingTop', oldValue: origSpacingTop, newValue: propSpacingTop });
            categorySet.add('spacing');
            const diffPx = propSpacingTop - origSpacingTop;
            changeTags.push({
              category: 'spacing',
              label: `Top Spacing: ${origSpacingTop}px → ${propSpacingTop}px`,
              detail: `Top spacing altered by ${diffPx > 0 ? '+' : ''}${diffPx}px`
            });
          }

          const origSpacingBottom = orig.spacingBottom ?? 0;
          const propSpacingBottom = pBlock.spacingBottom ?? 0;
          if (origSpacingBottom !== propSpacingBottom) {
            fieldDiffs.push({ field: 'spacingBottom', oldValue: origSpacingBottom, newValue: propSpacingBottom });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Bottom Spacing: ${origSpacingBottom}px → ${propSpacingBottom}px`
            });
          }

          const origSpacingPreset = orig.spacing || 'normal';
          const propSpacingPreset = pBlock.spacing || 'normal';
          if (origSpacingPreset !== propSpacingPreset) {
            fieldDiffs.push({ field: 'spacing', oldValue: origSpacingPreset, newValue: propSpacingPreset });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Spacing Preset: ${origSpacingPreset} → ${propSpacingPreset}`
            });
          }

          const origLineSpacing = (orig as any).lineSpacing;
          const propLineSpacing = (pBlock as any).lineSpacing;
          if (origLineSpacing !== propLineSpacing && (origLineSpacing || propLineSpacing)) {
            fieldDiffs.push({ field: 'lineSpacing', oldValue: origLineSpacing, newValue: propLineSpacing });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Line Height: ${origLineSpacing || '1.0'} → ${propLineSpacing || '1.0'}`
            });
          }

          // 2. Typography & Font Styling changes
          const origBold = !!(orig as any).bold;
          const propBold = !!(pBlock as any).bold;
          if (origBold !== propBold) {
            fieldDiffs.push({ field: 'bold', oldValue: origBold, newValue: propBold });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propBold ? 'Font: Bold Added' : 'Font: Bold Removed'
            });
          }

          const origItalic = !!(orig as any).italic;
          const propItalic = !!(pBlock as any).italic;
          if (origItalic !== propItalic) {
            fieldDiffs.push({ field: 'italic', oldValue: origItalic, newValue: propItalic });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propItalic ? 'Font: Italic Added' : 'Font: Italic Removed'
            });
          }

          const origUnderline = !!(orig as any).underline;
          const propUnderline = !!(pBlock as any).underline;
          if (origUnderline !== propUnderline) {
            fieldDiffs.push({ field: 'underline', oldValue: origUnderline, newValue: propUnderline });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propUnderline ? 'Font: Underline Added' : 'Font: Underline Removed'
            });
          }

          const origFontSize = (orig as any).fontSize;
          const propFontSize = (pBlock as any).fontSize;
          if (origFontSize !== propFontSize && (origFontSize || propFontSize)) {
            fieldDiffs.push({ field: 'fontSize', oldValue: origFontSize, newValue: propFontSize });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Font Size: ${origFontSize || 'Default'} → ${propFontSize || 'Default'}pt`
            });
          }

          const origAlignment = (orig as any).alignment;
          const propAlignment = (pBlock as any).alignment;
          if (origAlignment !== propAlignment && (origAlignment || propAlignment)) {
            fieldDiffs.push({ field: 'alignment', oldValue: origAlignment, newValue: propAlignment });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Alignment: ${origAlignment || 'left'} → ${propAlignment || 'left'}`
            });
          }

          const origLevel = (orig as any).level;
          const propLevel = (pBlock as any).level;
          if (origLevel !== propLevel && (origLevel || propLevel)) {
            fieldDiffs.push({ field: 'level', oldValue: origLevel, newValue: propLevel });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Heading Level: H${origLevel || 2} → H${propLevel || 2}`
            });
          }

          // 3. Section & Structural Move
          if (orig.section !== pBlock.section) {
            fieldDiffs.push({ field: 'section', oldValue: orig.section, newValue: pBlock.section });
            categorySet.add('structure');
            changeTags.push({
              category: 'structure',
              label: `Moved Section: "${orig.section}" → "${pBlock.section}"`
            });
          }

          // 4. Text & Narrative Content
          const origText = (orig as any).text;
          const propText = (pBlock as any).text;
          if (origText !== propText && (origText !== undefined || propText !== undefined)) {
            fieldDiffs.push({ field: 'text', oldValue: origText, newValue: propText });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Text Disclosure Modified'
            });
          }

          const origTitle = (orig as any).title;
          const propTitle = (pBlock as any).title;
          if (origTitle !== propTitle && (origTitle !== undefined || propTitle !== undefined)) {
            fieldDiffs.push({ field: 'title', oldValue: origTitle, newValue: propTitle });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: `Title: "${origTitle}" → "${propTitle}"`
            });
          }

          const origContent = (orig as any).content;
          const propContent = (pBlock as any).content;
          if (origContent !== propContent && (origContent !== undefined || propContent !== undefined)) {
            fieldDiffs.push({ field: 'content', oldValue: origContent, newValue: propContent });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Callout Notice Content Edited'
            });
          }

          let tableCellDiffs: SecTableCellDiff[] | undefined = undefined;

          // 5. Financial Statements & Table Rows
          if (orig.type === 'financial_table' && pBlock.type === 'financial_table') {
            const tableDiffResult = computeFinancialTableCellDiffs(orig, pBlock);
            if (tableDiffResult.cellCount > 0) {
              categorySet.add('financial_data');
              tableCellDiffs = tableDiffResult.tableCellDiffs;
              changeTags.push(...tableDiffResult.changeTags);

              for (const cd of tableDiffResult.tableCellDiffs) {
                fieldDiffs.push({
                  field: `${cd.rowLabel} [${cd.headerLabel}]`,
                  oldValue: cd.oldValue,
                  newValue: cd.newValue
                });
              }
            }
          }

          // 6. Signatures
          if (orig.type === 'signature' && pBlock.type === 'signature') {
            if (JSON.stringify(orig.officers) !== JSON.stringify(pBlock.officers)) {
              categorySet.add('signature');
              changeTags.push({
                category: 'signature',
                label: 'Signatory Officers Updated'
              });
            }
          }

          if (changeTags.length === 0) {
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Block properties modified'
            });
          }

          const categories = Array.from(categorySet);
          const isSpacingOnly = categories.length === 1 && categories[0] === 'spacing';
          const isTypographyOnly = categories.length === 1 && categories[0] === 'typography';
          const isContentModified = categories.includes('content') || categories.includes('financial_data');

          diffs.push({
            blockId: pBlock.id,
            status: 'modified',
            originalBlock: orig,
            proposedBlock: pBlock,
            fieldDiffs,
            tableCellDiffs,
            changeCategories: categories,
            changeTags,
            isSpacingOnly,
            isTypographyOnly,
            isContentModified
          });
        }
      }
    }

    for (const bBlock of baseBlocks) {
      if (!proposedMap.has(bBlock.id)) {
        // Check if this block existed in the original base document when the proposal was branched
        // If it was added to Live after the proposal was created, the contributor did NOT delete it!
        const initialBlocks = originSnapshotBlocks || INITIAL_SEC_FILING_DOC.blocks;
        const existedInInitial = initialBlocks.some((initB) => initB.id === bBlock.id);

        if (existedInInitial) {
          // Genuinely deleted by contributor in proposal
          diffs.push({
            blockId: bBlock.id,
            status: 'deleted',
            originalBlock: bBlock,
            changeCategories: ['structure', 'content'],
            changeTags: [
              { category: 'structure', label: `${bBlock.type.replace('_', ' ')} block deleted by contributor` }
            ]
          });
        } else {
          // Block was added to Live directly; contributor proposal simply didn't have it.
          // Preserve as unchanged live content so it is NOT marked as deleted.
          diffs.push({
            blockId: bBlock.id,
            status: 'unchanged',
            originalBlock: bBlock,
            proposedBlock: bBlock
          });
        }
      }
    }

    return diffs;
  },

  applyElectronicSignature(
    officerIdentifier: string,
    signatureData: {
      signatureText: string;
      signatureImageUrl?: string;
      provider?: any;
      signedVia?: string;
      envelopeId?: string;
      ipAddress?: string;
    }
  ): boolean {
    const doc = this.getMainDocument();
    let updated = false;

    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const nextBlocks = doc.blocks.map((b) => {
      if (b.type === 'signature') {
        const nextOfficers = b.officers.map((officer) => {
          const match =
            officer.id === officerIdentifier ||
            (officer.name && officerIdentifier && officer.name.toLowerCase().trim() === officerIdentifier.toLowerCase().trim()) ||
            b.officers.length === 1;

          if (match) {
            updated = true;
            return {
              ...officer,
              signed: true,
              signatureText: signatureData.signatureText.startsWith('/s/')
                ? signatureData.signatureText
                : `/s/ ${signatureData.signatureText}`,
              signatureImageUrl: signatureData.signatureImageUrl,
              date: formattedDate,
              provider: signatureData.provider || officer.provider || 'docusign',
              envelopeId: signatureData.envelopeId,
              signedAt: new Date().toISOString(),
              signedVia:
                signatureData.signedVia ||
                `${signatureData.provider === 'dropbox_sign' ? 'Dropbox Sign' : 'DocuSign'} Mobile SMS (Rule 302(b) Verified)`,
              auditTrailId: signatureData.envelopeId
                ? `SEC-AUDIT-${signatureData.envelopeId.replace(/^[a-z]+-env-/i, '').toUpperCase()}`
                : undefined
            };
          }
          return officer;
        });

        return { ...b, officers: nextOfficers };
      }
      return b;
    });

    if (updated) {
      this.saveMainDocument({ ...doc, blocks: nextBlocks, updatedAt: new Date().toISOString() });
      broadcastSync('DOCUMENT_UPDATED', { action: 'SIGNATURE_APPLIED', officerIdentifier });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sec-filing-signature-applied', {
            detail: { officerIdentifier, signatureData }
          })
        );
      }
      return true;
    }
    return false;
  },

  resetToDefault(): void {
    // Drop the debounced buffers too, otherwise reads keep serving the pre-reset
    // document from memory.
    if (saveMainDocTimer) clearTimeout(saveMainDocTimer);
    if (saveProposalsTimer) clearTimeout(saveProposalsTimer);
    saveMainDocTimer = null;
    saveProposalsTimer = null;
    pendingMainDocToSave = null;
    pendingProposalsToSave = null;

    localStorage.removeItem(STORAGE_KEYS.MAIN_DOC);
    localStorage.removeItem(STORAGE_KEYS.PROPOSALS);
    localStorage.removeItem(STORAGE_KEYS.VERSION_HISTORY);
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(INITIAL_SEC_FILING_DOC));
  }
};
