import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkInScript,
  createPostFromScript,
  decideScript,
  finalizeScript,
  getScriptHistory,
  getScriptReview,
  sendScriptForReview,
  setScriptInvitees,
  withdrawScriptCheckIn,
} from '../services/scriptReviewService';
import { queryKeys } from '../services/queryKeys';
import { useNotificationStream } from './useNotifications';
import type { ScriptInvitee, ScriptReviewState, ScriptVote } from '../types/scriptReview';

/**
 * A script document's review: its state, what the signed-in person may do (`state.access`), and the moves.
 * Refreshes when the server says the document changed (the portal's notification socket), so everyone reviewing the
 * same script sees check-ins, routing and decisions as they happen.
 */
export function useScriptReview(documentId: string | undefined) {
  const queryClient = useQueryClient();
  const key = queryKeys.secScriptReview(documentId || '');

  const query = useQuery<ScriptReviewState>({
    queryKey: key,
    queryFn: () => getScriptReview(documentId as string),
    enabled: !!documentId,
    retry: false,
  });

  useNotificationStream({
    onNotification: (n) => {
      if (n.type === 'WORKFLOW_SYNC' && n.entity_id === documentId) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const history = useQuery({
    queryKey: queryKeys.secScriptHistory(documentId || ''),
    queryFn: () => getScriptHistory(documentId as string),
    enabled: !!documentId && query.isSuccess,
  });

  const onDone = useCallback(
    (state: ScriptReviewState) => {
      queryClient.setQueryData(key, state);
      queryClient.invalidateQueries({ queryKey: queryKeys.secScriptHistory(documentId || '') });
    },
    [queryClient, key, documentId],
  );
  const id = documentId as string;

  const invite = useMutation({ mutationFn: (invitees: ScriptInvitee[]) => setScriptInvitees(id, invitees), onSuccess: onDone });
  const send = useMutation({
    mutationFn: (v: { invitees: ScriptInvitee[]; pageIds?: string[]; note?: string }) =>
      sendScriptForReview(id, v.invitees, v.pageIds, v.note),
    onSuccess: onDone,
  });
  const checkIn = useMutation({ mutationFn: (v: { vote: ScriptVote; note?: string }) => checkInScript(id, v.vote, v.note), onSuccess: onDone });
  const withdraw = useMutation({ mutationFn: () => withdrawScriptCheckIn(id), onSuccess: onDone });
  const finalize = useMutation({
    mutationFn: (v: { route?: 'LEVEL2' | 'CREATOR'; note?: string }) => finalizeScript(id, v.route, v.note),
    onSuccess: onDone,
  });
  const decide = useMutation({
    mutationFn: (v: { decision: 'APPROVE' | 'SEND_BACK'; note?: string }) => decideScript(id, v.decision, v.note),
    onSuccess: onDone,
  });
  const createPost = useMutation({ mutationFn: (note?: string) => createPostFromScript(id, note), onSuccess: onDone });

  return { query, state: query.data, history: history.data?.events ?? [], invite, send, checkIn, withdraw, finalize, decide, createPost };
}
