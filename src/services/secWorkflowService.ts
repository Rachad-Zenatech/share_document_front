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

/*
 * Standard workflow sheet layout, starting at A1 so every team's sheet reads the same way:
 *
 *   A1 Step           | B1 Description | C1 Assigned To
 *   A2 1              | B2 ...         | C2 ...
 *
 * The workflow name is the file name, so an exported "FS Notes V2.xlsx" re-imports as "FS Notes V2".
 * The importer still accepts older sheets where the table sits mid-sheet
 * (e.g. the original "Assignment of the FS Notes V2(WorkFlow)" starting at B5).
 */
const NAME_LABEL = 'Workflow Name';
const DESCRIPTION_LABEL = 'Description';
const STEP_HEADERS = ['Step', 'Description', 'Assigned To'];
const TEMPLATE_BLANK_STEPS = 8;

const lowerCell = (s: string | undefined) => (s || '').trim().toLowerCase();

/**
 * Turns sheet rows (from CSV or the first Excel worksheet) into a workflow.
 * Finds the header row containing "Step(s)" and "Description" wherever it is, then reads
 * numbered rows until the first blank step. "Workflow Name" / "Description" label rows above
 * the header fill the name and description; any other lines above it become the description.
 */
export function parseWorkflowRows(rows: string[][], fallbackName: string): SecWorkflowCreate {
  const lower = lowerCell;

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

  // Label rows from the standard layout ("Workflow Name" | value).
  const labelValue = (label: string) => {
    for (const r of rows.slice(0, headerIndex)) {
      const at = r.findIndex((c) => lower(c) === label.toLowerCase());
      if (at >= 0) return (r.slice(at + 1).find((c) => (c || '').trim()) || '').trim();
    }
    return '';
  };
  const labelledName = labelValue(NAME_LABEL);
  const labelledDescription = labelValue(DESCRIPTION_LABEL);

  const isLabelRow = (r: string[]) =>
    r.some((c) => lower(c) === NAME_LABEL.toLowerCase() || lower(c) === DESCRIPTION_LABEL.toLowerCase());
  const titleLines = rows
    .slice(0, headerIndex)
    .filter((r) => !isLabelRow(r))
    .map((r) => r.map((c) => (c || '').trim()).filter(Boolean).join(' '))
    .filter(Boolean);

  const description = labelledDescription || titleLines.join(' — ');
  return {
    name: labelledName || fallbackName,
    description: description || null,
    steps
  };
}

/** Reads a workflow sheet saved as CSV. */
export function parseWorkflowCsv(text: string, fallbackName: string): SecWorkflowCreate {
  return parseWorkflowRows(parseCsvRows(text.replace(/^﻿/, '')), fallbackName);
}

/** Reads the first worksheet of a workflow .xlsx file. */
export async function parseWorkflowXlsx(buffer: ArrayBuffer, fallbackName: string): Promise<SecWorkflowCreate> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook has no worksheets.');

  const rows: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, sheet.columnCount); c++) {
      cells.push((row.getCell(c).text || '').trim());
    }
    rows.push(cells);
  }
  return parseWorkflowRows(rows, fallbackName);
}

/** Reads a workflow sheet from an uploaded .xlsx or .csv file. */
export async function parseWorkflowFile(file: File): Promise<SecWorkflowCreate> {
  const fallbackName = file.name.replace(/\.(csv|xlsx)$/i, '');
  if (/\.xlsx$/i.test(file.name)) {
    return parseWorkflowXlsx(await file.arrayBuffer(), fallbackName);
  }
  return parseWorkflowCsv(await file.text(), fallbackName);
}

/**
 * Builds a workflow .xlsx in the standard A1 layout. Pass a workflow to export it,
 * or nothing for a blank template teams can fill in and import.
 */
export async function buildWorkflowWorkbook(workflow?: Pick<SecWorkflowCreate, 'steps'>): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Workflow');
  sheet.columns = [{ width: 16 }, { width: 70 }, { width: 50 }];


  const header = sheet.addRow(STEP_HEADERS);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2841' } };
  });

  const steps = workflow?.steps.length
    ? workflow.steps
    : Array.from({ length: TEMPLATE_BLANK_STEPS }, (_, i) => ({ step: i + 1, description: '', assignedTo: '' }));
  for (const s of steps) {
    const row = sheet.addRow([s.step, s.description, s.assignedTo ?? '']);
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
