import type {
  SecChangeProposal,
  SecFilingDocument,
  SecVersionSnapshot,
  SecBlock
} from '../../types/secFiling';
import type { ContributorPermissions } from '../../types/collaborator';
import { INITIAL_PROPOSALS } from '../../data/initialSecFilingData';
import {
  STORAGE_KEYS,
  safeSetItem,
  flushPendingSaves,
  broadcastSync,
  getPendingProposals,
  setPendingProposals,
  getSaveProposalsTimer,
  setSaveProposalsTimer
} from './secFilingStorage';
import { sanitizeAndCompactBlocks } from './secFilingSanitizer';
import { calculateDiffs } from './secFilingDiff';
import {
  getMainDocument,
  saveMainDocument,
  getVersionHistory,
  saveVersionHistory
} from './secFilingCore';

export function getProposalInviteUrl(proposal: SecChangeProposal): string {
  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? `${window.location.origin}/sec-filings/contribute`
      : '/sec-filings/contribute';
  const queryParams = new URLSearchParams({
    contributor: 'true',
    proposalId: proposal.id,
    name: proposal.author.name,
    role: proposal.author.role,
    section: proposal.assignedSection || 'ALL',
    title: proposal.title,
    ...(proposal.changeSummary?.description ? { desc: proposal.changeSummary.description } : {})
  });
  if (proposal.inviteToken) {
    queryParams.set('token', proposal.inviteToken);
  }
  if (proposal.permissions) {
    queryParams.set('docEdit', String(proposal.permissions.canEditDocument));
    queryParams.set('sheetEdit', String(proposal.permissions.canEditSpreadsheet));
  }
  return `${baseUrl}?${queryParams.toString()}`;
}

export function getProposals(): SecChangeProposal[] {
    const pending = getPendingProposals();
    if (pending) {
      return pending;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.PROPOSALS) || localStorage.getItem('sec_filing_proposals_v1') || localStorage.getItem('sec_filing_proposals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: SecChangeProposal) => ({
            ...p,
            blocks: sanitizeAndCompactBlocks(p.blocks || [])
          }));
        }
      } catch (e) {
        console.error('Failed to parse proposals from storage', e);
      }
    }
    safeSetItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(INITIAL_PROPOSALS));
    return JSON.parse(JSON.stringify(INITIAL_PROPOSALS));
}

export function saveProposals(proposals: SecChangeProposal[], immediate = false): boolean {
    setPendingProposals(proposals);
    if (immediate) {
      return flushPendingSaves();
    }
    const curTimer = getSaveProposalsTimer();
    if (curTimer) clearTimeout(curTimer);
    setSaveProposalsTimer(setTimeout(flushPendingSaves, 350));
    return true;
}

export function createProposal(
    title: string,
    author: { id: string; name: string; email: string; role: string },
    description: string,
    baseDoc: SecFilingDocument,
    assignedSection?: string
  ): SecChangeProposal {
    const proposals = getProposals();
    const newProposal: SecChangeProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: baseDoc.version,
      baseVersionNumber: baseDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(baseDoc.blocks)),
      assignedSection: assignedSection && assignedSection !== 'ALL' ? assignedSection : undefined,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: description || 'New proposed branch created'
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals);
    broadcastSync("PROPOSAL_CREATED", { proposalId: newProposal.id, title: newProposal.title });
    return newProposal;
}

