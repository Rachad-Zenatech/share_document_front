import { History, RotateCcw, Clock, User, CheckCircle2 } from 'lucide-react';
import type { SecVersionSnapshot } from '../../../types/secFiling';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: SecVersionSnapshot[];
  currentVersion: string;
  onRestore: (snapshotId: string) => void;
  isLeadController: boolean;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  open,
  onOpenChange,
  history,
  currentVersion,
  onRestore,
  isLeadController
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl sm:max-w-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
              SEC Filing Version History & Revisions
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 py-2">
          {history
            .slice()
            .reverse()
            .map((snap) => {
              const isCurrent = snap.version === currentVersion;

              return (
                <div
                  key={snap.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-500/30'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isCurrent ? 'default' : 'outline'}
                        className="font-mono text-xs uppercase"
                      >
                        {snap.version}
                      </Badge>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Main Version</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(snap.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-zinc-300 mt-2 font-medium">
                    {snap.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Author: {snap.author}</span>
                      <span>•</span>
                      <span>{snap.blocks.length} Blocks</span>
                    </div>

                    {!isCurrent && isLeadController && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(`Restore document state from ${snap.version}? This will create a new version snapshot.`)
                          ) {
                            onRestore(snap.id);
                            onOpenChange(false);
                          }
                        }}
                        className="h-6 text-[11px] text-slate-600 hover:text-blue-600 gap-1 px-2"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore This Version</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
