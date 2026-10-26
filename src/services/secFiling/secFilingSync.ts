/**
 * Loads filing documents, proposals and version history from the server into the
 * in-memory docStore (secFilingStore.ts) before the SEC pages render, and keeps that
 * copy fresh. Also runs the one-time upload of what this browser had in localStorage
 * from before documents moved to the server.
 */
import { apiClient } from '../apiClient';
import { ApiError } from '../helper';
import { INITIAL_PROPOSALS, INITIAL_VERSION_HISTORY } from '../../data/initialSecFilingData';
import {
  DOC_CONTENT_PREFIX,
  DOC_STORE_KEYS,
  docStoreInternals,
  hasUnsyncedChanges,
  replaceDocument
} from './secFilingStore';
import { setCachedDocumentsList, setPendingMainDoc, setPendingProposals } from './secFilingStorage';
import { getDocumentContent } from './secFilingCore';
import { fetchGuestSession } from './secFilingGuest';
import { isGuestSession } from '../guestInvite';

type ServerSummary = Record<string, unknown> & {
  id: string;
  revision: number;
  previewBlocks?: unknown[];
};
type ServerDoc = { document: Record<string, unknown>; revision: number };

const MIGRATION_FLAG = 'sec_filing_server_migration_v1';
const DEMO_PROPOSAL_IDS = new Set((INITIAL_PROPOSALS as Array<{ id: string }>).map((p) => p.id));
const DEMO_VERSION_IDS = new Set((INITIAL_VERSION_HISTORY as Array<{ id: string }>).map((v) => v.id));

const enc = encodeURIComponent;
const quiet = { skipGlobalLoading: true } as const;

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function notifyUpdated(reason: string) {
  window.dispatchEvent(new CustomEvent('sec-filing-remote-updated', { detail: { reason } }));
}

// ---------------------------------------------------------------------------- one-time upload

/**
 * Upload this browser's localStorage documents/proposals/history once. Ids that already
 * exist on the server are skipped there, so an older copy never overwrites a newer one.
 * The local copies are left in place as a backup.
 */
async function migrateBrowserData(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const byId = new Map<string, Record<string, unknown>>();
  const keep = (doc: Record<string, unknown> | null) => {
    if (!doc || typeof doc.id !== 'string' || !Array.isArray(doc.blocks)) return;
    const prev = byId.get(doc.id);
    if (!prev || String(doc.updatedAt || '') > String(prev.updatedAt || '')) byId.set(doc.id, doc);
  };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DOC_CONTENT_PREFIX)) keep(readLocal(key));
  }
  const legacyMain = readLocal<Record<string, unknown>>(DOC_STORE_KEYS.MAIN_DOC);
  keep(legacyMain);

  // Documents listed in the hub but never opened only existed as generated defaults;
  // materialize them so they are not lost from the list.
  const list = readLocal<Array<Record<string, unknown>>>(DOC_STORE_KEYS.DOCUMENTS_LIST) || [];
  for (const summary of list) {
    const id = summary.id as string;
    if (id && !byId.has(id)) {
      try {
        keep(getDocumentContent(id) as unknown as Record<string, unknown>);
      } catch {
        // skip
      }
    }
    const doc = byId.get(id);
    if (doc) {
      doc.templateType = doc.templateType || summary.templateType;
      if (Array.isArray(summary.invitedEmails)) {
        doc.invitedEmails = Array.from(new Set([...(doc.invitedEmails as string[] || []), ...(summary.invitedEmails as string[])]));
      }
    }
  }

  const fallbackDocId =
    localStorage.getItem(DOC_STORE_KEYS.ACTIVE_DOC_ID) || (legacyMain?.id as string | undefined) || null;
  const proposals = (readLocal<Array<Record<string, unknown>>>(DOC_STORE_KEYS.PROPOSALS) || [])
    .filter((p) => p?.id && !DEMO_PROPOSAL_IDS.has(p.id as string))
    .map((p) => ({ ...p, documentId: p.documentId || fallbackDocId }));
  const versions = (readLocal<Array<Record<string, unknown>>>(DOC_STORE_KEYS.VERSION_HISTORY) || [])
    .filter((v) => v?.id && !DEMO_VERSION_IDS.has(v.id as string))
    .map((v) => ({ ...v, documentId: v.documentId || fallbackDocId }));

  const documents = Array.from(byId.values()).map((d) => {
    const copy = { ...d };
    delete copy.attachedSpreadsheet;
    return copy;
  });

  if (documents.length > 0 || proposals.length > 0) {
    const result = await apiClient.post<{
      documentsImported: string[];
      documentsSkipped: string[];
      proposalsImported: number;
      versionsImported: number;
    }>('/sec-filings/documents/import', { documents, proposals, versions }, quiet);
    console.info('[sec-filing] uploaded browser documents to the server', result);
  }
  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
}

