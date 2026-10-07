import type {
  AttachedSpreadsheet,
  AttachedSpreadsheetPayload,
  AttachedSpreadsheetRecord,
  AttachedSpreadsheetResponse,
  SecFilingDocument,
  SecBlock
} from '../../types/secFiling';
import { DEFAULT_TRIAL_BALANCE_SHEET } from '../../data/defaultTrialBalanceSheet';
import { colToLetter, formatCellValue } from '../../utils/documentVariables';
import { apiClient } from '../apiClient';
import {
  STORAGE_KEYS,
  safeSetItem,
  broadcastSync,
  scheduleSaveSpreadsheetRegistry,
  getCachedSpreadsheetsList,
  setCachedSpreadsheetsList,
  getPendingMainDoc,
  setPendingMainDoc,
  getSaveSpreadsheetRegistryTimer,
  setSaveSpreadsheetRegistryTimer
} from './secFilingStorage';
import {
  getMainDocument,
  saveMainDocument,
  getDocumentContent,
  getActiveDocumentId,
  getAllDocuments
} from './secFilingCore';

const inFlightSpreadsheetWrites = new Map<string, Promise<unknown>>();
const pendingSpreadsheetPushes = new Map<string, { timer: any; payload: AttachedSpreadsheetPayload }>();
const SPREADSHEET_SYNC_DEBOUNCE_MS = 800;

function trackSpreadsheetWrite(docId: string, write: Promise<unknown>, failureMessage: string): void {
  const tracked = write.catch((err) => console.warn(failureMessage, err));
  inFlightSpreadsheetWrites.set(docId, tracked);
  tracked.finally(() => {
    if (inFlightSpreadsheetWrites.get(docId) === tracked) inFlightSpreadsheetWrites.delete(docId);
  });
}

function sendSpreadsheetPush(docId: string, payload: AttachedSpreadsheetPayload): void {
  trackSpreadsheetWrite(
    docId,
    apiClient.put(spreadsheetEndpoint(docId), payload, { skipGlobalLoading: true }),
    `Failed to save spreadsheet link for ${docId} to backend`
  );
}

/** Sends any debounced push now and waits for outstanding writes for this document. */
async function settleSpreadsheetWrites(docId: string): Promise<void> {
  const pending = pendingSpreadsheetPushes.get(docId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingSpreadsheetPushes.delete(docId);
    sendSpreadsheetPush(docId, pending.payload);
  }
  await inFlightSpreadsheetWrites.get(docId);
}

function spreadsheetEndpoint(docId: string): string {
  return `/api/sec-filings/documents/${encodeURIComponent(docId)}/spreadsheet`;
}

function toSpreadsheetPayload(sheet: AttachedSpreadsheet): AttachedSpreadsheetPayload {
  const letters = sheet.colLetters?.length
    ? sheet.colLetters
    : Array.from({ length: sheet.colCount || 0 }, (_, i) => colToLetter(i + 1));
  return {
    name: sheet.fileName,
    sheetName: sheet.sheetName,
    totalRows: sheet.rowCount,
    totalColumns: sheet.colCount,
    columns: letters.map((key, i) => ({ key, title: String(sheet.headers?.[i] ?? key) })),
    cells: sheet.cells || {},
    tabs: sheet.tabs || [],
    activeTabId: sheet.activeTabId,
    sourceSheetId: sheet.id
  };
}

function fromSpreadsheetRecord(record: AttachedSpreadsheetRecord): AttachedSpreadsheet {
  const colLetters = (record.columns || []).map((c) => c.key);
  return {
    id: record.sourceSheetId || record.id,
    fileName: record.name,
    sheetName: record.sheetName,
    rowCount: record.totalRows,
    colCount: record.totalColumns,
    maxCol: colLetters[colLetters.length - 1] || colToLetter(record.totalColumns || 1),
    colLetters: colLetters.length ? colLetters : undefined,
    headers: colLetters.length ? record.columns.map((c) => c.title) : undefined,
    cells: record.cells || {},
    tabs: record.tabs?.length ? record.tabs : undefined,
    activeTabId: record.activeTabId || undefined,
    updatedAt: record.updatedAt || undefined
  };
}

