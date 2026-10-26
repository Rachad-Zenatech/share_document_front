/**
 * Server-backed store for filing documents, proposals and version history.
 *
 * These used to live in each browser's localStorage, so nobody else could see them,
 * clearing site data deleted them, and the ~5 MB quota forced caps on proposals and
 * history. The SEC services still read and write synchronously through a
 * Storage-like API (getItem/setItem/...), but for the keys below that API is backed by
 * memory, filled from the server before the SEC pages render (secFilingSync.ts), and
 * every write is pushed to the server in the background:
 *
 *   sec_doc_content_<id> / main doc  -> PUT  /sec-filings/documents/{id}   (revision-checked)
 *   proposals                        -> PUT  /sec-filings/proposals/{id}
 *   version history                  -> POST /sec-filings/documents/{id}/versions
 *
 * Every other key (active document id, spreadsheet registry...) passes straight
 * through to localStorage.
 *
 * Guest contributors (no login) only ever push their own proposal, through the guest
 * endpoint; document and version writes stay in memory and are never sent.
 */
import { apiClient } from '../apiClient';
import { ApiError } from '../helper';
import { saveGuestProposal } from './secFilingGuest';

export const DOC_STORE_KEYS = {
  MAIN_DOC: 'sec_filing_main_doc_v4_compact',
  PROPOSALS: 'sec_filing_proposals_v4_compact',
  VERSION_HISTORY: 'sec_filing_versions_v4_compact',
  DOCUMENTS_LIST: 'sec_filing_documents_list_v2',
  ACTIVE_DOC_ID: 'sec_filing_active_doc_id',
};
export const DOC_CONTENT_PREFIX = 'sec_doc_content_';
// Keys older builds wrote; the server-backed store never serves them.
const LEGACY_KEYS = new Set([
  'sec_filing_main_doc_v2_full',
  'sec_filing_main_doc',
  'sec_filing_proposals_v1',
  'sec_filing_proposals'
]);

const PUSH_DEBOUNCE_MS = 800;
const RETRY_DELAYS_MS = [2000, 5000, 15000];

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const isManagedKey = (key: string) =>
  key === DOC_STORE_KEYS.MAIN_DOC ||
  key === DOC_STORE_KEYS.PROPOSALS ||
  key === DOC_STORE_KEYS.VERSION_HISTORY ||
  key === DOC_STORE_KEYS.DOCUMENTS_LIST ||
  key.startsWith(DOC_CONTENT_PREFIX) ||
  LEGACY_KEYS.has(key);

const memory = new Map<string, string>();
let serverBacked = false;
let guest: { token: string; proposalId: string } | null = null;

// Per-document state for revision-checked saves.
const revisions = new Map<string, number>();
const dirtyDocs = new Map<string, string>(); // id -> latest JSON not yet sent
const docTimers = new Map<string, ReturnType<typeof setTimeout>>();
const docInFlight = new Set<string>();
const docRetries = new Map<string, number>();

// Proposals / versions: what the server already has, to send only changes.
const pushedProposals = new Map<string, string>();
const pushedVersionIds = new Set<string>();
let proposalTimer: ReturnType<typeof setTimeout> | null = null;
let versionTimer: ReturnType<typeof setTimeout> | null = null;

const previews = new Map<string, unknown[]>();

let status: SyncStatus = 'idle';
let lastError: string | null = null;
const statusListeners = new Set<(s: SyncStatus, error: string | null) => void>();
let docReplacedHandler: ((id: string) => void) | null = null;

function setStatus(next: SyncStatus, error: string | null = null) {
  status = next;
  lastError = error;
  statusListeners.forEach((l) => l(next, error));
}

