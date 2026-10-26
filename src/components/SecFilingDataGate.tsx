import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CloudOff, Loader2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { hydrateSecFilingData, isSecFilingDataHydrated } from '../services/secFiling/secFilingSync';

/**
 * Renders the SEC filing pages only after their documents, proposals and history have
 * been loaded from the server (they are read synchronously from memory after that).
 * A contributor invite link's `proposalId` makes that proposal's document the open one.
 */
export default function SecFilingDataGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const proposalId = new URLSearchParams(location.search).get('proposalId') || undefined;
  const [ready, setReady] = useState(() => isSecFilingDataHydrated() && !proposalId);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    hydrateSecFilingData({ proposalId })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[sec-filing] could not load documents from the server', err);
        setError(
          err?.status === 401
            ? 'Your session has expired. Sign in again to open your documents.'
            : err?.message || 'The server could not be reached.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [proposalId, attempt]);

  if (ready) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      {error ? (
        <div className="max-w-md space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <CloudOff className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-foreground">Could not load your documents</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Documents are stored on the server so everyone sees the same copy; nothing is lost while this is retried.
          </p>
          <Button type="button" size="sm" onClick={() => setAttempt((a) => a + 1)} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading documents...
        </div>
      )}
    </div>
  );
}