/** Debounced upsert so rapid cell edits collapse into one PUT per document. */
function queueSpreadsheetPush(docId: string, sheet: AttachedSpreadsheet): void {
  const existing = pendingSpreadsheetPushes.get(docId);
  if (existing) clearTimeout(existing.timer);
  const payload = toSpreadsheetPayload(sheet);
  const timer = setTimeout(() => {
    pendingSpreadsheetPushes.delete(docId);
    sendSpreadsheetPush(docId, payload);
  }, SPREADSHEET_SYNC_DEBOUNCE_MS);
  pendingSpreadsheetPushes.set(docId, { timer, payload });
}

function removeSpreadsheetFromBackend(docId: string): void {
  const existing = pendingSpreadsheetPushes.get(docId);
  if (existing) {
    clearTimeout(existing.timer);
    pendingSpreadsheetPushes.delete(docId);
  }
  trackSpreadsheetWrite(
    docId,
    apiClient.delete(spreadsheetEndpoint(docId), { skipGlobalLoading: true }),
    `Failed to remove spreadsheet link for ${docId} from backend`
  );
}

export function getAllSpreadsheets(): AttachedSpreadsheet[] {
    const cached = getCachedSpreadsheetsList();
    if (cached) {
      return cached;
    }
    if (typeof localStorage === 'undefined') {
      return [{
        ...DEFAULT_TRIAL_BALANCE_SHEET,
        id: 'sheet-tb-master-2026',
        fileName: 'TB_Consolidated_Master_Q2_2026_FINAL.xlsx',
        assignedDocIds: ['sec-doc-zenatech-2026-q2', 'sec-doc-zenatech-10q-q2'],
        description: 'Master Consolidated Trial Balance for Q2 2026 reporting.'
      }];
    }

    const saved = localStorage.getItem(STORAGE_KEYS.SPREADSHEETS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCachedSpreadsheetsList(parsed);
          return parsed;
        }
      } catch {
        // Fallback
      }
    }

    const initialList: AttachedSpreadsheet[] = [
      {
        ...DEFAULT_TRIAL_BALANCE_SHEET,
        id: 'sheet-tb-master-2026',
        fileName: 'TB_Consolidated_Master_Q2_2026_FINAL.xlsx',
        assignedDocIds: ['sec-doc-zenatech-2026-q2', 'sec-doc-zenatech-10q-q2'],
        description: 'Master Consolidated Trial Balance for Q2 2026 reporting.'
      }
    ];

    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(initialList));
    } catch {
      // Ignore storage error
    }
    setCachedSpreadsheetsList(initialList);
    return initialList;
}

export function getSpreadsheetById(id: string): AttachedSpreadsheet | null {
    const list = getAllSpreadsheets();
    return list.find((s) => s.id === id) || null;
}

export function saveSpreadsheet(sheet: AttachedSpreadsheet, syncToMainDoc = false, immediate = false): void {
    const list = getAllSpreadsheets();
    const existingIdx = list.findIndex((s) => s.id === sheet.id);
    const updatedSheet: AttachedSpreadsheet = {
      ...sheet,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = updatedSheet;
    } else {
      list.unshift(updatedSheet);
    }

    setCachedSpreadsheetsList(list);

    if (immediate) {
      const regTimer = getSaveSpreadsheetRegistryTimer();
      if (regTimer) {
        clearTimeout(regTimer);
        setSaveSpreadsheetRegistryTimer(null);
      }
      try {
        localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
      } catch (e) {
        console.warn('Could not save spreadsheet registry', e);
      }
    } else {
      scheduleSaveSpreadsheetRegistry(list);
    }

    // Sync to all assigned documents in the backend (already debounced 800ms)
    if (sheet.assignedDocIds && sheet.assignedDocIds.length > 0) {
      for (const docId of sheet.assignedDocIds) {
        queueSpreadsheetPush(docId, updatedSheet);
      }
    }

    if (syncToMainDoc) {
      const mainDoc = getMainDocument();
      if (mainDoc.attachedSpreadsheetId === sheet.id || sheet.assignedDocIds?.includes(mainDoc.id)) {
        mainDoc.attachedSpreadsheet = updatedSheet;
        mainDoc.attachedSpreadsheetId = sheet.id;
        saveMainDocument(mainDoc, immediate);
      }
    }

    broadcastSync('SPREADSHEET_UPDATED', { sheetId: sheet.id });
}