export function createContributorInvite(params: {
    title: string;
    contributorName: string;
    contributorRole: string;
    contributorEmail?: string;
    assignedSection?: string;
    description?: string;
    permissions?: ContributorPermissions;
    baseDoc: SecFilingDocument;
  }): { proposal: SecChangeProposal; inviteUrl: string } {
    const proposals = getProposals();
    const propId = `prop-contrib-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const token = `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    const author = {
      id: `usr-contrib-${Date.now().toString(36)}`,
      name: params.contributorName,
      email: params.contributorEmail || `${params.contributorName.toLowerCase().replace(/\s+/g, '.')}@zenatech.com`,
      role: params.contributorRole
    };

    const newProposal: SecChangeProposal = {
      id: propId,
      title: params.title || `${params.contributorName}'s ${params.assignedSection || 'Filing'} Revisions`,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: params.baseDoc.version,
      baseVersionNumber: params.baseDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(params.baseDoc.blocks)),
      assignedSection: params.assignedSection && params.assignedSection !== 'ALL' ? params.assignedSection : undefined,
      inviteToken: token,
      permissions: params.permissions,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft assigned section workspace for ${params.contributorName}`
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals);

    const inviteUrl = getProposalInviteUrl(newProposal);

    broadcastSync("CONTRIBUTOR_INVITED", { proposalId: newProposal.id, name: params.contributorName });
    return { proposal: newProposal, inviteUrl };
}

export function getOrCreateContributorProposal(params: {
    id: string;
    title?: string;
    name?: string;
    role?: string;
    email?: string;
    section?: string;
    description?: string;
    permissions?: ContributorPermissions;
  }): SecChangeProposal {
    const proposals = getProposals();
    const existing = proposals.find((p) => p.id === params.id);
    if (existing) {
      return existing;
    }

    const mainDoc = getMainDocument();
    const author = {
      id: `contrib-${Date.now()}`,
      name: params.name || 'External Contributor',
      email: params.email || `${(params.name || 'contributor').toLowerCase().replace(/\s+/g, '.')}@zenatech.com`,
      role: params.role || 'Contributor'
    };

    const newProposal: SecChangeProposal = {
      id: params.id,
      title: params.title || `Contributor Draft - ${author.name}`,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: mainDoc.version,
      baseVersionNumber: mainDoc.versionNumber,
      blocks: JSON.parse(JSON.stringify(mainDoc.blocks)),
      assignedSection: params.section && params.section !== 'ALL' ? params.section : undefined,
      inviteToken: `inv-${Date.now().toString(36)}`,
      permissions: params.permissions,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft contributor session for ${author.name}`
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals);
    return newProposal;
}

export function forkProposalFromMerged(
    sourceProposalId: string,
    customBlocks?: SecBlock[],
    customTitle?: string
  ): SecChangeProposal {
    const proposals = getProposals();
    const source = proposals.find((p) => p.id === sourceProposalId);
    if (!source) {
      throw new Error(`Source proposal ${sourceProposalId} not found`);
    }

    const currentMain = getMainDocument();
    const newPropId = `prop-contrib-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const roundMatch = source.title.match(/\((?:Round|Revision)\s*(\d+)\)/i);
    let nextTitle = customTitle || source.title;
    if (!customTitle) {
      if (roundMatch) {
        const nextNum = parseInt(roundMatch[1], 10) + 1;
        nextTitle = source.title.replace(/\((?:Round|Revision)\s*\d+\)/i, `(Round ${nextNum})`);
      } else {
        nextTitle = `${source.title} (Round 2)`;
      }
    }

    const blocksToUse = customBlocks ? JSON.parse(JSON.stringify(customBlocks)) : JSON.parse(JSON.stringify(currentMain.blocks));
    const diffs = calculateDiffs(currentMain.blocks, blocksToUse);

    const newProposal: SecChangeProposal = {
      id: newPropId,
      title: nextTitle,
      author: { ...source.author },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      baseVersion: currentMain.version,
      baseVersionNumber: currentMain.versionNumber,
      blocks: blocksToUse,
      assignedSection: source.assignedSection,
      inviteToken: `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      changeSummary: {
        addedCount: diffs.filter((d) => d.status === 'added').length,
        modifiedCount: diffs.filter((d) => d.status === 'modified').length,
        deletedCount: diffs.filter((d) => d.status === 'deleted').length,
        description: `Follow-up revisions based on ${currentMain.version}`
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals, true);
    broadcastSync("PROPOSAL_UPDATED", { proposalId: newProposal.id });
    return newProposal;
}

export function updateProposal(proposal: SecChangeProposal): void {
    const proposals = getProposals();
    const idx = proposals.findIndex((p) => p.id === proposal.id);
    if (idx !== -1) {
      proposals[idx] = {
        ...proposal,
        updatedAt: new Date().toISOString()
      };
      saveProposals(proposals);
      broadcastSync("PROPOSAL_UPDATED", { proposalId: proposal.id });
    }
}

export function submitProposalForReview(
    proposalId: string,
    notes?: string
  ): { ok: boolean; reason?: 'not_found' | 'storage_full' } {
    const proposals = getProposals();
    const p = proposals.find((x) => x.id === proposalId);
    if (!p) {
      return { ok: false, reason: 'not_found' };
    }
    p.status = 'pending_review';
    p.submissionNotes = notes;
    p.submittedAt = new Date().toISOString();
    p.updatedAt = new Date().toISOString();
    // Write through immediately. The broadcast below makes other tabs re-read storage
    // at once, so a debounced write would have them reload a proposal list that does
    // not contain the submission yet.
    const persisted = saveProposals(proposals, true);
    if (!persisted) {
      // The submission is live in this session but did not reach storage, so the
      // Lead Controller would never see it. Report it instead of claiming success.
      return { ok: false, reason: 'storage_full' };
    }
    broadcastSync("PROPOSAL_SUBMITTED", { author: p.author.name, proposalId: p.id, title: p.title });
    return { ok: true };
}

