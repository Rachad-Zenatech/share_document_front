import { useState } from 'react';
import { Check, CheckCheck, Eye, FilePlus2, RotateCcw, UserPlus, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import type { useScriptReview } from '../../../hooks/useScriptReview';
import type { ScriptReviewState, ScriptStatus } from '../../../types/scriptReview';
import ScriptInviteDialog from './ScriptInviteDialog';

type Review = ReturnType<typeof useScriptReview>;

const STATUS_LABEL: Record<ScriptStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  LEVEL2_REVIEW: 'Level 2 review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
};

function StatusSummary({ state }: { state: ScriptReviewState }) {
  const voted = state.collaborators.filter((c) => c.vote).length;
  const required = state.collaborators.filter((c) => c.capacity === 'EDIT' && c.role !== 'MANAGER' && c.role !== 'VIEWER').length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge>{STATUS_LABEL[state.status]}</Badge>
      <span className="text-muted-foreground">Round {state.round}</span>
      <Badge variant="outline">You: {state.access.role.toLowerCase()}</Badge>
      {state.status === 'IN_REVIEW' && <span className="text-muted-foreground">{voted} of {required} checked in</span>}
      {!state.access.can_edit && state.access.can_note && (
        <span className="flex items-center gap-1 text-muted-foreground"><Eye className="size-3" /> View and notes only</span>
      )}
      {state.decision_note && <span className="truncate text-muted-foreground">Note: {state.decision_note}</span>}
    </div>
  );
}

function ReviewerActions({ state, review, note }: { state: ScriptReviewState; review: Review; note: string }) {
  const { access } = state;
  const mine = state.collaborators.find((c) => c.user_id === state.you && c.vote);
  const isSuggester = access.role === 'SUGGESTER';
  const busy = review.checkIn.isPending || review.finalize.isPending;
  return (
    <>
      {access.can_check_in && isSuggester && (
        <Button size="sm" disabled={busy} onClick={() => review.checkIn.mutate({ vote: 'DONE', note })}><Check /> Done</Button>
      )}
      {access.can_check_in && !isSuggester && (
        <>
          <Button size="sm" disabled={busy} onClick={() => review.checkIn.mutate({ vote: 'APPROVE', note })}><Check /> Approve</Button>
          <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => review.checkIn.mutate({ vote: 'CHANGES', note })}>
            <X /> Request changes
          </Button>
        </>
      )}
      {access.can_check_in && mine && (
        <Button size="sm" variant="ghost" onClick={() => review.withdraw.mutate()}><RotateCcw /> Withdraw check-in</Button>
      )}
      {access.can_finalize && state.all_checked && (
        <>
          <Button size="sm" disabled={busy} onClick={() => review.finalize.mutate({ route: 'CREATOR', note })}><CheckCheck /> Approve</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => review.finalize.mutate({ route: 'LEVEL2', note })}>Pass to level 2</Button>
        </>
      )}
    </>
  );
}

function ManagerActions({ state, review, note }: { state: ScriptReviewState; review: Review; note: string }) {
  if (!state.access.can_decide) return null;
  return (
    <>
      <Button size="sm" disabled={review.decide.isPending} onClick={() => review.decide.mutate({ decision: 'APPROVE', note })}>
        <CheckCheck /> Approve
      </Button>
      <Button size="sm" variant="outline" disabled={review.decide.isPending || !note.trim()} onClick={() => review.decide.mutate({ decision: 'SEND_BACK', note })}>
        <RotateCcw /> Send back
      </Button>
    </>
  );
}

function CreatorActions({ state, review, onInvite }: { state: ScriptReviewState; review: Review; onInvite: () => void }) {
  const { access } = state;
  return (
    <>
      {access.can_submit && (
        <Button size="sm" variant="outline" onClick={onInvite}><UserPlus /> Invite and send</Button>
      )}
      {access.can_create_post && !state.post_requested && (
        <Button size="sm" disabled={review.createPost.isPending} onClick={() => review.createPost.mutate(undefined)}>
          <FilePlus2 /> Create post
        </Button>
      )}
      {state.post_requested && <Badge variant="secondary">Post requested</Badge>}
    </>
  );
}

export default function ScriptReviewBar({ state, review }: { state: ScriptReviewState; review: Review }) {
  const [note, setNote] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const { access } = state;
  const wantsNote = access.can_check_in || access.can_decide || access.can_finalize;
  const error = [review.invite, review.send, review.checkIn, review.finalize, review.decide, review.createPost]
    .find((m) => m.error)?.error as Error | undefined;

  return (
    <div className="border-b border-border bg-card px-4 py-2 space-y-2">
      <StatusSummary state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <CreatorActions state={state} review={review} onInvite={() => setInviteOpen(true)} />
        <ReviewerActions state={state} review={review} note={note} />
        <ManagerActions state={state} review={review} note={note} />
      </div>
      {wantsNote && <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to request changes or send back)" rows={2} />}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {inviteOpen && (
        <ScriptInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          current={state.collaborators}
          creatorId={state.creator_id}
          busy={review.invite.isPending || review.send.isPending}
          canSend={access.can_submit}
          onSave={(invitees) => review.invite.mutate(invitees, { onSuccess: () => setInviteOpen(false) })}
          onSend={(invitees) => review.send.mutate({ invitees }, { onSuccess: () => { setInviteOpen(false); setNote(''); } })}
        />
      )}
    </div>
  );
}
