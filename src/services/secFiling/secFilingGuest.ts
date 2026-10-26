/**
 * Server calls for a guest contributor session (see services/guestInvite.ts). The
 * server scopes the invite token to one proposal: it can read that proposal and the
 * document it branches from, and save/submit the proposal while it is a draft. Every
 * other SEC call is skipped in guest mode by the store, sync and spreadsheet layers.
 *
 * Plain fetch instead of apiClient: no session token or cookie is sent, and a failure
 * must not trigger the expired-session redirect to the login page.
 */
import { BASE_URL } from '../apiClient';
import { ApiError } from '../helper';

export interface GuestSession {
  documentId: string;
  document: Record<string, unknown>;
  proposal: Record<string, unknown>;
  spreadsheet: Record<string, unknown> | null;
  expiresAt: string;
}

let session: GuestSession | null = null;

async function guestRequest<T>(token: string, method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/sec-filings/guest${path}`, {
    method,
    credentials: 'omit',
    headers: {
      'X-Invite-Token': token,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: unknown }).detail;
    throw new ApiError(typeof detail === 'string' ? detail : 'Request failed', res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function fetchGuestSession(token: string): Promise<GuestSession> {
  session = await guestRequest<GuestSession>(token, 'GET', '/session');
  return session;
}

/** The document's linked workbook as the guest session loaded it (read-only). */
export function getGuestSpreadsheetRecord(): Record<string, unknown> | null {
  return session?.spreadsheet ?? null;
}

export function getGuestProposalId(): string | null {
  return (session?.proposal.id as string | undefined) ?? null;
}

export async function saveGuestProposal(token: string, proposal: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await guestRequest<{ proposal: Record<string, unknown> }>(token, 'PUT', '/proposal', { proposal });
  return res.proposal;
}
