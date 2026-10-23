// src/services/secWorkflowService.ts
import type {
  SecDocumentWorkflowResponse,
  SecWorkflow,
  SecWorkflowCreate,
  SecWorkflowList,
  SecWorkflowStep,
  SecWorkflowUpdate
} from '../types/secWorkflow';
import { apiClient } from './apiClient';

const BASE = '/sec-filings/workflows';

export const getWorkflows = async () => {
  return apiClient.get<SecWorkflowList>(BASE);
};

export const createWorkflow = async (payload: SecWorkflowCreate) => {
  return apiClient.post<SecWorkflow>(BASE, payload);
};

export const updateWorkflow = async (id: string, payload: SecWorkflowUpdate) => {
  return apiClient.put<SecWorkflow>(`${BASE}/${id}`, payload);
};

export const deleteWorkflow = async (id: string) => {
  return apiClient.delete<{ id: string; deleted: boolean }>(`${BASE}/${id}`);
};

export const setWorkflowDocuments = async (id: string, documentIds: string[]) => {
  return apiClient.put<SecWorkflow>(`${BASE}/${id}/documents`, { documentIds });
};

export const getDocumentWorkflow = async (documentId: string) => {
  return apiClient.get<SecDocumentWorkflowResponse>(
    `/sec-filings/documents/${encodeURIComponent(documentId)}/workflow`
  );
};

/** The value shown in the invite modal's Task / Proposed Branch Title dropdown. */
export const formatWorkflowStepTitle = (step: SecWorkflowStep) =>
  `Step ${step.step}: ${step.description}`;

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Reads a workflow sheet exported to CSV (e.g. "Assignment of the FS Notes V2(WorkFlow).csv").
 * Finds the header row containing "Steps" and "Description", then reads numbered rows
 * until the first blank step. The lines above the header (company, sheet title) become the description.
 */
export function parseWorkflowCsv(text: string, fallbackName: string): SecWorkflowCreate {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  const lower = (s: string | undefined) => (s || '').trim().toLowerCase();

  const headerIndex = rows.findIndex(
    (r) => r.some((c) => lower(c) === 'steps' || lower(c) === 'step') && r.some((c) => lower(c) === 'description')
  );
  if (headerIndex === -1) {
    throw new Error('Could not find a header row with "Steps" and "Description" columns.');
  }
  const header = rows[headerIndex];
  const stepCol = header.findIndex((c) => lower(c) === 'steps' || lower(c) === 'step');
  const descCol = header.findIndex((c) => lower(c) === 'description');
  const assignedCol = header.findIndex((c) => lower(c).startsWith('assigned'));

  const steps: SecWorkflowStep[] = [];
  for (const r of rows.slice(headerIndex + 1)) {
    const stepNo = parseInt((r[stepCol] || '').trim(), 10);
    const description = (r[descCol] || '').trim();
    if (!Number.isFinite(stepNo) || !description) break;
    steps.push({
      step: stepNo,
      description,
      assignedTo: assignedCol >= 0 ? (r[assignedCol] || '').trim() || null : null
    });
  }
  if (steps.length === 0) {
    throw new Error('No numbered workflow steps were found under the header row.');
  }

  const titleLines = rows
    .slice(0, headerIndex)
    .map((r) => r.map((c) => c.trim()).filter(Boolean).join(' '))
    .filter(Boolean);

  return {
    name: fallbackName,
    description: titleLines.length ? titleLines.join(' — ') : null,
    steps
  };
}
