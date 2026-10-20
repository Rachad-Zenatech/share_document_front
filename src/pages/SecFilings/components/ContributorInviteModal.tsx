import React, { useState, useMemo } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Users,
  Clock,
  Plus,
  GitBranch,
  Search,
  RotateCcw,
  UserCheck,
  UserPlus,
  Crown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import type { SecFilingDocument, SecChangeProposal } from '../../../types/secFiling';
import type { ContributorPermissions } from '../../../types/collaborator';
import type { User } from '../../../lib/AuthContext';
import { getProposalInviteUrl } from '../../../services/secFilingService';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { toast } from 'sonner';

interface ContributorInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainDoc: SecFilingDocument;
  proposals?: SecChangeProposal[];
  documentSections: string[];
  onCreateInvite: (params: {
    title: string;
    contributorName: string;
    contributorRole: string;
    contributorEmail?: string;
    assignedSection?: string;
    description?: string;
    permissions: ContributorPermissions;
  }) => { proposal: SecChangeProposal; inviteUrl: string };
  onOpenProposal: (proposalId: string) => void;
  onForkProposal?: (sourceProposalId: string) => SecChangeProposal | null;
}

const FALLBACK_SYSTEM_USERS: Array<{
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
  department?: string;
}> = [
  {
    id: 'usr-admin-01',
    full_name: 'Alexander Ross',
    email: 'a.ross@zenatech.com',
    job_title: 'Chief Financial Officer (CFO)',
    department: 'Executive'
  },
  {
    id: 'usr-admin-02',
    full_name: 'Elena Rostova',
    email: 'e.rostova@zenatech.com',
    job_title: 'VP of Financial Reporting & SEC Compliance',
    department: 'Finance'
  },
  {
    id: 'usr-admin-03',
    full_name: 'Marcus Sterling',
    email: 'm.sterling@zenatech.com',
    job_title: 'Lead SEC Financial Controller',
    department: 'Controllership'
  },
  {
    id: 'usr-admin-04',
    full_name: 'Sophia Laurent',
    email: 's.laurent@zenatech.com',
    job_title: 'Senior Corporate Counsel',
    department: 'Legal'
  }
];