function emit(name: string, detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

function activeDocId(): string | null {
  try {
    return localStorage.getItem(DOC_STORE_KEYS.ACTIVE_DOC_ID);
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------- documents

function scheduleDocPush(id: string, json: string) {
  dirtyDocs.set(id, json);
  const t = docTimers.get(id);
  if (t) clearTimeout(t);
  docTimers.set(id, setTimeout(() => void pushDoc(id), PUSH_DEBOUNCE_MS));
  setStatus('saving');
}

async function pushDoc(id: string): Promise<void> {
  docTimers.delete(id);
  if (docInFlight.has(id)) return; // re-run when the in-flight save finishes
  const json = dirtyDocs.get(id);
  if (json === undefined) return;
  const document = parse<Record<string, unknown>>(json);
  if (!document) {
    dirtyDocs.delete(id);
    return;
  }

  dirtyDocs.delete(id);
  docInFlight.add(id);
  try {
    const res = await apiClient.put<{ revision: number }>(
      `/sec-filings/documents/${encodeURIComponent(id)}`,
      {
        document,
        baseRevision: revisions.get(id) ?? null,
        templateType: (document as { templateType?: string }).templateType
      },
      { skipGlobalLoading: true }
    );
    revisions.set(id, res.revision);
    docRetries.delete(id);
    lastAttemptFailed = false;
  } catch (err) {
    lastAttemptFailed = !(err instanceof ApiError && err.status === 409);
    if (err instanceof ApiError && err.status === 409) {
      // Someone else saved first: take their copy rather than overwrite it.
      const detail = err.detail as { revision?: number; document?: Record<string, unknown> } | undefined;
      if (detail?.document) {
        replaceDocument(id, detail.document, detail.revision ?? null);
        emit('sec-filing-remote-conflict', { documentId: id, title: detail.document.title });
      }
    } else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      setStatus('error', err.message);
      emit('sec-filing-sync-error', { documentId: id, message: err.message, permanent: true });
    } else {
      // Network/server error: keep the change and retry with backoff.
      if (!dirtyDocs.has(id)) dirtyDocs.set(id, json);
      const attempt = docRetries.get(id) ?? 0;
      docRetries.set(id, attempt + 1);
      setStatus('error', err instanceof Error ? err.message : 'Could not save to server');
      emit('sec-filing-sync-error', { documentId: id, message: (err as Error)?.message, permanent: false });
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      docTimers.set(id, setTimeout(() => void pushDoc(id), delay));
    }
  } finally {
    docInFlight.delete(id);
    if (dirtyDocs.has(id) && !docTimers.has(id)) {
      docTimers.set(id, setTimeout(() => void pushDoc(id), 50));
    }
    refreshIdleStatus();
  }
}

/** Put a server copy of a document into memory (after a conflict or a refresh). */
export function replaceDocument(id: string, document: Record<string, unknown>, revision: number | null) {
  const json = JSON.stringify({ ...document, id });
  memory.set(`${DOC_CONTENT_PREFIX}${id}`, json);
  const main = parse<{ id?: string }>(memory.get(DOC_STORE_KEYS.MAIN_DOC));
  if (main?.id === id) memory.set(DOC_STORE_KEYS.MAIN_DOC, json);
  if (revision !== null) revisions.set(id, revision);
  dirtyDocs.delete(id);
  docReplacedHandler?.(id);
}

// ---------------------------------------------------------------------------- proposals & versions

function scheduleProposalPush() {
  if (proposalTimer) clearTimeout(proposalTimer);
  proposalTimer = setTimeout(() => void pushProposals(), PUSH_DEBOUNCE_MS);
  setStatus('saving');
}

async function pushGuestProposal(): Promise<void> {
  proposalTimer = null;
  if (!guest) return;
  const list = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.PROPOSALS)) || [];
  const p = list.find((x) => x.id === guest!.proposalId);
  const json = p ? JSON.stringify(p) : null;
  if (!p || !json || pushedProposals.get(guest.proposalId) === json) {
    refreshIdleStatus();
    return;
  }
  try {
    await saveGuestProposal(guest.token, p);
    pushedProposals.set(guest.proposalId, json);
    lastAttemptFailed = false;
  } catch (err) {
    lastAttemptFailed = true;
    const message = err instanceof Error ? err.message : 'Could not save your changes';
    setStatus('error', message);
    // Expired/revoked link, already submitted, or edits outside the invite: retrying cannot help.
    const permanent = err instanceof ApiError && [404, 409, 422].includes(err.status);
    emit('sec-filing-sync-error', { proposalId: guest.proposalId, message, permanent });
    if (!permanent) proposalTimer = setTimeout(() => void pushGuestProposal(), RETRY_DELAYS_MS[1]);
  }
  refreshIdleStatus();
}

async function pushProposals(): Promise<void> {
  if (guest) return pushGuestProposal();
  proposalTimer = null;
  const list = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.PROPOSALS)) || [];
  const fallbackDoc = activeDocId();
  let failed = false;
  for (const p of list) {
    const id = p.id as string | undefined;
    const documentId = (p.documentId as string | undefined) || fallbackDoc;
    if (!id || !documentId) continue;
    const json = JSON.stringify(p);
    if (pushedProposals.get(id) === json) continue;
    try {
      await apiClient.put(
        `/sec-filings/proposals/${encodeURIComponent(id)}`,
        { documentId, proposal: { ...p, documentId } },
        { skipGlobalLoading: true }
      );
      pushedProposals.set(id, json);
    } catch (err) {
      failed = true;
      setStatus('error', err instanceof Error ? err.message : 'Could not save proposal');
    }
  }
  lastAttemptFailed = failed;
  if (failed) {
    proposalTimer = setTimeout(() => void pushProposals(), RETRY_DELAYS_MS[1]);
  }
  refreshIdleStatus();
}

