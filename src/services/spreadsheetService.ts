// Spreadsheet merge service – handles proposals and merging
import type { SpreadsheetProposal, SpreadsheetChange } from '../types/spreadsheet';

const STORAGE_KEY = 'spreadsheetProposals';

/** Load all proposals from localStorage */
export function loadSpreadsheetProposals(): SpreadsheetProposal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpreadsheetProposal[]) : [];
  } catch {
    return [];
  }
}

/** Persist proposals */
export function saveSpreadsheetProposals(proposals: SpreadsheetProposal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
  } catch {
    // ignore storage errors for now
  }
}

/** Compute diff between two spreadsheets (cell map) */
export function diffSpreadsheets(
  base: Record<string, any>,
  current: Record<string, any>
): SpreadsheetChange[] {
  const changes: SpreadsheetChange[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(current)]);
  allKeys.forEach((key) => {
    const before = base[key];
    const after = current[key];
    if (before !== after) {
      changes.push({ cellRef: key, before, after });
    }
  });
  return changes;
}

/** Create a new proposal from the current spreadsheet compared to the latest saved version */
export function createSpreadsheetProposal(
  title: string,
  author: { name: string; email?: string },
  baseSheet: Record<string, any>,
  currentSheet: Record<string, any>
): SpreadsheetProposal {
  const changes = diffSpreadsheets(baseSheet, currentSheet);
  const proposal: SpreadsheetProposal = {
    id: `sheet-proposal-${Date.now()}`,
    title,
    author,
    changes,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };
  const proposals = loadSpreadsheetProposals();
  proposals.push(proposal);
  saveSpreadsheetProposals(proposals);
  return proposal;
}

/** Merge accepted changes into the main spreadsheet */
export function mergeSpreadsheetChanges(
  proposalId: string,
  acceptedCellRefs: string[],
  mainSheet: Record<string, any>,
  setMainSheet: (s: Record<string, any>) => void,
  pushUndo: (prev: Record<string, any>) => void
) {
  const proposals = loadSpreadsheetProposals();
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) return;

  const acceptedSet = new Set(acceptedCellRefs);
  const newSheet = { ...mainSheet };
  proposal.changes.forEach((c) => {
    if (acceptedSet.has(c.cellRef)) {
      newSheet[c.cellRef] = c.after;
    }
  });

  // Record undo before applying
  pushUndo(mainSheet);

  // Apply merged sheet
  setMainSheet(newSheet);

  // Update proposal status
  proposal.status = 'merged';
  proposal.mergedAt = new Date().toISOString();
  saveSpreadsheetProposals(proposals);
}

/** Helper to get a proposal by ID */
export function getSpreadsheetProposal(id: string): SpreadsheetProposal | undefined {
  return loadSpreadsheetProposals().find((p) => p.id === id);
}
