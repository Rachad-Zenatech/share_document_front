import type {
  ScriptHistoryEvent,
  ScriptInvitee,
  ScriptReviewState,
  ScriptVote,
} from '../types/scriptReview';
import { apiClient } from './apiClient';

const base = (documentId: string) => `/sec-filings/documents/${encodeURIComponent(documentId)}/script-review`;

export const getScriptReview = (documentId: string) => apiClient.get<ScriptReviewState>(base(documentId));

export const getScriptHistory = (documentId: string) =>
  apiClient.get<{ events: ScriptHistoryEvent[] }>(`${base(documentId)}/history`);

export const setScriptInvitees = (documentId: string, invitees: ScriptInvitee[]) =>
  apiClient.put<ScriptReviewState>(`${base(documentId)}/invitees`, { invitees });

export const sendScriptForReview = (documentId: string, invitees: ScriptInvitee[], pageIds: string[] = [], note?: string) =>
  apiClient.post<ScriptReviewState>(`${base(documentId)}/send`, { invitees, page_ids: pageIds, note });

export const checkInScript = (documentId: string, vote: ScriptVote, note?: string) =>
  apiClient.put<ScriptReviewState>(`${base(documentId)}/check-in`, { vote, note });

export const withdrawScriptCheckIn = (documentId: string) => apiClient.delete<ScriptReviewState>(`${base(documentId)}/check-in`);

export const finalizeScript = (documentId: string, route?: 'LEVEL2' | 'CREATOR', note?: string) =>
  apiClient.post<ScriptReviewState>(`${base(documentId)}/finalize`, { route, note });

export const decideScript = (documentId: string, decision: 'APPROVE' | 'SEND_BACK', note?: string) =>
  apiClient.post<ScriptReviewState>(`${base(documentId)}/decision`, { decision, note });

export const createPostFromScript = (documentId: string, note?: string) =>
  apiClient.post<ScriptReviewState>(`${base(documentId)}/create-post`, { note });
