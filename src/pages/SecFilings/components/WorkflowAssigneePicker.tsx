import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, UserPlus, X } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import type { User } from '../../../lib/AuthContext';
import type { SecWorkflowAssignee } from '../../../types/secWorkflow';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';

interface WorkflowAssigneePickerProps {
  value: SecWorkflowAssignee[];
  onChange: (assignees: SecWorkflowAssignee[]) => void;
}

/** Display text stored as the step's `assignedTo` (used by export, cards and the invite modal). */
export const formatAssignees = (assignees: SecWorkflowAssignee[]) =>
  assignees.map((a) => a.name.trim()).filter(Boolean).join(', ');

const sameAssignee = (a: SecWorkflowAssignee, b: SecWorkflowAssignee) =>
  a.userId && b.userId ? a.userId === b.userId : !a.userId && !b.userId && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

/**
 * Multi-select of platform users for a workflow step, plus "Other" names for people
 * outside the platform (auditors, external counsel, staff without an account).
 */
export const WorkflowAssigneePicker: React.FC<WorkflowAssigneePickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['sec-workflow-assignable-users'],
    queryFn: () => apiClient.get<User[]>('/api/configuration/users?is_active=true'),
    staleTime: 60_000
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(users) ? users : [];
    if (!q) return list;
    return list.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.job_title?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const isUserSelected = (u: User) => value.some((a) => a.userId === u.id);

  const toggleUser = (u: User) => {
    if (isUserSelected(u)) {
      onChange(value.filter((a) => a.userId !== u.id));
    } else {
      onChange([...value, { userId: u.id, name: u.full_name || u.email, email: u.email }]);
    }
  };

  const remove = (target: SecWorkflowAssignee) => onChange(value.filter((a) => !sameAssignee(a, target)));

  const otherName = search.trim();
  const canAddOther =
    otherName.length > 0 && !value.some((a) => !a.userId && a.name.trim().toLowerCase() === otherName.toLowerCase());

  const addOther = () => {
    if (!canAddOther) return;
    onChange([...value, { userId: null, name: otherName, email: null }]);
    setSearch('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-8 px-2 py-1 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center gap-1.5 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <div className="flex-1 min-w-0 flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-slate-400 text-xs py-0.5">Assign people...</span>
            ) : (
              value.map((a) => (
                <Badge
                  key={a.userId || `other:${a.name}`}
                  variant="outline"
                  title={a.email || (a.userId ? undefined : 'External / no platform access')}
                  className={`text-[10px] gap-1 font-normal max-w-full ${
                    a.userId ? '' : 'border-purple-300 text-purple-800 dark:text-purple-300'
                  }`}
                >
                  <span className="truncate">{a.name}</span>
                  {!a.userId && <span className="text-[9px] text-purple-500 shrink-0">ext</span>}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${a.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(a);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(a);
                      }
                    }}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-2 gap-2 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredUsers.length === 1) toggleUser(filteredUsers[0]);
                else addOther();
              }
            }}
            placeholder="Search users, or type a name for someone else..."
            className="h-7 text-[11px] pl-8"
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {isLoading ? (
            <div className="py-3 text-center text-slate-400">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-3 text-center text-slate-400">
              {search ? `No platform users match "${search}"` : 'No platform users found'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const selected = isUserSelected(u);
              return (
                <label
                  key={u.id}
                  className={`flex items-start gap-2 p-1.5 rounded-md cursor-pointer ${
                    selected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Checkbox checked={selected} onCheckedChange={() => toggleUser(u)} className="mt-0.5" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-slate-800 dark:text-zinc-200">{u.full_name || u.email}</span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {[u.job_title, u.department, u.email].filter(Boolean).join(' • ')}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="pt-1.5 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
          <button
            type="button"
            disabled={!canAddOther}
            onClick={addOther}
            className="w-full flex items-center gap-1.5 p-1.5 rounded-md text-left text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:text-slate-400 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {otherName ? (
                <>
                  Add other: <strong>{otherName}</strong>
                </>
              ) : (
                'Other: type a name above for external people'
              )}
            </span>
          </button>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>{value.length} assigned</span>
            <button type="button" onClick={() => setOpen(false)} className="font-semibold text-blue-600 hover:underline cursor-pointer">
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
