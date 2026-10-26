import type {
  SecChangeProposal,
  SecFilingDocument,
  SecVersionSnapshot,
  SecBlock
} from '../../types/secFiling';
import type { ContributorPermissions } from '../../types/collaborator';
import { INITIAL_PROPOSALS } from '../../data/initialSecFilingData';
import {
  docStore,
  STORAGE_KEYS,
  safeSetItem,
  flushPendingSaves,
  broadcastSync,
  getPendingProposals,
  setPendingProposals,
  getSaveProposalsTimer,
  setSaveProposalsTimer,
  getPendingMainDoc
} from './secFilingStorage';
import { sanitizeAndCompactBlocks } from './secFilingSanitizer';
import { flushRemote, isDocStoreServerBacked } from './secFilingStore';
import { addDocumentInvitee, getActiveDocumentId } from './secFilingCore';
import { calculateDiffs } from './secFilingDiff';
import {
  getMainDocument,
  saveMainDocument,
  getVersionHistory,
  saveVersionHistory
} from './secFilingCore';
import { saveSpreadsheet } from './secFilingSpreadsheet';

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
    if (proposal.permissions.canMergeAndApprove !== undefined) {
      queryParams.set('canMerge', String(proposal.permissions.canMergeAndApprove));
    }
  }
  return `${baseUrl}?${queryParams.toString()}`;
}

/** The document proposals are read and written for: the one open in the editor. */
function currentDocumentId(): string {
    const pendingMain = getPendingMainDoc();
    if (pendingMain?.id) return pendingMain.id;
    try {
      const main = JSON.parse(docStore.getItem(STORAGE_KEYS.MAIN_DOC) || 'null');
      if (main?.id) return main.id;
    } catch {
      // fall through
    }
    return getActiveDocumentId();
}

/** Every loaded proposal, across documents. */
function getAllProposals(): SecChangeProposal[] {
    const pending = getPendingProposals();
    if (pending) {
      return pending;
    }
    const saved = docStore.getItem(STORAGE_KEYS.PROPOSALS) || docStore.getItem('sec_filing_proposals_v1') || docStore.getItem('sec_filing_proposals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && (parsed.length > 0 || isDocStoreServerBacked())) {
          return parsed.map((p: SecChangeProposal) => ({
            ...p,
            blocks: sanitizeAndCompactBlocks(p.blocks || [])
          }));
        }
      } catch (e) {
        console.error('Failed to parse proposals from storage', e);
      }
    }
    // Demo proposals only for the old browser-only mode; on the server an empty list is real.
    if (isDocStoreServerBacked()) return [];
    safeSetItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(INITIAL_PROPOSALS));
    return JSON.parse(JSON.stringify(INITIAL_PROPOSALS));
}

/**
 * Proposals of the open document. They used to be one list shared by every document,
 * so a branch made on one filing showed up on all of them; older proposals without a
 * documentId still show everywhere until they are next saved (which tags them).
 */
export function getProposals(): SecChangeProposal[] {
    const docId = currentDocumentId();
    return getAllProposals().filter((p) => !p.documentId || p.documentId === docId);
}

