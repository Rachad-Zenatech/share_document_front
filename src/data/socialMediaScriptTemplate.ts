import type { SecFilingDocument, SecBlock, SecTableRow } from '../types/secFiling';
import { SCRIPT_FONT_FAMILY, SCRIPT_FORM_TYPE } from '../types/documentType';

/**
 * "Social Media Script": the script page of the "Shaun Instagram Reels - AV Scripts" document, as it is in the Social Media
 * portal: a numbered title, a "Storyline:" line, a "Hook score | duration | lane" line, and the table of beats (Time, Visual /
 * footage, Voiceover, On-screen text) with the navy header, banded rows and bold on-screen text. A "Footage and compliance
 * note:" line follows when the script has one. The page footer ("Internal draft. Needs Comms/IR review before publishing.
 * Page n") is drawn by the editor for this kind of document (see DocumentRunningHeader).
 *
 * The gallery's template is the first script of that document, as a worked example to overwrite. Blank and attached scripts
 * made by the Social Media portal use the same page with their own content (the backend's script_app_service.build_document);
 * the server reads a script back from this shape, so keep the two in step.
 */
export const SCRIPT_TABLE_HEADERS = ['Time', 'Visual / footage', 'Voiceover', 'On-screen text'];
export const SCRIPT_HEADER_FILL = '#1F3A5F';
export const SCRIPT_BAND_FILL = '#F1F5F9';
export const SCRIPT_COLUMN_WIDTHS = ['7%', '29%', '40%', '24%'];

const EXAMPLE = {
  storyline: "Operator's receipt (his own experience)",
  facts: 'Hook score 80.8 (strong) | about 35 seconds | Green lane',
  beats: [
    ['0:00', 'Close-up of a laptop with code scrolling, hard cut to a drone propeller spinning up',
      "Twenty five years in software didn't prepare me for drones.", '25 YEARS IN SOFTWARE'],
    ['0:04', 'Office: someone pressing deploy on a laptop, then a calendar flipping Friday to Monday',
      'In software, you ship on Friday and fix it on Monday. A bug costs you a bad review.', 'SHIP FRIDAY. FIX MONDAY.'],
    ['0:10', 'Drone sitting still on a test pad, rotors stopped, silence',
      'In an aircraft, a bug costs you the aircraft.', 'A BUG COSTS THE AIRCRAFT'],
    ['0:13', 'Macro shots: a connector clicking in, a screw being tightened, a battery latch snapping shut',
      'So the habits flip. You test the boring parts harder than the exciting ones. Connectors. Screws. Battery latches.',
      'TEST THE BORING PARTS'],
    ['0:21', 'Hand writing in a logbook, a clipboard checklist being ticked',
      "You write down every single change. Because one day you'll need to know which one mattered.", 'WRITE DOWN EVERY CHANGE'],
    ['0:26', 'Engineer looking at a test-readout screen, then walking to the aircraft',
      "You don't argue with a test result. You go find out why.", ''],
    ['0:30', 'Laptop closing, then a drone lifting off cleanly',
      'Software taught me to move fast. Hardware taught me what fast actually costs.', 'WHAT FAST ACTUALLY COSTS'],
  ],
};

function beatRows(): SecTableRow[] {
  // The table draws its own header row from `headers`: the rows are only the beats.
  return [
    ...EXAMPLE.beats.map((b, i): SecTableRow => ({
      id: `sc-r${i + 1}`, type: 'data', cells: [...b], ...(i % 2 ? { shading: SCRIPT_BAND_FILL } : {}),
    })),
  ];
}

export function generateSocialMediaScriptDoc(title = 'Twenty five years in software'): SecFilingDocument {
  const now = new Date().toISOString();
  const stamp = Date.now();
  const paragraph = (n: number, text: string, extra: Partial<SecBlock> = {}): SecBlock =>
    ({ id: `blk-${stamp}-${n}`, type: 'paragraph', section: 'Script', text, alignment: 'left', spacingBottom: 4, fontFamily: SCRIPT_FONT_FAMILY, ...extra }) as SecBlock;
  const blocks: SecBlock[] = [
    { id: `blk-${stamp}-0`, type: 'heading', section: 'Script', level: 2, text: `1. ${title}`, alignment: 'left', bold: true,
      color: SCRIPT_HEADER_FILL, spacingBottom: 4, fontFamily: SCRIPT_FONT_FAMILY },
    paragraph(1, `Storyline: ${EXAMPLE.storyline}`),
    paragraph(2, EXAMPLE.facts, { color: '#6b7280', spacingBottom: 8 }),
    { id: `blk-${stamp}-3`, type: 'financial_table', section: 'Script', headers: SCRIPT_TABLE_HEADERS,
      headerShading: SCRIPT_HEADER_FILL, headerTextColor: '#FFFFFF', boldColumns: [3],
      columnAlignments: ['left', 'left', 'left', 'left'], columnWidths: SCRIPT_COLUMN_WIDTHS,
      spacingTop: 2, spacingBottom: 8, rows: beatRows() },
  ];
  return {
    id: `doc-social-script-${stamp}`, title, symbol: 'ZENA', formType: SCRIPT_FORM_TYPE, period: '', currency: 'USD',
    status: 'draft', version: 'v1.0.0', versionNumber: 1, blocks, createdAt: now, updatedAt: now, lastModifiedBy: 'Current User',
  };
}
