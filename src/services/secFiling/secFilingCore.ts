import type {
  SecFilingDocument,
  SecDocumentSummary,
  SecVersionSnapshot,
  SecBlock
} from '../../types/secFiling';
import { INITIAL_SEC_FILING_DOC, INITIAL_VERSION_HISTORY } from '../../data/initialSecFilingData';
import {
  generateOnboardingChecklistDoc,
  generateOffboardingChecklistDoc,
  generateBlankDocument,
  generate10QDoc,
  generate10KDoc,
  generate8KDoc,
  generateProjectProposalDoc
} from '../../data/secDocumentTemplates';
import {
  STORAGE_KEYS,
  safeSetItem,
  flushPendingSaves,
  broadcastSync,
  getCachedDocumentsList,
  setCachedDocumentsList,
  getPendingMainDoc,
  setPendingMainDoc,
  getSaveMainDocTimer,
  setSaveMainDocTimer,
  getSaveProposalsTimer,
  setSaveProposalsTimer,
  setPendingProposals
} from './secFilingStorage';
import { sanitizeAndCompactBlocks } from './secFilingSanitizer';
import { getAllSpreadsheets } from './secFilingSpreadsheet';

export function getMainDocument(): SecFilingDocument {
    const pending = getPendingMainDoc();
    if (pending) {
      const allSheets = getAllSpreadsheets();
      const match = allSheets.find((s) => s.id === pending.attachedSpreadsheetId || s.assignedDocIds?.includes(pending.id));
      if (match) {
        pending.attachedSpreadsheetId = match.id;
        pending.attachedSpreadsheet = match;
      } else if (!pending.attachedSpreadsheetId) {
        pending.attachedSpreadsheet = null;
      }
      return pending;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.MAIN_DOC) || localStorage.getItem('sec_filing_main_doc_v2_full') || localStorage.getItem('sec_filing_main_doc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.blocks)) {
          // If this is the default review copy and was corrupted by earlier compaction (lost 4th column or was truncated)
          if (parsed.id === 'sec-doc-zenatech-2026-q2') {
            const firstTable = parsed.blocks.find((b: any) => b.type === 'financial_table');
            if (parsed.blocks.length < 50 || (firstTable && firstTable.headers?.length < 4)) {
              safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(INITIAL_SEC_FILING_DOC));
              return JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
            }
          }
          const allSheets = getAllSpreadsheets();
          if (parsed.attachedSpreadsheetId) {
            const match = allSheets.find((s) => s.id === parsed.attachedSpreadsheetId);
            parsed.attachedSpreadsheet = match || null;
          } else {
            const match = allSheets.find((s) => s.assignedDocIds?.includes(parsed.id));
            if (match) {
              parsed.attachedSpreadsheetId = match.id;
              parsed.attachedSpreadsheet = match;
            } else {
              parsed.attachedSpreadsheet = null;
            }
          }
          parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse main document from storage', e);
      }
    }
    const defaultDoc = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
    const allSheets = getAllSpreadsheets();
    const match = allSheets.find((s) => s.assignedDocIds?.includes(defaultDoc.id) || s.id === defaultDoc.attachedSpreadsheetId);
    if (match) {
      defaultDoc.attachedSpreadsheetId = match.id;
      defaultDoc.attachedSpreadsheet = match;
    } else {
      defaultDoc.attachedSpreadsheet = null;
    }
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(defaultDoc));
    return defaultDoc;
}

export function saveMainDocument(doc: SecFilingDocument, immediate = false): boolean {
    setPendingMainDoc(doc);

    // Fast in-memory update of document summary in cached list
    const cachedList = getCachedDocumentsList();
    if (cachedList) {
      const existing = cachedList.find((d) => d.id === doc.id);
      if (existing) {
        existing.title = doc.title;
        existing.updatedAt = doc.updatedAt || new Date().toISOString();
        existing.blocksCount = doc.blocks?.length || 0;
        existing.formType = doc.formType;
      }
    }

    if (immediate) {
      return flushPendingSaves();
    } else {
      const curTimer = getSaveMainDocTimer();
    if (curTimer) clearTimeout(curTimer);
    setSaveMainDocTimer(setTimeout(flushPendingSaves, 350));
    }
    return true;
}

