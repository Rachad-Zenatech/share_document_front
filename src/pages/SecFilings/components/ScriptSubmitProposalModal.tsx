import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Send, Table } from 'lucide-react';
import type { SubmitProposalModalProps } from './SubmitProposalModal';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';

type Props = Pick<SubmitProposalModalProps, 'open' | 'onOpenChange' | 'proposal' | 'diffs' | 'onSubmit'>;
const DEFAULT_NOTES = 'Updated script wording and scene details. Ready for review.';

function ScriptSubmissionSummary({ proposal, diffs }: Pick<Props, 'proposal' | 'diffs'>) {
  const added = diffs.filter((diff) => diff.status === 'added').length;
  const modified = diffs.filter((diff) => diff.status === 'modified').length;
  const deleted = diffs.filter((diff) => diff.status === 'deleted').length;
  const total = added + modified + deleted;
  const tableChanges = diffs.reduce((sum, diff) => sum + (diff.tableCellDiffs?.length || 0), 0);
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{proposal?.title || 'Script changes'}</span>
        {proposal && <Badge className="border-none bg-purple-100 text-[10px] text-purple-700 dark:bg-purple-950 dark:text-purple-300">{proposal.author.name}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-zinc-700">
        <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">+{added} Added</Badge>
        <Badge className="border-none bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">~{modified} Modified</Badge>
        <Badge className="border-none bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">-{deleted} Deleted</Badge>
        <span className="ml-auto text-slate-500">{total} content change{total === 1 ? '' : 's'}</span>
      </div>
      {tableChanges > 0 && <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><Table className="h-3.5 w-3.5 shrink-0" />{tableChanges} script table cell / row change{tableChanges === 1 ? '' : 's'}</p>}
    </div>
  );
}

export function ScriptSubmitProposalModal({ open, onOpenChange, proposal, diffs, onSubmit }: Props) {
  const [notes, setNotes] = useState(proposal?.submissionNotes || DEFAULT_NOTES);
  useEffect(() => {
    if (open) setNotes(proposal?.submissionNotes || DEFAULT_NOTES);
  }, [open, proposal?.id, proposal?.submissionNotes]);
  const submit = () => {
    onSubmit(notes);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-lg dark:border-zinc-800 dark:bg-zinc-900 max-h-[calc(100dvh-1.5rem)]">
        <div className="flex items-center gap-3 bg-gradient-to-r from-purple-900 to-indigo-950 px-6 py-4 text-white">
          <Send className="h-5 w-5 shrink-0 text-purple-200" />
          <div>
            <DialogTitle className="text-base font-bold text-white">Submit Script Changes for Review</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-purple-200">Send your script edits to the script owner for review and merging.</DialogDescription>
          </div>
        </div>
        <div className="space-y-4 p-6 text-xs">
          <ScriptSubmissionSummary proposal={proposal} diffs={diffs} />
          <div className="space-y-1.5">
            <label htmlFor="script-submission-notes" className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-300"><MessageSquare className="h-3.5 w-3.5 text-purple-600" />Message for the script owner</label>
            <Textarea id="script-submission-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Summarize script edits, scene changes, and anything the reviewer should check..." rows={3} className="text-xs" />
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your changes will be marked <strong>Pending Review</strong>. The script owner can compare them with the main script and merge the approved edits.</span>
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={submit} className="gap-1.5 bg-purple-600 text-xs text-white hover:bg-purple-700"><Send className="h-3.5 w-3.5" />Submit for Review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