// ---------------------------------------------------------------------------- hydration

async function fetchProposalWithRetry(proposalId: string): Promise<{ documentId: string; proposal: Record<string, unknown> } | null> {
  // An invite link can be opened a moment before the lead's browser has sent it.
  for (const delay of [0, 1500, 3000, 5000]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      return await apiClient.get(`/sec-filings/proposals/${enc(proposalId)}`, quiet);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  return null;
}

async function doHydrate(proposalId?: string): Promise<void> {
  await migrateBrowserData();

  const { documents: summaries } = await apiClient.get<{ documents: ServerSummary[] }>('/sec-filings/documents', quiet);

  let requested: { documentId: string; proposal: Record<string, unknown> } | null = null;
  if (proposalId) requested = await fetchProposalWithRetry(proposalId);

  const ids = summaries.map((s) => s.id);
  const [docs, proposalLists] = await Promise.all([
    Promise.all(ids.map((id) => apiClient.get<ServerDoc>(`/sec-filings/documents/${enc(id)}`, quiet))),
    Promise.all(
      ids.map((id) =>
        apiClient
          .get<{ proposals: Array<Record<string, unknown>> }>(`/sec-filings/documents/${enc(id)}/proposals`, quiet)
          .then((r) => r.proposals)
      )
    )
  ]);

  const storedActive = localStorage.getItem(DOC_STORE_KEYS.ACTIVE_DOC_ID);
  const activeId =
    requested?.documentId ||
    (storedActive && ids.includes(storedActive) ? storedActive : null) ||
    ids[0] ||
    null;

  const versions = activeId
    ? (await apiClient.get<{ versions: Array<Record<string, unknown>> }>(
        `/sec-filings/documents/${enc(activeId)}/versions`,
        quiet
      )).versions
    : [];

  const previews = new Map<string, unknown[]>();
  const list = summaries.map(({ previewBlocks, revision: _revision, ...summary }) => {
    previews.set(summary.id as string, previewBlocks || []);
    return summary;
  });

  const proposals = proposalLists.flat();
  if (requested && !proposals.some((p) => p.id === requested!.proposal.id)) {
    proposals.unshift(requested.proposal);
  }

  docStoreInternals.enableServerBacking({
    list,
    documents: docs.map((d) => ({ document: d.document, revision: d.revision })),
    proposals,
    versions,
    previews,
    activeId
  });
  // Drop anything the storage layer cached from before the server data arrived.
  setCachedDocumentsList(null);
  setPendingMainDoc(null);
  setPendingProposals(null);
  if (activeId) localStorage.setItem(DOC_STORE_KEYS.ACTIVE_DOC_ID, activeId);
}

/**
 * A guest contributor loads only their proposal and its document. Nothing from this
 * browser's localStorage is uploaded, and no other SEC endpoint is called.
 */
async function doGuestHydrate(token: string): Promise<void> {
  // A freshly copied link can be opened before the lead's browser has registered it.
  let session: Awaited<ReturnType<typeof fetchGuestSession>> | null = null;
  for (const delay of [0, 1500, 3000]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      session = await fetchGuestSession(token);
      break;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404) || delay === 3000) throw err;
    }
  }
  if (!session) return;
  docStoreInternals.enableGuestBacking({ token, document: session.document, proposal: session.proposal });
  setCachedDocumentsList(null);
  setPendingMainDoc(null);
  setPendingProposals(null);
  localStorage.setItem(DOC_STORE_KEYS.ACTIVE_DOC_ID, session.documentId);
}