function scheduleVersionPush() {
  if (versionTimer) clearTimeout(versionTimer);
  versionTimer = setTimeout(() => void pushVersions(), PUSH_DEBOUNCE_MS);
}

async function pushVersions(): Promise<void> {
  versionTimer = null;
  const list = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.VERSION_HISTORY)) || [];
  const fallbackDoc = activeDocId();
  let failed = false;
  for (const s of list) {
    const id = s.id as string | undefined;
    const documentId = (s.documentId as string | undefined) || fallbackDoc;
    if (!id || !documentId || pushedVersionIds.has(id)) continue;
    try {
      await apiClient.post(
        `/sec-filings/documents/${encodeURIComponent(documentId)}/versions`,
        { snapshot: { ...s, documentId } },
        { skipGlobalLoading: true }
      );
      pushedVersionIds.add(id);
    } catch {
      failed = true;
    }
  }
  if (failed) versionTimer = setTimeout(() => void pushVersions(), RETRY_DELAYS_MS[1]);
}

let lastAttemptFailed = false;

/** 'saved' once nothing is pending and the last attempt succeeded; errors stay visible until then. */
function refreshIdleStatus() {
  const pending = dirtyDocs.size > 0 || docInFlight.size > 0 || docTimers.size > 0 || proposalTimer !== null;
  if (!pending && !lastAttemptFailed) setStatus('saved');
}

// ---------------------------------------------------------------------------- Storage-like API

export const docStore = {
  getItem(key: string): string | null {
    if (serverBacked && isManagedKey(key)) {
      return LEGACY_KEYS.has(key) ? null : memory.get(key) ?? null;
    }
    return localStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (!(serverBacked && isManagedKey(key))) {
      localStorage.setItem(key, value);
      return;
    }
    if (LEGACY_KEYS.has(key)) return;
    memory.set(key, value);
    if (key.startsWith(DOC_CONTENT_PREFIX)) {
      if (!guest) scheduleDocPush(key.slice(DOC_CONTENT_PREFIX.length), value);
    } else if (key === DOC_STORE_KEYS.MAIN_DOC) {
      const id = parse<{ id?: string }>(value)?.id;
      if (id) {
        memory.set(`${DOC_CONTENT_PREFIX}${id}`, value);
        if (!guest) scheduleDocPush(id, value);
      }
    } else if (key === DOC_STORE_KEYS.PROPOSALS) {
      scheduleProposalPush();
    } else if (key === DOC_STORE_KEYS.VERSION_HISTORY) {
      if (!guest) scheduleVersionPush();
    }
  },

  /** Removing never deletes on the server; documents are deleted explicitly. */
  removeItem(key: string): void {
    if (serverBacked && isManagedKey(key)) {
      memory.delete(key);
      return;
    }
    localStorage.removeItem(key);
  },

  get length(): number {
    return serverBacked ? memory.size : localStorage.length;
  },

  key(index: number): string | null {
    if (serverBacked) return Array.from(memory.keys())[index] ?? null;
    return localStorage.key(index);
  }
};

// ---------------------------------------------------------------------------- used by secFilingSync

