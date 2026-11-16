import { useRef } from 'react';
import { useNotificationStream } from './useNotifications';
import { activeDocumentType } from './useFinancialTableTemplates';
import { DOCUMENT_TYPE_CONFIG } from '../types/documentType';
import { refreshActiveDocument } from '../services/secFiling/secFilingSync';
import { getActiveDocumentId } from '../services/secFiling/secFilingCore';

const RETRY_MS = 1500;
const MAX_RETRIES = 6;

/**
 * Keeps the open document up to date: when the server announces a change to it (a save, a proposal, a merge, a check-in or a
 * decision by someone else, over the portal's notification socket), it is read again and the editor shows it. What a kind of
 * document does about it is set in DOCUMENT_TYPE_CONFIG. While this person has changes of their own still being saved the
 * refresh waits and tries again, so nothing they typed is overwritten.
 */
export function useDocumentLiveSync() {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = (attempt = 0) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(async () => {
      const applied = await refreshActiveDocument('server-event');
      if (!applied && attempt < MAX_RETRIES) refresh(attempt + 1);
    }, attempt === 0 ? 300 : RETRY_MS);
  };

  useNotificationStream({
    onNotification: (n) => {
      if (n.type !== 'WORKFLOW_SYNC' || n.entity_id !== getActiveDocumentId()) return;
      if (DOCUMENT_TYPE_CONFIG[activeDocumentType()].liveSync) refresh();
    },
  });
}