export function deleteSpreadsheet(sheetId: string): void {
    const allSheets = getAllSpreadsheets();
    for (const docId of allSheets.find((s) => s.id === sheetId)?.assignedDocIds || []) {
      removeSpreadsheetFromBackend(docId);
    }
    const list = allSheets.filter((s) => s.id !== sheetId);
    setCachedSpreadsheetsList(list);
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not update spreadsheet registry', e);
    }

    // Unassign from all documents
    const docSummaries = getAllDocuments();
    for (const docSummary of docSummaries) {
      try {
        const docKey = `sec_doc_content_${docSummary.id}`;
        const savedDoc = localStorage.getItem(docKey);
        if (savedDoc) {
          const parsedDoc = JSON.parse(savedDoc);
          if (parsedDoc.attachedSpreadsheetId === sheetId) {
            parsedDoc.attachedSpreadsheetId = undefined;
            parsedDoc.attachedSpreadsheet = null;
            localStorage.setItem(docKey, JSON.stringify(parsedDoc));
          }
        }
      } catch {
        // Ignore
      }
    }

    const mainDoc = getMainDocument();
    if (mainDoc.attachedSpreadsheetId === sheetId) {
      mainDoc.attachedSpreadsheetId = undefined;
      mainDoc.attachedSpreadsheet = null;
      saveMainDocument(mainDoc, true);
    }

    broadcastSync('SPREADSHEET_DELETED', { sheetId });
}

export function assignSpreadsheetToDocuments(sheetId: string, targetDocIds: string[]): void {
    const list = getAllSpreadsheets();
    const sheetIdx = list.findIndex((s) => s.id === sheetId);
    if (sheetIdx < 0) return;

    const sheet = list[sheetIdx];
    const previousDocIds = sheet.assignedDocIds || [];
    sheet.assignedDocIds = targetDocIds;
    sheet.updatedAt = new Date().toISOString();
    list[sheetIdx] = sheet;
    setCachedSpreadsheetsList(list);

    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    // Update all documents
    const allDocs = getAllDocuments();
    for (const docSummary of allDocs) {
      try {
        const docKey = `sec_doc_content_${docSummary.id}`;
        const savedDoc = localStorage.getItem(docKey);
        if (savedDoc) {
          const parsedDoc = JSON.parse(savedDoc);
          if (targetDocIds.includes(docSummary.id)) {
            parsedDoc.attachedSpreadsheetId = sheetId;
            parsedDoc.attachedSpreadsheet = sheet;
          } else if (parsedDoc.attachedSpreadsheetId === sheetId) {
            parsedDoc.attachedSpreadsheetId = undefined;
            parsedDoc.attachedSpreadsheet = null;
          }
          localStorage.setItem(docKey, JSON.stringify(parsedDoc));
        }
      } catch {
        // Ignore
      }
    }

    const mainDoc = getMainDocument();
    if (targetDocIds.includes(mainDoc.id)) {
      mainDoc.attachedSpreadsheetId = sheetId;
      mainDoc.attachedSpreadsheet = sheet;
      saveMainDocument(mainDoc, true);
    } else if (mainDoc.attachedSpreadsheetId === sheetId) {
      mainDoc.attachedSpreadsheetId = undefined;
      mainDoc.attachedSpreadsheet = null;
      saveMainDocument(mainDoc, true);
    }

    for (const docId of targetDocIds) {
      queueSpreadsheetPush(docId, sheet);
    }
    for (const docId of previousDocIds) {
      if (!targetDocIds.includes(docId)) removeSpreadsheetFromBackend(docId);
    }

    broadcastSync('SPREADSHEET_ASSIGNMENT_CHANGED', { sheetId, targetDocIds });
}

