import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  Users,
  Clock,
  Plus,
  GitBranch
} from 'lucide-react';
import type { SecFilingDocument, SecChangeProposal } from '../../../types/secFiling';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';

export function getProposalInviteUrl(proposal: SecChangeProposal): string {
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/sec-filings/contribute` : '/sec-filings/contribute';
  const queryParams = new URLSearchParams({
    contributor: 'true',
    proposalId: proposal.id,
    name: proposal.author.name,
    role: proposal.author.role,
    section: proposal.assignedSection || 'ALL',
    title: proposal.title,
    ...(proposal.changeSummary.description ? { desc: proposal.changeSummary.description } : {})
  });
  return `${baseUrl}?${queryParams.toString()}`;
}

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
  }) => { proposal: SecChangeProposal; inviteUrl: string };
  onOpenProposal: (proposalId: string) => void;
  onForkProposal?: (sourceProposalId: string) => SecChangeProposal | null;
}

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
  const [contributorName, setContributorName] = useState('Sarah Jenkins');
  const [contributorRole, setContributorRole] = useState('External Legal Counsel');
  const [contributorEmail, setContributorEmail] = useState('sarah.jenkins@lawcorp.com');
  const [taskTitle, setTaskTitle] = useState('Note 7 Debt Covenants & Legal Disclosures');
  const [assignedSection, setAssignedSection] = useState('ALL');
  const [description, setDescription] = useState('Please review and insert the finalized Q2 debenture terms.');

  const [generatedInvite, setGeneratedInvite] = useState<{
    proposal: SecChangeProposal;
    inviteUrl: string;
  } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      description: description.trim()
    });

    setGeneratedInvite(res);
    setCopiedId(res.proposal.id);
    navigator.clipboard.writeText(res.inviteUrl);
    toast.success('Generated and copied contributor share link!');
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
      toast.info(`Opened Contributor Workspace in a new tab for ${target.author.name}`);
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
                Generate or retrieve persistent links for external reviewers, auditors, and legal counsel.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
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
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
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
              {/* Quick Persona Presets */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Quick Presets for SEC Filing Contributors</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      className="p-2.5 text-left rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/40 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-all group cursor-pointer"
                    >
                      <div className="font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600">
                        {p.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Contributor Full Name *
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
                    Contributor Title / Role *
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
                    Task / Proposal Title *
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
                    className="w-full h-8 px-2 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
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

              {/* Generate Link Button */}
              {!generatedInvite ? (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-sm cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  <span>Generate Shareable Contributor Link</span>
                </Button>
              ) : (
                /* Generated Result Card */
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-xs text-blue-950 dark:text-blue-100">
                        Contributor Link Generated & Active
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700 dark:text-blue-300">
                      Saved in History
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
                        Edits save directly to this branch. If the person loses this link, you can re-copy it from the "Active Invites" tab at any time.
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
                          <span>â€¢</span>
                          <span>{p.author.role}</span>
                          <span>â€¢</span>
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
                          title="Open contributor view"
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
