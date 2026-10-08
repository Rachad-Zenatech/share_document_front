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

export function describeStorageUsage(): {
  totalBytes: number;
  breakdown: Array<{ key: string; bytes: number }>;
} {
  if (typeof localStorage === 'undefined') {
    return { totalBytes: 0, breakdown: [] };
  }
  const breakdown: Array<{ key: string; bytes: number }> = [];
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) || '';
    const bytes = (key.length + val.length) * 2;
    totalBytes += bytes;
    breakdown.push({ key, bytes });
  }
  breakdown.sort((a, b) => b.bytes - a.bytes);
  return { totalBytes, breakdown };
}

export function logStorageBreakdown(): { totalBytes: number; largestKey: string | null } {
  const { totalBytes, breakdown } = describeStorageUsage();
  console.table(breakdown.slice(0, 10));
  return {
    totalBytes,
    largestKey: breakdown[0]?.key ?? null,
  };
}

function readProposalsForReclaim(): any[] | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeProposalsForReclaim(proposals: any[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals));
  } catch (e) {
    console.warn('Could not write reclaimed proposals', e);
  }
}

function trimHistoryTo(keep: number): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(STORAGE_KEYS.VERSION_HISTORY);
  if (!raw) return false;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length <= keep) return false;
    if (keep <= 0) {
      localStorage.removeItem(STORAGE_KEYS.VERSION_HISTORY);
    } else {
      localStorage.setItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(list.slice(0, keep)));
    }
    return true;
  } catch {
    return false;
  }
}

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

function trimAllProposalsTo(keep: number): boolean {
  const source = readProposalsForReclaim();
  if (!source || source.length <= keep) return false;
  const sorted = [...source].sort((a, b) => {
    if (a.status === 'pending_review' && b.status !== 'pending_review') return -1;
    if (b.status === 'pending_review' && a.status !== 'pending_review') return 1;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
  const kept = sorted.slice(0, keep);
  writeProposalsForReclaim(kept);
  return true;
}

function clearOrphanCustomDocs(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let freed = false;
  try {
    const rawList = localStorage.getItem(STORAGE_KEYS.DOCUMENTS_LIST);
    const validIds = new Set<string>();
    if (rawList) {
      try {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) {
          parsed.forEach((d) => d?.id && validIds.add(d.id));
        }
      } catch {
        // Ignore
      }
    }
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_ID);
    if (activeId) validIds.add(activeId);
    validIds.add('sec-doc-zenatech-2026-q2');

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sec_doc_content_')) {
        const docId = key.replace('sec_doc_content_', '');
        if (!validIds.has(docId)) {
          localStorage.removeItem(key);
          freed = true;
        }
      }
    }
  } catch (e) {
    console.warn('Error clearing orphan docs', e);
  }
  return freed;
}

function purgeAllLegacyAndStaleKeys(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let freed = false;
  const currentKeySet = new Set(Object.values(STORAGE_KEYS));
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sec_filing_') && !currentKeySet.has(key)) {
        localStorage.removeItem(key);
        freed = true;
      }
    }
  } catch (e) {
    console.warn('Error purging legacy keys', e);
  }
  return freed;
}

export function cleanupStorageQuota(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let freed = false;
  try {
    if (purgeAllLegacyAndStaleKeys()) freed = true;
    if (clearOrphanCustomDocs()) freed = true;
    if (trimClosedProposalsTo(2)) freed = true;
    if (trimAllProposalsTo(3)) freed = true;
    if (trimHistoryTo(3)) freed = true;
  } catch (e) {
    console.warn('Could not run cleanupStorageQuota', e);
  }
  return freed;
}

export function reclaimStorageSpace(round: number): boolean {
  try {
    switch (round) {
      case 0:
        return purgeAllLegacyAndStaleKeys();
      case 1:
        return clearOrphanCustomDocs();
      case 2:
        return trimHistoryTo(MAX_RETAINED_SNAPSHOTS);
      case 3:
        return trimClosedProposalsTo(MAX_RETAINED_CLOSED_PROPOSALS);
      case 4:
        return trimHistoryTo(MIN_RETAINED_SNAPSHOTS);
      case 5:
        return trimAllProposalsTo(3);
      case 6:
        return trimClosedProposalsTo(0);
      case 7:
        return trimHistoryTo(1);
      case 8:
        return trimAllProposalsTo(1);
      case 9:
        return trimHistoryTo(0);
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
  cleanupStorageQuota();
  window.addEventListener('beforeunload', flushPendingSaves);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSaves();
    }
  });
}