export function assignSpreadsheetToDocument(
    docId: string,
    sheetId: string | null,
    options: { syncBackend?: boolean } = {}
  ): void {
    const { syncBackend = true } = options;
    const allSheets = getAllSpreadsheets();
    const assignedSheet = sheetId ? allSheets.find((s) => s.id === sheetId) || null : null;
    const updatedSheets = allSheets.map((s) => {
      const assigned = new Set(s.assignedDocIds || []);
      if (s.id === sheetId) {
        assigned.add(docId);
      } else {
        assigned.delete(docId);
      }
      return { ...s, assignedDocIds: Array.from(assigned) };
    });

    setCachedSpreadsheetsList(updatedSheets);
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(updatedSheets));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    const docKey = `sec_doc_content_${docId}`;
    const finalTargetDoc: SecFilingDocument = getDocumentContent(docId);

    if (sheetId && assignedSheet) {
      finalTargetDoc.attachedSpreadsheetId = sheetId;
      finalTargetDoc.attachedSpreadsheet = assignedSheet;
    } else {
      finalTargetDoc.attachedSpreadsheetId = undefined;
      finalTargetDoc.attachedSpreadsheet = null;
    }
    safeSetItem(docKey, JSON.stringify(finalTargetDoc));

    const activeDocId = getActiveDocumentId();
    const currentMain = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.MAIN_DOC) : null;
    let mainObj: any = null;
    if (currentMain) {
      try {
        mainObj = JSON.parse(currentMain);
      } catch {
        mainObj = null;
      }
    }

    const pendingMain = getPendingMainDoc();
    if (docId === activeDocId || (mainObj && mainObj.id === docId) || (pendingMain && pendingMain.id === docId)) {
      safeSetItem(STORAGE_KEYS.MAIN_DOC, JSON.stringify(finalTargetDoc));
      setPendingMainDoc(finalTargetDoc);
    }

    if (syncBackend) {
      if (sheetId && assignedSheet) {
        queueSpreadsheetPush(docId, assignedSheet);
      } else {
        removeSpreadsheetFromBackend(docId);
      }
    }

    broadcastSync('SPREADSHEET_ASSIGNMENT_CHANGED', { docId, sheetId });
  }

export function getAttachedSpreadsheet(docId?: string): AttachedSpreadsheet | null {
    const allSheets = getAllSpreadsheets();
    const targetId = docId || getActiveDocumentId();

    const matchByDoc = allSheets.find((s) => s.assignedDocIds?.includes(targetId));
    if (matchByDoc) return matchByDoc;

    const doc = docId ? getDocumentContent(docId) : getMainDocument();
    if (doc.attachedSpreadsheet) return doc.attachedSpreadsheet;
    if (doc.attachedSpreadsheetId) {
      const match = allSheets.find((s) => s.id === doc.attachedSpreadsheetId);
      if (match) return match;
    }
    return null;
}

  /**
   * Reads the document's linked spreadsheet from the backend.
   * Resolves null when nothing is linked; rejects when the backend is unreachable.
   */
export async function fetchAttachedSpreadsheetFromBackend(docId: string): Promise<AttachedSpreadsheet | null> {
    await settleSpreadsheetWrites(docId);
    const res = await apiClient.get<AttachedSpreadsheetResponse>(spreadsheetEndpoint(docId), {
      skipGlobalLoading: true
    });
    return res?.spreadsheet ? fromSpreadsheetRecord(res.spreadsheet) : null;
}

  /** Pushes the locally linked sheet for a document to the backend (used to backfill old links). */
