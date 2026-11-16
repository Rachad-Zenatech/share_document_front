import React from 'react';
import { ChevronLeft, ChevronRight, CheckCheck, Clock, GitMerge, GitPullRequest, ShieldCheck, X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import type { SecChangeProposal } from '../../../types/secFiling';

const when = (iso?: string): string => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};

/** Who changed the script, against which version, and the one close button. */
export const ScriptMergeHeader: React.FC<{ proposal: SecChangeProposal; onClose: () => void }> = ({ proposal, onClose }) => (
  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-600/10 text-blue-600 dark:border-blue-900">
        <GitPullRequest className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">{proposal.title}</h3>
          <Badge variant={proposal.status === 'pending_review' ? 'default' : 'outline'} className={proposal.status === 'pending_review' ? 'bg-amber-600 text-white hover:bg-amber-600' : ''}>
            {proposal.status === 'pending_review' ? 'Ready to merge' : proposal.status}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-zinc-400">
          <span>Changes by <strong className="text-slate-700 dark:text-zinc-200">{proposal.author.name}</strong></span>
          <span>• Script version {proposal.baseVersion}</span>
          {proposal.submittedAt && (
            <span className="flex items-center gap-1 font-medium text-purple-600 dark:text-purple-400"><Clock className="h-3 w-3" />Sent {when(proposal.submittedAt)}</span>
          )}
        </div>
      </div>
    </div>
    <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-800">
      <X className="h-4 w-4" />
    </Button>
  </div>
);

interface ToolbarProps {
  selected: number;
  total: number;
  position: number;
  showUnchanged: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onJump: (delta: number) => void;
  onToggleUnchanged: () => void;
}

/** One row: how many changes are taken, select all, jump between changes, and show the rest of the script. */
export const ScriptMergeToolbar: React.FC<ToolbarProps> = ({ selected, total, position, showUnchanged, onSelectAll, onDeselectAll, onJump, onToggleUnchanged }) => (
  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/90">
    <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium dark:border-zinc-700 dark:bg-zinc-800">
      <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
      <strong className="text-blue-700 dark:text-blue-400">{selected} of {total}</strong> changes to merge
    </span>
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onSelectAll}>Select all</Button>
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onDeselectAll}>Deselect all</Button>
    <span className="ml-auto flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onJump(-1)} aria-label="Previous change"><ChevronLeft className="h-4 w-4" /></Button>
      <span className="min-w-[3rem] text-center text-slate-500">{total ? position + 1 : 0} / {total}</span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onJump(1)} aria-label="Next change"><ChevronRight className="h-4 w-4" /></Button>
    </span>
    <Button type="button" variant={showUnchanged ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={onToggleUnchanged}>
      {showUnchanged ? 'Hide unchanged lines' : 'Show whole script'}
    </Button>
  </div>
);

interface FooterProps {
  isLeadController: boolean;
  canMerge: boolean;
  selected: number;
  total: number;
  notes: string;
  onNotes: (v: string) => void;
  onCancel: () => void;
  onReject: () => void;
  onMerge: () => void;
  onMergeAll: () => void;
}

/** Notes, then the decision, in one short bar so the changes keep the screen. */
export const ScriptMergeFooter: React.FC<FooterProps> = ({ isLeadController, canMerge, selected, total, notes, onNotes, onCancel, onReject, onMerge, onMergeAll }) => (
  <div className="flex shrink-0 flex-wrap items-end gap-3 border-t border-slate-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="min-w-[16rem] flex-1">
      <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        {isLeadController ? 'Notes for the writer (optional)' : 'Viewing only: a Lead Controller merges these changes'}
      </label>
      <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={1} placeholder="e.g. Took the new voiceover, kept the original title." className="min-h-9 resize-none bg-slate-50 text-xs dark:bg-zinc-950" />
    </div>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" className="h-9 text-xs" onClick={onCancel}>Cancel</Button>
      {canMerge && (
        <>
          <Button type="button" variant="outline" className="h-9 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onReject}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
          {selected < total && <Button type="button" variant="outline" className="h-9 border-emerald-400 text-xs text-emerald-700 hover:bg-emerald-50" onClick={onMergeAll}>Merge all ({total})</Button>}
          <Button type="button" disabled={selected === 0} className="h-9 gap-1.5 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700" onClick={onMerge}>
            <GitMerge className="h-3.5 w-3.5" />Merge selected ({selected})
          </Button>
        </>
      )}
    </div>
  </div>
);