export function saveProposals(proposals: SecChangeProposal[], immediate = false): boolean {
    const docId = currentDocumentId();
    const sanitized = proposals.map((p) => ({
      ...p,
      documentId: p.documentId || docId,
      blocks: sanitizeAndCompactBlocks(p.blocks || [])
    }));

    const ordered = sanitized.sort((a, b) => {
      if (a.status === 'pending_review' && b.status !== 'pending_review') return -1;
      if (b.status === 'pending_review' && a.status !== 'pending_review') return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    // The 4-proposal cap only existed to fit browser storage; the server keeps them all.
    const kept = isDocStoreServerBacked() ? ordered : ordered.slice(0, 4);

    // Keep other documents' proposals untouched.
    const keptIds = new Set(kept.map((p) => p.id));
    const others = getAllProposals().filter(
      (p) => p.documentId && p.documentId !== docId && !keptIds.has(p.id)
    );

    setPendingProposals([...kept, ...others]);
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
      attachedSpreadsheet: baseDoc.attachedSpreadsheet
        ? JSON.parse(JSON.stringify(baseDoc.attachedSpreadsheet))
        : null,
      assignedSection: assignedSection && assignedSection !== 'ALL' ? assignedSection : undefined,
      documentId: baseDoc.id,
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
      attachedSpreadsheet: params.baseDoc.attachedSpreadsheet
        ? JSON.parse(JSON.stringify(params.baseDoc.attachedSpreadsheet))
        : null,
      assignedSection: params.assignedSection && params.assignedSection !== 'ALL' ? params.assignedSection : undefined,
      inviteToken: token,
      permissions: params.permissions,
      documentId: params.baseDoc.id,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft assigned section workspace for ${params.contributorName}`
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals, true);

    // Register invited contributor on the document for access permission
    if (params.baseDoc?.id && author.email) {
      addDocumentInvitee(params.baseDoc.id, author.email);
    }
    // The contributor may open the link right away (often in a new tab or on another
    // machine), so send the proposal and the invite to the server now.
    void flushRemote();

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
      attachedSpreadsheet: mainDoc.attachedSpreadsheet
        ? JSON.parse(JSON.stringify(mainDoc.attachedSpreadsheet))
        : null,
      assignedSection: params.section && params.section !== 'ALL' ? params.section : undefined,
      inviteToken: `inv-${Date.now().toString(36)}`,
      permissions: params.permissions,
      documentId: mainDoc.id,
      changeSummary: {
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        description: params.description || `Draft contributor session for ${author.name}`
      }
    };

    proposals.unshift(newProposal);
    saveProposals(proposals);

    // Register invited contributor on the document for access permission
    if (mainDoc.id && author.email) {
      addDocumentInvitee(mainDoc.id, author.email);
    }
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

    const sheetToUse = source.attachedSpreadsheet
      ? JSON.parse(JSON.stringify(source.attachedSpreadsheet))
      : currentMain.attachedSpreadsheet
      ? JSON.parse(JSON.stringify(currentMain.attachedSpreadsheet))
      : null;

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
      attachedSpreadsheet: sheetToUse,
      assignedSection: source.assignedSection,
      inviteToken: `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      documentId: source.documentId || currentMain.id,
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
    // The reviewer is usually someone else on another machine; send it now.
    void flushRemote();
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

    let mergedSpreadsheet = currentMain.attachedSpreadsheet || null;
    if (proposal.attachedSpreadsheet) {
      const baseSheet = currentMain.attachedSpreadsheet || proposal.attachedSpreadsheet;
      const baseTabs = baseSheet.tabs || [];
      const propTabs = proposal.attachedSpreadsheet.tabs || [];

      // Proposed tabs represent the authoritative new structure (rows, columns, headers, cells)
      // for the workbook. Any tabs present in proposal take full precedence, while any
      // unreferenced legacy tabs in base are preserved.
      const propTabIds = new Set(propTabs.map(t => t.id || t.name));
      const untouchedBaseTabs = baseTabs.filter(b => !propTabIds.has(b.id) && !propTabIds.has(b.name));

      const mergedTabs = [
        ...propTabs.map(pTab => ({
          ...pTab,
          cells: { ...(pTab.cells || {}) }
        })),
        ...untouchedBaseTabs
      ];

      mergedSpreadsheet = {
        ...baseSheet,
        ...proposal.attachedSpreadsheet,
        cells: {
          ...(proposal.attachedSpreadsheet.cells || propTabs[0]?.cells || {})
        },
        tabs: mergedTabs.length > 0 ? mergedTabs : proposal.attachedSpreadsheet.tabs || baseSheet.tabs,
        updatedAt: new Date().toISOString()
      };
      saveSpreadsheet(mergedSpreadsheet, false, true);
    }

    const updatedMain: SecFilingDocument = {
      ...currentMain,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      blocks: mergedBlocks,
      attachedSpreadsheet: mergedSpreadsheet,
      attachedSpreadsheetId: mergedSpreadsheet?.id || currentMain.attachedSpreadsheetId,
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
      proposalId: proposal.id,
      documentId: updatedMain.id
    };
    versionHistory.push(newSnapshot);
    saveVersionHistory(versionHistory);

    proposal.status = 'merged';
    proposal.reviewedBy = reviewerName;
    proposal.reviewedAt = new Date().toISOString();
    proposal.reviewNotes = reviewNotes;
    saveProposals(proposals, true);
    void flushRemote();
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