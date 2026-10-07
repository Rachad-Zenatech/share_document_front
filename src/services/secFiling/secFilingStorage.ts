import type {
  SecFilingDocument,
  SecChangeProposal,
  SecDocumentSummary,
  AttachedSpreadsheet
} from '../../types/secFiling';

export const STORAGE_KEYS = {
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

export function getCachedSpreadsheetsList(): AttachedSpreadsheet[] | null {
  return cachedSpreadsheetsList;
}

export function setCachedSpreadsheetsList(list: AttachedSpreadsheet[] | null): void {
  cachedSpreadsheetsList = list;
}

export function getCachedDocumentsList(): SecDocumentSummary[] | null {
  return cachedDocumentsList;
}

export function setCachedDocumentsList(list: SecDocumentSummary[] | null): void {
  cachedDocumentsList = list;
}

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

export function getBroadcastChannel(): BroadcastChannel | null {
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

export function broadcastSync(type: string, payload?: any): void {
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

export function getPendingMainDoc(): SecFilingDocument | null {
  return pendingMainDocToSave;
}

export function setPendingMainDoc(doc: SecFilingDocument | null): void {
  pendingMainDocToSave = doc;
}

export function getSaveMainDocTimer(): any {
  return saveMainDocTimer;
}

export function setSaveMainDocTimer(timer: any): void {
  saveMainDocTimer = timer;
}

let saveProposalsTimer: any = null;
let pendingProposalsToSave: SecChangeProposal[] | null = null;

export function getPendingProposals(): SecChangeProposal[] | null {
  return pendingProposalsToSave;
}

export function setPendingProposals(proposals: SecChangeProposal[] | null): void {
  pendingProposalsToSave = proposals;
}

export function getSaveProposalsTimer(): any {
  return saveProposalsTimer;
}

export function setSaveProposalsTimer(timer: any): void {
  saveProposalsTimer = timer;
}

let saveSpreadsheetRegistryTimer: any = null;

export function getSaveSpreadsheetRegistryTimer(): any {
  return saveSpreadsheetRegistryTimer;
}

export function setSaveSpreadsheetRegistryTimer(timer: any): void {
  saveSpreadsheetRegistryTimer = timer;
}

export function scheduleSaveSpreadsheetRegistry(list: AttachedSpreadsheet[]): void {
  if (saveSpreadsheetRegistryTimer) clearTimeout(saveSpreadsheetRegistryTimer);
  saveSpreadsheetRegistryTimer = setTimeout(() => {
    saveSpreadsheetRegistryTimer = null;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }
  }, 400);
}

// --------------------------------------------------------------------------
// Storage quota handling
// --------------------------------------------------------------------------

const MAX_RETAINED_SNAPSHOTS = 5;
const MIN_RETAINED_SNAPSHOTS = 2;
const MAX_RETAINED_CLOSED_PROPOSALS = 5;

export type StorageFailure = {
  key: string;
  recovered: boolean;
  totalBytes?: number;
  largestKey?: string | null;
};

let storageFailureListener: ((failure: StorageFailure) => void) | null = null;

export function setStorageFailureListener(
  listener: ((failure: StorageFailure) => void) | null
): void {
  storageFailureListener = listener;
}

export function isQuotaError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22
    );
  }
  return !!err && typeof err === 'object' && (err as any).name === 'QuotaExceededError';
}

const LEGACY_KEYS: { legacy: string; supersededBy: string }[] = [
  { legacy: 'sec_filing_main_doc_v2_full', supersededBy: STORAGE_KEYS.MAIN_DOC },
  { legacy: 'sec_filing_main_doc', supersededBy: STORAGE_KEYS.MAIN_DOC },
  { legacy: 'sec_filing_proposals_v1', supersededBy: STORAGE_KEYS.PROPOSALS },
  { legacy: 'sec_filing_proposals', supersededBy: STORAGE_KEYS.PROPOSALS },
  { legacy: 'sec_filing_versions_v2_full', supersededBy: STORAGE_KEYS.VERSION_HISTORY }
];

export function describeStorageUsage(): { key: string; bytes: number }[] {
  const entries: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      entries.push({ key, bytes: (localStorage.getItem(key) || '').length + key.length });
    }
  } catch (e) {
    console.warn('Could not measure storage usage', e);
  }
  return entries.sort((a, b) => b.bytes - a.bytes);
}

export function logStorageBreakdown(): { totalBytes: number; largestKey: string | null } {
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
  localStorage.setItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(history.slice(-limit)));
  return true;
}

function trimClosedProposalsTo(keep: number): boolean {
  const source = readProposalsForReclaim();
  if (!source) return false;
  const isClosed = (p: any) => p?.status === 'merged' || p?.status === 'rejected';
  const closed = source.filter(isClosed);
  if (closed.length <= keep) return false;
  const kept = new Set(closed.slice(0, keep).map((p: any) => p.id));
  writeProposalsForReclaim(source.filter((p: any) => !isClosed(p) || kept.has(p.id)));
  return true;
}

export function reclaimStorageSpace(round: number): boolean {
  try {
    switch (round) {
      case 0: {
        let freed = false;
        for (const { legacy, supersededBy } of LEGACY_KEYS) {
          if (localStorage.getItem(legacy) === null) continue;
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
        return trimHistoryTo(1);
      case 6:
        return trimClosedProposalsTo(0);
      default:
        return false;
    }
  } catch (e) {
    console.warn('Could not reclaim SEC filing storage space', e);
    return false;
  }
}

export function safeSetItem(key: string, value: string): boolean {
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
        const { totalBytes, largestKey } = logStorageBreakdown();
        console.error(`Browser storage is full; could not write ${key}`, err);
        storageFailureListener?.({ key, recovered: false, totalBytes, largestKey });
        return false;
      }
    }
  }
}

export function flushPendingSaves(): boolean {
  if (saveSpreadsheetRegistryTimer && cachedSpreadsheetsList) {
    clearTimeout(saveSpreadsheetRegistryTimer);
    saveSpreadsheetRegistryTimer = null;
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(cachedSpreadsheetsList));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }
  }

  if (pendingMainDocToSave) {
    if (saveMainDocTimer) clearTimeout(saveMainDocTimer);
    saveMainDocTimer = null;
    const doc = pendingMainDocToSave;

    try {
      if (cachedDocumentsList) {
        const existing = cachedDocumentsList.find((d) => d.id === doc.id);
        if (existing) {
          existing.title = doc.title;
          existing.updatedAt = doc.updatedAt || new Date().toISOString();
          existing.blocksCount = doc.blocks?.length || 0;
          existing.formType = doc.formType;
          localStorage.setItem(STORAGE_KEYS.DOCUMENTS_LIST, JSON.stringify(cachedDocumentsList));
        }
      }
      safeSetItem(`sec_doc_content_${doc.id}`, JSON.stringify(doc));
    } catch (e) {
      console.warn('Could not update document summary', e);
    }

    if (safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(doc))) {
      pendingMainDocToSave = null;
      broadcastSync("MAIN_DOC_SAVED", { version: doc.version });
    }
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