export function getDocumentsList(): SecDocumentSummary[] {
    const cached = getCachedDocumentsList();
    if (cached) {
      return cached;
    }
    const mainDoc = getMainDocument();
    const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS_LIST);
    let list: SecDocumentSummary[] = [];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {
        console.error('Failed to parse documents list', e);
      }
    }

    if (list.length === 0) {
      list = [
        {
          id: mainDoc.id || 'sec-doc-zenatech-2026-q2',
          title: mainDoc.title || 'ZenaTech, Inc. Consolidated Financial Statements — June 30, 2026 (v22 REVIEW COPY)',
          formType: mainDoc.formType || 'Form 6-K / Interim Consolidated',
          period: mainDoc.period || 'For the Six Months Ended June 30, 2026 and June 30, 2025',
          updatedAt: mainDoc.updatedAt || new Date().toISOString(),
          createdAt: mainDoc.createdAt || '2026-06-30T08:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: mainDoc.version || 'v22 Review Copy',
          blocksCount: mainDoc.blocks?.length || 42,
          templateType: '10-q',
        },
        {
          id: 'sec-doc-zenatech-10q-q2',
          title: 'ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)',
          formType: 'Form 10-Q',
          period: 'Q2 2026',
          updatedAt: '2026-09-29T16:45:00.000Z',
          createdAt: '2026-09-20T10:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: 'v1.0',
          blocksCount: 18,
          templateType: '10-q',
        },
        {
          id: 'sec-doc-zenatech-2025-10k',
          title: 'ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)',
          formType: 'Form 10-K',
          period: 'FY 2025',
          updatedAt: '2026-09-28T14:30:00.000Z',
          createdAt: '2026-09-15T09:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: 'v1.2',
          blocksCount: 64,
          templateType: '10-k',
        },
        {
          id: 'sec-doc-zenatech-8k-acq',
          title: 'ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)',
          formType: 'Form 8-K',
          period: 'Current',
          updatedAt: '2026-09-25T11:20:00.000Z',
          createdAt: '2026-09-24T09:00:00.000Z',
          owner: 'me',
          isShared: true,
          version: 'v1.0',
          blocksCount: 12,
          templateType: '8-k',
        },
      ];
    } else {
      list = list.filter((d) => d.id !== 'sec-doc-zenatech-v24-sarah-jenkins' && !d.title?.includes('Sarah_Jenkins'));
    }

    // Scan localStorage for any custom doc keys: sec_doc_content_*
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sec_doc_content_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const doc = JSON.parse(raw);
                if (doc && doc.id && doc.title) {
                  const existsIdx = list.findIndex((d) => d.id === doc.id);
                  if (existsIdx >= 0) {
                    list[existsIdx].title = doc.title;
                    list[existsIdx].updatedAt = doc.updatedAt || list[existsIdx].updatedAt;
                    list[existsIdx].blocksCount = doc.blocks?.length || list[existsIdx].blocksCount;
                  } else {
                    list.push({
                      id: doc.id,
                      title: doc.title,
                      formType: doc.formType || 'SEC Filing',
                      period: doc.period,
                      updatedAt: doc.updatedAt || new Date().toISOString(),
                      createdAt: doc.createdAt || new Date().toISOString(),
                      owner: 'me',
                      isShared: true,
                      version: doc.version || 'v1.0',
                      blocksCount: doc.blocks?.length || 0,
                      templateType: '10-q',
                    });
                  }
                }
              } catch {
                // Ignore parse error on individual item
              }
            }
          }
        }
      } catch (e) {
        console.warn('Error scanning custom docs in localStorage', e);
      }
    }

    // Synchronize active mainDoc summary if matching ID exists
    const existingIdx = list.findIndex((d) => d.id === mainDoc.id);
    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        title: mainDoc.title,
        formType: mainDoc.formType,
        period: mainDoc.period,
        updatedAt: mainDoc.updatedAt || list[existingIdx].updatedAt,
        blocksCount: mainDoc.blocks?.length || list[existingIdx].blocksCount,
      };
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    const deduplicatedList: SecDocumentSummary[] = [];
    for (const item of list) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        deduplicatedList.push(item);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS_LIST, JSON.stringify(deduplicatedList));
    } catch (e) {
      console.warn('Could not save documents list', e);
    }
    setCachedDocumentsList(deduplicatedList);
    return deduplicatedList;
}

