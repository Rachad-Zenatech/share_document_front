import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  SecFilingDocument,
  SecChangeProposal,
  SecVersionSnapshot,
  SecBlock,
  SecBlockType,
  SecBlockDiff,
  SecBlockSpacing,
  SecHeadingBlock,
  SecParagraphBlock,
  SecFinancialTableBlock,
  SecTableRow
} from '../types/secFiling';
import { secFilingService, setStorageFailureListener, getProposalInviteUrl } from '../services/secFilingService';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { ZENATECH_LOGO_DATA_URL } from '../data/zenatechLogoAsset';

export type UserFilingRole = 'LEAD_CONTROLLER' | 'CONTRIBUTOR';

export function useSecFiling() {
  const { user } = useAuth();

  // --------------------------------------------------------------------------
  // 1. ALL STATE & REFS (Strictly ordered at the top)
  // --------------------------------------------------------------------------
  const [activeRole, setActiveRole] = useState<UserFilingRole>('LEAD_CONTROLLER');
  const [mainDoc, setMainDoc] = useState<SecFilingDocument>(() => secFilingService.getMainDocument());
  const [proposals, setProposals] = useState<SecChangeProposal[]>(() => secFilingService.getProposals());
  const [versionHistory, setVersionHistory] = useState<SecVersionSnapshot[]>(() =>
    secFilingService.getVersionHistory()
  );
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [contributorSession, setContributorSession] = useState<{
    isContributor: boolean;
    name?: string;
    role?: string;
    assignedSection?: string;
  }>({ isContributor: false });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);

  const [undoStack, setUndoStack] = useState<SecBlock[][]>([]);
  const [redoStack, setRedoStack] = useState<SecBlock[][]>([]);
  const isUndoRedoActionRef = useRef<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. CORE MEMOS (Derived working document & structure)
  // --------------------------------------------------------------------------
  const activeProposal = useMemo(() => {
    return proposals.find((p) => p.id === activeProposalId) || null;
  }, [proposals, activeProposalId]);

  const workingBlocks = useMemo(() => {
    if (activeProposal) {
      return activeProposal.blocks;
    }
    return mainDoc.blocks;
  }, [activeProposal, mainDoc.blocks]);

  const documentSections = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (const b of workingBlocks) {
      if (b.section && !seen.has(b.section)) {
        seen.add(b.section);
        list.push(b.section);
      }
    }
    return list;
  }, [workingBlocks]);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of workingBlocks) {
      if (b.section) {
        counts[b.section] = (counts[b.section] || 0) + 1;
      }
    }
    return counts;
  }, [workingBlocks]);

  const filteredBlocks = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) {
      return workingBlocks;
    }
    return workingBlocks.filter((b) => {
      if (b.type === 'heading' && b.text.toLowerCase().includes(trimmedQuery)) return true;
      if (b.type === 'paragraph' && b.text.toLowerCase().includes(trimmedQuery)) return true;
      if (b.type === 'callout' && (b.content.toLowerCase().includes(trimmedQuery) || b.title?.toLowerCase().includes(trimmedQuery)))
        return true;
      if (b.type === 'financial_table') {
        if (b.title?.toLowerCase().includes(trimmedQuery)) return true;
        if (b.headers.some((h) => h.toLowerCase().includes(trimmedQuery))) return true;
        if (b.rows.some((r) => r.cells.some((c) => c.toLowerCase().includes(trimmedQuery)))) return true;
      }
      return false;
    });
  }, [workingBlocks, searchQuery]);

  // --------------------------------------------------------------------------
  // 3. ALL CALLBACKS
  // --------------------------------------------------------------------------
  const refreshAll = useCallback(() => {
    setMainDoc(secFilingService.getMainDocument());
    setProposals(secFilingService.getProposals());
    setVersionHistory(secFilingService.getVersionHistory());
  }, []);

  const toggleBlockSelection = useCallback((id: string, multiSelect = false) => {
    setSelectedBlockIds((prev) => {
      if (!multiSelect) {
        if (prev.length === 1 && prev[0] === id) {
          setSelectedBlockId(null);
          return [];
        }
        setSelectedBlockId(id);
        return [id];
      }
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      setSelectedBlockId(next.length > 0 ? next[next.length - 1] : null);
      return next;
    });
  }, []);

  const selectAllBlocks = useCallback(() => {
    const allIds = workingBlocks.map((b) => b.id);
    setSelectedBlockIds(allIds);
    if (allIds.length > 0) setSelectedBlockId(allIds[0]);
    toast.info(`Selected all ${allIds.length} blocks`);
  }, [workingBlocks]);

  const clearBlockSelection = useCallback(() => {
    setSelectedBlockIds([]);
    setSelectedBlockId(null);
  }, []);

  const calculateDiffForProposal = useCallback(
    (proposal: SecChangeProposal): SecBlockDiff[] => {
      // Find the base version snapshot if present in history
      const versionHistory = secFilingService.getVersionHistory();
      const baseSnap = versionHistory.find((v) => v.versionNumber === proposal.baseVersionNumber);
      return secFilingService.calculateDiffs(mainDoc.blocks, proposal.blocks, baseSnap?.blocks);
    },
    [mainDoc.blocks]
  );

  const handleForkProposal = useCallback(
    (sourceProposalId?: string, customBlocks?: SecBlock[], customTitle?: string) => {
      const targetId = sourceProposalId || activeProposalId;
      if (!targetId) return null;
      try {
        const forked = secFilingService.forkProposalFromMerged(targetId, customBlocks, customTitle);
        setProposals(secFilingService.getProposals());
        setActiveProposalId(forked.id);

        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('proposalId', forked.id);
          url.searchParams.set('title', forked.title);
          window.history.replaceState({}, '', url.toString());

          const inviteUrl = getProposalInviteUrl(forked);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(inviteUrl).catch(() => {});
          }
        }

        toast.success(`Started new revision draft: "${forked.title}"`, {
          description: 'A new share link has been created and copied to clipboard. Ready for a new review!'
        });
        return forked;
      } catch (err: any) {
        toast.error(err.message || 'Failed to start new proposal draft');
        return null;
      }
    },
    [activeProposalId]
  );

  const applyWorkingBlocks = useCallback(
    (newBlocks: SecBlock[]) => {
      if (activeProposal) {
        // If this proposal was already merged into Main, auto-fork into a new proposal
        // so edits are not lost, merged history remains immutable, and a new link is established!
        if (activeProposal.status === 'merged') {
          handleForkProposal(activeProposal.id, newBlocks);
          return;
        }

        const updatedProposal: SecChangeProposal = {
          ...activeProposal,
          blocks: newBlocks,
          updatedAt: new Date().toISOString()
        };
        const diffs = secFilingService.calculateDiffs(mainDoc.blocks, newBlocks);
        updatedProposal.changeSummary = {
          ...updatedProposal.changeSummary,
          addedCount: diffs.filter((d) => d.status === 'added').length,
          modifiedCount: diffs.filter((d) => d.status === 'modified').length,
          deletedCount: diffs.filter((d) => d.status === 'deleted').length
        };

        secFilingService.updateProposal(updatedProposal);
        setProposals((prev) => prev.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)));
      } else {
        const updatedMain: SecFilingDocument = {
          ...mainDoc,
          blocks: newBlocks,
          updatedAt: new Date().toISOString(),
          lastModifiedBy: user?.full_name || 'Controller'
        };
        secFilingService.saveMainDocument(updatedMain);
        setMainDoc(updatedMain);
      }
    },
    [activeProposal, mainDoc, user, handleForkProposal]
  );

  const setWorkingBlocks = useCallback(
    (newBlocks: SecBlock[]) => {
      if (!isUndoRedoActionRef.current) {
        const hasChanged =
          workingBlocks.length !== newBlocks.length ||
          workingBlocks.some((b, i) => b !== newBlocks[i]);
        if (hasChanged) {
          setUndoStack((prev) => {
            const next = [...prev, workingBlocks];
            if (next.length > 60) return next.slice(next.length - 60);
            return next;
          });
          setRedoStack([]);
        }
      }
      applyWorkingBlocks(newBlocks);
    },
    [workingBlocks, applyWorkingBlocks]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      toast.info('Nothing to undo');
      return;
    }

    const previousSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = workingBlocks;

    isUndoRedoActionRef.current = true;
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, currentSnapshot]);
    applyWorkingBlocks(previousSnapshot);
    isUndoRedoActionRef.current = false;

    toast.info('Undid last change (Ctrl+Z / ⌘Z)');
  }, [undoStack, workingBlocks, applyWorkingBlocks]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) {
      toast.info('Nothing to redo');
      return;
    }

    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = workingBlocks;

    isUndoRedoActionRef.current = true;
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, currentSnapshot]);
    applyWorkingBlocks(nextSnapshot);
    isUndoRedoActionRef.current = false;

    toast.info('Redid change (Ctrl+Y / ⌘⇧Z)');
  }, [redoStack, workingBlocks, applyWorkingBlocks]);

  const addBlock = useCallback(
    (index: number, type: SecBlockType, defaultSection?: string, customBlock?: Partial<SecBlock>) => {
      let section = defaultSection && defaultSection !== 'ALL' ? defaultSection : '';
      if (!section && type === 'heading') {
        let sName = 'New Section';
        let c = 1;
        const existingSections = new Set(workingBlocks.map((b) => b.section).filter(Boolean));
        while (existingSections.has(sName)) {
          c++;
          sName = `New Section ${c}`;
        }
        section = sName;
      } else if (!section) {
        section = workingBlocks[index]?.section || 'General Disclosures';
      }

      const blockId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let newBlock: SecBlock;

      switch (type) {
        case 'heading': {
          const isNewNamedSection = !defaultSection || defaultSection === 'ALL';
          const headingText = isNewNamedSection ? section : 'New Section Heading';
          newBlock = {
            id: blockId,
            type: 'heading',
            section,
            level: 2,
            text: headingText,
            alignment: 'left',
            bold: true,
            spacingTop: 12,
            spacing: 'normal'
          };
          break;
        }
        case 'paragraph':
          newBlock = {
            id: blockId,
            type: 'paragraph',
            section,
            text: 'Enter paragraph disclosure text here...',
            alignment: 'left',
            spacingTop: 6,
            spacing: 'normal'
          };
          break;
        case 'financial_table': {
          const customFt = customBlock as Partial<SecFinancialTableBlock> | undefined;
          // Copy cells as well as rows: templates are module-level constants, so a
          // shared cells array would let edits on one inserted table leak into the next.
          const freshRows: SecTableRow[] = customFt?.rows
            ? customFt.rows.map((r, rIdx) => ({
                ...r,
                cells: [...r.cells],
                ...(r.cellAlignments ? { cellAlignments: [...r.cellAlignments] } : {}),
                id: `r-${Date.now()}-${rIdx}-${Math.random().toString(36).substring(2, 6)}`
              }))
            : [
                { id: `r-${Date.now()}-1`, type: 'data', cells: ['Item Revenue or Asset', '', '1,250,000', '980,000'] },
                { id: `r-${Date.now()}-2`, type: 'data', cells: ['Direct Operating Cost', '', '(450,000)', '(320,000)'] },
                { id: `r-${Date.now()}-3`, type: 'total', cells: ['Total Net Amount', '', '800,000', '660,000'], bold: true, underline: true, doubleUnderline: true }
              ];
          newBlock = {
            id: blockId,
            type: 'financial_table',
            section: customFt?.section || section,
            title: customFt?.title || 'Schedule of Financial Details',
            headers: customFt?.headers ? [...customFt.headers] : ['Description / Line Item', 'Note Ref', 'Q2 2026 ($)', 'Q2 2025 ($)'],
            ...(customFt?.headerShading ? { headerShading: customFt.headerShading } : {}),
            ...(customFt?.periodHeaders
              ? {
                  periodHeaders: customFt.periodHeaders.map((header) => ({
                    ...header,
                    lines: [...header.lines]
                  }))
                }
              : {}),
            columnAlignments: customFt?.columnAlignments ? [...customFt.columnAlignments] : ['left', 'center', 'right', 'right'],
            columnWidths: customFt?.columnWidths ? [...customFt.columnWidths] : ['50%', '10%', '20%', '20%'],
            rows: freshRows,
            spacingTop: customFt?.spacingTop ?? 12,
            spacing: customFt?.spacing ?? 'normal',
            ...(customFt?.footnotes ? { footnotes: [...customFt.footnotes] } : {})
          };
          break;
        }
        case 'callout':
          newBlock = {
            id: blockId,
            type: 'callout',
            section,
            variant: 'notice',
            title: 'Regulatory Compliance Note',
            content: 'This section contains unaudited forward-looking statements subject to safe harbor provisions.',
            spacingTop: 10,
            spacing: 'normal'
          };
          break;
        case 'signature':
          newBlock = {
            id: blockId,
            type: 'signature',
            section,
            title: 'Authorized Corporate Signatures',
            officers: [
              {
                id: `off-${Date.now()}-1`,
                name: user?.full_name || 'Authorized Officer',
                title: 'Principal Financial Officer',
                date: new Date().toISOString().split('T')[0],
                signatureText: '',
                signed: false
              }
            ],
            spacingTop: 16,
            spacing: 'normal'
          };
          break;
        case 'divider':
          newBlock = {
            id: blockId,
            type: 'divider',
            section,
            pageBreak: true,
            label: 'New Section Break',
            spacingTop: 16,
            spacing: 'normal'
          };
          break;
        case 'metadata':
          newBlock = {
            id: blockId,
            type: 'metadata',
            section,
            companyName: 'ZenaTech, Inc.',
            symbol: 'ZENA',
            cik: '0001987654',
            formType: 'Form 6-K',
            periodEnded: 'June 30, 2026',
            currency: 'CAD ($)',
            fiscalYear: '2026',
            filingDate: new Date().toISOString().split('T')[0],
            documentTitle: 'Interim Financial Report',
            jurisdiction: 'SEC EDGAR',
            spacingTop: 12,
            spacing: 'normal'
          };
          break;
        case 'image':
          newBlock = {
            id: blockId,
            type: 'image',
            section,
            url: ZENATECH_LOGO_DATA_URL,
            alt: 'ZenaTech Logo',
            caption: '',
            alignment: 'center',
            width: 260,
            spacingTop: 10,
            spacing: 'normal'
          };
          break;
        default:
          newBlock = {
            id: blockId,
            type: 'paragraph',
            section,
            text: '',
            alignment: 'left',
            spacingTop: 6,
            spacing: 'normal'
          };
      }

      const nextBlocks = [...workingBlocks];
      const targetIdx = index >= 0 && index <= nextBlocks.length ? index : nextBlocks.length;
      nextBlocks.splice(targetIdx, 0, newBlock);
      setWorkingBlocks(nextBlocks);
      setSelectedBlockId(newBlock.id);
      toast.success(`Added new ${type.replace('_', ' ')} block`);
    },
    [workingBlocks, setWorkingBlocks, user]
  );

  const updateBlock = useCallback(
    (id: string, updates: Partial<SecBlock>) => {
      const currentBlock = workingBlocks.find((b) => b.id === id);
      if (!currentBlock) return;

      const oldSection = currentBlock.section;
      let newSection: string | undefined;

      if (typeof updates.section === 'string' && updates.section.trim() !== '') {
        const trimmedSec = updates.section.trim();
        if (trimmedSec !== oldSection) {
          newSection = trimmedSec;
        }
      }

      const headingTextUpdate = (updates as any).text;
      if (currentBlock.type === 'heading' && typeof headingTextUpdate === 'string') {
        const trimmedText = headingTextUpdate.trim();
        const isFirstInSection =
          workingBlocks.findIndex((b) => b.section === oldSection) ===
          workingBlocks.findIndex((b) => b.id === id);
        const matchesOldSection =
          currentBlock.text.trim().toLowerCase() === oldSection.trim().toLowerCase();
        const isGenericSection =
          oldSection === 'General Disclosures' || oldSection.startsWith('New Section');

        if (trimmedText && (matchesOldSection || isFirstInSection || isGenericSection)) {
          newSection = trimmedText;
          updates.section = trimmedText;
        }
      }

      const nextBlocks = workingBlocks.map((b) => {
        if (b.id === id) {
          const updated = {
            ...b,
            ...updates,
            updatedAt: new Date().toISOString(),
            modifiedBy: user?.full_name || 'User'
          } as SecBlock;

          if (newSection) {
            updated.section = newSection;
          }
          return updated;
        }

        if (newSection && b.section === oldSection) {
          const updatedSibling: SecBlock = {
            ...b,
            section: newSection,
            updatedAt: new Date().toISOString()
          };
          if (
            updatedSibling.type === 'heading' &&
            updatedSibling.text.trim() === oldSection.trim()
          ) {
            (updatedSibling as SecHeadingBlock).text = newSection;
          }
          return updatedSibling;
        }

        return b;
      });

      setWorkingBlocks(nextBlocks);

      if (newSection && sectionFilter === oldSection) {
        setSectionFilter(newSection);
      }
    },
    [workingBlocks, setWorkingBlocks, user, sectionFilter, setSectionFilter]
  );

  const moveBlock = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = workingBlocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === workingBlocks.length - 1) return;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      const nextBlocks = [...workingBlocks];
      const [moved] = nextBlocks.splice(idx, 1);
      nextBlocks.splice(targetIdx, 0, moved);
      setWorkingBlocks(nextBlocks);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const moveMultipleBlocks = useCallback(
    (ids: string[], direction: 'up' | 'down') => {
      if (!ids || ids.length === 0) return;
      const selectedSet = new Set(ids);
      const indices = workingBlocks
        .map((b, i) => (selectedSet.has(b.id) ? i : -1))
        .filter((i) => i !== -1);

      if (indices.length === 0) return;
      if (direction === 'up' && indices[0] === 0) return;
      if (direction === 'down' && indices[indices.length - 1] === workingBlocks.length - 1) return;

      const nextBlocks = [...workingBlocks];
      if (direction === 'up') {
        for (let i = 1; i < nextBlocks.length; i++) {
          if (selectedSet.has(nextBlocks[i].id) && !selectedSet.has(nextBlocks[i - 1].id)) {
            const temp = nextBlocks[i];
            nextBlocks[i] = nextBlocks[i - 1];
            nextBlocks[i - 1] = temp;
          }
        }
      } else {
        for (let i = nextBlocks.length - 2; i >= 0; i--) {
          if (selectedSet.has(nextBlocks[i].id) && !selectedSet.has(nextBlocks[i + 1].id)) {
            const temp = nextBlocks[i];
            nextBlocks[i] = nextBlocks[i + 1];
            nextBlocks[i + 1] = temp;
          }
        }
      }

      setWorkingBlocks(nextBlocks);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const duplicateMultipleBlocks = useCallback(
    (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      const selectedSet = new Set(ids);
      const blocksToClone = workingBlocks.filter((b) => selectedSet.has(b.id));
      if (blocksToClone.length === 0) return;

      const lastIdx = workingBlocks.reduce(
        (max, b, i) => (selectedSet.has(b.id) ? Math.max(max, i) : max),
        0
      );

      const clonedList: SecBlock[] = blocksToClone.map((block) => ({
        ...JSON.parse(JSON.stringify(block)),
        id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        updatedAt: new Date().toISOString()
      }));

      const nextBlocks = [...workingBlocks];
      nextBlocks.splice(lastIdx + 1, 0, ...clonedList);
      setWorkingBlocks(nextBlocks);
      setSelectedBlockIds(clonedList.map((c) => c.id));
      setSelectedBlockId(clonedList[0].id);
      toast.success(`Duplicated ${clonedList.length} blocks`);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const deleteMultipleBlocks = useCallback(
    (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      if (workingBlocks.length <= ids.length) {
        toast.error('Cannot delete all blocks in the document');
        return;
      }
      const selectedSet = new Set(ids);
      const nextBlocks = workingBlocks.filter((b) => !selectedSet.has(b.id));
      setWorkingBlocks(nextBlocks);
      setSelectedBlockIds([]);
      setSelectedBlockId(null);
      toast.success(`Deleted ${ids.length} blocks`);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const moveMultipleBlocksToSection = useCallback(
    (ids: string[], targetSection: string) => {
      if (!ids || ids.length === 0) return;
      const selectedSet = new Set(ids);
      const nextBlocks = workingBlocks.map((b) => {
        if (selectedSet.has(b.id)) {
          return { ...b, section: targetSection, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      setWorkingBlocks(nextBlocks);
      toast.success(`Moved ${ids.length} blocks to "${targetSection}"`);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const updateMultipleBlocksSpacing = useCallback(
    (ids: string[], spacing: SecBlockSpacing) => {
      if (!ids || ids.length === 0) return;
      const selectedSet = new Set(ids);
      const nextBlocks = workingBlocks.map((b) => {
        if (selectedSet.has(b.id)) {
          return { ...b, spacing, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      setWorkingBlocks(nextBlocks);
      toast.success(`Updated spacing to "${spacing}" for ${ids.length} blocks`);
    },
    [workingBlocks, setWorkingBlocks]
  );

  const moveSection = useCallback(
    (sectionName: string, direction: 'up' | 'down') => {
      if (!sectionName) return;

      const currentIdx = documentSections.indexOf(sectionName);
      if (currentIdx === -1) return;
      if (direction === 'up' && currentIdx === 0) return;
      if (direction === 'down' && currentIdx === documentSections.length - 1) return;

      const targetSecIndex = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
      const targetSection = documentSections[targetSecIndex];

      const sectionBlocks = workingBlocks.filter((b) => b.section === sectionName);
      const otherBlocks = workingBlocks.filter((b) => b.section !== sectionName);

      const nextBlocks = [...otherBlocks];
      if (direction === 'up') {
        const insertIdx = otherBlocks.findIndex((b) => b.section === targetSection);
        nextBlocks.splice(insertIdx !== -1 ? insertIdx : 0, 0, ...sectionBlocks);
        setWorkingBlocks(nextBlocks);
        toast.success(`Moved section "${sectionName}" before "${targetSection}"`);
      } else {
        let lastIdx = -1;
        for (let i = otherBlocks.length - 1; i >= 0; i--) {
          if (otherBlocks[i].section === targetSection) {
            lastIdx = i;
            break;
          }
        }
        nextBlocks.splice(lastIdx !== -1 ? lastIdx + 1 : otherBlocks.length, 0, ...sectionBlocks);
        setWorkingBlocks(nextBlocks);
        toast.success(`Moved section "${sectionName}" after "${targetSection}"`);
      }
    },
    [workingBlocks, documentSections, setWorkingBlocks]
  );

  const reorderSection = useCallback(
    (sectionName: string, targetSecIndex: number) => {
      if (!sectionName) return;

      const currentIdx = documentSections.indexOf(sectionName);
      if (currentIdx === -1 || targetSecIndex < 0 || targetSecIndex >= documentSections.length || currentIdx === targetSecIndex) {
        return;
      }

      const sectionBlocks = workingBlocks.filter((b) => b.section === sectionName);
      const otherBlocks = workingBlocks.filter((b) => b.section !== sectionName);

      const targetSection = documentSections[targetSecIndex];
      const nextBlocks = [...otherBlocks];

      if (targetSecIndex < currentIdx) {
        const insertIdx = otherBlocks.findIndex((b) => b.section === targetSection);
        nextBlocks.splice(insertIdx !== -1 ? insertIdx : 0, 0, ...sectionBlocks);
      } else {
        let lastIdx = -1;
        for (let i = otherBlocks.length - 1; i >= 0; i--) {
          if (otherBlocks[i].section === targetSection) {
            lastIdx = i;
            break;
          }
        }
        nextBlocks.splice(lastIdx !== -1 ? lastIdx + 1 : otherBlocks.length, 0, ...sectionBlocks);
      }

      setWorkingBlocks(nextBlocks);
      toast.success(`Moved section "${sectionName}"`);
    },
    [workingBlocks, documentSections, setWorkingBlocks]
  );

  const createSection = useCallback(
    (name = 'New Section') => {
      let sectionName = name;
      let counter = 1;
      const existingSections = new Set(workingBlocks.map((b) => b.section).filter(Boolean));
      while (existingSections.has(sectionName)) {
        counter++;
        sectionName = `${name} ${counter}`;
      }

      const headingId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const paragraphId = `block-${Date.now() + 1}-${Math.random().toString(36).substring(2, 6)}`;

      const newHeading: SecHeadingBlock = {
        id: headingId,
        type: 'heading',
        section: sectionName,
        level: 2,
        text: sectionName,
        alignment: 'left',
        bold: true,
        spacingTop: 14,
        spacing: 'normal'
      };

      const newParagraph: SecParagraphBlock = {
        id: paragraphId,
        type: 'paragraph',
        section: sectionName,
        text: 'Enter paragraph disclosure text here...',
        alignment: 'left',
        spacingTop: 6,
        spacing: 'normal'
      };

      const nextBlocks = [...workingBlocks, newHeading, newParagraph];
      setWorkingBlocks(nextBlocks);
      setSelectedBlockId(headingId);
      setSectionFilter('ALL');
      toast.success(`Created section "${sectionName}". Type a name on the page to rename it.`);

      setTimeout(() => {
        const el = document.getElementById(headingId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const textarea = el.querySelector('textarea');
          if (textarea) {
            textarea.focus();
            textarea.select();
          }
        }
      }, 100);

      return sectionName;
    },
    [workingBlocks, setWorkingBlocks, setSelectedBlockId, setSectionFilter]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const idx = workingBlocks.findIndex((b) => b.id === id);
      if (idx === -1) return;

      const blockToClone = workingBlocks[idx];
      const cloned: SecBlock = {
        ...JSON.parse(JSON.stringify(blockToClone)),
        id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        updatedAt: new Date().toISOString()
      };

      const nextBlocks = [...workingBlocks];
      nextBlocks.splice(idx + 1, 0, cloned);
      setWorkingBlocks(nextBlocks);
      setSelectedBlockId(cloned.id);
      setSelectedBlockIds([cloned.id]);
      toast.success('Block duplicated');
    },
    [workingBlocks, setWorkingBlocks]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      if (workingBlocks.length <= 1) {
        toast.error('Cannot delete the only remaining block in the document');
        return;
      }
      const nextBlocks = workingBlocks.filter((b) => b.id !== id);
      setWorkingBlocks(nextBlocks);
      if (selectedBlockId === id) {
        setSelectedBlockId(null);
      }
      setSelectedBlockIds((prev) => prev.filter((item) => item !== id));
      toast.success('Block removed');
    },
    [workingBlocks, setWorkingBlocks, selectedBlockId]
  );

  const handleCreateProposal = useCallback(
    (title: string, description: string, assignedSection?: string) => {
      const author = {
        id: user?.id || 'usr-contrib',
        name: user?.full_name || 'Financial Contributor',
        email: user?.email || 'contributor@zenatech.com',
        role: activeRole === 'LEAD_CONTROLLER' ? 'Controller' : 'Financial Analyst'
      };
      const created = secFilingService.createProposal(title, author, description, mainDoc, assignedSection);
      setProposals(secFilingService.getProposals());
      setActiveProposalId(created.id);
      toast.success(`Created proposed change branch: "${title}"`);
      return created;
    },
    [user, activeRole, mainDoc]
  );

  const handleCreateContributorInvite = useCallback(
    (params: {
      title: string;
      contributorName: string;
      contributorRole: string;
      contributorEmail?: string;
      assignedSection?: string;
      description?: string;
    }) => {
      const result = secFilingService.createContributorInvite({
        ...params,
        baseDoc: mainDoc
      });
      setProposals(secFilingService.getProposals());
      return result;
    },
    [mainDoc]
  );

  /**
   * Resolves the change proposal that the current session is editing, creating the
   * contributor draft on demand when the session came in through an invite link.
   * Returns null only when there is genuinely nothing to submit (e.g. the Lead
   * Controller is editing Main with no proposal checked out).
   */
  const ensureActiveProposalId = useCallback((): string | null => {
    if (activeProposalId) return activeProposalId;

    const params = new URLSearchParams(window.location.search);
    const isContributorLink =
      params.get('contributor') === 'true' || window.location.pathname.includes('/contribute');
    if (!isContributorLink) return null;

    const name = params.get('name');
    const ensured = secFilingService.getOrCreateContributorProposal({
      id: params.get('proposalId') || 'prop-contrib-session-active',
      title:
        params.get('title') ||
        (name ? `${name}'s Section Revisions` : 'Contributor Draft Revisions'),
      name: name || undefined,
      role: params.get('role') || undefined,
      section: params.get('section') || undefined,
      description: params.get('desc') || undefined
    });
    setProposals(secFilingService.getProposals());
    setActiveProposalId(ensured.id);
    return ensured.id;
  }, [activeProposalId]);

  const handleSubmitForReview = useCallback(
    (notes?: string) => {
      const targetProposalId = ensureActiveProposalId();
      if (!targetProposalId) {
        toast.error('No change proposal is checked out, so there is nothing to submit.', {
          description: 'Create a change proposal first, then submit it for Lead Controller review.'
        });
        return;
      }

      const currentProp = secFilingService.getProposals().find((p) => p.id === targetProposalId);
      if (currentProp && currentProp.status === 'merged') {
        toast.info('This proposal was already merged into Main. Starting a new revision draft...');
        const forked = handleForkProposal(targetProposalId);
        if (forked) {
          toast.info('You are now on a new revision draft with a new link. Submit when your new changes are ready.');
        }
        return;
      }

      const result = secFilingService.submitProposalForReview(targetProposalId, notes);
      setProposals(secFilingService.getProposals());

      if (!result.ok) {
        if (result.reason === 'storage_full') {
          toast.error('Submitted changes could not be saved: browser storage is full.', {
            description:
              'Clear older merged drafts or version history from this filing, then submit again. Your edits are still open in this tab.',
            duration: 10000
          });
        } else {
          toast.error('Submission failed: this change proposal could no longer be found.');
        }
        return;
      }
      toast.success('Proposed changes submitted to Lead Controller for review and merging!');
    },
    [ensureActiveProposalId, handleForkProposal]
  );

  const handleMergeProposal = useCallback(
    (proposalId: string, notes?: string) => {
      try {
        const reviewer = user?.full_name || 'Lead Controller';
        const { updatedDoc } = secFilingService.mergeProposalIntoMain(proposalId, reviewer, notes);
        setMainDoc(updatedDoc);
        setProposals(secFilingService.getProposals());
        setVersionHistory(secFilingService.getVersionHistory());
        if (activeProposalId === proposalId) {
          setActiveProposalId(null);
        }
        toast.success(`Successfully merged changes into Main Version! (${updatedDoc.version})`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to merge proposal');
      }
    },
    [user, activeProposalId]
  );

  const handleSelectiveMerge = useCallback(
    (proposalId: string, acceptedBlockIds: string[], notes?: string) => {
      try {
        const reviewer = user?.full_name || 'Lead Controller';
        const { updatedDoc } = secFilingService.mergeSelectiveChanges(
          proposalId,
          acceptedBlockIds,
          reviewer,
          notes
        );
        setMainDoc(updatedDoc);
        setProposals(secFilingService.getProposals());
        setVersionHistory(secFilingService.getVersionHistory());
        if (activeProposalId === proposalId) {
          setActiveProposalId(null);
        }
        toast.success(`Confirmed and merged ${acceptedBlockIds.length} changes into Main Version! (${updatedDoc.version})`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to merge selected changes');
      }
    },
    [user, activeProposalId]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string, notes: string) => {
      const reviewer = user?.full_name || 'Lead Controller';
      secFilingService.rejectProposal(proposalId, reviewer, notes);
      setProposals(secFilingService.getProposals());
      toast.info('Proposal marked as rejected with feedback.');
    },
    [user]
  );

  const handleRestoreVersion = useCallback(
    (snapshotId: string) => {
      try {
        const restoredBy = user?.full_name || 'Lead Controller';
        const updated = secFilingService.restoreVersion(snapshotId, restoredBy);
        setMainDoc(updated);
        setVersionHistory(secFilingService.getVersionHistory());
        setActiveProposalId(null);
        toast.success(`Document restored to ${updated.version}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to restore version');
      }
    },
    [user]
  );

  const handleResetToDefault = useCallback(() => {
    secFilingService.resetToDefault();
    refreshAll();
    setActiveProposalId(null);
    setSelectedBlockId(null);
    toast.success('Reset filing document to baseline v22 Review Copy');
  }, [refreshAll]);

  // --------------------------------------------------------------------------
  // 4. MEMOIZED DIFFS
  // --------------------------------------------------------------------------
  const activeDiffs = useMemo(() => {
    if (!activeProposal) return [];
    return calculateDiffForProposal(activeProposal);
  }, [activeProposal, calculateDiffForProposal]);

  // --------------------------------------------------------------------------
  // 5. ALL EFFECTS (Strictly at the bottom)
  // --------------------------------------------------------------------------
  // Surface storage-quota problems. Autosave failures used to be logged only, which
  // made edits look saved while nothing reached disk.
  useEffect(() => {
    setStorageFailureListener((failure) => {
      if (failure.recovered) {
        toast.info('Freed up browser storage by trimming old filing version history.');
        return;
      }
      const mb = (n?: number) => (typeof n === 'number' ? `${(n / 1024 / 1024).toFixed(1)} MB` : 'the budget');
      toast.error('Browser storage is full — this filing could not be saved.', {
        id: 'sec-filing-storage-full',
        description:
          `${mb(failure.totalBytes)} in use${failure.largestKey ? `, mostly "${failure.largestKey}"` : ''}. ` +
          'Your edits are still open in this tab. See the console for a full breakdown by key.',
        duration: 12000
      });
    });
    return () => setStorageFailureListener(null);
  }, []);

  // Detect contributor link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isContributor =
      params.get('contributor') === 'true' || window.location.pathname.includes('/contribute');
    const propId = params.get('proposalId');
    const name = params.get('name');
    const role = params.get('role');
    const section = params.get('section');
    const title = params.get('title') || undefined;
    const desc = params.get('desc') || undefined;

    if (isContributor) {
      setActiveRole('CONTRIBUTOR');
      const effectivePropId = propId || 'prop-contrib-session-active';
      const ensuredProp = secFilingService.getOrCreateContributorProposal({
        id: effectivePropId,
        title: title || (name ? `${name}'s Section Revisions` : 'Contributor Draft Revisions'),
        name: name || undefined,
        role: role || undefined,
        section: section || undefined,
        description: desc
      });
      // Persist right away so a Lead Controller tab that is already open (or one opened
      // a moment later) can see this contributor draft instead of a stale proposal list.
      secFilingService.saveProposals(secFilingService.getProposals(), true);
      setProposals(secFilingService.getProposals());
      setActiveProposalId(ensuredProp.id);

      setContributorSession({
        isContributor: true,
        name: name || undefined,
        role: role || undefined,
        assignedSection: section && section !== 'ALL' ? section : undefined
      });

      if (section && section !== 'ALL') {
        setSectionFilter(section);
      }
      toast.info(`Welcome ${name || 'Contributor'}! You are editing in Contributor Draft mode.`);
    }
  }, []);

  // Real-time cross-tab synchronization (BroadcastChannel + StorageEvent)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      // Key names must match secFilingService's STORAGE_KEYS, otherwise cross-tab
      // writes are never picked up.
      if (e.key && e.key.startsWith('sec_filing_')) {
        refreshAll();
      }
    };

    window.addEventListener('storage', handleStorage);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('sec_filing_sync_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'PROPOSAL_SUBMITTED') {
            refreshAll();
            toast.success(`New draft submitted by ${event.data?.author || 'Contributor'}!`, {
              description: `"${event.data?.title || 'Filing Updates'}" is ready for Lead Controller review in Merge Control.`
            });
          } else if (event.data?.type === 'DOC_MERGED') {
            refreshAll();
            toast.info('Main document updated with newly approved changes.');
          } else {
            refreshAll();
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error', err);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [refreshAll]);

  // Global Keyboard Listener for Ctrl+Z / Cmd+Z and Ctrl+Y / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z or Cmd+Z (without shift)
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y, or Ctrl+Shift+Z / Cmd+Shift+Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleUndo, handleRedo]);

  return {
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
    setSelectedBlockIds,
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
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
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
  };
}