let hydration: Promise<void> | null = null;

/**
 * Load everything once per page load. `proposalId` (from a contributor invite link)
 * makes that proposal's document the open one; `guestToken` loads a guest session instead.
 */
export function hydrateSecFilingData(options: { proposalId?: string; guestToken?: string } = {}): Promise<void> {
  if (hydration) {
    return options.proposalId && !options.guestToken
      ? hydration.then(() => ensureProposalLoaded(options.proposalId!))
      : hydration;
  }
  const load = options.guestToken ? doGuestHydrate(options.guestToken) : doHydrate(options.proposalId);
  hydration = load.catch((err) => {
    hydration = null;
    throw err;
  });
  return hydration;
}

export function isSecFilingDataHydrated(): boolean {
  return docStoreInternals.isServerBacked();
}

async function ensureProposalLoaded(proposalId: string): Promise<void> {
  if (docStoreInternals.hasProposal(proposalId)) return;
  const res = await fetchProposalWithRetry(proposalId);
  if (!res) return;
  docStoreInternals.addProposal(res.proposal);
  localStorage.setItem(DOC_STORE_KEYS.ACTIVE_DOC_ID, res.documentId);
  setPendingProposals(null);
}

// ---------------------------------------------------------------------------- staying fresh

async function loadVersions(documentId: string) {
  if (isGuestSession()) return;
  try {
    const { versions } = await apiClient.get<{ versions: Array<Record<string, unknown>> }>(
      `/sec-filings/documents/${enc(documentId)}/versions`,
      quiet
    );
    docStoreInternals.mergeVersions(documentId, versions);
    notifyUpdated('versions');
  } catch (err) {
    console.warn('[sec-filing] could not load version history', err);
  }
}

/** Pick up what other people saved to the open document (and its proposals). */
async function refreshActiveDocument(reason: string) {
  const id = localStorage.getItem(DOC_STORE_KEYS.ACTIVE_DOC_ID);
  if (!id || !docStoreInternals.isServerBacked() || hasUnsyncedChanges() || isGuestSession()) return;
  try {
    const [doc, { proposals }] = await Promise.all([
      apiClient.get<ServerDoc>(`/sec-filings/documents/${enc(id)}`, quiet),
      apiClient.get<{ proposals: Array<Record<string, unknown>> }>(`/sec-filings/documents/${enc(id)}/proposals`, quiet)
    ]);
    let changed = false;
    // Re-check: an edit may have started while the requests were in flight.
    if (!docStoreInternals.hasPendingDoc(id) && doc.revision !== docStoreInternals.getRevision(id)) {
      replaceDocument(id, doc.document, doc.revision);
      changed = true;
    }
    if (docStoreInternals.mergeProposals(id, proposals)) {
      setPendingProposals(null);
      changed = true;
    }
    if (changed) notifyUpdated(reason);
  } catch (err) {
    console.warn('[sec-filing] could not refresh document', err);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('sec-filing-document-opened', (e) => {
    const id = (e as CustomEvent<{ documentId: string }>).detail?.documentId;
    if (id) void loadVersions(id);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshActiveDocument('focus');
  });

  // Another tab of this browser saved something: it reaches the server shortly after
  // (saves are debounced), so fetch then rather than reading this tab's memory.
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('sec_filing_sync_channel');
      bc.onmessage = () => {
        setTimeout(() => void refreshActiveDocument('other-tab'), 1500);
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }
}
