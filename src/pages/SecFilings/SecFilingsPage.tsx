import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileDown,
  Printer,
  History,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Send,
  RotateCcw,
  Search,
  CheckCircle2,
  ChevronDown,
  Share2,
  FolderArchive,
  Undo2,
  Redo2
} from 'lucide-react';
import { useSecFiling } from '../../hooks/useSecFiling';
import { secFilingService } from '../../services/secFilingService';
import { BlockBuilder } from './components/BlockBuilder';
import { DocumentOutline } from './components/DocumentOutline';
import { BlockInspector } from './components/BlockInspector';
import { MergeReviewModal } from './components/MergeReviewModal';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { NewProposalModal } from './components/NewProposalModal';
import { ContributorInviteModal } from './components/ContributorInviteModal';
import { SubmitProposalModal } from './components/SubmitProposalModal';
import { MediaBucketModal } from './components/MediaBucketModal';
import { exportSecFilingToDocx, downloadBlob, printSecFiling } from '../../utils/secFilingExport';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useFinancialTableTemplates } from '../../hooks/useFinancialTableTemplates';
import { resolveTableTemplates } from '../../data/financialTableTemplates';

export default function SecFilingsPage() {
  const {
    mainDoc,
    proposals,
    versionHistory,
    activeProposalId,
    activeProposal,
    workingBlocks,
    filteredBlocks,
    documentSections,
    sectionCounts,
    selectedBlockId,
    selectedBlockIds,
    activeRole,
    activeDiffs,
    sectionFilter,
    searchQuery,
    setSelectedBlockId,
    toggleBlockSelection,
    selectAllBlocks,
    clearBlockSelection,
    setActiveProposalId,
    setActiveRole,
    setSectionFilter,
    setSearchQuery,
    addBlock,
    updateBlock,
    moveBlock,
    moveMultipleBlocks,
    duplicateBlock,
    duplicateMultipleBlocks,
    deleteBlock,
    deleteMultipleBlocks,
    moveMultipleBlocksToSection,
    updateMultipleBlocksSpacing,
    moveSection,
    reorderSection,
    createSection,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    handleCreateProposal,
    handleCreateContributorInvite,
    handleForkProposal,
    handleSubmitForReview,
    handleMergeProposal,
    handleSelectiveMerge,
    handleRejectProposal,
    handleRestoreVersion,
    handleResetToDefault,
    calculateDiffForProposal,
    contributorSession
  } = useSecFiling();

  const isJumpingRef = useRef(false);

  const handleSelectSection = (section: string) => {
    setSectionFilter(section);
    isJumpingRef.current = true;

    if (section === 'ALL') {
      const firstPage = document.getElementById('doc-page-1');
      if (firstPage) {
        firstPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => {
        isJumpingRef.current = false;
      }, 700);
      return;
    }

    const targetBlock = workingBlocks.find((b) => b.section === section);
    if (targetBlock) {
      setSelectedBlockId(targetBlock.id);
      const el = document.getElementById(targetBlock.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 700);
  };

  // Keep outline active section updated as user scrolls through the document
  useEffect(() => {
    const handleScroll = () => {
      if (isJumpingRef.current) return;
      if (window.scrollY < 120) {
        if (sectionFilter !== 'ALL') {
          setSectionFilter('ALL');
        }
        return;
      }
      for (const block of workingBlocks) {
        const el = document.getElementById(block.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 260 && rect.bottom >= 100) {
            if (block.section && block.section !== sectionFilter) {
              setSectionFilter(block.section);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [workingBlocks, sectionFilter, setSectionFilter]);

  // Statement templates come from the database; the bundled set is the fallback

  // while the request is in flight or if the user lacks SEC_FILINGS_READ.

  const { data: templateData } = useFinancialTableTemplates();

  const tableTemplates = useMemo(

    () => resolveTableTemplates(templateData?.templates),

    [templateData]

  );


  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isNewProposalModalOpen, setIsNewProposalModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmitProposalModalOpen, setIsSubmitProposalModalOpen] = useState(false);
  const [isMediaBucketOpen, setIsMediaBucketOpen] = useState(false);
  const [selectedProposalForReview, setSelectedProposalForReview] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'word' | 'blocks'>('word');

  const navigate = useNavigate();
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Selected block object for inspector
  const selectedBlock = workingBlocks.find((b) => b.id === selectedBlockId) || null;

  // Export handlers
  const handleExportDocx = async () => {
    try {
      secFilingService.flushPendingSaves();
      setIsExportingDocx(true);
      toast.info('Generating formatted Word Document (.docx)...');
      const currentWorkingDoc = {
        ...mainDoc,
        blocks: workingBlocks,
        version: activeProposal ? `${mainDoc.version} (Branch: ${activeProposal.title})` : mainDoc.version
      };
      const blob = await exportSecFilingToDocx(currentWorkingDoc);
      const filename = `ZenaTech_SEC_Filing_${currentWorkingDoc.version.replace(/\s+/g, '_')}.docx`;
      downloadBlob(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export to Word Document');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = () => {
    const currentWorkingDoc = {
      ...mainDoc,
      blocks: workingBlocks,
      version: activeProposal ? `${mainDoc.version} (Branch: ${activeProposal.title})` : mainDoc.version
    };
    printSecFiling(currentWorkingDoc);
  };

  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending_review').length;
  const [showOutline, setShowOutline] = useState(true);
  const [showInspector, setShowInspector] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-16">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 md:px-8 py-3 shadow-xs">
        <div className="max-w-[1750px] w-full mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Title & Document Badge */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/sec-filings')}
              className="h-9 px-2.5 text-xs gap-1.5 font-medium bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 shadow-2xs shrink-0"
              title="Return to SEC Docs Hub"
            >
              <FolderArchive className="w-3.5 h-3.5 text-blue-600" />
              <span>SEC Docs Hub</span>
            </Button>
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-[#0E2841] dark:text-zinc-100">
                  SEC Filing Page Builder & Merge Control
                </h1>
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${
                    activeProposal
                      ? 'border-purple-500 text-purple-600 bg-purple-50/50 dark:bg-purple-950/40'
                      : 'border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                  }`}
                >
                  {activeProposal ? `Proposal Branch: ${activeProposal.title}` : `Main Version: ${mainDoc.version}`}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {mainDoc.symbol} • {mainDoc.formType} • {mainDoc.period} ({mainDoc.currency})
              </p>
            </div>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Invite Contributor / Share Link Button */}
            {activeRole === 'LEAD_CONTROLLER' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1.5 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite Contributor</span>
              </Button>
            )}

            {/* Undo / Redo Controls */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z / ⌘Z)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y / ⌘⇧Z)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Persona Role Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('LEAD_CONTROLLER');
                  toast.info('Switched to Lead Controller persona (Has full Merge authority)');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRole === 'LEAD_CONTROLLER'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                Lead Controller
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole('CONTRIBUTOR');
                  toast.info('Switched to Contributor persona (Drafts & submits change proposals)');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRole === 'CONTRIBUTOR'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                Contributor
              </button>
            </div>

            {/* Branch / Proposal Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
                  <GitBranch className="w-3.5 h-3.5 text-blue-600" />
                  <span className="max-w-[140px] truncate">
                    {activeProposal ? activeProposal.title : 'Main Version'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-1 text-xs">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-500">
                  Select Document Version / Branch
                </div>
                <DropdownMenuItem
                  onClick={() => setActiveProposalId(null)}
                  className={`flex items-center justify-between ${
                    !activeProposalId ? 'bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Main (Live {mainDoc.version})</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-500">
                  Proposed Change Branches ({proposals.length})
                </div>
                {proposals.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setActiveProposalId(p.id)}
                    className={`flex flex-col items-start gap-0.5 py-1.5 ${
                      activeProposalId === p.id
                        ? 'bg-purple-50 dark:bg-purple-950/60 font-bold text-purple-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{p.title}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0">
                        {p.status}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      By {p.author.name}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsNewProposalModalOpen(true)}
                  className="text-blue-600 dark:text-blue-400 font-semibold gap-1.5"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>+ Create New Change Proposal</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Proposal Submit or Merge Control */}
            {activeProposal ? (
              <div className="flex items-center gap-1.5">
                {activeProposal.status === 'merged' ? (
                  <>
                    <Badge className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 text-xs py-1 px-2.5 gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Merged into Main</span>
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleForkProposal(activeProposal.id)}
                      className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-semibold shadow-xs cursor-pointer"
                      title="Start a new revision branch off latest Main"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>New Revision Branch</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsSubmitProposalModalOpen(true)}
                    disabled={activeProposal.status === 'pending_review'}
                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-semibold shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {activeProposal.status === 'pending_review'
                        ? 'Submitted (Under Review)'
                        : 'Submit Final Changes'}
                    </span>
                  </Button>
                )}
              </div>
            ) : null}

            {/* Merge Hub / Review Pending Proposals Button for Lead Controller */}
            {activeRole === 'LEAD_CONTROLLER' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 relative shadow-xs"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Merge Control</span>
                    {pendingProposalsCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-emerald-800 text-[10px] font-bold">
                        {pendingProposalsCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-2 text-xs">
                  <div className="px-2 py-1 font-bold text-slate-800 dark:text-zinc-200">
                    Lead Controller Merge Hub
                  </div>
                  <p className="px-2 pb-2 text-[11px] text-slate-500">
                    Review side-by-side diffs and merge proposals into Main.
                  </p>
                  <DropdownMenuSeparator />
                  {proposals.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">No proposals yet</div>
                  ) : (
                    proposals.map((prop) => (
                      <div
                        key={prop.id}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 space-y-1 mb-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[180px]">
                            {prop.title}
                          </span>
                          <Badge
                            variant={prop.status === 'pending_review' ? 'default' : 'outline'}
                            className="text-[9px] uppercase"
                          >
                            {prop.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span>By {prop.author.name}</span>
                            {prop.submittedAt && (
                              <span className="text-purple-600 dark:text-purple-400 font-mono">
                                • {new Date(prop.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedProposalForReview(prop);
                              setIsMergeModalOpen(true);
                            }}
                            className="h-5 text-[10px] text-blue-600 hover:text-blue-700 p-1"
                          >
                            Inspect & Merge →
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Version History */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(true)}
              className="h-8 text-xs gap-1.5"
              title="View Version Timeline & Restore"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Revisions ({versionHistory.length})</span>
            </Button>

            {/* Media & Image Bucket Library */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMediaBucketOpen(true)}
              className="h-8 text-xs gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 font-medium"
              title="Company Media & Image Bucket (Manage logos & pictures)"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Media Bucket</span>
            </Button>

            {/* Export Dropdown (.docx, .pdf) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 font-semibold"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
                <DropdownMenuItem
                  onClick={handleExportDocx}
                  disabled={isExportingDocx}
                  className="flex items-center gap-2 py-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold">Word Document (.docx)</div>
                    <div className="text-[10px] text-slate-400">SEC formatted Microsoft Word file</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportPdf}
                  className="flex items-center gap-2 py-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-purple-600" />
                  <div>
                    <div className="font-semibold">Print / Export to PDF</div>
                    <div className="text-[10px] text-slate-400">EDGAR-ready printable filing view</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleResetToDefault}
                  className="text-red-600 dark:text-red-400 text-[11px] gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Baseline v22 Copy</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Pending Contributor Submissions Notification Banner for Lead Controller */}
      {pendingProposalsCount > 0 && activeRole === 'LEAD_CONTROLLER' && !activeProposal && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 md:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md border-b border-emerald-500/50 sticky top-[57px] z-36 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 text-white shadow-xs">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold tracking-wide">
                {pendingProposalsCount} Contributor Submission{pendingProposalsCount > 1 ? 's' : ''} Awaiting Review
              </span>
              <span className="text-emerald-100 ml-2 hidden md:inline">
                {proposals
                  .filter((p) => p.status === 'pending_review')
                  .map((p) => `"${p.title}" by ${p.author.name}`)
                  .join(', ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const firstPending = proposals.find((p) => p.status === 'pending_review');
                if (firstPending) {
                  setSelectedProposalForReview(firstPending);
                  setIsMergeModalOpen(true);
                }
              }}
              className="h-7 text-xs bg-white text-emerald-900 hover:bg-emerald-50 font-bold shadow-sm gap-1.5"
            >
              <GitMerge className="w-3.5 h-3.5 text-emerald-700" />
              <span>Review & Merge Changes</span>
            </Button>
          </div>
        </div>
      )}

      {/* Contributor Draft Banner (Active when in Contributor role or editing a proposal) */}
      {(activeRole === 'CONTRIBUTOR' || activeProposal || contributorSession.isContributor) && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-950 text-white px-4 md:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-md border-b border-purple-800/60 sticky top-[57px] z-35">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-1 rounded bg-white/20 text-sm">✍️</span>
            <div>
              <span className="font-bold tracking-wide">
                {activeProposal ? `Contributor Workspace: "${activeProposal.title}"` : 'Contributor Draft Mode'}
              </span>
              <span className="text-purple-200/90 ml-2 hidden md:inline">
                {contributorSession.name
                  ? `Logged in as ${contributorSession.name} (${contributorSession.role || 'Contributor'})`
                  : 'Add or modify blocks. When finished, submit your final review for Main Controller approval.'}
              </span>
            </div>
            {activeProposal && (
              <Badge
                variant="outline"
                className="bg-white/15 text-white border-white/30 text-[10px] uppercase font-mono"
              >
                Status: {activeProposal.status.replace('_', ' ')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeProposal && activeProposal.status !== 'merged' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsSubmitProposalModalOpen(true)}
                disabled={activeProposal.status === 'pending_review'}
                className="h-7 text-xs bg-white hover:bg-white/90 text-purple-950 font-bold shadow-sm gap-1.5"
              >
                <Send className="w-3 h-3 text-purple-700" />
                <span>
                  {activeProposal.status === 'pending_review'
                    ? 'Final Draft Submitted'
                    : 'Submit Final Review'}
                </span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Secondary Search & Sidebar Toggle Subbar */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-zinc-800 px-4 md:px-8 py-2 sticky top-[57px] z-30 shadow-xs">
        <div className="max-w-[1750px] w-full mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            {/* Outline Toggle Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowOutline(!showOutline)}
              className={`h-8 text-xs gap-1.5 ${
                showOutline ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-200' : 'text-slate-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Headings Pane</span>
            </Button>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search statements, line items, and notes..."
                className="pl-8 h-8 text-xs bg-slate-50 dark:bg-zinc-800/70 border-slate-200 dark:border-zinc-700"
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-3">
            <span>
              Showing <strong>{filteredBlocks.length}</strong> of <strong>{workingBlocks.length}</strong> blocks
            </span>
            {activeDiffs.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                {activeDiffs.filter((d) => d.status !== 'unchanged').length} Changes in Branch
              </Badge>
            )}

            {/* Inspector Toggle Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowInspector(!showInspector)}
              className={`h-8 text-xs gap-1.5 ${
                showInspector ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 border-purple-200' : 'text-slate-600'
              }`}
            >
              <span>Format Pane</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Expansive Center Workspace */}
      <main className="w-full max-w-full mx-auto px-2 sm:px-4 md:px-6 py-4 flex gap-4 lg:gap-6 items-start justify-center">
        {/* Left Column: Word Headings Outline Pane (Collapsible, Full Height) */}
        {showOutline && (
          <div className="w-64 shrink-0 sticky top-28 h-[calc(100vh-16rem)] max-h-[calc(100vh-16rem)] min-h-[340px] flex flex-col">
            <DocumentOutline
              sections={documentSections}
              activeSection={sectionFilter}
              onSelectSection={handleSelectSection}
              totalBlocks={workingBlocks.length}
              sectionCounts={sectionCounts}
              onMoveSection={moveSection}
              onReorderSection={reorderSection}
              onCreateSection={createSection}
              className="h-full flex-1"
            />
          </div>
        )}

        {/* Center Column: Prominent Word Document Sheet */}
        <div className="flex-1 w-full min-w-0">
          <BlockBuilder
            tableTemplates={tableTemplates}
            blocks={workingBlocks}
            filteredBlocks={filteredBlocks}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            onSelectBlock={(id) => {
              setSelectedBlockId(id);
            }}
            onToggleBlockSelection={toggleBlockSelection}
            onSelectAllBlocks={selectAllBlocks}
            onClearSelection={clearBlockSelection}
            onAddBlock={(index, type, customBlock) =>
              addBlock(index, type, sectionFilter !== 'ALL' ? sectionFilter : undefined, customBlock)
            }
            onUpdateBlock={updateBlock}
            onMoveBlock={moveBlock}
            onMoveMultipleBlocks={moveMultipleBlocks}
            onDuplicateBlock={duplicateBlock}
            onDuplicateMultipleBlocks={duplicateMultipleBlocks}
            onDeleteBlock={deleteBlock}
            onDeleteMultipleBlocks={deleteMultipleBlocks}
            onMoveMultipleBlocksToSection={moveMultipleBlocksToSection}
            onUpdateMultipleBlocksSpacing={updateMultipleBlocksSpacing}
            documentSections={documentSections}
            diffs={activeDiffs}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
          />
        </div>

        {/* Right Column: Block Format & Inspector Pane (Collapsible) */}
        {showInspector && (
          <div className="w-72 shrink-0 sticky top-28 space-y-4">
            <BlockInspector
              block={selectedBlock}
              onUpdate={(updates) => selectedBlockId && updateBlock(selectedBlockId, updates)}
              onClose={() => setShowInspector(false)}
              sections={documentSections}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <MergeReviewModal
        open={isMergeModalOpen}
        onOpenChange={setIsMergeModalOpen}
        proposal={selectedProposalForReview || activeProposal}
        mainDoc={mainDoc}
        diffs={
          selectedProposalForReview
            ? calculateDiffForProposal(selectedProposalForReview)
            : activeDiffs
        }
        isLeadController={activeRole === 'LEAD_CONTROLLER'}
        onMerge={handleMergeProposal}
        onMergeSelective={handleSelectiveMerge}
        onReject={handleRejectProposal}
      />

      <VersionHistoryModal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        history={versionHistory}
        currentVersion={mainDoc.version}
        onRestore={handleRestoreVersion}
        isLeadController={activeRole === 'LEAD_CONTROLLER'}
      />

      <NewProposalModal
        open={isNewProposalModalOpen}
        onOpenChange={setIsNewProposalModalOpen}
        onCreate={(title, desc) => handleCreateProposal(title, desc)}
        baseVersion={mainDoc.version}
      />

      <ContributorInviteModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        mainDoc={mainDoc}
        proposals={proposals}
        documentSections={documentSections}
        onCreateInvite={handleCreateContributorInvite}
        onOpenProposal={(id) => {
          setActiveProposalId(id);
          setActiveRole('CONTRIBUTOR');
        }}
        onForkProposal={handleForkProposal}
      />

      <SubmitProposalModal
        open={isSubmitProposalModalOpen}
        onOpenChange={setIsSubmitProposalModalOpen}
        proposal={activeProposal}
        diffs={activeDiffs}
        onSubmit={handleSubmitForReview}
      />

      <MediaBucketModal
        isOpen={isMediaBucketOpen}
        onClose={() => setIsMediaBucketOpen(false)}
      />
    </div>
  );
}
