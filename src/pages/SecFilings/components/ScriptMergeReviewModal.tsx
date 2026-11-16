import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui/dialog';
import type { SecBlockDiff, SecChangeProposal } from '../../../types/secFiling';
import { ScriptChangeCard } from './ScriptChangeCard';
import { ScriptMergeFooter, ScriptMergeHeader, ScriptMergeToolbar } from './ScriptMergeParts';

interface ScriptMergeReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: SecChangeProposal | null;
  diffs: SecBlockDiff[];
  isLeadController: boolean;
  onMerge: (proposalId: string, notes?: string) => void;
  onMergeSelective?: (proposalId: string, acceptedBlockIds: string[], notes?: string) => void;
  onReject: (proposalId: string, notes: string) => void;
}

/**
 * The merge review for a script: what the contributor changed, line by line (title, storyline, hook line, the script
 * table's beats), each to take or leave. The SEC filing's review (MergeReviewModal) stays for filings; this one has no
 * pages, sections, spreadsheets or filing wording, and gives the changes the whole screen.
 */
export const ScriptMergeReviewModal: React.FC<ScriptMergeReviewModalProps> = ({
  open, onOpenChange, proposal, diffs, isLeadController, onMerge, onMergeSelective, onReject,
}) => {
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState<string[]>([]);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [active, setActive] = useState(0);

  const changed = useMemo(() => diffs.filter((d) => d.status !== 'unchanged'), [diffs]);
  const shown = showUnchanged ? diffs : changed;

  // Every change starts taken; the reviewer unticks the ones to leave.
  useEffect(() => {
    if (open) setAccepted(changed.map((d) => d.blockId));
  }, [open, changed]);

  if (!proposal) return null;

  const toggle = (id: string) => setAccepted((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const close = () => onOpenChange(false);

  const merge = (ids: string[]) => {
    if (onMergeSelective) onMergeSelective(proposal.id, ids, notes);
    else onMerge(proposal.id, notes);
    close();
  };
  const reject = () => {
    onReject(proposal.id, notes.trim() || 'Declined by the Lead Controller during review.');
    close();
  };
  const jump = (delta: number) => {
    if (!changed.length) return;
    const next = (active + delta + changed.length) % changed.length;
    setActive(next);
    document.getElementById(`script-diff-${changed[next].blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex !h-[96vh] !w-[98vw] !max-w-[98vw] flex-col gap-0 overflow-hidden border border-slate-300 bg-slate-100 p-0 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:!max-w-[98vw]"
      >
        <DialogTitle className="sr-only">Script review</DialogTitle>
        <ScriptMergeHeader proposal={proposal} onClose={close} />
        <ScriptMergeToolbar
          selected={accepted.length}
          total={changed.length}
          position={active}
          showUnchanged={showUnchanged}
          onSelectAll={() => setAccepted(changed.map((d) => d.blockId))}
          onDeselectAll={() => setAccepted([])}
          onJump={jump}
          onToggleUnchanged={() => setShowUnchanged((v) => !v)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto max-w-5xl space-y-3">
            {changed.length === 0 && <p className="py-12 text-center text-sm text-slate-500">This version has no changes to the script.</p>}
            {shown.map((d) => (
              <ScriptChangeCard
                key={d.blockId}
                diff={d}
                author={proposal.author.name}
                checked={accepted.includes(d.blockId)}
                active={changed[active]?.blockId === d.blockId}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
        <ScriptMergeFooter
          isLeadController={isLeadController}
          canMerge={isLeadController && proposal.status !== 'merged'}
          selected={accepted.length}
          total={changed.length}
          notes={notes}
          onNotes={setNotes}
          onCancel={close}
          onReject={reject}
          onMerge={() => merge(accepted)}
          onMergeAll={() => merge(changed.map((d) => d.blockId))}
        />
      </DialogContent>
    </Dialog>
  );
};