export function getDocumentPreview(id: string): SecBlock[] {
    const mainDoc = getMainDocument();
    if (id === mainDoc.id || id === 'sec-doc-zenatech-2026-q2') {
      return mainDoc.blocks.slice(0, 15);
    }
    const customKey = `sec_doc_content_${id}`;
    const customSaved = localStorage.getItem(customKey);
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          return parsed.blocks.slice(0, 15);
        }
      } catch {
        // Fallback to defaults
      }
    }
    if (id === 'sec-doc-zenatech-10q-q2') {
      return generate10QDoc('ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)').blocks.slice(0, 15);
    }
    if (id === 'sec-doc-zenatech-2025-10k') {
      return generate10KDoc('ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)').blocks.slice(0, 15);
    }
    if (id === 'sec-doc-zenatech-8k-acq') {
      return generate8KDoc('ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)').blocks.slice(0, 15);
    }
    if (id === 'doc-onboarding-1') {
      return generateOnboardingChecklistDoc('Onboarding').blocks.slice(0, 15);
    }
    if (id === 'doc-offboarding-2') {
      return generateOffboardingChecklistDoc('Offboarding Checklist').blocks.slice(0, 15);
    }
    return mainDoc.blocks.slice(0, 15);
}

export function saveDocumentsList(list: SecDocumentSummary[]): void {
    setCachedDocumentsList(list);
    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS_LIST, JSON.stringify(list));
      broadcastSync('DOCUMENTS_LIST_UPDATED', { count: list.length });
    } catch (e) {
      console.warn('Could not save documents list', e);
    }
}

export function getAllDocuments(): SecDocumentSummary[] {
    return getDocumentsList();
}

export function setActiveDocumentId(id: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, id);
    }
}

export function getDocumentContent(id: string): SecFilingDocument {
    const pending = getPendingMainDoc();
    if (pending && pending.id === id) {
      return pending;
    }
    if (id === getActiveDocumentId() || id === 'sec-doc-zenatech-2026-q2') {
      // Only short-circuit when the main doc really is this document; otherwise
      // fall through so we don't hand back another doc (and its spreadsheet link).
      const main = getMainDocument();
      if (main.id === id) return main;
    }
    const customKey = `sec_doc_content_${id}`;
    const customSaved = typeof localStorage !== 'undefined' ? localStorage.getItem(customKey) : null;
    let doc: SecFilingDocument | null = null;
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          doc = parsed;
        }
      } catch {
        // Ignore JSON parse errors from corrupted storage keys
      }
    }
    if (!doc) {
      if (id === 'sec-doc-zenatech-10q-q2') doc = generate10QDoc('ZenaTech, Inc. Form 10-Q');
      else if (id === 'sec-doc-zenatech-2025-10k') doc = generate10KDoc('ZenaTech, Inc. Form 10-K');
      else if (id === 'sec-doc-zenatech-8k-acq') doc = generate8KDoc('ZenaTech, Inc. Form 8-K');
      else if (id === 'doc-onboarding-1') doc = generateOnboardingChecklistDoc('Onboarding');
      else if (id === 'doc-offboarding-2') doc = generateOffboardingChecklistDoc('Offboarding Checklist');
      else doc = generateBlankDocument('Untitled Document');
    }
    // Resolve attached spreadsheet from central Hub registry
    const allSheets = getAllSpreadsheets();
    if (doc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === doc.attachedSpreadsheetId);
      if (match) {
        doc.attachedSpreadsheet = match;
      }
    } else {
      // Check if any sheet in Hub is explicitly assigned to this document ID
      const match = allSheets.find((s) => s.assignedDocIds?.includes(doc.id));
      if (match) {
        doc.attachedSpreadsheetId = match.id;
        doc.attachedSpreadsheet = match;
      } else {
        doc.attachedSpreadsheet = null;
      }
    }
    return doc;
}

export function getActiveDocumentId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_ID) || 'sec-doc-zenatech-2026-q2';
}

