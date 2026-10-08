import React, { useState, useEffect, useMemo } from 'react';
import {
  GitMerge,
  Clock,
  GitPullRequest,
  X,
  MessageSquare,
  ShieldCheck,
  Check,
  FileText,
  Columns,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCheck,
  Maximize2,
  ChevronDown,
  Layers,
  Zap,
  MoveVertical,
  Type,
  Table,
  FolderTree,
  Edit3,
  Plus,
  Trash2,
  Eye
} from 'lucide-react';
import type {
  SecChangeProposal,
  SecFilingDocument,
  SecBlockDiff,
  SecTableCellDiff,
  SecBlock,
  SecHeadingBlock,
  SecParagraphBlock,
  SecFinancialTableBlock,
  SecCalloutBlock,
  SecSignatureBlock,
  SecDividerBlock,
  SecMetadataBlock,
  SecImageBlock,
  AttachedSpreadsheet
} from '../../../types/secFiling';
import { ZENATECH_LOGO_DATA_URL } from '../../../data/zenatechLogoAsset';
import { paginateBlocks } from '../../../utils/secFilingPagination';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../../../components/ui/dropdown-menu';
import { computeSpreadsheetDiffs } from '../../../utils/documentVariables';
import { AttachedSpreadsheetModal } from './AttachedSpreadsheetModal';
import { DocumentVariableRenderer } from './DocumentVariableRenderer';
import { EmbeddedSpreadsheetDiffViewer } from './EmbeddedSpreadsheetDiffViewer';
import { secFilingService } from '../../../services/secFilingService';

function formatSubmissionTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

const sanitizeTableCells = (cells: string[]): string[] => {
  const result = [...cells];
  for (let i = 0; i < result.length - 1; i++) {
    const c = (result[i] || '').trim();
    const nextC = (result[i + 1] || '').trim();
    if (c.startsWith('(') && !c.endsWith(')') && nextC === ')') {
      result[i] = `${c})`;
      result[i + 1] = '';
    } else if (c.startsWith('(') && !c.endsWith(')') && !result.slice(i).some((x) => x.includes(')'))) {
      result[i] = `${c})`;
    }
  }
  if (result.length > 0) {
    const last = (result[result.length - 1] || '').trim();
    if (last.startsWith('(') && !last.endsWith(')')) {
      result[result.length - 1] = `${last})`;
    }
  }
  return result;
};

const isComparativeDateHeaderCell = (text: string, rowIndex: number, _colIndex?: number): boolean => {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  if (/^As of$/i.test(trimmed)) return true;
  if (/^Notes?(\s*Ref)?$/i.test(trimmed)) return true;
  if (/^(Three|Six|Nine|Twelve)\s+months\s+ended/i.test(trimmed)) return true;
  if (/^Six\s+months\s+20\d\d/i.test(trimmed)) return true;
  if (/^(Q[1-4]|FY)\s*20\d\d/i.test(trimmed)) return true;
  if (
    rowIndex <= 3 &&
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?(\s+\d{4})?(\s+in\s+[$a-zA-Z]+)?$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (rowIndex <= 3 && /^(19|20)\d{2}(\s+in\s+[$a-zA-Z]+)?$/.test(trimmed)) {
    return true;
  }
  return false;
};

interface MergeReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: SecChangeProposal | null;
  mainDoc: SecFilingDocument;
  diffs: SecBlockDiff[];
  isLeadController: boolean;
  onMerge: (proposalId: string, notes?: string) => void;
  onMergeSelective?: (proposalId: string, acceptedBlockIds: string[], notes?: string) => void;
  onReject: (proposalId: string, notes: string) => void;
}


