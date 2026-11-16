import { lazy, useCallback, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ProtectedRoute from '../../../components/common/ProtectedRoute';
import SecFilingDataGate from '../../../components/SecFilings/SecFilingDataGate';
import { useScriptReview } from '../../../hooks/useScriptReview';
import { useHeartbeat } from '../../../hooks/useHeartbeat';
import { isEditorOnly } from '../../../lib/embedBridge';
import { DOCUMENT_TYPE_CONFIG } from '../../../types/documentType';
import { queryKeys } from '../../../services/queryKeys';
import { getDocumentsList, openDocument } from '../../../services/secFiling/secFilingCore';
import './embedEditor.css';
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
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.secScriptReview(documentId) });
  }, [queryClient, documentId]);
  useEmbedBridge(documentId, review.state, review.history, refresh);
  useHeartbeat(true); // the person is active in the portal that hosts this, so their session here stays alive too

  return (
    <div className="flex h-screen flex-col bg-background" data-editor-only={isEditorOnly() ? '' : undefined}>
      {review.state && DOCUMENT_TYPE_CONFIG.script.reviewControls && !isEditorOnly() && <ScriptReviewBar state={review.state} review={review} />}
      <div className="min-h-0 flex-1 overflow-auto">
        <SecFilingsEditor />
      </div>
    </div>
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
