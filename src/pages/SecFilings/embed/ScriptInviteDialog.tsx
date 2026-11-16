import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { useAssignableUsers } from '../../../hooks/useSecWorkflows';
import type { ScriptCapacity, ScriptCollaborator, ScriptCollaboratorRole, ScriptInvitee } from '../../../types/scriptReview';

const ROLES: { value: ScriptCollaboratorRole; label: string }[] = [
  { value: 'REVIEWER', label: 'Content reviewer' },
  { value: 'SUGGESTER', label: 'Suggesting reviewer' },
  { value: 'MANAGER', label: 'Manager (Super Admin)' },
  { value: 'VIEWER', label: 'Viewer' },
];
const SELECT = 'h-8 rounded-md border border-border bg-background px-2 text-xs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: ScriptCollaborator[];
  creatorId: string;
  busy: boolean;
  canSend: boolean;
  onSave: (invitees: ScriptInvitee[]) => void;
  onSend: (invitees: ScriptInvitee[]) => void;
}

function InviteeRow({ invitee, name, onChange, onRemove }: {
  invitee: ScriptInvitee;
  name: string;
  onChange: (next: ScriptInvitee) => void;
  onRemove: () => void;
}) {
  const managerLocksEdit = invitee.role === 'MANAGER';
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate text-sm">{name}</span>
      <select className={SELECT} value={invitee.role} onChange={(e) => onChange({ ...invitee, role: e.target.value as ScriptCollaboratorRole })}>
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <select
        className={SELECT}
        value={managerLocksEdit ? 'EDIT' : invitee.capacity}
        disabled={managerLocksEdit}
        onChange={(e) => onChange({ ...invitee, capacity: e.target.value as ScriptCapacity })}
      >
        <option value="EDIT">Can edit</option>
        <option value="VIEW">View + notes</option>
      </select>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${name}`}>
        <Trash2 />
      </Button>
    </div>
  );
}

export default function ScriptInviteDialog({ open, onOpenChange, current, creatorId, busy, canSend, onSave, onSend }: Props) {
  const { data: users = [] } = useAssignableUsers();
  const [invitees, setInvitees] = useState<ScriptInvitee[]>(() =>
    current.map((c) => ({ user_id: c.user_id, role: c.role, capacity: c.capacity })));
  const nameOf = (id: string) => current.find((c) => c.user_id === id)?.name || users.find((u) => u.id === id)?.full_name || id;
  const available = users.filter((u) => u.id !== creatorId && !invitees.some((i) => i.user_id === u.id));
  const reviewerReady = invitees.some((i) => i.capacity === 'EDIT' && (i.role === 'REVIEWER' || i.role === 'SUGGESTER'));

  const add = (userId: string) => userId && setInvitees((list) => [...list, { user_id: userId, role: 'REVIEWER', capacity: 'EDIT' }]);
  const update = (index: number, next: ScriptInvitee) => setInvitees((list) => list.map((v, i) => (i === index ? next : v)));
  const remove = (index: number) => setInvitees((list) => list.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite reviewers</DialogTitle>
          <DialogDescription>
            Reviewers and suggesting reviewers who can edit must check in before the script moves on. People with
            "View + notes" can read and add notes only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {invitees.map((inv, i) => (
            <InviteeRow key={inv.user_id} invitee={inv} name={nameOf(inv.user_id)} onChange={(n) => update(i, n)} onRemove={() => remove(i)} />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <UserPlus className="size-4 text-muted-foreground" />
            <select className={`${SELECT} flex-1`} value="" onChange={(e) => add(e.target.value)}>
              <option value="">Add a person...</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onSave(invitees)}>Save invites</Button>
          <Button type="button" disabled={busy || !canSend || !reviewerReady} onClick={() => onSend(invitees)}>Send for review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
