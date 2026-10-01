import React, { useEffect, useState } from 'react';
import {
  Send,
  CheckCircle2,
  MessageSquare,
  Table
} from 'lucide-react';
import type { SecChangeProposal, SecBlockDiff } from '../../../types/secFiling';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';

const DEFAULT_SUBMISSION_NOTES =
  'Completed draft revisions. All figures reconciled and ready for final controller approval.';

interface SubmitProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: SecChangeProposal | null;
  diffs: SecBlockDiff[];
  onSubmit: (notes?: string) => void;
}

export const SubmitProposalModal: React.FC<SubmitProposalModalProps> = ({
  open,
  onOpenChange,
  proposal,
  diffs,
  onSubmit
}) => {
  const [submissionNotes, setSubmissionNotes] = useState(DEFAULT_SUBMISSION_NOTES);

  // Re-seed the message each time the dialog is opened so re-submitting or editing
  // notes shows what was actually sent last time.
  useEffect(() => {
    if (open) {
      setSubmissionNotes(proposal?.submissionNotes || DEFAULT_SUBMISSION_NOTES);
    }
  }, [open, proposal?.id, proposal?.submissionNotes]);

  const addedDiffs = diffs.filter((d) => d.status === 'added');
  const modifiedDiffs = diffs.filter((d) => d.status === 'modified');
  const deletedDiffs = diffs.filter((d) => d.status === 'deleted');
  const totalChanges = addedDiffs.length + modifiedDiffs.length + deletedDiffs.length;
  const totalTableCellDiffs = diffs.reduce((acc, d) => acc + (d.tableCellDiffs?.length || 0), 0);

  const handleSubmit = () => {
    onSubmit(submissionNotes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg sm:max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-purple-200 backdrop-blur-md">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Submit Final Changes for Review
              </DialogTitle>
              <DialogDescription className="text-xs text-purple-200/80 mt-0.5">
                Send your proposed edits to the Lead Controller for confirmation & merging.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Proposal Summary Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">
                {proposal?.title || 'Contributor Draft Revisions'}
              </span>
              {proposal && (
                <Badge className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-none font-mono text-[10px]">
                  {proposal.author.name} ({proposal.author.role})
                </Badge>
              )}
            </div>

            {/* Diff Counters */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-zinc-700">
              <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-none text-[11px] font-mono">
                +{addedDiffs.length} Added
              </Badge>
              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-none text-[11px] font-mono">
                ~{modifiedDiffs.length} Modified
              </Badge>
              <Badge className="bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-none text-[11px] font-mono">
                -{deletedDiffs.length} Deleted
              </Badge>
              <span className="ml-auto text-slate-400 font-medium">
                {totalChanges} total block change{totalChanges === 1 ? '' : 's'}
              </span>
            </div>

            {totalTableCellDiffs > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                <Table className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Includes <strong>{totalTableCellDiffs} table cell / row {totalTableCellDiffs === 1 ? 'change' : 'changes'}</strong> across financial tables
                </span>
              </div>
            )}
          </div>

          {/* Submission Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              <span>Final Submission Message for Lead Controller</span>
            </label>
            <Textarea
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Summarize the changes you made, sources checked, and any items requiring special review..."
              rows={3}
              className="text-xs bg-white dark:bg-zinc-800"
            />
          </div>

          {/* Info notice */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 flex items-start gap-2 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Once submitted, this proposal transitions to <strong>Pending Review</strong>. The Lead Controller will inspect side-by-side differences and confirm which changes to merge into the Main version.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Final Review</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