export function pushAttachedSpreadsheetToBackend(docId: string, sheet: AttachedSpreadsheet): void {
    queueSpreadsheetPush(docId, sheet);
}

  /**
   * Makes the backend's link the local one: upserts the sheet into the Hub registry
   * and attaches it to the document. Returns the sheet that is now attached.
   */
export function applyBackendSpreadsheet(docId: string, remote: AttachedSpreadsheet): AttachedSpreadsheet {
    const list = getAllSpreadsheets();
    const idx = list.findIndex((s) => s.id === remote.id);
    const local = idx >= 0 ? list[idx] : null;

    // Keep a newer local copy (e.g. edits made while offline) and push it up instead.
    const localIsNewer =
      !!local?.updatedAt && !!remote.updatedAt && new Date(local.updatedAt) > new Date(remote.updatedAt);
    const merged: AttachedSpreadsheet = localIsNewer
      ? { ...local! }
      : { ...local, ...remote, description: local?.description };
    merged.assignedDocIds = Array.from(new Set([...(local?.assignedDocIds || []), docId]));

    if (idx >= 0) list[idx] = merged;
    else list.unshift(merged);
    setCachedSpreadsheetsList(list);
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save spreadsheet registry', e);
    }

    assignSpreadsheetToDocument(docId, merged.id, { syncBackend: false });
    if (localIsNewer) queueSpreadsheetPush(docId, merged);
    return merged;
}

export function updateAttachedSpreadsheet(
    sheet: AttachedSpreadsheet,
    docId?: string,
    shiftedBlocks?: SecBlock[]
  ): SecFilingDocument {
    // Save to central Spreadsheet Hub registry (debounced, do not double-sync to mainDoc)
    saveSpreadsheet(sheet, false, false);

    const doc = docId ? getDocumentContent(docId) : getMainDocument();
    doc.attachedSpreadsheet = sheet;
    doc.attachedSpreadsheetId = sheet.id;
    if (shiftedBlocks && Array.isArray(shiftedBlocks)) {
      doc.blocks = shiftedBlocks;
    }
    doc.updatedAt = new Date().toISOString();
    saveMainDocument(doc, false);
    broadcastSync('SPREADSHEET_UPDATED', { sheetId: sheet.id });

    // Background sync to PostgreSQL backend (debounced; deduped with saveSpreadsheet's push)
    queueSpreadsheetPush(docId || doc.id || getActiveDocumentId(), sheet);

    return doc;
}

