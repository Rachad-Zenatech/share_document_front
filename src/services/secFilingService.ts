/**
 * Unified SEC Filing Service Facade
 *
 * Consolidates the modular SEC Filing subsystems:
 *   - secFilingStorage: LocalStorage quota handling, reclaimed space, debounced disk flush
 *   - secFilingDiff: Table & block diff engine, cell change detection
 *   - secFilingSpreadsheet: Workbook registry, cell-to-doc propagation, debounced backend pushes
 *   - secFilingProposals: Proposal creation, forking, review submission, full & selective merges
 *   - secFilingMockDocs: Seed document generators, block sanitizers
 *   - secFilingCore: Document CRUD, version snapshots, templates, e-signatures
 */

// 1. Storage & Quota Management
export {
  type StorageFailure,
  setStorageFailureListener,
  describeStorageUsage,
  flushPendingSaves,
  STORAGE_KEYS
} from './secFiling/secFilingStorage';

import { flushPendingSaves } from './secFiling/secFilingStorage';

// 2. Diff & Table Compaction Engine
export {
  compactFinancialTableBlock,
  computeFinancialTableCellDiffs,
  calculateDiffs
} from './secFiling/secFilingDiff';

import { calculateDiffs } from './secFiling/secFilingDiff';

// 3. Mock & Seed Document Helpers
export {
  sanitizeAndCompactBlocks,
  generateSarahJenkinsMergedDoc
} from './secFiling/secFilingMockDocs';

// 4. Proposals & Contributor URLs
export {
  getProposalInviteUrl
} from './secFiling/secFilingProposals';

import {
  getProposals,
  saveProposals,
  createProposal,
  createContributorInvite,
  getOrCreateContributorProposal,
  forkProposalFromMerged,
  updateProposal,
  submitProposalForReview,
  mergeSelectiveChanges,
  mergeProposalIntoMain,
  rejectProposal
} from './secFiling/secFilingProposals';

// 5. Core Document Operations
import {
  getMainDocument,
  saveMainDocument,
  getDocumentsList,
  getDocumentPreview,
  saveDocumentsList,
  getAllDocuments,
  setActiveDocumentId,
  getActiveDocumentId,
  getDocumentContent,
  openDocument,
  createDocumentFromTemplate,
  duplicateDocument,
  renameDocument,
  deleteDocument,
  getVersionHistory,
  saveVersionHistory,
  restoreVersion,
  applyElectronicSignature,
  resetToDefault
} from './secFiling/secFilingCore';

// 6. Spreadsheet Operations
export {
  fetchAttachedSpreadsheetFromBackend,
  pushAttachedSpreadsheetToBackend,
  applyBackendSpreadsheet,
  getAttachedSpreadsheet,
  assignSpreadsheetToDocument,
  assignSpreadsheetToDocuments,
  updateAttachedSpreadsheet,
  updateSpreadsheetCellAndSyncDoc,
  getAllSpreadsheets,
  getSpreadsheetById,
  saveSpreadsheet,
  deleteSpreadsheet
} from './secFiling/secFilingSpreadsheet';

import {
  getAllSpreadsheets,
  getSpreadsheetById,
  saveSpreadsheet,
  deleteSpreadsheet,
  assignSpreadsheetToDocuments,
  assignSpreadsheetToDocument,
  getAttachedSpreadsheet,
  fetchAttachedSpreadsheetFromBackend,
  pushAttachedSpreadsheetToBackend,
  applyBackendSpreadsheet,
  updateAttachedSpreadsheet,
  updateSpreadsheetCellAndSyncDoc
} from './secFiling/secFilingSpreadsheet';

/**
 * Unified SEC Filing Service Facade Object
 * Preserves 100% backwards compatibility with all existing callers.
 */
export const secFilingService = {
  flushPendingSaves,

  // Document Core CRUD
  getMainDocument,
  saveMainDocument,
  getDocumentsList,
  getDocumentPreview,
  saveDocumentsList,
  getAllDocuments,
  setActiveDocumentId,
  getActiveDocumentId,
  getDocumentContent,
  openDocument,
  createDocumentFromTemplate,
  duplicateDocument,
  renameDocument,
  deleteDocument,

  // Spreadsheet Hub & Synchronization
  getAllSpreadsheets,
  getSpreadsheetById,
  saveSpreadsheet,
  deleteSpreadsheet,
  assignSpreadsheetToDocuments,
  assignSpreadsheetToDocument,
  getAttachedSpreadsheet,
  fetchAttachedSpreadsheetFromBackend,
  pushAttachedSpreadsheetToBackend,
  applyBackendSpreadsheet,
  updateAttachedSpreadsheet,
  updateSpreadsheetCellAndSyncDoc,

  // Proposals & Merge Engine
  getProposals,
  saveProposals,
  createProposal,
  createContributorInvite,
  getOrCreateContributorProposal,
  forkProposalFromMerged,
  updateProposal,
  submitProposalForReview,
  mergeSelectiveChanges,
  mergeProposalIntoMain,
  rejectProposal,

  // Version History
  getVersionHistory,
  saveVersionHistory,
  restoreVersion,

  // Diff Engine
  calculateDiffs,

  // Signatures & Reset
  applyElectronicSignature,
  resetToDefault
};

export default secFilingService;