export const ContributorInviteModal: React.FC<ContributorInviteModalProps> = ({
  open,
  onOpenChange,
  mainDoc,
  proposals = [],
  documentSections,
  onCreateInvite,
  onOpenProposal,
  onForkProposal
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'existing'>('create');
  const [sourceMode, setSourceMode] = useState<'presets' | 'system' | 'custom'>('presets');

  // Form states
  const [contributorName, setContributorName] = useState('');
  const [contributorRole, setContributorRole] = useState('');
  const [contributorEmail, setContributorEmail] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [assignedSection, setAssignedSection] = useState('ALL');
  const [description, setDescription] = useState('');
  const [governanceRole, setGovernanceRole] = useState<'CONTRIBUTOR' | 'DOC_MANAGER'>('CONTRIBUTOR');
  const [permissions, setPermissions] = useState<ContributorPermissions>({
    canEditDocument: true,
    canEditSpreadsheet: false,
    canMergeAndApprove: false
  });

  // System users search state
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [generatedInvite, setGeneratedInvite] = useState<{
    proposal: SecChangeProposal;
    inviteUrl: string;
  } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch real users from backend Security & System Directory
  const { data: systemUsersData = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<User[]>('/api/configuration/users');
        if (Array.isArray(res) && res.length > 0) {
          return res;
        }
      } catch {
        // Fallback to local system users if offline or unauthenticated
      }
      return FALLBACK_SYSTEM_USERS;
    },
    staleTime: 60_000
  });

  const availableUsers = useMemo(() => {
    const list = Array.isArray(systemUsersData) && systemUsersData.length > 0
      ? systemUsersData
      : FALLBACK_SYSTEM_USERS;

    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase();
    return list.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.job_title?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [systemUsersData, userSearchQuery]);

  const handleSelectSystemUser = (u: any) => {
    setContributorName(u.full_name || '');
    setContributorEmail(u.email || '');
    setContributorRole(u.job_title || u.department || 'System Member');
    setTaskTitle(`${u.full_name}'s Section Review`);
    setGeneratedInvite(null);
    toast.success(`Selected system user: ${u.full_name}`);
  };

  const handleResetToBlank = () => {
    setContributorName('');
    setContributorRole('');
    setContributorEmail('');
    setTaskTitle('');
    setAssignedSection('ALL');
    setDescription('');
    setGovernanceRole('CONTRIBUTOR');
    setPermissions({
      canEditDocument: true,
      canEditSpreadsheet: false,
      canMergeAndApprove: false
    });
    setGeneratedInvite(null);
    setSourceMode('custom');
  };

  const handleRoleGovernanceChange = (role: 'CONTRIBUTOR' | 'DOC_MANAGER') => {
    setGovernanceRole(role);
    if (role === 'DOC_MANAGER') {
      setPermissions({
        canEditDocument: true,
        canEditSpreadsheet: true,
        canMergeAndApprove: true
      });
    } else {
      setPermissions({
        canEditDocument: true,
        canEditSpreadsheet: false,
        canMergeAndApprove: false
      });
    }
    setGeneratedInvite(null);
  };

  const handleGenerate = () => {
    if (!contributorName.trim() || !taskTitle.trim()) {
      toast.error('Please enter a contributor name and task title.');
      return;
    }

    const res = onCreateInvite({
      title: taskTitle.trim(),
      contributorName: contributorName.trim(),
      contributorRole: contributorRole.trim(),
      contributorEmail: contributorEmail.trim(),
      assignedSection: assignedSection === 'ALL' ? undefined : assignedSection,
      description: description.trim(),
      permissions
    });

    setGeneratedInvite(res);
    setCopiedId(res.proposal.id);
    navigator.clipboard.writeText(res.inviteUrl);
    toast.success(
      permissions.canMergeAndApprove
        ? 'Generated and copied Document Co-Manager link (Merge rights enabled)!'
        : 'Generated and copied Contributor share link (Merge approval required)!'
    );
  };

  const handleCopyExistingLink = (p: SecChangeProposal) => {
    const url = getProposalInviteUrl(p);
    navigator.clipboard.writeText(url);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast.success(`Copied share link for "${p.title}" (${p.author.name})!`);
  };

  const handleSwitchToContributorSession = (p?: SecChangeProposal) => {
    const target = p || generatedInvite?.proposal;
    if (target) {
      onOpenProposal(target.id);
      onOpenChange(false);
      const url = getProposalInviteUrl(target);
      window.open(url, '_blank');
      toast.info(`Opened Workspace in a new tab for ${target.author.name}`);
    }
  };

  const applyPreset = (preset: {
    name: string;
    role: string;
    email: string;
    title: string;
    section: string;
  }) => {
    setContributorName(preset.name);
    setContributorRole(preset.role);
    setContributorEmail(preset.email);
    setTaskTitle(preset.title);
    setAssignedSection(preset.section);
    setGeneratedInvite(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl sm:max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-[#0E2841] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-white backdrop-blur-md">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Contributor Access & Invite Links
              </DialogTitle>
              <p className="text-xs text-blue-200 mt-0.5">
                Invite team members, external reviewers, or co-managers to contribute and review.
              </p>
            </div>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Invite</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'existing'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Active Invites & Re-Share Links ({proposals.length})</span>
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
          {activeTab === 'create' ? (
            <>
              {/* Source Selection Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>1. Select User Source</span>
                  </span>
                  {(contributorName || contributorRole || contributorEmail) && (
                    <button
                      type="button"
                      onClick={handleResetToBlank}
                      className="text-[10px] text-slate-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                      title="Clear fields and start fresh"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset / Blank</span>
                    </button>
                  )}
                </div>

                {/* Source Mode Switcher */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setSourceMode('presets')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceMode === 'presets'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quick Presets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceMode('system')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceMode === 'system'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>System Directory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode('custom');
                      handleResetToBlank();
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceMode === 'custom'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                    <span>On-The-Fly / Custom</span>
                  </button>
                </div>

                {/* Sub-view: Quick Presets */}
                {sourceMode === 'presets' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 animate-in fade-in duration-150">
                    {[
                      {
                        label: 'External Legal Counsel',
                        name: 'Sarah Jenkins',
                        role: 'Senior Legal Partner',
                        email: 's.jenkins@lawcorp.com',
                        title: 'Note 7 Debt Covenants & Legal Disclosures',
                        section: 'LOANS PAYABLE'
                      },
                      {
                        label: 'Tax Specialist',
                        name: 'David Chen, CPA',
                        role: 'Director of Taxation',
                        email: 'd.chen@zenatech.com',
                        title: 'Q2 Deferred Tax & Loss Carryforward Revision',
                        section: 'INCOME TAXES'
                      },
                      {
                        label: 'Independent Auditor',
                        name: 'Michael Vance, CA',
                        role: 'Audit Partner (External)',
                        email: 'm.vance@auditfirm.com',
                        title: 'Interim Review Notice & Signatures',
                        section: 'Auditor Report & Cover'
                      }
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={`p-2.5 text-left rounded-xl border transition-all group cursor-pointer ${
                          contributorName === p.name
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/30'
                        }`}
                      >
                        <div className="font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                          {p.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{p.name}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Sub-view: System & Security Directory */}
                {sourceMode === 'system' && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 space-y-2 animate-in fade-in duration-150">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                      <Input
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Search system users by name, role, email, or department..."
                        className="h-7 text-[11px] pl-8"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {availableUsers.length === 0 ? (
                        <div className="text-center py-3 text-slate-400 text-[11px]">
                          No system users found matching "{userSearchQuery}"
                        </div>
                      ) : (
                        availableUsers.map((u) => {
                          const isSelected = contributorEmail === u.email;
                          return (
                            <div
                              key={u.id || u.email}
                              onClick={() => handleSelectSystemUser(u)}
                              className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-500'
                                  : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-blue-400 hover:bg-blue-50/30'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                                  <span>{u.full_name}</span>
                                  {u.department && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-slate-500">
                                      {u.department}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {u.job_title || 'Team Member'} • {u.email}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                className="h-6 text-[10px] px-2"
                              >
                                {isSelected ? 'Selected' : 'Choose'}
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Participant Full Name *
                  </label>
                  <Input
                    value={contributorName}
                    onChange={(e) => {
                      setContributorName(e.target.value);
                      setGeneratedInvite(null);
                    }}
                    placeholder="e.g. Jane Doe"
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Job Title / Role *
                  </label>
                  <Input
                    value={contributorRole}
                    onChange={(e) => {
                      setContributorRole(e.target.value);
                      setGeneratedInvite(null);
                    }}
                    placeholder="e.g. Senior Financial Analyst"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Participant Email Address
                  </label>
                  <Input
                    value={contributorEmail}
                    onChange={(e) => {
                      setContributorEmail(e.target.value);
                      setGeneratedInvite(null);
                    }}
                    placeholder="e.g. j.doe@zenatech.com"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Assigned Section Focus
                  </label>
                  <select
                    value={assignedSection}
                    onChange={(e) => {
                      setAssignedSection(e.target.value);
                      setGeneratedInvite(null);
                    }}
                    className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Entire Document (All Sections)</option>
                    {documentSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Task / Proposed Branch Title *
                  </label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => {
                      setTaskTitle(e.target.value);
                      setGeneratedInvite(null);
                    }}
                    placeholder="e.g. Q2 Leases & Share Capital Draft"
                    className="h-8 text-xs font-semibold text-blue-950 dark:text-blue-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Instructions / Notes for Contributor
                </label>
                <Input
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setGeneratedInvite(null);
                  }}
                  placeholder="e.g. Please update fair value numbers and sign off when finished."
                  className="h-8 text-xs"
                />
              </div>

              {/* Document Governance & Merge Rights Selector */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>2. Document Governance & Merge Authorization</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Multi-manager supported
                  </Badge>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option 1: Contributor (Approval Required) */}
                  <div
                    onClick={() => handleRoleGovernanceChange('CONTRIBUTOR')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      governanceRole === 'CONTRIBUTOR'
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-600'
                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-xs text-slate-800 dark:text-zinc-100">
                        Contributor (Standard)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Edits are isolated in a draft branch. All changes <strong>must be reviewed and merged by a Lead Controller</strong> before reaching the master filing.
                    </p>
                  </div>

                  {/* Option 2: Document Co-Manager (Direct Merge & Review Rights) */}
                  <div
                    onClick={() => handleRoleGovernanceChange('DOC_MANAGER')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      governanceRole === 'DOC_MANAGER'
                        ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="font-bold text-xs text-purple-950 dark:text-purple-200">
                        Document Co-Manager
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Authorized to <strong>review incoming proposals, approve/reject changes, execute partial or full merges</strong> into master, and manage version snapshots.
                    </p>
                  </div>
                </div>

                {/* Granular Permission Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {(
                    [
                      { key: 'canEditDocument', label: 'Edit Document Draft', hint: 'Edit blocks in filing' },
                      { key: 'canEditSpreadsheet', label: 'Edit Attached Sheet', hint: 'Modify linked workbook cells' },
                      { key: 'canMergeAndApprove', label: 'Merge & Approve Rights', hint: 'Direct merge authority' }
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-start gap-2 p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 cursor-pointer hover:border-blue-500 transition-all"
                    >
                      <Checkbox
                        checked={permissions[opt.key] ?? false}
                        onCheckedChange={(checked) => {
                          setPermissions((prev) => ({ ...prev, [opt.key]: checked === true }));
                          if (opt.key === 'canMergeAndApprove') {
                            setGovernanceRole(checked === true ? 'DOC_MANAGER' : 'CONTRIBUTOR');
                          }
                          setGeneratedInvite(null);
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-semibold text-[11px] text-slate-800 dark:text-zinc-200">{opt.label}</span>
                        <span className="block text-[9px] text-slate-400">{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Link Button */}
              {!generatedInvite ? (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  className={`w-full text-white font-semibold text-xs h-9 gap-1.5 shadow-sm cursor-pointer ${
                    permissions.canMergeAndApprove
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  <span>
                    {permissions.canMergeAndApprove
                      ? 'Generate Document Co-Manager Access Link'
                      : 'Generate Contributor Share Link (Approval Required)'}
                  </span>
                </Button>
              ) : (
                /* Generated Result Card */
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-xs text-blue-950 dark:text-blue-100">
                        {permissions.canMergeAndApprove
                          ? 'Document Co-Manager Link Generated & Active'
                          : 'Contributor Link Generated & Active'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700 dark:text-blue-300">
                      {permissions.canMergeAndApprove ? 'Direct Merge Rights' : 'Merge Approval Required'}
                    </Badge>
                  </div>

                  {/* URL Display */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-blue-300 dark:border-zinc-700 font-mono text-[11px] text-slate-700 dark:text-zinc-300 truncate select-all">
                      {generatedInvite.inviteUrl}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopyExistingLink(generatedInvite.proposal)}
                      className="h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    >
                      {copiedId === generatedInvite.proposal.id ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === generatedInvite.proposal.id ? 'Copied!' : 'Copy Link'}</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        Edits save directly to this branch. If the link is lost, you can re-copy it from the "Active Invites" tab.
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitchToContributorSession()}
                      className="h-7 text-[11px] gap-1 text-blue-600 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                    >
                      <span>Open Live</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Active Invites Tab */
            <div className="space-y-2">
              <div className="text-[11px] text-slate-500 pb-1 flex items-center justify-between">
                <span>All active contributor sessions and branches are preserved below. Re-copy any link at any time:</span>
              </div>

              {proposals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  No active contributor links yet. Switch to "Create New Invite" to generate one.
                </div>
              ) : (
                proposals.map((p) => {
                  const isCopied = copiedId === p.id;
                  const isManager = p.permissions?.canMergeAndApprove;

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 dark:text-zinc-100 text-xs truncate">
                            {p.title}
                          </span>
                          <Badge
                            variant={p.status === 'pending_review' ? 'default' : 'outline'}
                            className={`text-[9px] uppercase font-mono ${
                              p.status === 'pending_review'
                                ? 'bg-emerald-600 text-white'
                                : p.status === 'merged'
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : ''
                            }`}
                          >
                            {p.status.replace('_', ' ')}
                          </Badge>
                          {isManager ? (
                            <Badge className="bg-purple-50 text-purple-700 border-purple-300 text-[9px] font-semibold">
                              Doc Co-Manager
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-slate-600">
                              Requires Merge Approval
                            </Badge>
                          )}
                          {p.assignedSection && p.assignedSection !== 'ALL' && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px]">
                              Scope: {p.assignedSection}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">
                            {p.author.name}
                          </span>
                          <span>•</span>
                          <span>{p.author.role}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {p.status === 'merged' && onForkProposal && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const forked = onForkProposal(p.id);
                              if (forked) {
                                setCopiedId(forked.id);
                                setTimeout(() => setCopiedId(null), 2500);
                              }
                            }}
                            className="h-7 px-2.5 text-xs font-semibold gap-1 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-2xs"
                            title="Generate a new branch and share link for the next round of changes"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span>New Revision Link</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleCopyExistingLink(p)}
                          className={`h-7 px-2.5 text-xs font-semibold gap-1 transition-all cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                          <span>{isCopied ? 'Link Copied!' : p.status === 'merged' ? 'Copy Merged Link' : 'Re-Copy Link'}</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSwitchToContributorSession(p)}
                          title="Open workspace"
                          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Targeting Main Document Version: <strong className="text-slate-700 dark:text-zinc-300 font-mono">{mainDoc.version}</strong>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