export function updateSpreadsheetCellAndSyncDoc(
    cellRef: string,
    newValue: any,
    docId?: string,
    updatedSheet?: AttachedSpreadsheet
  ): { updatedDoc: SecFilingDocument; updatedCount: number } {
    const doc = docId ? getDocumentContent(docId) : getMainDocument();
    const cleanRef = cellRef.trim().toUpperCase();

    let spreadsheet = updatedSheet || doc.attachedSpreadsheet;
    if (!spreadsheet) {
      return { updatedDoc: doc, updatedCount: 0 };
    }

    if (!updatedSheet) {
      const activeTabId = spreadsheet.activeTabId;
      spreadsheet = {
        ...spreadsheet,
        cells: {
          ...spreadsheet.cells,
          [cleanRef]: newValue
        },
        updatedAt: new Date().toISOString()
      };
      if (spreadsheet.tabs && activeTabId) {
        spreadsheet.tabs = spreadsheet.tabs.map((tab) => {
          if (tab.id === activeTabId) {
            return {
              ...tab,
              cells: { ...tab.cells, [cleanRef]: newValue }
            };
          }
          return tab;
        });
      }
    }

    doc.attachedSpreadsheet = spreadsheet;
    doc.attachedSpreadsheetId = spreadsheet.id;

    // Persist in central Spreadsheet Hub registry (in-memory + debounced disk write)
    saveSpreadsheet(spreadsheet, false, false);

    // Background sync to PostgreSQL backend (already debounced 800ms)
    queueSpreadsheetPush(docId || doc.id || getActiveDocumentId(), spreadsheet);

    const formattedVal = formatCellValue(newValue);
    let updatedCount = 0;

    // Pattern to match @Cell or @'Sheet'!Cell or @Sheet!Cell with optional {...}
    let bareCell = cleanRef;
    let tabPrefixPattern = '(?:(?:\'[^\']+\'|[A-Za-z0-9_.\\- ]+)!)?';
    const tabMatch = cleanRef.match(/^(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3}\d{1,4})$/i);
    if (tabMatch) {
      bareCell = tabMatch[3].toUpperCase();
      const specificTab = tabMatch[1] || tabMatch[2];
      if (specificTab) {
        const escapedTab = specificTab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        tabPrefixPattern = `(?:'${escapedTab}'|${escapedTab})!`;
      }
    }
    const regex = new RegExp(`@(${tabPrefixPattern}${bareCell})(?:\\{[^}]*\\})?`, 'gi');
    const bareUpper = bareCell.toUpperCase();

    // Fast-path: Update occurrences across document blocks only where @ and bareUpper exist
    let hasAnyBlockChanged = false;
    if (Array.isArray(doc.blocks)) {
      doc.blocks = doc.blocks.map((block) => {
        if (block.type === 'paragraph' || block.type === 'heading') {
          if (block.text && block.text.includes('@') && block.text.toUpperCase().includes(bareUpper)) {
            let blockChanged = false;
            regex.lastIndex = 0;
            const newText = block.text.replace(regex, (_, p1) => {
              blockChanged = true;
              updatedCount++;
              return `@${p1}{${formattedVal}}`;
            });
            if (blockChanged) {
              hasAnyBlockChanged = true;
              return {
                ...block,
                text: newText,
                updatedAt: new Date().toISOString()
              };
            }
          }
        } else if (block.type === 'callout') {
          let updated = false;
          let content = block.content;
          let title = block.title;
          if (content && content.includes('@') && content.toUpperCase().includes(bareUpper)) {
            regex.lastIndex = 0;
            content = content.replace(regex, (_, p1) => {
              updated = true;
              updatedCount++;
              return `@${p1}{${formattedVal}}`;
            });
          }
          if (title && title.includes('@') && title.toUpperCase().includes(bareUpper)) {
            regex.lastIndex = 0;
            title = title.replace(regex, (_, p1) => {
              updated = true;
              updatedCount++;
              return `@${p1}{${formattedVal}}`;
            });
          }
          if (updated) {
            hasAnyBlockChanged = true;
            return { ...block, content, title, updatedAt: new Date().toISOString() };
          }
        } else if (block.type === 'financial_table' && Array.isArray(block.rows)) {
          let tableUpdated = false;
          const rows = block.rows.map((r) => {
            if (Array.isArray(r.cells)) {
              let rowUpdated = false;
              const cells = r.cells.map((c) => {
                if (typeof c === 'string' && c.includes('@') && c.toUpperCase().includes(bareUpper)) {
                  regex.lastIndex = 0;
                  const newC = c.replace(regex, (_, p1) => {
                    rowUpdated = true;
                    tableUpdated = true;
                    updatedCount++;
                    return `@${p1}{${formattedVal}}`;
                  });
                  return newC;
                }
                return c;
              });
              if (rowUpdated) return { ...r, cells };
            }
            return r;
          });
          if (tableUpdated) {
            hasAnyBlockChanged = true;
            return { ...block, rows, updatedAt: new Date().toISOString() };
          }
        }
        return block;
      });
    }

    if (hasAnyBlockChanged) {
      doc.updatedAt = new Date().toISOString();
    }
    saveMainDocument(doc, false); // Debounced save
    broadcastSync('SPREADSHEET_UPDATED', { cellRef: cleanRef, value: newValue });

    return { updatedDoc: doc, updatedCount };
}