export function mergeSelectiveChanges(
    proposalId: string,
    acceptedBlockIds: string[],
    reviewerName: string,
    reviewNotes?: string
  ): { updatedDoc: SecFilingDocument; newSnapshot: SecVersionSnapshot } {
    const proposals = getProposals();
    const proposal = proposals.find((x) => x.id === proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const currentMain = getMainDocument();
    const diffs = calculateDiffs(currentMain.blocks, proposal.blocks);
    const acceptedSet = new Set(acceptedBlockIds);

    let mergedBlocks: SecBlock[] = JSON.parse(JSON.stringify(currentMain.blocks));

    for (const diff of diffs) {
      if (acceptedSet.has(diff.blockId)) {
        if (diff.status === 'modified' && diff.proposedBlock) {
          const idx = mergedBlocks.findIndex((b) => b.id === diff.blockId);
          if (idx !== -1) {
            mergedBlocks[idx] = JSON.parse(JSON.stringify(diff.proposedBlock));
          }
        } else if (diff.status === 'deleted') {
          mergedBlocks = mergedBlocks.filter((b) => b.id !== diff.blockId);
        }
      }
    }

    for (const diff of diffs) {
      if (diff.status === 'added' && diff.proposedBlock && acceptedSet.has(diff.blockId)) {
        const propIndex = proposal.blocks.findIndex((b) => b.id === diff.blockId);
        let insertIndex = mergedBlocks.length;
        if (propIndex > 0) {
          const prevPropBlock = proposal.blocks[propIndex - 1];
          const mainPrevIdx = mergedBlocks.findIndex((b) => b.id === prevPropBlock.id);
          if (mainPrevIdx !== -1) {
            insertIndex = mainPrevIdx + 1;
          }
        }
        mergedBlocks.splice(insertIndex, 0, JSON.parse(JSON.stringify(diff.proposedBlock)));
      }
    }

    const nextVersionNumber = currentMain.versionNumber + 1;
    const nextVersionLabel = `v${nextVersionNumber} (Merged ${proposal.author.name})`;
    const versionHistory = getVersionHistory();

    const updatedMain: SecFilingDocument = {
      ...currentMain,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      blocks: mergedBlocks,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: reviewerName
    };

    // Write the merged document through immediately and abort the merge if it does not
    // reach storage, so the proposal is never marked merged against a document that was
    // silently rolled back.
    if (!saveMainDocument(updatedMain, true)) {
      throw new Error(
        'Browser storage is full, so the merged document could not be saved. Clear older version history or merged drafts for this filing, then merge again.'
      );
    }

    const newSnapshot: SecVersionSnapshot = {
      id: `snap-v${nextVersionNumber}-${Date.now()}`,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      timestamp: new Date().toISOString(),
      author: reviewerName,
      description: `Confirmed and merged ${acceptedBlockIds.length} changes from "${proposal.title}" by ${proposal.author.name}. ${reviewNotes || ''}`,
      blocks: JSON.parse(JSON.stringify(mergedBlocks)),
      proposalId: proposal.id
    };
    versionHistory.push(newSnapshot);
    saveVersionHistory(versionHistory);

    proposal.status = 'merged';
    proposal.reviewedBy = reviewerName;
    proposal.reviewedAt = new Date().toISOString();
    proposal.reviewNotes = reviewNotes;
    saveProposals(proposals, true);
    broadcastSync("DOC_MERGED", { reviewer: reviewerName, proposalId: proposal.id });

    return { updatedDoc: updatedMain, newSnapshot };
}

export function mergeProposalIntoMain(
    proposalId: string,
    reviewerName: string,
    reviewNotes?: string
  ): { updatedDoc: SecFilingDocument; newSnapshot: SecVersionSnapshot } {
    const proposals = getProposals();
    const proposal = proposals.find((x) => x.id === proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    const allDiffs = calculateDiffs(getMainDocument().blocks, proposal.blocks);
    const allChangedIds = allDiffs.filter((d) => d.status !== 'unchanged').map((d) => d.blockId);
    return mergeSelectiveChanges(proposalId, allChangedIds, reviewerName, reviewNotes);
}

export function rejectProposal(proposalId: string, reviewerName: string, reviewNotes: string): void {
    const proposals = getProposals();
    const p = proposals.find((x) => x.id === proposalId);
    if (p) {
      p.status = 'rejected';
      p.reviewedBy = reviewerName;
      p.reviewedAt = new Date().toISOString();
      p.reviewNotes = reviewNotes;
      saveProposals(proposals);
    }
}