/* ------------------------------------------------------------------------- */
/* GRANULAR CHANGE TYPE BADGES COMPONENT                                      */
/* Clearly highlights if a change is Spacing, Font/Style, Text, or Table     */
/* ------------------------------------------------------------------------- */
export const ChangeTypeBadges: React.FC<{ diff?: SecBlockDiff }> = ({ diff }) => {
  if (!diff || diff.status === 'unchanged') return null;

  if (diff.status === 'added') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 shadow-2xs">
        <Plus className="w-3 h-3 text-emerald-600" />
        <span>New Block Added</span>
      </span>
    );
  }

  if (diff.status === 'deleted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 shadow-2xs">
        <Trash2 className="w-3 h-3 text-red-600" />
        <span>Block Deleted</span>
      </span>
    );
  }

  // Modified: inspect exact categories
  const tags = diff.changeTags || [];

  return (
    <div className="flex flex-wrap items-center gap-1.5 font-sans">
      {/* Quick Summary Pill for exclusive spacing or styling */}
      {diff.isSpacingOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-200 border border-cyan-300 shadow-2xs">
          <MoveVertical className="w-3 h-3 text-cyan-600" />
          <span>Spacing Change Only</span>
        </span>
      )}

      {diff.isTypographyOnly && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border border-purple-300 shadow-2xs">
          <Type className="w-3 h-3 text-purple-600" />
          <span>Font / Style Only</span>
        </span>
      )}

      {/* Individual Breakdown Tags */}
      {tags.map((tag, idx) => {
        let badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
        let IconComponent = Edit3;

        if (tag.category === 'spacing') {
          badgeColor = 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 border-cyan-300 font-semibold';
          IconComponent = MoveVertical;
        } else if (tag.category === 'typography') {
          badgeColor = 'bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border-purple-300 font-semibold';
          IconComponent = Type;
        } else if (tag.category === 'content') {
          badgeColor = 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-300 font-semibold';
          IconComponent = FileText;
        } else if (tag.category === 'financial_data') {
          badgeColor = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 font-semibold';
          IconComponent = Table;
        } else if (tag.category === 'structure') {
          badgeColor = 'bg-orange-50 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 border-orange-300 font-semibold';
          IconComponent = FolderTree;
        }

        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${badgeColor}`}
            title={tag.detail || tag.label}
          >
            <IconComponent className="w-2.5 h-2.5 shrink-0 opacity-80" />
            <span>{tag.label}</span>
          </span>
        );
      })}
    </div>
  );
};


export const MergeReviewModal: React.FC<MergeReviewModalProps> = ({
  open,
  onOpenChange,
  proposal,
  mainDoc,
  diffs,
  isLeadController,
  onMerge,
  onMergeSelective,
  onReject
}) => {
  const [reviewNotes, setReviewNotes] = useState('');
  const [viewMode, setViewMode] = useState<
    'doc-track-changes' | 'side-by-side-sheets' | 'summary-cards' | 'spreadsheet-diffs'
  >('doc-track-changes');
  const [docWidth, setDocWidth] = useState<'wide' | 'full' | 'standard'>('wide');
  const [wordDisplayMode, setWordDisplayMode] = useState<'markup' | 'merged-preview' | 'live-original'>('markup');
  const [acceptedBlockIds, setAcceptedBlockIds] = useState<string[]>([]);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [activeDiffIndex, setActiveDiffIndex] = useState<number>(0);
  const [isSpreadsheetPreviewOpen, setIsSpreadsheetPreviewOpen] = useState<boolean>(false);
  const [targetSpreadsheetCell, setTargetSpreadsheetCell] = useState<string | undefined>(undefined);
  const [targetSpreadsheetTab, setTargetSpreadsheetTab] = useState<string | undefined>(undefined);

  const proposalSpreadsheet = proposal?.attachedSpreadsheet || mainDoc.attachedSpreadsheet;
  const mainSpreadsheet = mainDoc.attachedSpreadsheet;

  const handleOpenSpreadsheetToCell = (cellRef?: string, tabName?: string) => {
    setTargetSpreadsheetCell(cellRef);
    setTargetSpreadsheetTab(tabName);
    setIsSpreadsheetPreviewOpen(true);
  };

  const changedDiffs = useMemo(() => diffs.filter((d) => d.status !== 'unchanged'), [diffs]);

  const spreadsheetDiffs = useMemo(() => {
    if (!proposal) return [];
    const effectiveBase =
      mainDoc.attachedSpreadsheet ||
      secFilingService.getAttachedSpreadsheet(mainDoc.id);

    const effectiveProp =
      proposal.attachedSpreadsheet ||
      (proposal.id ? secFilingService.getProposals().find((p) => p.id === proposal.id)?.attachedSpreadsheet : null) ||
      effectiveBase;

    return computeSpreadsheetDiffs(
      effectiveBase,
      effectiveProp,
      proposal.blocks || []
    );
  }, [mainDoc, proposal]);

  // If there are spreadsheet changes and no document text changes, default to spreadsheet diffs view
  useEffect(() => {
    if (open) {
      if (changedDiffs.length === 0 && spreadsheetDiffs.length > 0) {
        setViewMode('spreadsheet-diffs');
      } else {
        setViewMode('doc-track-changes');
      }
    }
  }, [open, changedDiffs.length, spreadsheetDiffs.length]);

  const totalChangesCount = changedDiffs.length + spreadsheetDiffs.length;
  const totalSelectedCount = acceptedBlockIds.length + (spreadsheetDiffs.length > 0 ? spreadsheetDiffs.length : 0);

  const spacingChangeCount = useMemo(
    () => changedDiffs.filter((d) => d.changeCategories?.includes('spacing')).length,
    [changedDiffs]
  );
  const typographyChangeCount = useMemo(
    () => changedDiffs.filter((d) => d.changeCategories?.includes('typography')).length,
    [changedDiffs]
  );
  const contentChangeCount = useMemo(
    () => changedDiffs.filter((d) => d.changeCategories?.includes('content')).length,
    [changedDiffs]
  );
  const tableChangeCount = useMemo(
    () => changedDiffs.filter((d) => d.changeCategories?.includes('financial_data')).length,
    [changedDiffs]
  );

  const sheetWidthClass =
    docWidth === 'full'
      ? 'w-full max-w-none'
      : docWidth === 'wide'
      ? 'w-full max-w-[1380px] xl:max-w-[1440px]'
      : 'w-full max-w-[960px]';

  // Construct the unified full document block list preserving Live Main Document backbone and order
  const unifiedDocBlocks = useMemo(() => {
    if (!proposal) return [];

    const result: { blockId: string; diff: SecBlockDiff; block: SecBlock }[] = [];
    const diffMap = new Map<string, SecBlockDiff>(diffs.map((d) => [d.blockId, d]));
    const handledBlockIds = new Set<string>();

    // Map each proposed added block to the block that precedes it in proposal.blocks
    const addedBlocksAfterMap = new Map<string, { blockId: string; diff: SecBlockDiff; block: SecBlock }[]>();
    const leadingAddedBlocks: { blockId: string; diff: SecBlockDiff; block: SecBlock }[] = [];

    let prevProposedBlockId: string | null = null;
    for (const pBlock of proposal.blocks) {
      const diff = diffMap.get(pBlock.id);
      if (diff && diff.status === 'added') {
        const item = { blockId: pBlock.id, diff, block: pBlock };
        handledBlockIds.add(pBlock.id);
        if (prevProposedBlockId) {
          if (!addedBlocksAfterMap.has(prevProposedBlockId)) {
            addedBlocksAfterMap.set(prevProposedBlockId, []);
          }
          addedBlocksAfterMap.get(prevProposedBlockId)!.push(item);
        } else {
          leadingAddedBlocks.push(item);
        }
      } else {
        prevProposedBlockId = pBlock.id;
      }
    }

    // 1. Insert any leading added blocks at the start
    result.push(...leadingAddedBlocks);

    // 2. Iterate through Live Main Document blocks to preserve Live order and all Live content
    for (const mainBlock of mainDoc.blocks) {
      const diff = diffMap.get(mainBlock.id) || {
        blockId: mainBlock.id,
        status: 'unchanged' as const,
        originalBlock: mainBlock,
        proposedBlock: mainBlock
      };
      handledBlockIds.add(mainBlock.id);

      // Add the block (original live block or modified/deleted diff)
      result.push({
        blockId: mainBlock.id,
        diff,
        block: mainBlock
      });

      // If any proposed added blocks were placed after this block, insert them here
      if (addedBlocksAfterMap.has(mainBlock.id)) {
        result.push(...addedBlocksAfterMap.get(mainBlock.id)!);
      }
    }

    // 3. Safety fallback: any remaining diffs not yet added
    for (const diff of diffs) {
      if (!handledBlockIds.has(diff.blockId)) {
        const block = diff.proposedBlock || diff.originalBlock;
        if (block) {
          result.push({ blockId: diff.blockId, diff, block });
        }
      }
    }

    return result;
  }, [diffs, proposal, mainDoc.blocks]);

  // Extract all sections and aggregate their change statistics
  const sectionStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        section: string;
        totalBlocks: number;
        changedCount: number;
        addedCount: number;
        modifiedCount: number;
        deletedCount: number;
      }
    >();

    unifiedDocBlocks.forEach((item) => {
      const sec = item.block.section || 'General Disclosures';
      if (!statsMap.has(sec)) {
        statsMap.set(sec, {
          section: sec,
          totalBlocks: 0,
          changedCount: 0,
          addedCount: 0,
          modifiedCount: 0,
          deletedCount: 0
        });
      }
      const entry = statsMap.get(sec)!;
      entry.totalBlocks += 1;
      if (item.diff.status === 'added') {
        entry.changedCount += 1;
        entry.addedCount += 1;
      } else if (item.diff.status === 'modified') {
        entry.changedCount += 1;
        entry.modifiedCount += 1;
      } else if (item.diff.status === 'deleted') {
        entry.changedCount += 1;
        entry.deletedCount += 1;
      }
    });

    return Array.from(statsMap.values());
  }, [unifiedDocBlocks]);

  // Filtered unified doc blocks
  const filteredUnifiedBlocks = useMemo(() => {
    if (selectedSectionFilter === 'ALL') return unifiedDocBlocks;
    if (selectedSectionFilter === 'ONLY_CHANGED') {
      const changedSectionsSet = new Set(
        sectionStats.filter((s) => s.changedCount > 0).map((s) => s.section)
      );
      return unifiedDocBlocks.filter((item) => changedSectionsSet.has(item.block.section));
    }
    return unifiedDocBlocks.filter((item) => item.block.section === selectedSectionFilter);
  }, [unifiedDocBlocks, selectedSectionFilter, sectionStats]);

  // Paginated Document Pages (full white sheet background)
  const paginatedPages = useMemo(() => {
    if (!filteredUnifiedBlocks || filteredUnifiedBlocks.length === 0) return [];
    const blockList = filteredUnifiedBlocks.map((item) => item.block);
    const rawPages = paginateBlocks(blockList);
    const itemMap = new Map(filteredUnifiedBlocks.map((item) => [item.blockId, item]));

    return rawPages.map((p) => ({
      pageNumber: p.pageNumber,
      items: p.blocks.map((b) => itemMap.get(b.id)).filter(Boolean) as typeof filteredUnifiedBlocks
    }));
  }, [filteredUnifiedBlocks]);

  // Clean Merged Live Document Preview Blocks (with accepted changes applied, 0 diff clutter)
  const mergedLiveBlocks = useMemo(() => {
    if (!proposal) return mainDoc.blocks;
    const blocks: SecBlock[] = [];
    for (const item of filteredUnifiedBlocks) {
      const isAccepted = acceptedBlockIds.includes(item.blockId);
      if (item.diff.status === 'unchanged') {
        blocks.push(item.block);
      } else if (item.diff.status === 'added') {
        if (isAccepted && item.diff.proposedBlock) {
          blocks.push(item.diff.proposedBlock);
        }
      } else if (item.diff.status === 'modified') {
        if (isAccepted && item.diff.proposedBlock) {
          blocks.push(item.diff.proposedBlock);
        } else if (item.diff.originalBlock) {
          blocks.push(item.diff.originalBlock);
        }
      } else if (item.diff.status === 'deleted') {
        if (!isAccepted && item.diff.originalBlock) {
          blocks.push(item.diff.originalBlock);
        }
      }
    }
    return blocks;
  }, [filteredUnifiedBlocks, acceptedBlockIds, proposal, mainDoc.blocks]);

  const mergedLivePages = useMemo(() => {
    return paginateBlocks(mergedLiveBlocks);
  }, [mergedLiveBlocks]);

  // Current Live Main Document Pages
  const originalLivePages = useMemo(() => {
    const origBlocks = selectedSectionFilter === 'ALL'
      ? mainDoc.blocks
      : mainDoc.blocks.filter((b) => b.section === selectedSectionFilter);
    return paginateBlocks(origBlocks);
  }, [mainDoc.blocks, selectedSectionFilter]);

  // Synchronized Side-by-Side Aligned Rows (so Right document spaces out to match Left document row-for-row)
  const sideBySideAlignedRows = useMemo(() => {
    if (!proposal) return [];
    const proposalBlockIds = new Set(proposal.blocks.map((b) => b.id));

    return filteredUnifiedBlocks.map((item) => {
      const { blockId, diff } = item;

      let leftBlock: SecBlock | null = null;
      let rightBlock: SecBlock | null = null;

      if (diff.status === 'unchanged') {
        leftBlock = diff.originalBlock || item.block;
        // If block exists in proposal blocks, render on right; otherwise right gets blank spacer
        if (diff.proposedBlock) {
          rightBlock = diff.proposedBlock;
        } else if (diff.originalBlock && proposalBlockIds.has(diff.originalBlock.id)) {
          rightBlock = diff.originalBlock;
        } else {
          rightBlock = null; // Preserved in Live Main, right side gets spacer!
        }
      } else if (diff.status === 'modified') {
        leftBlock = diff.originalBlock || null;
        rightBlock = diff.proposedBlock || null;
      } else if (diff.status === 'added') {
        leftBlock = null;
        rightBlock = diff.proposedBlock || null;
      } else if (diff.status === 'deleted') {
        leftBlock = diff.originalBlock || null;
        rightBlock = null;
      }

      return {
        blockId,
        diff,
        leftBlock,
        rightBlock
      };
    });
  }, [filteredUnifiedBlocks, proposal]);

  // Selected section stat object
  const currentSectionStat = useMemo(() => {
    if (selectedSectionFilter === 'ALL' || selectedSectionFilter === 'ONLY_CHANGED') return null;
    return sectionStats.find((s) => s.section === selectedSectionFilter);
  }, [sectionStats, selectedSectionFilter]);

  // Initialize accepted block IDs whenever proposal or diffs change
  useEffect(() => {
    if (proposal && diffs.length > 0) {
      setAcceptedBlockIds(changedDiffs.map((d) => d.blockId));
    }
  }, [proposal, diffs, changedDiffs]);

  if (!proposal) return null;

  const toggleDiffAcceptance = (blockId: string) => {
    setAcceptedBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]
    );
  };

  const handleSelectAll = () => {
    setAcceptedBlockIds(changedDiffs.map((d) => d.blockId));
  };

  const handleDeselectAll = () => {
    setAcceptedBlockIds([]);
  };

  const handleConfirmMergeSelected = () => {
    if (acceptedBlockIds.length === 0 && spreadsheetDiffs.length === 0) {
      alert('Please select at least one change to confirm and merge.');
      return;
    }
    if (onMergeSelective) {
      onMergeSelective(proposal.id, acceptedBlockIds, reviewNotes);
    } else {
      onMerge(proposal.id, reviewNotes);
    }
    onOpenChange(false);
  };

  const handleApproveAndMergeAll = () => {
    const allIds = changedDiffs.map((d) => d.blockId);
    if (onMergeSelective) {
      onMergeSelective(proposal.id, allIds, reviewNotes);
    } else {
      onMerge(proposal.id, reviewNotes);
    }
    onOpenChange(false);
  };

  const handleRejectClick = () => {
    const reason = reviewNotes.trim() || 'Declined by Lead Controller during review.';
    onReject(proposal.id, reason);
    onOpenChange(false);
  };

  const scrollToDiff = (diffIdx: number) => {
    if (changedDiffs.length === 0) return;
    const targetIdx = (diffIdx + changedDiffs.length) % changedDiffs.length;
    setActiveDiffIndex(targetIdx);
    const targetDiff = changedDiffs[targetIdx];
    if (targetDiff) {
      const el = document.getElementById(`diff-block-${targetDiff.blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 shadow-2xl transition-all !max-w-[98vw] !w-[98vw] !h-[96vh] sm:!max-w-[98vw] sm:!w-[98vw] sm:!h-[96vh] max-w-[98vw] sm:max-w-[98vw] w-[98vw] sm:w-[98vw] h-[96vh] sm:h-[96vh]"
      >
        <DialogTitle className="sr-only">Merge Review & Controller Authority</DialogTitle>

        {/* Modal Header Strip */}
        <div className="px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  {proposal.title}
                </h3>
                <Badge
                  variant={proposal.status === 'pending_review' ? 'default' : 'outline'}
                  className={
                    proposal.status === 'pending_review'
                      ? 'bg-amber-600 text-white hover:bg-amber-600'
                      : ''
                  }
                >
                  {proposal.status === 'pending_review' ? 'Ready for Controller Merge' : proposal.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                <span>
                  Contributor: <strong className="text-slate-700 dark:text-zinc-200">{proposal.author.name}</strong> ({proposal.author.role})
                </span>
                <span>•</span>
                <span>Base: {proposal.baseVersion}</span>
                {proposal.submittedAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-mono font-medium">
                      <Clock className="w-3 h-3" />
                      Submitted {formatRelativeTime(proposal.submittedAt)} ({formatSubmissionTime(proposal.submittedAt)})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* View Mode & Selective Cherry-Pick Controls Ribbon */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Left: Cherry-Pick Status & Quick Select All / Deselect All */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700 font-medium">
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-700 dark:text-zinc-300">
                Selected for Merge: <strong className="text-blue-700 dark:text-blue-400">
                  {totalSelectedCount} of {totalChangesCount}
                </strong> changes
                {spreadsheetDiffs.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({acceptedBlockIds.length} doc blocks, {spreadsheetDiffs.length} spreadsheet cells)
                  </span>
                )}
              </span>
            </div>

            {changedDiffs.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 rounded bg-white dark:bg-zinc-800 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 border border-slate-200 dark:border-zinc-700 cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-1 rounded bg-white dark:bg-zinc-800 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 dark:border-zinc-700 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            )}

            {/* Change Categories Breakdown Pill */}
            {(changedDiffs.length > 0 || spreadsheetDiffs.length > 0) && (
              <div className="hidden xl:flex items-center gap-1.5 text-[11px] bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
                <span className="text-slate-500 font-sans font-medium text-[11px]">Types:</span>
                {contentChangeCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200 text-[10px]">
                    <FileText className="w-2.5 h-2.5 text-blue-600" />
                    {contentChangeCount} Text
                  </span>
                )}
                {spacingChangeCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 font-semibold border border-cyan-200 text-[10px]">
                    <MoveVertical className="w-2.5 h-2.5 text-cyan-600" />
                    {spacingChangeCount} Spacing
                  </span>
                )}
                {typographyChangeCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 font-semibold border border-purple-200 text-[10px]">
                    <Type className="w-2.5 h-2.5 text-purple-600" />
                    {typographyChangeCount} Font/Style
                  </span>
                )}
                {tableChangeCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 text-[10px]">
                    <Table className="w-2.5 h-2.5 text-emerald-600" />
                    {tableChangeCount} Table
                  </span>
                )}
                {spreadsheetDiffs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode('spreadsheet-diffs')}
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 font-bold border border-amber-300 text-[10px] cursor-pointer hover:bg-amber-200 transition-colors"
                    title="View Spreadsheet Cell Diffs"
                  >
                    <Table className="w-2.5 h-2.5 text-amber-600" />
                    {spreadsheetDiffs.length} Excel Cells
                  </button>
                )}
              </div>
            )}

            {/* Jump to Next/Prev Change buttons */}
            {changedDiffs.length > 0 && (
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                <span className="text-[11px] text-slate-500 font-medium pl-1">Jump:</span>
                <button
                  type="button"
                  onClick={() => scrollToDiff(activeDiffIndex - 1)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-600 dark:text-zinc-300 cursor-pointer"
                  title="Previous Change"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold text-blue-600">
                  {activeDiffIndex + 1}/{changedDiffs.length}
                </span>
                <button
                  type="button"
                  onClick={() => scrollToDiff(activeDiffIndex + 1)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded text-slate-600 dark:text-zinc-300 cursor-pointer"
                  title="Next Change"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Rich Colorized Section Filter, Width Switcher, View Mode Switcher */}
          <div className="flex items-center gap-2">
            {/* Document Live Mode vs Track Changes Sub-Mode Switcher */}
            {viewMode === 'doc-track-changes' && (
              <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700 text-xs">
                <button
                  type="button"
                  onClick={() => setWordDisplayMode('markup')}
                  className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    wordDisplayMode === 'markup'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                  title="View inline track changes markup and accept toggles"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Track Changes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWordDisplayMode('merged-preview')}
                  className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    wordDisplayMode === 'merged-preview'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                  title="Preview clean Live Document with accepted changes applied"
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview Live Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWordDisplayMode('live-original')}
                  className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    wordDisplayMode === 'live-original'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                  title="View current Live Main document before merge"
                >
                  <FileText className="w-3 h-3" />
                  <span>Current Live</span>
                </button>
              </div>
            )}
            {/* Document Canvas Width Switcher */}
            {viewMode === 'doc-track-changes' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 font-medium cursor-pointer"
                    title="Change Document Sheet Width"
                  >
                    <Maximize2 className="w-3 h-3 text-blue-600" />
                    <span className="capitalize">
                      {docWidth === 'wide' ? 'Wide (1380px)' : docWidth === 'full' ? 'Full Screen' : 'Letter (960px)'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1 text-xs">
                  <div className="px-2 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                    Document Width
                  </div>
                  <DropdownMenuItem
                    onClick={() => setDocWidth('wide')}
                    className={`py-1.5 cursor-pointer ${docWidth === 'wide' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''}`}
                  >
                    <span>Wide Screen (1380px)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDocWidth('full')}
                    className={`py-1.5 cursor-pointer ${docWidth === 'full' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''}`}
                  >
                    <span>Full Screen (100% Fluid)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDocWidth('standard')}
                    className={`py-1.5 cursor-pointer ${docWidth === 'standard' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''}`}
                  >
                    <span>Standard Letter (960px)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* COLORIZED SECTION FILTER DROPDOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                    selectedSectionFilter === 'ONLY_CHANGED'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                      : currentSectionStat && currentSectionStat.changedCount > 0
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200'
                  }`}
                >
                  <Filter className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[200px]">
                    {selectedSectionFilter === 'ALL'
                      ? `All Sections (${unifiedDocBlocks.length} blocks)`
                      : selectedSectionFilter === 'ONLY_CHANGED'
                      ? '⚡ Changed Sections Only'
                      : selectedSectionFilter}
                  </span>

                  {/* If section has changes, show vibrant amber pill */}
                  {selectedSectionFilter === 'ALL' && changedDiffs.length > 0 ? (
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-300">
                      {changedDiffs.length} changes
                    </span>
                  ) : currentSectionStat && currentSectionStat.changedCount > 0 ? (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {currentSectionStat.changedCount} changes
                    </span>
                  ) : null}

                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto p-1.5 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Document Sections</span>
                  <span className="text-amber-600 font-mono font-bold">
                    {changedDiffs.length} Changes in Proposal
                  </span>
                </div>

                {/* Option: All Sections */}
                <DropdownMenuItem
                  onClick={() => setSelectedSectionFilter('ALL')}
                  className={`flex items-center justify-between py-1.5 px-2 cursor-pointer rounded-md ${
                    selectedSectionFilter === 'ALL'
                      ? 'bg-blue-50 dark:bg-blue-950/50 font-bold text-blue-700 dark:text-blue-400'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>All Document Sections</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {unifiedDocBlocks.length} blocks
                  </span>
                </DropdownMenuItem>

                {/* Option: Only Changed Sections */}
                {changedDiffs.length > 0 && (
                  <DropdownMenuItem
                    onClick={() => setSelectedSectionFilter('ONLY_CHANGED')}
                    className={`flex items-center justify-between py-1.5 px-2 cursor-pointer rounded-md my-0.5 ${
                      selectedSectionFilter === 'ONLY_CHANGED'
                        ? 'bg-amber-100 dark:bg-amber-950 font-bold text-amber-900 dark:text-amber-200 border border-amber-300'
                        : 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 dark:text-amber-300 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>⚡ Only Sections with Changes</span>
                    </div>
                    <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0">
                      {changedDiffs.length}
                    </Badge>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-1" />

                {/* List of All Sections with Colorized Badges */}
                <div className="space-y-0.5">
                  {sectionStats.map((stat) => {
                    const hasChanges = stat.changedCount > 0;
                    const isSelected = selectedSectionFilter === stat.section;

                    return (
                      <DropdownMenuItem
                        key={stat.section}
                        onClick={() => setSelectedSectionFilter(stat.section)}
                        className={`flex items-center justify-between py-1.5 px-2 cursor-pointer rounded-md transition-colors ${
                          isSelected
                            ? 'bg-blue-100/90 dark:bg-blue-950/90 font-bold text-blue-900 dark:text-blue-200 border border-blue-300'
                            : hasChanges
                            ? 'bg-amber-50/80 hover:bg-amber-100 text-amber-950 dark:text-amber-200 font-semibold border-l-2 border-amber-500'
                            : 'hover:bg-slate-100 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                          {hasChanges && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                          <span className="truncate">{stat.section}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {hasChanges ? (
                            <div className="flex items-center gap-1">
                              {stat.modifiedCount > 0 && (
                                <span className="text-[9px] font-mono font-bold bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                                  ~{stat.modifiedCount}
                                </span>
                              )}
                              {stat.addedCount > 0 && (
                                <span className="text-[9px] font-mono font-bold bg-emerald-200/90 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300">
                                  +{stat.addedCount}
                                </span>
                              )}
                              {stat.deletedCount > 0 && (
                                <span className="text-[9px] font-mono font-bold bg-red-200/90 text-red-900 px-1.5 py-0.2 rounded border border-red-300">
                                  -{stat.deletedCount}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {stat.totalBlocks} blks
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle (Document View vs Side-by-Side vs Block Mode) */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode('doc-track-changes')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'doc-track-changes'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="Full Word Document Track Changes View"
              >
                <FileText className="w-3 h-3" />
                <span>Word View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('side-by-side-sheets')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'side-by-side-sheets'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="Dual Sheets Side-by-Side Comparison"
              >
                <Columns className="w-3 h-3" />
                <span>Side-by-Side</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('summary-cards')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'summary-cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="Block Mode Diff Cards"
              >
                <Columns className="w-3 h-3" />
                <span>Block Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('spreadsheet-diffs')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'spreadsheet-diffs'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="Inspect Spreadsheet & Financial Model Cell Changes"
              >
                <Table className="w-3 h-3 text-emerald-500" />
                <span>Spreadsheet Changes</span>
                {spreadsheetDiffs.length > 0 && (
                  <Badge
                    className={`text-[9px] px-1 py-0 font-mono font-bold ${
                      viewMode === 'spreadsheet-diffs'
                        ? 'bg-white text-emerald-800'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {spreadsheetDiffs.length}
                  </Badge>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Review Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 bg-slate-200/60 dark:bg-zinc-950/80 flex flex-col items-center">
          {changedDiffs.length === 0 ? (
            <div className="my-auto py-12 text-center text-slate-500 text-sm bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-slate-300 dark:border-zinc-800 shadow-md">
              <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 dark:text-zinc-100">No Differences Found</h4>
              <p className="text-xs text-slate-500 mt-1">
                The proposed changes are identical to the current Main document version.
              </p>
            </div>
          ) : viewMode === 'doc-track-changes' ? (
            /* ========================================================================= */
            /* 1. PAGINATED DOCUMENT VIEW   */
            /* ========================================================================= */
            <div className="w-full flex flex-col items-center space-y-8">
              {/* Preview Live Banner if in Merged Preview or Original Mode */}
              {wordDisplayMode === 'merged-preview' && (
                <div className={`${sheetWidthClass} bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-xs`}>
                  <div className="flex items-center gap-2 font-medium">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>
                      <strong>Resulting Live Document Preview:</strong> Showing how the finalized document will appear with <strong>{acceptedBlockIds.length}</strong> accepted change(s) applied.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWordDisplayMode('markup')}
                    className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 hover:bg-emerald-100 cursor-pointer shadow-2xs"
                  >
                    Return to Track Changes
                  </button>
                </div>
              )}

              {wordDisplayMode === 'live-original' && (
                <div className={`${sheetWidthClass} bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 px-4 py-2.5 rounded-lg flex items-center justify-between text-xs shadow-xs`}>
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>
                      <strong>Current Live Main Document (v{mainDoc.versionNumber}):</strong> Showing active base document prior to proposal merge.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWordDisplayMode('markup')}
                    className="px-2.5 py-1 rounded bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold border border-slate-300 hover:bg-slate-200 cursor-pointer shadow-2xs"
                  >
                    Return to Track Changes
                  </button>
                </div>
              )}

              {wordDisplayMode === 'merged-preview' ? (
                /* Pure Clean Post-Merge Live Preview Pages */
                mergedLivePages.map((page) => (
                  <div
                    key={page.pageNumber}
                    id={`doc-page-${page.pageNumber}`}
                    className={`${sheetWidthClass} bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 px-8 sm:px-12 md:px-16 lg:px-20 py-10 md:py-14 relative transition-all duration-150 flex flex-col justify-between`}
                    style={{
                      minHeight: '1056px',
                      fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif'
                    }}
                  >
                    <div className="absolute right-4 top-3 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full select-none z-10 border border-slate-200">
                      Page {page.pageNumber} of {mergedLivePages.length}
                    </div>

                    <div>
                      {/* Document Header */}
                      <div className="pb-3 mb-6 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                        <span className="font-semibold tracking-tight text-[#0E2841]">
                          ZenaTech, Inc. — Form 6-K Interim Report
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 mr-24">
                          Live Document Preview • v{mainDoc.versionNumber + 1} Draft
                        </span>
                      </div>

                      {/* Clean Blocks Flow */}
                      <div className="space-y-1">
                        {page.blocks.map((block, idx) => (
                          <div key={block.id || idx} className="relative py-0 hover:bg-slate-50/40 rounded transition-colors">
                            <SecDocBlockRenderer
                              block={block}
                              spreadsheet={proposalSpreadsheet}
                              onInspectCell={handleOpenSpreadsheetToCell}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Document Footer */}
                    <div className="pt-6 mt-8 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                      <span className="italic">Confidential — Post-Merge Final Preview Copy</span>
                      <span className="font-bold text-[#0E2841]">
                        ZenaTech, Inc. • Six Months Ended June 30, 2026
                      </span>
                      <span>Page {page.pageNumber}</span>
                    </div>
                  </div>
                ))
              ) : wordDisplayMode === 'live-original' ? (
                /* Pure Current Live Document Pages */
                originalLivePages.map((page) => (
                  <div
                    key={page.pageNumber}
                    id={`doc-page-${page.pageNumber}`}
                    className={`${sheetWidthClass} bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 px-8 sm:px-12 md:px-16 lg:px-20 py-10 md:py-14 relative transition-all duration-150 flex flex-col justify-between`}
                    style={{
                      minHeight: '1056px',
                      fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif'
                    }}
                  >
                    <div className="absolute right-4 top-3 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full select-none z-10 border border-slate-200">
                      Page {page.pageNumber} of {originalLivePages.length}
                    </div>

                    <div>
                      {/* Document Header */}
                      <div className="pb-3 mb-6 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                        <span className="font-semibold tracking-tight text-[#0E2841]">
                          ZenaTech, Inc. — Form 6-K Interim Report
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 mr-24">
                          Current Live Main Version (v{mainDoc.versionNumber})
                        </span>
                      </div>

                      {/* Clean Blocks Flow */}
                      <div className="space-y-1">
                        {page.blocks.map((block, idx) => (
                          <div key={block.id || idx} className="relative py-0 hover:bg-slate-50/40 rounded transition-colors">
                            <SecDocBlockRenderer
                              block={block}
                              spreadsheet={mainSpreadsheet}
                              onInspectCell={handleOpenSpreadsheetToCell}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Document Footer */}
                    <div className="pt-6 mt-8 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                      <span className="italic">Confidential — Live Main Document Copy</span>
                      <span className="font-bold text-[#0E2841]">
                        ZenaTech, Inc. • Six Months Ended June 30, 2026
                      </span>
                      <span>Page {page.pageNumber}</span>
                    </div>
                  </div>
                ))
              ) : (
                /* Standard Track Changes Mode with Inline Review Highlights */
                paginatedPages.map((page) => (
                <div
                  key={page.pageNumber}
                  id={`doc-page-${page.pageNumber}`}
                  className={`${sheetWidthClass} bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 px-8 sm:px-12 md:px-16 lg:px-20 py-10 md:py-14 relative transition-all duration-150 flex flex-col justify-between`}
                  style={{
                    minHeight: '1056px',
                    fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif'
                  }}
                >
                  {/* Floating Page Badge */}
                  <div className="absolute right-4 top-3 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full select-none z-10 border border-slate-200">
                    Page {page.pageNumber} of {paginatedPages.length}
                  </div>

                  <div>
                    {/* Document Header */}
                    <div className="pb-3 mb-6 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                      <span className="font-semibold tracking-tight text-[#0E2841]">
                        ZenaTech, Inc. — Form 6-K Interim Report
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 mr-24">
                        Track Changes Review • Page {page.pageNumber} of {paginatedPages.length}
                      </span>
                    </div>

                    {/* Document Blocks Flow for this Page */}
                    <div className="space-y-1">
                      {page.items.map((item, idx) => {
                        const { blockId, diff, block } = item;
                        const isChanged = diff.status !== 'unchanged';
                        const isAccepted = acceptedBlockIds.includes(blockId);

                        if (!isChanged) {
                          /* Unchanged Block: Rendered cleanly as standard document content */
                          return (
                            <div key={blockId || idx} className="relative py-0 hover:bg-slate-50/40 rounded transition-colors">
                              <SecDocBlockRenderer
                                block={block}
                                spreadsheet={proposalSpreadsheet}
                                onInspectCell={handleOpenSpreadsheetToCell}
                              />
                            </div>
                          );
                        }

                        /* Track-changes revision left bar color */
                        let leftBorderClass = 'border-l-4 border-amber-500 pl-3.5 bg-amber-50/10 dark:bg-amber-950/10';
                        if (diff.status === 'added') {
                          leftBorderClass = isAccepted
                            ? 'border-l-4 border-emerald-500 pl-3.5 bg-emerald-50/15 dark:bg-emerald-950/15'
                            : 'border-l-4 border-slate-300 pl-3.5 opacity-60';
                        } else if (diff.status === 'deleted') {
                          leftBorderClass = isAccepted
                            ? 'border-l-4 border-red-500 pl-3.5 bg-red-50/15 dark:bg-red-950/15'
                            : 'border-l-4 border-blue-400 pl-3.5 bg-blue-50/10 dark:bg-blue-950/10';
                        }

                        return (
                          <div
                            key={blockId || idx}
                            id={`diff-block-${blockId}`}
                            className={`relative my-2 rounded-r-md transition-all py-1 ${leftBorderClass}`}
                          >
                            {/* Compact Inline Reviewer Action Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 mb-1 font-sans text-xs select-none">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleDiffAcceptance(blockId)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer border shadow-2xs ${
                                    isAccepted
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-bold'
                                      : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                                  }`}
                                  title={isAccepted ? 'Accepted for merge' : 'Click to accept change'}
                                >
                                  {isAccepted ? (
                                    <>
                                      <Check className="w-3 h-3 text-white" />
                                      <span>✓ Accepted</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3 text-slate-500" />
                                      <span>+ Accept</span>
                                    </>
                                  )}
                                </button>

                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-bold px-1.5 py-0 ${
                                    diff.status === 'added'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : diff.status === 'deleted'
                                      ? 'bg-red-100 text-red-800 border-red-300'
                                      : 'bg-amber-100 text-amber-900 border-amber-300'
                                  }`}
                                >
                                  {diff.status === 'added'
                                    ? '+ Added'
                                    : diff.status === 'deleted'
                                    ? '- Deleted'
                                    : '~ Modified'}
                                </Badge>

                                <ChangeTypeBadges diff={diff} />

                                <span className="text-[10px] text-slate-500">
                                  by {proposal.author.name}
                                </span>
                              </div>

                              <span className="text-[10px] font-mono text-slate-400">
                                {block.section}
                              </span>
                            </div>

                            {/* Content Stream with Native Track Changes Highlighting */}
                            {diff.status === 'added' ? (
                              <div className={!isAccepted ? 'opacity-50 line-through' : ''}>
                                <SecDocBlockRenderer
                                  block={diff.proposedBlock!}
                                  spreadsheet={proposalSpreadsheet}
                                  onInspectCell={handleOpenSpreadsheetToCell}
                                />
                              </div>
                            ) : diff.status === 'deleted' ? (
                              <div className={isAccepted ? 'line-through text-red-700 opacity-70' : 'text-slate-800'}>
                                <SecDocBlockRenderer
                                  block={diff.originalBlock!}
                                  spreadsheet={mainSpreadsheet}
                                  onInspectCell={handleOpenSpreadsheetToCell}
                                />
                              </div>
                            ) : (
                              <div>
                                {diff.isSpacingOnly || diff.isTypographyOnly ? (
                                  /* Pure formatting / spacing: show updated formatting seamlessly */
                                  <SecDocBlockRenderer
                                    block={isAccepted ? diff.proposedBlock! : diff.originalBlock!}
                                    spreadsheet={isAccepted ? proposalSpreadsheet : mainSpreadsheet}
                                    onInspectCell={handleOpenSpreadsheetToCell}
                                  />
                                ) : diff.originalBlock?.type === 'financial_table' && diff.proposedBlock?.type === 'financial_table' ? (
                                  /* Financial table with cell revisions: render single integrated table with inline track changes */
                                  <SecDocBlockRenderer
                                    block={diff.proposedBlock}
                                    comparisonBlock={diff.originalBlock}
                                    tableCellDiffs={diff.tableCellDiffs}
                                    side="unified-track-changes"
                                    isAccepted={isAccepted}
                                    spreadsheet={proposalSpreadsheet}
                                    onInspectCell={handleOpenSpreadsheetToCell}
                                  />
                                ) : (
                                  /* Content change: show red strikethrough original + green proposed revision */
                                  <div className="space-y-1">
                                    {diff.originalBlock && (
                                      <div className={isAccepted ? 'line-through text-red-700/80 opacity-70' : 'text-slate-900'}>
                                        <SecDocBlockRenderer
                                          block={diff.originalBlock}
                                          spreadsheet={mainSpreadsheet}
                                          onInspectCell={handleOpenSpreadsheetToCell}
                                        />
                                      </div>
                                    )}
                                    {diff.proposedBlock && isAccepted && (
                                      <div className="text-emerald-950 bg-emerald-50/40 p-1 rounded border border-emerald-200/60 mt-1">
                                        <SecDocBlockRenderer
                                          block={diff.proposedBlock}
                                          spreadsheet={proposalSpreadsheet}
                                          onInspectCell={handleOpenSpreadsheetToCell}
                                        />
                                      </div>
                                    )}
                                    {diff.proposedBlock && !isAccepted && (
                                      <div className="text-slate-400 line-through opacity-50 p-1 rounded border border-dashed border-slate-200 mt-1">
                                        <SecDocBlockRenderer
                                          block={diff.proposedBlock}
                                          spreadsheet={proposalSpreadsheet}
                                          onInspectCell={handleOpenSpreadsheetToCell}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div className="pt-6 mt-8 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                    <span className="italic">Confidential — SEC Filing Merge Review Copy</span>
                    <span className="font-bold text-[#0E2841]">
                      ZenaTech, Inc. • Six Months Ended June 30, 2026
                    </span>
                    <span>Page {page.pageNumber}</span>
                  </div>
                </div>
              ))
              )}
            </div>
          ) : viewMode === 'side-by-side-sheets' ? (
            /* ========================================================================= */
            /* 2. SYNCHRONIZED ROW-ALIGNED SIDE-BY-SIDE VIEW (MATCHING HORIZONTAL ROWS)   */
            /* ========================================================================= */
            <div className="w-full max-w-full space-y-2">
              {/* Column Headers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-2">
                <div className="text-center text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Live Main Version (v{mainDoc.versionNumber})
                </div>
                <div className="text-center text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Contributor Proposal ({proposal.author.name})
                </div>
              </div>

              {/* Synchronized Side-by-Side Document Sheet */}
              <div
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl rounded-sm border border-slate-300/80 dark:border-zinc-800 px-6 sm:px-10 py-8 min-h-[1056px]"
                style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
              >
                {/* Header Strip */}
                <div className="pb-3 mb-6 border-b border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-2 gap-6 text-[11px] font-sans select-none">
                  <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-[#0E2841] dark:text-blue-400">Current Main Document</span>
                    <span className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">v{mainDoc.versionNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                    <span className="font-semibold">Proposed Revision Draft</span>
                    <span className="font-mono text-[10px] bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                      {formatSubmissionTime(proposal.submittedAt)}
                    </span>
                  </div>
                </div>

                {/* Synchronized Block-by-Block Rows */}
                <div className="space-y-4">
                  {sideBySideAlignedRows.map((row) => {
                    const { blockId, diff, leftBlock, rightBlock } = row;
                    const isAccepted = acceptedBlockIds.includes(blockId);

                    return (
                      <div key={blockId} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        {/* Left Side (Live Main Version) */}
                        <div className="flex flex-col justify-start">
                          {leftBlock ? (
                            <div
                              className={`relative transition-all p-3 rounded-lg border h-full flex flex-col justify-between ${
                                diff.status === 'deleted'
                                  ? 'bg-red-50/50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-950 dark:text-red-200'
                                  : diff.status === 'modified'
                                  ? 'bg-amber-50/25 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                  : 'border-transparent py-0.5'
                              }`}
                            >
                              {(diff.status === 'deleted' || diff.status === 'modified') && (
                                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 dark:border-zinc-800 text-xs font-sans select-none">
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-bold px-2 py-0.5 ${
                                        diff.status === 'deleted'
                                          ? 'bg-red-100 text-red-800 border-red-300'
                                          : 'bg-amber-100 text-amber-900 border-amber-300'
                                      }`}
                                    >
                                      {diff.status === 'deleted' ? '- Deleted in Proposal' : 'Current Main Version'}
                                    </Badge>
                                    {diff.status === 'modified' && <ChangeTypeBadges diff={diff} />}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">{leftBlock.section}</span>
                                </div>
                              )}
                              <div className={diff.status === 'deleted' ? 'line-through opacity-70' : ''}>
                                <SecDocBlockRenderer
                                  block={leftBlock}
                                  comparisonBlock={rightBlock}
                                  tableCellDiffs={diff.tableCellDiffs}
                                  side="original"
                                  isAccepted={isAccepted}
                                  spreadsheet={mainSpreadsheet}
                                  onInspectCell={handleOpenSpreadsheetToCell}
                                />
                              </div>
                            </div>
                          ) : (
                            /* Blank space on Left side when block was added in Proposal */
                            <div className="h-full min-h-[60px] rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/40 flex items-center justify-center text-slate-400 text-[10px] italic select-none">
                              <span>(Not present in Live Main Document)</span>
                            </div>
                          )}
                        </div>

                        {/* Right Side (Contributor Proposal) */}
                        <div className="flex flex-col justify-start">
                          {rightBlock ? (
                            <div
                              id={`side-diff-${blockId}`}
                              className={`relative transition-all p-3 rounded-lg border h-full flex flex-col justify-between ${
                                diff.status === 'added'
                                  ? isAccepted
                                    ? 'border-emerald-400 bg-emerald-50/25 dark:bg-emerald-950/30 shadow-xs'
                                    : 'border-slate-300 bg-slate-50/50 opacity-60'
                                  : diff.status === 'modified'
                                  ? isAccepted
                                    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/30 shadow-xs'
                                    : 'border-slate-300 bg-slate-50/50 opacity-60'
                                  : 'border-transparent py-0.5'
                              }`}
                            >
                              {(diff.status === 'added' || diff.status === 'modified') && (
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200/80 dark:border-zinc-800 font-sans text-xs select-none">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleDiffAcceptance(blockId)}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs ${
                                        isAccepted
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-bold'
                                          : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                                      }`}
                                      title={isAccepted ? 'Accepted for merge' : 'Click to accept change'}
                                    >
                                      {isAccepted ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-white" />
                                          <span>✓ Accepted</span>
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3.5 h-3.5 text-slate-500" />
                                          <span>+ Accept</span>
                                        </>
                                      )}
                                    </button>

                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-bold px-2 py-0.5 ${
                                        diff.status === 'added'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : 'bg-amber-100 text-amber-900 border-amber-300'
                                      }`}
                                    >
                                      {diff.status === 'added' ? '+ Added' : '~ Modified'}
                                    </Badge>

                                    <ChangeTypeBadges diff={diff} />
                                  </div>

                                  <span className="text-[10px] text-slate-400 font-mono">{rightBlock.section}</span>
                                </div>
                              )}
                              <SecDocBlockRenderer
                                block={rightBlock}
                                comparisonBlock={leftBlock}
                                tableCellDiffs={diff.tableCellDiffs}
                                side="proposed"
                                isAccepted={isAccepted}
                                spreadsheet={proposalSpreadsheet}
                                onInspectCell={handleOpenSpreadsheetToCell}
                              />
                            </div>
                          ) : (
                            /* Blank space on Right side to perfectly match up with Left document! */
                            <div className="h-full min-h-[60px] rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/40 flex items-center justify-center text-slate-400 text-[10px] italic select-none">
                              <span>{diff.status === 'deleted' ? '(Block Deleted in Proposal)' : '(Preserved in Live Main Document)'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Side-by-Side Footer */}
                <div className="pt-6 mt-8 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 font-sans select-none">
                  <span className="italic">Confidential — SEC Filing Side-by-Side Synchronized Comparison</span>
                  <span className="font-bold text-[#0E2841]">
                    ZenaTech, Inc. • Six Months Ended June 30, 2026
                  </span>
                  <span>Unaudited</span>
                </div>
              </div>
            </div>
          ) : viewMode === 'spreadsheet-diffs' ? (
            /* ========================================================================= */
            /* 3. SPREADSHEET / EXCEL CELL CHANGES VIEW                                  */
            /* ========================================================================= */
            <div className="w-full max-w-[1380px] space-y-4">
              <EmbeddedSpreadsheetDiffViewer
                baseSpreadsheet={mainDoc.attachedSpreadsheet || secFilingService.getAttachedSpreadsheet(mainDoc.id)}
                proposedSpreadsheet={
                  proposal?.attachedSpreadsheet ||
                  (proposal?.id ? secFilingService.getProposals().find((p) => p.id === proposal.id)?.attachedSpreadsheet : null) ||
                  mainDoc.attachedSpreadsheet ||
                  secFilingService.getAttachedSpreadsheet(mainDoc.id)
                }
                spreadsheetDiffs={spreadsheetDiffs}
                onOpenFullModal={() => setIsSpreadsheetPreviewOpen(true)}
                initialCellRef={targetSpreadsheetCell}
                initialTabName={targetSpreadsheetTab}
              />
            </div>
          ) : (
            /* ========================================================================= */
            /* 4. SUMMARY CARDS LIST VIEW                                                */
            /* ========================================================================= */
            <div className="w-full max-w-[1380px] space-y-3">
              {changedDiffs.map((diff, idx) => {
                const isAccepted = acceptedBlockIds.includes(diff.blockId);
                return (
                  <div
                    key={diff.blockId || idx}
                    className={`p-4 rounded-xl border bg-white dark:bg-zinc-900 transition-all space-y-3 ${
                      isAccepted
                        ? 'border-blue-400 dark:border-blue-800 shadow-sm'
                        : 'border-slate-200 dark:border-zinc-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleDiffAcceptance(diff.blockId)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs ${
                            isAccepted
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-bold'
                              : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                          }`}
                          title={isAccepted ? 'Accepted for merge' : 'Click to accept change'}
                        >
                          {isAccepted ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>✓ Accepted</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-slate-500" />
                              <span>+ Accept</span>
                            </>
                          )}
                        </button>

                        <Badge
                          variant="outline"
                          className={
                            diff.status === 'added'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : diff.status === 'deleted'
                              ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                              : 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                          }
                        >
                          {diff.status.toUpperCase()}
                        </Badge>

                        <ChangeTypeBadges diff={diff} />

                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          {(diff.proposedBlock || diff.originalBlock)?.section}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({(diff.proposedBlock || diff.originalBlock)?.type})
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        ID: {diff.blockId}
                      </span>
                    </div>

                    {/* Granular Table Cell Changes Grid for Financial Tables */}
                    {diff.tableCellDiffs && diff.tableCellDiffs.length > 0 && (
                      <div className="mb-3 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-sans shadow-2xs">
                        <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Table className="w-3.5 h-3.5 text-amber-600" />
                            <span>Granular Table Cell Changes ({diff.tableCellDiffs.length}):</span>
                          </div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                            Inspected cell-by-cell
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {diff.tableCellDiffs.map((cd, i) => (
                            <div key={i} className="p-2 rounded bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 text-[11px] shadow-2xs">
                              <div className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{cd.rowLabel}</div>
                              <div className="text-[10px] text-slate-500 mb-1">{cd.headerLabel}</div>
                              <div className="flex items-center gap-1 font-mono text-[10px]">
                                {cd.status === 'cell_modified' ? (
                                  <>
                                    <span className="line-through text-red-600 bg-red-50 dark:bg-red-950/60 px-1 py-0.2 rounded border border-red-200">{cd.oldValue || '—'}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-200">{cd.newValue || '—'}</span>
                                  </>
                                ) : cd.status === 'row_added' ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">+ Added Row: {cd.newValue}</span>
                                ) : (
                                  <span className="text-red-700 font-bold bg-red-50 px-1 rounded border border-red-200">- Deleted Row: {cd.oldValue}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
                        <div className="font-semibold text-slate-500 text-[10px] uppercase">
                          Current Main Version
                        </div>
                        {diff.originalBlock ? (
                          <SecDocBlockRenderer
                            block={diff.originalBlock}
                            comparisonBlock={diff.proposedBlock}
                            tableCellDiffs={diff.tableCellDiffs}
                            side="original"
                            isAccepted={isAccepted}
                            spreadsheet={mainSpreadsheet}
                            onInspectCell={handleOpenSpreadsheetToCell}
                          />
                        ) : (
                          <span className="italic text-slate-400">(Block did not exist)</span>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-blue-50/20 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-blue-600 dark:text-blue-400 text-[10px] uppercase pb-1 border-b border-blue-100">
                          <span>Proposed by {proposal.author.name}</span>
                        </div>
                        {diff.proposedBlock ? (
                          <SecDocBlockRenderer
                            block={diff.proposedBlock}
                            comparisonBlock={diff.originalBlock}
                            tableCellDiffs={diff.tableCellDiffs}
                            side="proposed"
                            isAccepted={isAccepted}
                            spreadsheet={proposalSpreadsheet}
                            onInspectCell={handleOpenSpreadsheetToCell}
                          />
                        ) : (
                          <span className="italic text-red-500">(Block deleted)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Controller Merge / Review Action Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-2.5 shadow-lg">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Controller Confirmation & Merge Commit Notes</span>
            </label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Verified and approved changes against finalized Q2 schedule."
              rows={2}
              className="text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {isLeadController
                  ? `Lead Controller authority active. ${totalSelectedCount} of ${totalChangesCount} change(s) selected to merge.`
                  : 'Viewing in Contributor mode. Switch role to Lead Controller to merge.'}
              </span>
            </div>

            <div className="flex items-center gap-2 pr-16 sm:pr-20 relative z-[70] hover:z-[99]">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 cursor-pointer relative z-[70] hover:z-[99] hover:shadow-md transition-all"
              >
                Cancel
              </Button>

              {isLeadController && proposal.status !== 'merged' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRejectClick}
                    className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>

                  <Button
                    type="button"
                    onClick={handleConfirmMergeSelected}
                    disabled={totalSelectedCount === 0}
                    className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm font-semibold relative z-[70] hover:z-[99] cursor-pointer hover:shadow-md transition-all"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Confirm & Merge Selected ({totalSelectedCount})</span>
                  </Button>

                  {totalSelectedCount < totalChangesCount && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleApproveAndMergeAll}
                      className="text-xs h-8 text-emerald-700 dark:text-emerald-300 border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium relative z-[70] hover:z-[99] cursor-pointer hover:shadow-md transition-all"
                    >
                      <span>Merge All ({totalChangesCount})</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {proposal && (
        <AttachedSpreadsheetModal
          open={isSpreadsheetPreviewOpen}
          onOpenChange={setIsSpreadsheetPreviewOpen}
          spreadsheet={proposal.attachedSpreadsheet || mainDoc.attachedSpreadsheet}
          onUpdateSpreadsheet={() => {}}
          onUpdateCell={() => 0}
          blocks={proposal.blocks || mainDoc.blocks}
          mode="manage"
          targetBlockTitle="Proposal Spreadsheet Inspection"
          initialCellRef={targetSpreadsheetCell}
          initialTabName={targetSpreadsheetTab}
        />
      )}
    </Dialog>
  );
};

/* ------------------------------------------------------------------------- */
/* SEC DOCUMENT BLOCK RENDERER FOR AUTHENTIC SHEET PRESENTATION         */
/* ------------------------------------------------------------------------- */
const SecDocBlockRenderer: React.FC<{
  block: SecBlock;
  comparisonBlock?: SecBlock | null;
  tableCellDiffs?: SecTableCellDiff[];
  side?: 'original' | 'proposed' | 'unified-track-changes';
  isAccepted?: boolean;
  spreadsheet?: AttachedSpreadsheet | null;
  onInspectCell?: (cellRef?: string, tabName?: string) => void;
}> = ({
  block,
  comparisonBlock: _comparisonBlock,
  tableCellDiffs = [],
  side = 'unified-track-changes',
  isAccepted = false,
  spreadsheet,
  onInspectCell
}) => {
  if (block.type === 'heading') {
    const b = block as SecHeadingBlock;
    const defaultFontSize =
      b.level === 1 ? 20 : b.level === 2 ? 16 : b.level === 3 ? 14.5 : 13.5;
    const effectiveFontSize = b.fontSize || defaultFontSize;

    return (
      <div
        style={{
          marginTop: `${b.spacingTop ?? (b.level === 1 ? 12 : b.level === 2 ? 8 : 6)}px`,
          color: b.color || '#0E2841',
          fontFamily: b.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
          fontSize: `${effectiveFontSize}px`,
          textAlign: b.alignment || 'left',
          textDecoration: b.underline ? 'underline' : 'none',
          fontStyle: b.italic ? 'italic' : 'normal',
          fontWeight: b.bold !== false ? 'bold' : 'normal',
          lineHeight: b.lineSpacing ? `${b.lineSpacing}` : '1.2'
        }}
        className="w-full select-text"
      >
        <DocumentVariableRenderer
          text={b.text}
          spreadsheet={spreadsheet}
          onInspectCell={onInspectCell}
        />
      </div>
    );
  }

  if (block.type === 'paragraph') {
    const b = block as SecParagraphBlock;
    const effectiveFontSize = b.fontSize || 14;

    return (
      <div
        style={{
          marginTop: `${b.spacingTop ?? 4}px`,
          color: b.color || '#111827',
          fontFamily: b.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
          fontSize: `${effectiveFontSize}px`,
          textAlign: b.alignment || 'left',
          textDecoration: b.underline ? 'underline' : 'none',
          fontStyle: b.italic ? 'italic' : 'normal',
          fontWeight: b.bold ? 'bold' : 'normal',
          lineHeight: b.lineSpacing ? `${b.lineSpacing}` : '1.45'
        }}
        className="w-full whitespace-pre-wrap select-text"
      >
        {b.noteNumber && (
          <span className="font-bold mr-2 text-[#0E2841] underline">
            Note {b.noteNumber}:
          </span>
        )}
        <DocumentVariableRenderer
          text={b.text}
          spreadsheet={spreadsheet}
          onInspectCell={onInspectCell}
        />
      </div>
    );
  }

  if (block.type === 'financial_table') {
    const b = block as SecFinancialTableBlock;
    const rawHeaders = b.headers || [];
    const cleanedHeaders = rawHeaders.map((h) => (/^Col\s*\d+$/i.test(h?.trim() || '') ? '' : h));
    const hasMeaningfulHeader = cleanedHeaders.some((h) => h && h.trim().length > 0);
    const firstRowIsHeader = b.rows && b.rows.length > 0 && b.rows[0].type === 'header';
    const showHeaderRow = hasMeaningfulHeader && !firstRowIsHeader;

    const cellDiffMap = new Map<string, SecTableCellDiff>();
    for (const cd of tableCellDiffs) {
      cellDiffMap.set(`${cd.rowIndex}_${cd.colIndex}`, cd);
    }

    const modifiedCellsList = tableCellDiffs.filter((d) => d.status === 'cell_modified');
    const hasChanges = tableCellDiffs.length > 0;

    return (
      <div
        style={{ marginTop: `${b.spacingTop ?? 10}px` }}
        className="w-full overflow-x-auto space-y-2 select-text"
      >
        {/* Track changes summary ribbon for tables in unified mode */}
        {side === 'unified-track-changes' && hasChanges && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-sans mb-1.5 shadow-2xs">
            <div className="flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200">
              <Table className="w-3.5 h-3.5 text-amber-600" />
              <span>Table Cell Revisions ({tableCellDiffs.length}):</span>
            </div>
            {modifiedCellsList.slice(0, 4).map((cd, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 shadow-2xs"
              >
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{cd.rowLabel}:</span>
                <span className="line-through text-red-600 dark:text-red-400 font-mono text-[10px]">{cd.oldValue || '—'}</span>
                <span className="text-slate-400">→</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">{cd.newValue || '—'}</span>
              </span>
            ))}
            {modifiedCellsList.length > 4 && (
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                +{modifiedCellsList.length - 4} more
              </span>
            )}
          </div>
        )}

        {b.title && (
          <div className="font-bold text-sm text-[#0E2841] flex items-center justify-between">
            <span>{b.title}</span>
            {hasChanges && side !== 'unified-track-changes' && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                side === 'original'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {side === 'original' ? 'Baseline Values' : 'Proposed Values'} ({tableCellDiffs.length} cell changes)
              </span>
            )}
          </div>
        )}

        <table className="w-full border-collapse text-xs font-sans">
          <thead>
            {showHeaderRow && (
              <tr className="border-t-2 border-b border-slate-900 bg-slate-50/50">
                {cleanedHeaders.map((h, i) => {
                  const headerDiff = cellDiffMap.get(`-1_${i}`);
                  return (
                    <th
                      key={i}
                      style={{
                        textAlign: b.columnAlignments?.[i] || (i === 0 ? 'left' : 'center'),
                        width: b.columnWidths?.[i] || undefined
                      }}
                      className="py-1.5 px-2 font-bold text-slate-800 text-[11px]"
                    >
                      {headerDiff && side === 'unified-track-changes' ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="line-through text-red-600 font-normal opacity-80">{headerDiff.oldValue}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-700 font-bold">{headerDiff.newValue}</span>
                        </div>
                      ) : headerDiff && side === 'original' ? (
                        <span className="bg-amber-100 text-amber-900 px-1 rounded border border-amber-300">{h}</span>
                      ) : headerDiff && side === 'proposed' ? (
                        <span className="bg-emerald-100 text-emerald-900 px-1 rounded border border-emerald-300 font-bold">{h}</span>
                      ) : (
                        h
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {b.rows.map((row, rIdx) => {
              const rowAddedDiff = tableCellDiffs.find((d) => d.rowIndex === rIdx && d.status === 'row_added');
              const rowDeletedDiff = tableCellDiffs.find((d) => d.rowIndex === rIdx && d.status === 'row_deleted');

              let rowHighlightClass = '';
              if (side === 'unified-track-changes') {
                if (rowAddedDiff) {
                  rowHighlightClass = 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500';
                } else if (rowDeletedDiff) {
                  rowHighlightClass = 'bg-red-50/80 dark:bg-red-950/40 border-l-4 border-l-red-500 line-through text-red-800 opacity-75';
                }
              }

              if (row.type === 'section_title' || row.type === 'category_header') {
                return (
                  <tr key={row.id} className={`border-t border-slate-100 font-bold text-slate-900 bg-slate-50/30 ${rowHighlightClass}`}>
                    <td colSpan={b.headers.length} className="py-1 px-2 text-[11px] italic">
                      <DocumentVariableRenderer
                        text={row.cells[0]}
                        spreadsheet={spreadsheet}
                        onInspectCell={onInspectCell}
                      />
                    </td>
                  </tr>
                );
              }
              if (row.type === 'blank') {
                return (
                  <tr key={row.id} className={rowHighlightClass}>
                    <td colSpan={b.headers.length} className="h-2"></td>
                  </tr>
                );
              }
              const isTotal = row.type === 'total';
              const isSubtotal = row.type === 'subtotal';
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50/60 ${rowHighlightClass} ${
                    isTotal
                      ? 'border-t border-b-2 border-double border-slate-900 font-bold bg-slate-50/40'
                      : isSubtotal
                      ? 'border-t border-slate-400 font-semibold'
                      : 'border-b border-slate-100'
                  }`}
                >
                  {sanitizeTableCells(row.cells).map((cell, cIdx) => {
                    const isDateHeader = isComparativeDateHeaderCell(cell, rIdx, cIdx);
                    const align = row.cellAlignments?.[cIdx] || row.align || (isDateHeader ? 'center' : (b.columnAlignments?.[cIdx] || (cIdx === 0 ? 'left' : 'right')));
                    const cellDiff = cellDiffMap.get(`${rIdx}_${cIdx}`);

                    let cellContent: React.ReactNode = (
                      <span className={isDateHeader ? 'font-bold text-[#0E2841]' : 'text-slate-800'}>
                        <DocumentVariableRenderer
                          text={String(cell ?? '')}
                          spreadsheet={spreadsheet}
                          onInspectCell={onInspectCell}
                        />
                      </span>
                    );

                    if (cellDiff && cellDiff.status === 'cell_modified') {
                      if (side === 'unified-track-changes') {
                        if (isAccepted) {
                          cellContent = (
                            <span
                              className="inline-flex items-center gap-1 font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 shadow-2xs font-mono"
                              title={`Accepted modification: "${cellDiff.oldValue}" → "${cellDiff.newValue}"`}
                            >
                              <span>{cellDiff.newValue || '—'}</span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                            </span>
                          );
                        } else {
                          cellContent = (
                            <div
                              className="inline-flex items-center gap-1 flex-wrap"
                              title={`Modified: was "${cellDiff.oldValue}" in Main Document`}
                            >
                              <span className="line-through text-red-700 dark:text-red-400 bg-red-100/90 dark:bg-red-950/90 px-1 py-0.5 rounded border border-red-300 dark:border-red-800 text-[10px] font-mono shadow-2xs">
                                {cellDiff.oldValue || '—'}
                              </span>
                              <span className="text-slate-400 text-[10px] font-sans">→</span>
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-400 dark:border-emerald-700 shadow-2xs text-[11px] font-mono">
                                {cellDiff.newValue || '—'}
                              </span>
                            </div>
                          );
                        }
                      } else if (side === 'original') {
                        cellContent = (
                          <span
                            className="inline-block bg-amber-100/95 dark:bg-amber-950/90 text-amber-950 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded border border-amber-400 dark:border-amber-700 shadow-2xs font-mono"
                            title={`Original Main Value. Proposed change in draft: "${cellDiff.newValue}"`}
                          >
                            <DocumentVariableRenderer
                              text={String(cell ?? '')}
                              spreadsheet={spreadsheet}
                              onInspectCell={onInspectCell}
                            />
                          </span>
                        );
                      } else if (side === 'proposed') {
                        cellContent = (
                          <span
                            className="inline-block bg-emerald-100/95 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-200 font-bold px-1.5 py-0.5 rounded border border-emerald-400 dark:border-emerald-700 shadow-2xs font-mono"
                            title={`Proposed New Value. Original value in Main was: "${cellDiff.oldValue}"`}
                          >
                            <DocumentVariableRenderer
                              text={String(cell ?? '')}
                              spreadsheet={spreadsheet}
                              onInspectCell={onInspectCell}
                            />
                          </span>
                        );
                      }
                    }

                    return (
                      <td
                        key={cIdx}
                        style={{
                          textAlign: align,
                          paddingLeft: cIdx === 0 && row.indent ? `${row.indent * 14 + 8}px` : '8px'
                        }}
                        className="py-1 px-2 text-[11px] font-mono whitespace-nowrap"
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {b.footnotes && b.footnotes.length > 0 && (
          <div className="pt-1 text-[10px] text-slate-500 italic space-y-0.5">
            {b.footnotes.map((fn, fIdx) => (
              <div key={fIdx}>{fn}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'image') {
    const b = block as SecImageBlock;
    const alignClass =
      b.alignment === 'left' ? 'justify-start' : b.alignment === 'right' ? 'justify-end' : 'justify-center';

    return (
      <div
        style={{ marginTop: `${b.spacingTop ?? 8}px` }}
        className={`w-full flex flex-col ${alignClass} py-1 select-none`}
      >
        <div className="flex flex-col items-center max-w-full">
          <img
            src={b.url || ZENATECH_LOGO_DATA_URL}
            alt={b.alt || 'SEC Filing Document Asset'}
            style={{ width: b.width ? `${b.width}px` : '260px', height: 'auto' }}
            className="object-contain"
          />
          {b.caption && (
            <p className="text-[11px] text-slate-500 italic mt-1 text-center">{b.caption}</p>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'callout') {
    const b = block as SecCalloutBlock;
    return (
      <div
        style={{ marginTop: `${b.spacingTop ?? 8}px` }}
        className="w-full p-3.5 rounded-lg border border-blue-200 bg-blue-50/50 text-blue-950 text-xs space-y-1 select-text"
      >
        {b.title && (
          <div className="font-bold text-blue-900">
            <DocumentVariableRenderer
              text={b.title}
              spreadsheet={spreadsheet}
              onInspectCell={onInspectCell}
            />
          </div>
        )}
        <div className="leading-relaxed">
          <DocumentVariableRenderer
            text={b.content}
            spreadsheet={spreadsheet}
            onInspectCell={onInspectCell}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'signature') {
    const b = block as SecSignatureBlock;
    return (
      <div
        style={{ marginTop: `${b.spacingTop ?? 14}px` }}
        className="w-full space-y-3 pt-2 select-text"
      >
        {b.title && <div className="font-bold text-xs uppercase tracking-wider text-[#0E2841]">{b.title}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {b.officers.map((officer) => (
            <div key={officer.id} className="p-3 border-t-2 border-slate-900 text-xs space-y-1">
              <div className="font-bold text-slate-900">{officer.name}</div>
              <div className="text-slate-600 text-[11px]">{officer.title}</div>
              <div className="text-slate-400 text-[10px] font-mono">Date: {officer.date}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'divider') {
    const b = block as SecDividerBlock;
    return (
      <div style={{ marginTop: `${b.spacingTop ?? 10}px` }} className="w-full py-2">
        <div className="w-full border-t border-slate-300" />
      </div>
    );
  }

  if (block.type === 'metadata') {
    const b = block as SecMetadataBlock;
    return (
      <div
        style={{ marginTop: `${b.spacingTop ?? 8}px` }}
        className="w-full p-4 rounded bg-slate-50 border border-slate-200 text-xs space-y-1 select-text font-mono"
      >
        <div className="font-bold text-[#0E2841] text-sm">{b.companyName} ({b.symbol})</div>
        <div className="text-slate-600 text-[11px]">Form: {b.formType} • Period: {b.periodEnded} • CIK: {b.cik}</div>
      </div>
    );
  }

  return null;
};