export const docStoreInternals = {
  /** Switch the managed keys from localStorage to memory and load server data into it. */
  enableServerBacking(seed: {
    list: unknown[];
    documents: Array<{ document: Record<string, unknown>; revision: number }>;
    proposals: Array<Record<string, unknown>>;
    versions: Array<Record<string, unknown>>;
    previews: Map<string, unknown[]>;
    activeId: string | null;
  }) {
    serverBacked = true;
    memory.clear();
    revisions.clear();
    pushedProposals.clear();
    pushedVersionIds.clear();
    previews.clear();
    seed.previews.forEach((v, k) => previews.set(k, v));

    memory.set(DOC_STORE_KEYS.DOCUMENTS_LIST, JSON.stringify(seed.list));
    for (const { document, revision } of seed.documents) {
      const id = document.id as string;
      memory.set(`${DOC_CONTENT_PREFIX}${id}`, JSON.stringify(document));
      revisions.set(id, revision);
    }
    const active = seed.documents.find((d) => d.document.id === seed.activeId) || seed.documents[0];
    if (active) memory.set(DOC_STORE_KEYS.MAIN_DOC, JSON.stringify(active.document));

    memory.set(DOC_STORE_KEYS.PROPOSALS, JSON.stringify(seed.proposals));
    seed.proposals.forEach((p) => pushedProposals.set(p.id as string, JSON.stringify(p)));
    memory.set(DOC_STORE_KEYS.VERSION_HISTORY, JSON.stringify(seed.versions));
    seed.versions.forEach((v) => pushedVersionIds.add(v.id as string));
    setStatus('saved');
  },

  /** Load a guest session: its document (read-only) and the one proposal it may save. */
  enableGuestBacking(seed: { token: string; document: Record<string, unknown>; proposal: Record<string, unknown> }) {
    const id = seed.document.id as string;
    docStoreInternals.enableServerBacking({
      list: [{ id, title: seed.document.title, formType: seed.document.formType, period: seed.document.period }],
      documents: [{ document: seed.document, revision: 0 }],
      proposals: [seed.proposal],
      versions: [],
      previews: new Map(),
      activeId: id
    });
    guest = { token: seed.token, proposalId: seed.proposal.id as string };
  },

  /** Merge server versions of one document into memory (loaded when it is opened). */
  mergeVersions(documentId: string, versions: Array<Record<string, unknown>>) {
    const current = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.VERSION_HISTORY)) || [];
    const others = current.filter((v) => v.documentId !== documentId);
    versions.forEach((v) => pushedVersionIds.add(v.id as string));
    memory.set(DOC_STORE_KEYS.VERSION_HISTORY, JSON.stringify([...others, ...versions]));
  },

  /**
   * Replace one document's proposals with the server's, unless local changes are still
   * unsent. Returns whether anything changed.
   */
  mergeProposals(documentId: string, proposals: Array<Record<string, unknown>>): boolean {
    if (proposalTimer) return false;
    const before = memory.get(DOC_STORE_KEYS.PROPOSALS) || '[]';
    const current = parse<Array<Record<string, unknown>>>(before) || [];
    const mine = current.filter((p) => !p.documentId || p.documentId === documentId);
    const others = current.filter((p) => p.documentId && p.documentId !== documentId);
    const key = (list: Array<Record<string, unknown>>) =>
      JSON.stringify([...list].sort((a, b) => String(a.id).localeCompare(String(b.id))));
    if (key(mine) === key(proposals)) return false;
    proposals.forEach((p) => pushedProposals.set(p.id as string, JSON.stringify(p)));
    memory.set(DOC_STORE_KEYS.PROPOSALS, JSON.stringify([...proposals, ...others]));
    return true;
  },

  /** Add one proposal fetched by id (a contributor opening an invite link). */
  addProposal(proposal: Record<string, unknown>) {
    const current = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.PROPOSALS)) || [];
    const rest = current.filter((p) => p.id !== proposal.id);
    pushedProposals.set(proposal.id as string, JSON.stringify(proposal));
    memory.set(DOC_STORE_KEYS.PROPOSALS, JSON.stringify([proposal, ...rest]));
  },

  hasProposal(id: string): boolean {
    const current = parse<Array<Record<string, unknown>>>(memory.get(DOC_STORE_KEYS.PROPOSALS)) || [];
    return current.some((p) => p.id === id);
  },

  getRevision: (id: string) => revisions.get(id) ?? null,
  isServerBacked: () => serverBacked,
  hasPendingDoc: (id: string) => dirtyDocs.has(id) || docInFlight.has(id) || docTimers.has(id)
};

export function getDocumentPreviewBlocks(id: string): unknown[] | null {
  return previews.get(id) ?? null;
}

export function isDocStoreServerBacked(): boolean {
  return serverBacked;
}

/** True while changes are still on their way to the server. */
export function hasUnsyncedChanges(): boolean {
  return dirtyDocs.size > 0 || docInFlight.size > 0 || proposalTimer !== null || versionTimer !== null;
}

/** Send everything pending now (e.g. before a contributor tab opens the same proposal). */
export async function flushRemote(): Promise<void> {
  for (const [id, t] of docTimers) {
    clearTimeout(t);
    docTimers.delete(id);
  }
  const docs = Array.from(dirtyDocs.keys());
  if (proposalTimer) clearTimeout(proposalTimer);
  if (versionTimer) clearTimeout(versionTimer);
  await Promise.all([...docs.map((id) => pushDoc(id)), pushProposals(), pushVersions()]);
}

export async function deleteRemoteDocument(id: string): Promise<void> {
  if (guest) throw new Error('Guest contributors cannot delete documents');
  const t = docTimers.get(id);
  if (t) clearTimeout(t);
  docTimers.delete(id);
  dirtyDocs.delete(id);
  await apiClient.delete(`/sec-filings/documents/${encodeURIComponent(id)}`, { skipGlobalLoading: true });
}

export function onSyncStatus(listener: (s: SyncStatus, error: string | null) => void): () => void {
  statusListeners.add(listener);
  listener(status, lastError);
  return () => statusListeners.delete(listener);
}

/** Lets the storage layer drop its in-memory pending copy when the server copy replaces it. */
export function setDocReplacedHandler(handler: (id: string) => void) {
  docReplacedHandler = handler;
}

// The unload warning lives in secFilingStorage, which first flushes its own debounced copy.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (serverBacked) void flushRemote();
  });
}
