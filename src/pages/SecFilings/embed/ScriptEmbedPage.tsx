import { lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ProtectedRoute from '../../../components/common/ProtectedRoute';
import SecFilingDataGate from '../../../components/SecFilings/SecFilingDataGate';
import { useScriptReview } from '../../../hooks/useScriptReview';
import { useHeartbeat } from '../../../hooks/useHeartbeat';
import { isEditorOnly, isReadOnlyEmbed, postToParent } from '../../../lib/embedBridge';
import { DOCUMENT_TYPE_CONFIG } from '../../../types/documentType';
import { queryKeys } from '../../../services/queryKeys';
import { getDocumentsList, openDocument } from '../../../services/secFiling/secFilingCore';
import type { EmbedNote } from '../../../types/scriptReview';
import './embedEditor.css';
import { EmbedNotesContext } from './EmbedNotesContext';
import { applyEmbedHighlights, readDomSelection, scrollToEmbedNote } from './embedNotes';
import ScriptReviewBar from './ScriptReviewBar';
import { useEmbedBridge } from './useEmbedBridge';

// The full document editor (blocks, proposals, comments and the merge review), shown without the portal's app shell.
const SecFilingsEditor = lazy(() => import('../SecFilingsPage'));

/**
 * Opens the document (its content, not just its id: the editor shows the "main document", which would otherwise be whichever
 * one this browser had open last) once its data has loaded; says so when this person has no such document.
 */
function ActiveDocument({ documentId, children }: { documentId: string; children: ReactNode }) {
  const found = useMemo(() => {
    if (!getDocumentsList().some((d) => d.id === documentId)) return false;
    openDocument(documentId);
    return true;
  }, [documentId]);
  if (!found) {
    return <div className="flex h-screen items-center justify-center p-6 text-sm text-muted-foreground">This script isn't available to you, or it was deleted.</div>;
  }
  return <>{children}</>;
}

function EmbedFrame({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const review = useScriptReview(documentId);
  const [readOnly, setReadOnly] = useState(() => isReadOnlyEmbed());
  const bodyRef = useRef<HTMLDivElement>(null);
  const [notesState, setNotesState] = useState<{ notes: EmbedNote[]; activeNoteId: string | null }>({ notes: [], activeNoteId: null });
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.secScriptReview(documentId) });
  }, [queryClient, documentId]);
  const onNotes = useCallback((notes: EmbedNote[], activeNoteId: string | null) => {
    setNotesState({ notes, activeNoteId });
  }, []);
  const onGoToNote = useCallback((id: string) => {
    if (bodyRef.current) scrollToEmbedNote(bodyRef.current, id);
  }, []);
  const onReadOnly = useCallback((next: boolean) => {
    setReadOnly(next);
  }, []);
  useEmbedBridge(documentId, review.state, review.history, refresh, onNotes, onGoToNote, onReadOnly);
  useHeartbeat(true); // the person is active in the portal that hosts this, so their session here stays alive too

  useEffect(() => {
    if (!bodyRef.current) return;
    const root = bodyRef.current;
    const blockEdit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const blockKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (['c', 'a', 'f'].includes(e.key.toLowerCase())) return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const reportSelection = () => {
      const sel = readDomSelection(root);
      if (sel) postToParent({ type: 'script-embed:selection', documentId, ...sel });
    };
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement | null)?.closest?.('[data-embed-note]') as HTMLElement | null;
      if (mark?.dataset.embedNote) postToParent({ type: 'script-embed:select-note', documentId, id: mark.dataset.embedNote });
    };
    if (readOnly) {
      root.addEventListener('beforeinput', blockEdit, true);
      root.addEventListener('paste', blockEdit, true);
      root.addEventListener('drop', blockEdit, true);
      root.addEventListener('keydown', blockKey, true);
    }
    root.addEventListener('mouseup', reportSelection);
    root.addEventListener('keyup', reportSelection);
    root.addEventListener('select', reportSelection, true);
    root.addEventListener('click', onClick);
    return () => {
      if (readOnly) {
        root.removeEventListener('beforeinput', blockEdit, true);
        root.removeEventListener('paste', blockEdit, true);
        root.removeEventListener('drop', blockEdit, true);
        root.removeEventListener('keydown', blockKey, true);
      }
      root.removeEventListener('mouseup', reportSelection);
      root.removeEventListener('keyup', reportSelection);
      root.removeEventListener('select', reportSelection, true);
      root.removeEventListener('click', onClick);
    };
  }, [readOnly, documentId]);

  useEffect(() => {
    if (!bodyRef.current) return;
    const root = bodyRef.current;
    let applying = false;
    let timer = 0;
    const run = () => {
      if (applying) return;
      applying = true;
      try {
        applyEmbedHighlights(root, notesState.notes, notesState.activeNoteId);
      } finally {
        applying = false;
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 120);
    };
    schedule();
    const observer = new MutationObserver(() => {
      if (!applying && notesState.notes.length) schedule();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [notesState]);

  const notesCtx = useMemo(
    () => ({ readOnly, notes: notesState.notes, activeNoteId: notesState.activeNoteId }),
    [readOnly, notesState],
  );

  return (
    <EmbedNotesContext.Provider value={notesCtx}>
      <div
        className="flex h-screen flex-col bg-background"
        data-editor-only={isEditorOnly() ? '' : undefined}
        data-readonly-embed={readOnly ? '' : undefined}
      >
        {review.state && DOCUMENT_TYPE_CONFIG.script.reviewControls && !isEditorOnly() && <ScriptReviewBar state={review.state} review={review} />}
        <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-auto">
          <SecFilingsEditor />
        </div>
      </div>
    </EmbedNotesContext.Provider>
  );
}

/**
 * /embed/script/:documentId - a Social Media Script document without the app shell, for the Social Media portal to open in
 * a dialog. The review bar offers what this person may do (script_review_rules on the server decides); the editor
 * and the merge review are the same ones the rest of the portal uses.
 */
export default function ScriptEmbedPage() {
  const { documentId } = useParams<{ documentId: string }>();
  if (!documentId) return null;
  return (
    <ProtectedRoute>
      <SecFilingDataGate>
        <ActiveDocument documentId={documentId}>
          <EmbedFrame documentId={documentId} />
        </ActiveDocument>
      </SecFilingDataGate>
    </ProtectedRoute>
  );
}