export function openDocument(id: string): SecFilingDocument {
    setPendingMainDoc(null);
    setActiveDocumentId(id);

    const customKey = `sec_doc_content_${id}`;
    let doc: SecFilingDocument | null = null;
    const customSaved = typeof localStorage !== 'undefined' ? localStorage.getItem(customKey) : null;
    if (customSaved) {
      try {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.blocks)) {
          parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
          doc = parsed;
        }
      } catch (e) {
        console.error('Failed to parse doc', e);
      }
    }

    if (!doc) {
      const savedMain = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.MAIN_DOC) : null;
      if (savedMain) {
        try {
          const parsed = JSON.parse(savedMain);
          if (parsed && parsed.id === id && Array.isArray(parsed.blocks)) {
            parsed.blocks = sanitizeAndCompactBlocks(parsed.blocks);
            doc = parsed;
          }
        } catch {
          // Ignore
        }
      }
    }

    if (!doc) {
      if (id === 'sec-doc-zenatech-10q-q2') {
        doc = generate10QDoc('ZenaTech, Inc. Form 10-Q (Q2 2026 Quarterly Report)');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-2025-10k') {
        doc = generate10KDoc('ZenaTech, Inc. Form 10-K (Annual Comprehensive Audited Filing)');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-8k-acq') {
        doc = generate8KDoc('ZenaTech, Inc. Form 8-K (Current Report — Strategic Acquisition)');
        doc.id = id;
      } else if (id === 'doc-onboarding-1') {
        doc = generateOnboardingChecklistDoc('Onboarding');
        doc.id = id;
      } else if (id === 'doc-offboarding-2') {
        doc = generateOffboardingChecklistDoc('Offboarding Checklist');
        doc.id = id;
      } else if (id === 'sec-doc-zenatech-2026-q2') {
        doc = JSON.parse(JSON.stringify(INITIAL_SEC_FILING_DOC));
      } else {
        doc = generateBlankDocument('Untitled Document');
        doc.id = id;
      }
    }

    const finalDoc: SecFilingDocument = doc || generateBlankDocument('Untitled Document');
    finalDoc.id = id;

    // Resolve attached spreadsheet from central Hub registry
    const allSheets = getAllSpreadsheets();
    if (finalDoc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === finalDoc.attachedSpreadsheetId);
      if (match) {
        finalDoc.attachedSpreadsheet = match;
      } else {
        const fallbackMatch = allSheets.find((s) => s.assignedDocIds?.includes(finalDoc.id));
        if (fallbackMatch) {
          finalDoc.attachedSpreadsheetId = fallbackMatch.id;
          finalDoc.attachedSpreadsheet = fallbackMatch;
        } else {
          finalDoc.attachedSpreadsheetId = undefined;
          finalDoc.attachedSpreadsheet = null;
        }
      }
    } else {
      const match = allSheets.find((s) => s.assignedDocIds?.includes(finalDoc.id));
      if (match) {
        finalDoc.attachedSpreadsheetId = match.id;
        finalDoc.attachedSpreadsheet = match;
      } else {
        finalDoc.attachedSpreadsheet = null;
      }
    }

    safeSetItem(customKey, JSON.stringify(finalDoc));
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(finalDoc));
    setPendingMainDoc(finalDoc);
    return finalDoc;
}


export function createDocumentFromTemplate(templateId: string, customTitle?: string): SecFilingDocument {
    let newDoc: SecFilingDocument;
    const title = customTitle || (templateId === 'blank' ? 'Untitled Document' : `New ${templateId.toUpperCase()} Document`);

    switch (templateId) {
      case 'onboarding':
        newDoc = generateOnboardingChecklistDoc(title);
        break;
      case 'offboarding':
        newDoc = generateOffboardingChecklistDoc(title);
        break;
      case '10-q':
        newDoc = generate10QDoc(title);
        break;
      case '10-k':
        newDoc = generate10KDoc(title);
        break;
      case '8-k':
        newDoc = generate8KDoc(title);
        break;
      case 'proposal':
        newDoc = generateProjectProposalDoc(title);
        break;
      case 'blank':
      default:
        newDoc = generateBlankDocument(title);
        break;
    }

    // Save document content
    safeSetItem(`sec_doc_content_${newDoc.id}`, JSON.stringify(newDoc));
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(newDoc));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, newDoc.id);
    setPendingMainDoc(newDoc);

    // Add to documents list
    const list = getDocumentsList();
    const summary: SecDocumentSummary = {
      id: newDoc.id,
      title: newDoc.title,
      formType: newDoc.formType,
      period: newDoc.period,
      updatedAt: newDoc.updatedAt,
      createdAt: newDoc.createdAt,
      owner: 'me',
      isShared: false,
      version: newDoc.version,
      blocksCount: newDoc.blocks.length,
      templateType: templateId,
    };

    list.unshift(summary);
    saveDocumentsList(list);
    return newDoc;
}

