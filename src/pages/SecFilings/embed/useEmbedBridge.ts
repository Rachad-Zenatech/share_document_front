import { useEffect, useRef } from 'react';
import { focusScriptPassage, clearScriptFocus } from '../../../lib/scriptFocus';
import { listenToParent, postToParent } from '../../../lib/embedBridge';
import type { EmbedNote, ScriptHistoryEvent, ScriptReviewState } from '../../../types/scriptReview';

/**
 * Tells the Social Media portal page that hosts this embed what is happening (ready, status changes, a merge, a post
 * request) and obeys its close / refresh requests. Everything goes through lib/embedBridge, which only talks to an
 * allow-listed parent origin; outside an iframe none of it does anything.
 */
export function useEmbedBridge(
  documentId: string,
  state: ScriptReviewState | undefined,
  history: ScriptHistoryEvent[],
  onRefresh: () => void,
  onNotes?: (notes: EmbedNote[], activeNoteId: string | null) => void,
  onGoToNote?: (id: string) => void,
  onReadOnly?: (readOnly: boolean) => void,
) {
  const seenMerges = useRef<number | null>(null);
  const authRequired = useRef(false);

  useEffect(() => {
    const onAuthRequired = () => {
      authRequired.current = true;
    };
    window.addEventListener('script-embed:auth-required', onAuthRequired);
    postToParent({ type: 'script-embed:ready', documentId });
    const unlisten = listenToParent((message) => {
      if (message.type === 'script-embed:refresh') onRefresh();
      if (message.type === 'script-embed:focus-passage') {
        const found = focusScriptPassage(message.terms);
        postToParent({ type: 'script-embed:focus-result', requestId: message.requestId, found });
      }
      if (message.type === 'script-embed:token') {
        sessionStorage.setItem('token', message.token);
        if (authRequired.current) {
          authRequired.current = false;
          onRefresh();
        }
      }
      if (message.type === 'script-embed:close-request') postToParent({ type: 'script-embed:close', documentId });
      if (message.type === 'script-embed:notes') onNotes?.(message.notes, message.activeNoteId);
      if (message.type === 'script-embed:go-to-note') onGoToNote?.(message.id);
      if (message.type === 'script-embed:set-readonly') onReadOnly?.(message.readOnly);
    });
    return () => {
      window.removeEventListener('script-embed:auth-required', onAuthRequired);
      unlisten();
      clearScriptFocus();
    };
  }, [documentId, onRefresh, onNotes, onGoToNote, onReadOnly]);

  useEffect(() => {
    if (!state) return;
    postToParent({ type: 'script-embed:status', documentId, status: state.status, round: state.round, access: state.access });
  }, [documentId, state?.status, state?.round, state?.access.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const merges = history.filter((e) => e.kind === 'MERGED').length;
  useEffect(() => {
    // The first look at the history only sets the baseline: older merges aren't news.
    if (seenMerges.current !== null && merges > seenMerges.current) postToParent({ type: 'script-embed:merge-completed', documentId });
    seenMerges.current = merges;
  }, [documentId, merges]);

  const postRequested = !!state?.post_requested;
  useEffect(() => {
    if (postRequested) postToParent({ type: 'script-embed:post-requested', documentId });
  }, [documentId, postRequested]);
}