export function duplicateDocument(id: string): SecFilingDocument | null {
    const list = getDocumentsList();
    const item = list.find((d) => d.id === id);
    if (!item) return null;

    let baseDoc: SecFilingDocument;
    const customSaved = localStorage.getItem(`sec_doc_content_${id}`);
    if (customSaved) {
      baseDoc = JSON.parse(customSaved);
    } else if (id === 'sec-doc-zenatech-2026-q2') {
      baseDoc = getMainDocument();
    } else if (item.templateType === 'onboarding') {
      baseDoc = generateOnboardingChecklistDoc(item.title);
    } else if (item.templateType === 'offboarding') {
      baseDoc = generateOffboardingChecklistDoc(item.title);
    } else {
      baseDoc = generateBlankDocument(item.title);
    }

    const newId = `doc-copy-${Date.now()}`;
    const newDoc: SecFilingDocument = {
      ...baseDoc,
      id: newId,
      title: `Copy of ${item.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 'v1.0.0',
      versionNumber: 1,
      blocks: JSON.parse(JSON.stringify(baseDoc.blocks || [])),
    };

    safeSetItem(`sec_doc_content_${newId}`, JSON.stringify(newDoc));

    const newSummary: SecDocumentSummary = {
      ...item,
      id: newId,
      title: newDoc.title,
      updatedAt: newDoc.updatedAt,
      createdAt: newDoc.createdAt,
      owner: 'me',
      isShared: false,
    };

    list.unshift(newSummary);
    saveDocumentsList(list);
    return newDoc;
}

export function renameDocument(id: string, newTitle: string): boolean {
    if (!newTitle.trim()) return false;
    const list = getDocumentsList();
    const item = list.find((d) => d.id === id);
    if (item) {
      item.title = newTitle.trim();
      item.updatedAt = new Date().toISOString();
      saveDocumentsList(list);
    }

    // Also update document content if present
    const customKey = `sec_doc_content_${id}`;
    const saved = localStorage.getItem(customKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.title = newTitle.trim();
        parsed.updatedAt = new Date().toISOString();
        safeSetItem(customKey, JSON.stringify(parsed));
      } catch (e) {
        console.error('Rename error', e);
      }
    }

    if (id === getActiveDocumentId()) {
      const main = getMainDocument();
      main.title = newTitle.trim();
      main.updatedAt = new Date().toISOString();
      saveMainDocument(main, true);
    }

    return true;
}

export function deleteDocument(id: string): boolean {
    const list = getDocumentsList();
    const filtered = list.filter((d) => d.id !== id);
    saveDocumentsList(filtered);
    try {
      localStorage.removeItem(`sec_doc_content_${id}`);
    } catch (e) {
      console.warn('Remove doc error', e);
    }
    return true;
}

export function getVersionHistory(): SecVersionSnapshot[] {
    const saved = localStorage.getItem(STORAGE_KEYS.VERSION_HISTORY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse version history', e);
      }
    }
    safeSetItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(INITIAL_VERSION_HISTORY));
    return JSON.parse(JSON.stringify(INITIAL_VERSION_HISTORY));
}

export function saveVersionHistory(history: SecVersionSnapshot[]): void {
    // Each snapshot carries a full copy of the document, so cap the history here
    // rather than letting it grow until it exhausts the storage quota.
    const capped =
      history.length > 5 ? history.slice(-5) : history;
    safeSetItem(STORAGE_KEYS.VERSION_HISTORY, JSON.stringify(capped));
}

export function restoreVersion(snapshotId: string, restoredBy: string): SecFilingDocument {
    const history = getVersionHistory();
    const snapshot = history.find((s) => s.id === snapshotId);
    if (!snapshot) throw new Error('Snapshot not found');

    const currentMain = getMainDocument();
    const nextVersionNumber = currentMain.versionNumber + 1;
    const nextVersionLabel = `v${nextVersionNumber} (Restored from ${snapshot.version})`;

    const updatedMain: SecFilingDocument = {
      ...currentMain,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
      updatedAt: new Date().toISOString(),
      lastModifiedBy: `${restoredBy} (Restored from ${snapshot.version})`
    };

    if (!saveMainDocument(updatedMain, true)) {
      throw new Error(
        'Browser storage is full, so the restored document could not be saved. Clear older version history for this filing, then restore again.'
      );
    }

    const newSnapshot: SecVersionSnapshot = {
      id: `snap-v${nextVersionNumber}-${Date.now()}`,
      version: nextVersionLabel,
      versionNumber: nextVersionNumber,
      timestamp: new Date().toISOString(),
      author: restoredBy,
      description: `Restored document state from ${snapshot.version}`,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks))
    };
    history.push(newSnapshot);
    saveVersionHistory(history);

    return updatedMain;
}

export function applyElectronicSignature(
    officerIdentifier: string,
    signatureData: {
      signatureText: string;
      signatureImageUrl?: string;
      provider?: any;
      signedVia?: string;
      envelopeId?: string;
      ipAddress?: string;
    }
  ): boolean {
    const doc = getMainDocument();
    let updated = false;

    const formattedDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const nextBlocks = doc.blocks.map((b) => {
      if (b.type === 'signature') {
        const nextOfficers = b.officers.map((officer) => {
          const match =
            officer.id === officerIdentifier ||
            (officer.name && officerIdentifier && officer.name.toLowerCase().trim() === officerIdentifier.toLowerCase().trim()) ||
            b.officers.length === 1;

          if (match) {
            updated = true;
            return {
              ...officer,
              signed: true,
              signatureText: signatureData.signatureText.startsWith('/s/')
                ? signatureData.signatureText
                : `/s/ ${signatureData.signatureText}`,
              signatureImageUrl: signatureData.signatureImageUrl,
              date: formattedDate,
              provider: signatureData.provider || officer.provider || 'docusign',
              envelopeId: signatureData.envelopeId,
              signedAt: new Date().toISOString(),
              signedVia:
                signatureData.signedVia ||
                `${signatureData.provider === 'dropbox_sign' ? 'Dropbox Sign' : 'DocuSign'} Mobile SMS (Rule 302(b) Verified)`,
              auditTrailId: signatureData.envelopeId
                ? `SEC-AUDIT-${signatureData.envelopeId.replace(/^[a-z]+-env-/i, '').toUpperCase()}`
                : undefined
            };
          }
          return officer;
        });

        return { ...b, officers: nextOfficers };
      }
      return b;
    });

    if (updated) {
      saveMainDocument({ ...doc, blocks: nextBlocks, updatedAt: new Date().toISOString() });
      broadcastSync('DOCUMENT_UPDATED', { action: 'SIGNATURE_APPLIED', officerIdentifier });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sec-filing-signature-applied', {
            detail: { officerIdentifier, signatureData }
          })
        );
      }
      return true;
    }
    return false;
}

export function resetToDefault(): void {
    // Drop the debounced buffers too, otherwise reads keep serving the pre-reset
    // document from memory.
    const mainTimer = getSaveMainDocTimer();
    if (mainTimer) clearTimeout(mainTimer);
    const propTimer = getSaveProposalsTimer();
    if (propTimer) clearTimeout(propTimer);
    setSaveMainDocTimer(null);
    setSaveProposalsTimer(null);
    setPendingMainDoc(null);
    setPendingProposals(null);

    localStorage.removeItem(STORAGE_KEYS.MAIN_DOC);
    localStorage.removeItem(STORAGE_KEYS.PROPOSALS);
    localStorage.removeItem(STORAGE_KEYS.VERSION_HISTORY);
    safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(INITIAL_SEC_FILING_DOC));
}