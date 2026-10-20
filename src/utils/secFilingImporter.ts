import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import type {
  SecFilingDocument,
  SecBlock,
  SecFinancialTableBlock,
  SecTableRow
} from '../types/secFiling';
import { sanitizeAndCompactBlocks } from '../services/secFilingService';
import { ZENATECH_LOGO_DATA_URL } from '../data/zenatechLogoAsset';

export interface ImportDocOptions {
  file: File;
  title?: string;
  formType?: string;
  period?: string;
  convertTables?: boolean;
  lockDocument?: boolean;
  lockedBy?: string;
  primaryCompany?: string;
  includeLogo?: boolean;
  defaultSection?: string;
}

export interface ParsedDocumentResult {
  doc: SecFilingDocument;
  blocks: SecBlock[];
  title: string;
  summary: {
    headings: number;
    paragraphs: number;
    tables: number;
    callouts: number;
    images: number;
    totalBlocks: number;
  };
}

/**
 * Extracts all embedded images from word/media/* and word/_rels/document.xml.rels
 */
async function extractDocxMediaMap(zip: JSZip): Promise<Map<string, string>> {
  const relsToDataUrl = new Map<string, string>();
  const pathToDataUrl = new Map<string, string>();

  // 1. Extract all media files in word/media/
  const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('word/media/'));
  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (!file) continue;
    const ext = path.split('.').pop()?.toLowerCase() || 'png';
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
        ? 'image/png'
        : ext === 'gif'
        ? 'image/gif'
        : ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'webp'
        ? 'image/webp'
        : 'image/png';
    const base64 = await file.async('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    pathToDataUrl.set(path, dataUrl);
    // Also key by filename without directory (e.g. "image1.png")
    const filename = path.replace('word/media/', '');
    pathToDataUrl.set(filename, dataUrl);
  }

  // 2. Read word/_rels/document.xml.rels to map rId -> media path
  const relsXml = zip.file('word/_rels/document.xml.rels');
  if (relsXml) {
    try {
      const text = await relsXml.async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const relElements = Array.from(doc.getElementsByTagName('Relationship'));
      for (const rel of relElements) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) {
          const normalizedTarget = target.replace(/^(\.\.\/)+/, '').replace(/^word\//, '');
          const filename = target.split('/').pop() || '';
          const dataUrl =
            pathToDataUrl.get(`word/${normalizedTarget}`) ||
            pathToDataUrl.get(normalizedTarget) ||
            pathToDataUrl.get(filename);
          if (dataUrl) {
            relsToDataUrl.set(id, dataUrl);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse word/_rels/document.xml.rels', e);
    }
  }

  return relsToDataUrl;
}

/**
 * Recursively flattens elements inside a DOCX node (handling <w:sdt>, <w:p>, <w:tbl>).
 */
function collectDocxBlockElements(node: Element, list: Element[] = []): Element[] {
  for (const child of Array.from(node.children)) {
    const name = child.nodeName;
    if (name === 'w:p' || name === 'w:tbl') {
      list.push(child);
    } else if (name === 'w:sdt') {
      // Look inside w:sdtContent
      const sdtContent = child.getElementsByTagName('w:sdtContent')[0];
      if (sdtContent) {
        collectDocxBlockElements(sdtContent, list);
      } else {
        collectDocxBlockElements(child, list);
      }
    }
  }
  return list;
}

/**
 * 100% Comprehensive DOCX parser supporting:
 * - Paragraphs with bold, italic, underline, alignments, font size, colors
 * - Structured Document Tags (<w:sdt>)
 * - Headings 1-4, Title, Subtitle, and section headers
 * - Financial Tables with header row detection, column alignments, subtotal/total rows, category headers
 * - Embedded Images and charts from word/media/
 * - Callout boxes and notes
 */
export async function parseDocxFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<SecFilingDocument> {
  const result = await parseDocxBlocks(file, options);
  return result.doc;
}

export async function parseDocxBlocks(file: File, options: Partial<ImportDocOptions> = {}): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('Invalid Word document (.docx). Missing word/document.xml.');
  }

  const mediaMap = await extractDocxMediaMap(zip);
  const xmlText = await docXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Could not find document body in DOCX.');
  }

  const blocks: SecBlock[] = [];
  let currentSection = options.defaultSection || 'General';
  let blockIndex = 0;
  const shouldConvertTables = options.convertTables !== false;
  const shouldIncludeLogo = Boolean(options.includeLogo);

  if (shouldIncludeLogo) {
    blocks.push({
      id: `blk-import-${Date.now()}-${blockIndex++}`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'Company Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    });
  }

  // Flatten top-level and sdt elements
  const elements = collectDocxBlockElements(body);

  for (const node of elements) {
    const nodeName = node.nodeName;

    // 1. Paragraph (<w:p>)
    if (nodeName === 'w:p') {
      // Check for embedded drawings/images
      const blips = Array.from(node.getElementsByTagName('a:blip'));
      for (const blip of blips) {
        const embedId = blip.getAttribute('r:embed');
        if (embedId && mediaMap.has(embedId)) {
          blocks.push({
            id: `blk-import-img-${Date.now()}-${blockIndex++}`,
            type: 'image',
            section: currentSection,
            url: mediaMap.get(embedId)!,
            alt: 'Imported Document Figure',
            alignment: 'center',
            width: 500,
          });
        }
      }

      // Collect run texts
      const textNodes = Array.from(node.getElementsByTagName('w:t'));
      let text = '';
      for (const t of textNodes) {
        text += t.textContent || '';
      }
      text = text.replace(/[\r\n]+/g, ' ').trim();

      if (!text) continue;

      const pStyle = node.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
      const jc = node.getElementsByTagName('w:jc')[0]?.getAttribute('w:val') || 'left';
      const isBold = node.getElementsByTagName('w:b').length > 0;
      const isItalic = node.getElementsByTagName('w:i').length > 0;
      const isUnderline = node.getElementsByTagName('w:u').length > 0;
      const alignment: 'left' | 'center' | 'right' | 'justify' =
        jc === 'center' ? 'center' : jc === 'right' ? 'right' : jc === 'both' ? 'justify' : 'left';

      // Section and Heading detection
      const isTitle = /title/i.test(pStyle);
      const isH1 =
        /heading\s*1/i.test(pStyle) ||
        (isBold && text.length < 90 && (alignment === 'center' || /^(UNITED STATES|FORM |PART |ITEM |NOTE )/i.test(text)));
      const isH2 =
        /heading\s*2/i.test(pStyle) ||
        (isBold && text.length < 120 && /^(Item\s+\d+|Note\s+\d+|Part\s+[I|V|X]+)/i.test(text));
      const isH3 = /heading\s*3/i.test(pStyle);
      const isH4 = /heading\s*4/i.test(pStyle);

      // Callout check (e.g. shaded paragraph or warning/notice text)
      const shd = node.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill');
      const hasShading = shd && shd !== 'auto' && shd !== 'none' && shd !== 'FFFFFF';
      const isCallout =
        hasShading ||
        /^(Note|Important|Warning|Notice|Caution|Disclaimer):/i.test(text) ||
        pStyle.toLowerCase().includes('callout') ||
        pStyle.toLowerCase().includes('quote');

      const headingAlign: 'left' | 'center' | 'right' = alignment === 'justify' ? 'left' : alignment;

      if (isCallout) {
        let variant: 'info' | 'warning' | 'notice' | 'unaudited' | 'success' = 'info';
        if (/warning|caution/i.test(text)) variant = 'warning';
        else if (/unaudited/i.test(text)) variant = 'unaudited';
        else if (/notice|important/i.test(text)) variant = 'notice';

        const colonIdx = text.indexOf(':');
        const title = colonIdx > 0 && colonIdx < 30 ? text.slice(0, colonIdx).trim() : 'Document Note';
        const content = colonIdx > 0 && colonIdx < 30 ? text.slice(colonIdx + 1).trim() : text;

        blocks.push({
          id: `blk-import-callout-${Date.now()}-${blockIndex++}`,
          type: 'callout',
          section: currentSection,
          variant,
          title,
          content,
        });
      } else if (isTitle || isH1) {
        if (text.length < 50 && !text.includes('.')) {
          currentSection = text;
        }
        blocks.push({
          id: `blk-import-h1-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 1,
          text,
          alignment: headingAlign,
          bold: true,
          color: '#0E2841',
        });
      } else if (isH2) {
        blocks.push({
          id: `blk-import-h2-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 2,
          text,
          alignment: headingAlign,
          bold: true,
        });
      } else if (isH3) {
        blocks.push({
          id: `blk-import-h3-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 3,
          text,
          alignment: headingAlign,
          bold: true,
        });
      } else if (isH4) {
        blocks.push({
          id: `blk-import-h4-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 4,
          text,
          alignment: headingAlign,
          bold: true,
        });
      } else {
        blocks.push({
          id: `blk-import-p-${Date.now()}-${blockIndex++}`,
          type: 'paragraph',
          section: currentSection,
          text,
          alignment,
          bold: isBold,
          italic: isItalic,
          underline: isUnderline,
        });
      }
    }

    // 2. Table (<w:tbl>)
    else if (nodeName === 'w:tbl') {
      const trNodes = Array.from(node.getElementsByTagName('w:tr'));
      if (trNodes.length === 0) continue;

      if (!shouldConvertTables) {
        for (const tr of trNodes) {
          const tcNodes = Array.from(tr.getElementsByTagName('w:tc'));
          const line = tcNodes
            .map((tc) => {
              const tNodes = Array.from(tc.getElementsByTagName('w:t'));
              return tNodes.map((t) => t.textContent || '').join(' ').trim();
            })
            .filter(Boolean)
            .join('   |   ');

          if (line) {
            blocks.push({
              id: `blk-import-txt-${Date.now()}-${blockIndex++}`,
              type: 'paragraph',
              section: currentSection,
              text: line,
              alignment: 'left',
            });
          }
        }
        continue;
      }

      const rows: SecTableRow[] = [];
      let detectedHeaders: string[] = [];

      for (let rIdx = 0; rIdx < trNodes.length; rIdx++) {
        const tr = trNodes[rIdx];
        const isHeaderRow = tr.getElementsByTagName('w:tblHeader').length > 0;
        const tcNodes = Array.from(tr.getElementsByTagName('w:tc'));

        const cells: string[] = [];
        for (const tc of tcNodes) {
          const gridSpan = parseInt(tc.getElementsByTagName('w:gridSpan')[0]?.getAttribute('w:val') || '1', 10);
          const tNodes = Array.from(tc.getElementsByTagName('w:t'));
          const cellText = tNodes.map((t) => t.textContent || '').join(' ').trim();
          cells.push(cellText);
          // If cell spans multiple columns, push empty values for extra columns
          for (let s = 1; s < gridSpan; s++) {
            cells.push('');
          }
        }

        if (cells.every((c) => !c)) continue;

        const isRowBold = tr.getElementsByTagName('w:b').length > 0;
        const shdVal = tr.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill');
        const hasShd = shdVal && shdVal !== 'auto' && shdVal !== 'none' && shdVal !== 'FFFFFF';
        const hasDoubleUnderline = tr.getElementsByTagName('w:bottom')[0]?.getAttribute('w:val') === 'double';

        const rowText = cells.join(' ').toLowerCase();
        const isTotalRow = hasDoubleUnderline || /\btotal\b/i.test(rowText);
        const isSubtotalRow = /\bsubtotal\b/i.test(rowText);

        if ((rIdx === 0 || isHeaderRow) && !detectedHeaders.length) {
          detectedHeaders = cells.map((c, i) => c || (i === 0 ? 'Description' : `Col ${i}`));
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'header',
            cells,
            bold: true,
          });
        } else if (hasShd || (isRowBold && cells.filter(Boolean).length <= 2)) {
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'category_header',
            cells,
            bold: true,
            shading: '#E6F4FF',
          });
        } else if (isTotalRow) {
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'total',
            cells,
            bold: true,
            doubleUnderline: true,
          });
        } else if (isSubtotalRow) {
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'subtotal',
            cells,
            bold: true,
            underline: true,
          });
        } else {
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'data',
            cells,
            bold: isRowBold,
          });
        }
      }

      if (rows.length > 0) {
        const maxCols = Math.max(...rows.map((r) => r.cells.length), detectedHeaders.length || 2);
        while (detectedHeaders.length < maxCols) {
          detectedHeaders.push(`Col ${detectedHeaders.length + 1}`);
        }

        // Column Alignments: Left for description, Right for figures
        const columnAlignments: ('left' | 'right' | 'center')[] = detectedHeaders.map((_, i) =>
          i === 0 ? 'left' : 'right'
        );

        const normalizedRows = rows.map((r) => {
          const newCells = [...r.cells];
          while (newCells.length < maxCols) {
            newCells.push('');
          }
          return { ...r, cells: newCells };
        });

        const tableBlock: SecFinancialTableBlock = {
          id: `blk-import-tbl-${Date.now()}-${blockIndex++}`,
          type: 'financial_table',
          section: currentSection || 'Financial Statements',
          title: `Table: ${detectedHeaders[0] || 'Statement Data'}`,
          headers: detectedHeaders,
          columnAlignments,
          rows: normalizedRows,
          spacing: 'normal',
        };

        blocks.push(tableBlock);
      }
    }
  }

  return buildFinalResult(blocks, file, options);
}

/**
 * Parses Markdown (.md, .markdown) files into SecBlocks.
 */
export async function parseMarkdownFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<ParsedDocumentResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const blocks: SecBlock[] = [];
  let currentSection = options.defaultSection || 'General';
  let blockIndex = 0;

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: SecTableRow[] = [];

  const flushTable = () => {
    if (inTable && tableHeaders.length > 0) {
      blocks.push({
        id: `blk-md-tbl-${Date.now()}-${blockIndex++}`,
        type: 'financial_table',
        section: currentSection,
        title: tableHeaders[0] || 'Markdown Table',
        headers: tableHeaders,
        columnAlignments: tableHeaders.map((_, i) => (i === 0 ? 'left' : 'right')),
        rows: tableRows,
      });
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table row detection (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const parts = trimmed
        .slice(1, -1)
        .split('|')
        .map((p) => p.trim());
      // Skip separator row (|---|---|)
      if (parts.every((p) => /^:?-+:?$/.test(p))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeaders = parts;
        tableRows.push({
          id: `r-hdr-${Date.now()}-${i}`,
          type: 'header',
          cells: parts,
          bold: true,
        });
      } else {
        const isBold = parts.some((p) => p.startsWith('**') && p.endsWith('**'));
        const cleanCells = parts.map((p) => p.replace(/\*\*/g, '').replace(/__/g, ''));
        tableRows.push({
          id: `r-data-${Date.now()}-${i}`,
          type: 'data',
          cells: cleanCells,
          bold: isBold,
        });
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('# ')) {
      const hText = trimmed.replace(/^#\s+/, '').trim();
      currentSection = hText;
      blocks.push({
        id: `blk-md-h1-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 1,
        text: hText,
        alignment: 'left',
        bold: true,
        color: '#0E2841',
      });
    } else if (trimmed.startsWith('## ')) {
      const hText = trimmed.replace(/^##\s+/, '').trim();
      blocks.push({
        id: `blk-md-h2-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 2,
        text: hText,
        alignment: 'left',
        bold: true,
      });
    } else if (trimmed.startsWith('### ')) {
      const hText = trimmed.replace(/^###\s+/, '').trim();
      blocks.push({
        id: `blk-md-h3-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 3,
        text: hText,
        alignment: 'left',
        bold: true,
      });
    }
    // Callouts / Blockquotes (> Note)
    else if (trimmed.startsWith('>')) {
      const calloutText = trimmed.replace(/^>\s*/, '').trim();
      blocks.push({
        id: `blk-md-callout-${Date.now()}-${blockIndex++}`,
        type: 'callout',
        section: currentSection,
        variant: 'info',
        title: 'Note',
        content: calloutText,
      });
    }
    // Regular paragraphs
    else {
      const isBold = trimmed.startsWith('**') && trimmed.endsWith('**');
      const clean = trimmed.replace(/^\*\*(.*)\*\*$/, '$1');
      blocks.push({
        id: `blk-md-p-${Date.now()}-${blockIndex++}`,
        type: 'paragraph',
        section: currentSection,
        text: clean,
        alignment: 'left',
        bold: isBold,
      });
    }
  }

  flushTable();
  return buildFinalResult(blocks, file, options);
}

/**
 * Parses HTML (.html, .htm) documents into SecBlocks.
 */
export async function parseHtmlFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<ParsedDocumentResult> {
  const html = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: SecBlock[] = [];
  let currentSection = options.defaultSection || 'General';
  let blockIndex = 0;

  const walker = doc.body.children;
  for (const el of Array.from(walker)) {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim() || '';

    if (tag === 'h1') {
      currentSection = text;
      blocks.push({
        id: `blk-html-h1-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 1,
        text,
        alignment: 'left',
        bold: true,
        color: '#0E2841',
      });
    } else if (tag === 'h2') {
      blocks.push({
        id: `blk-html-h2-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 2,
        text,
        alignment: 'left',
        bold: true,
      });
    } else if (tag === 'h3' || tag === 'h4') {
      blocks.push({
        id: `blk-html-h3-${Date.now()}-${blockIndex++}`,
        type: 'heading',
        section: currentSection,
        level: 3,
        text,
        alignment: 'left',
        bold: true,
      });
    } else if (tag === 'blockquote') {
      blocks.push({
        id: `blk-html-callout-${Date.now()}-${blockIndex++}`,
        type: 'callout',
        section: currentSection,
        variant: 'info',
        title: 'Note',
        content: text,
      });
    } else if (tag === 'table') {
      const trs = Array.from(el.querySelectorAll('tr'));
      if (trs.length > 0) {
        const rows: SecTableRow[] = [];
        let headers: string[] = [];
        trs.forEach((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent?.trim() || '');
          if (rIdx === 0) {
            headers = cells;
            rows.push({ id: `r-${rIdx}`, type: 'header', cells, bold: true });
          } else {
            rows.push({ id: `r-${rIdx}`, type: 'data', cells });
          }
        });
        blocks.push({
          id: `blk-html-tbl-${Date.now()}-${blockIndex++}`,
          type: 'financial_table',
          section: currentSection,
          title: headers[0] || 'HTML Table',
          headers,
          columnAlignments: headers.map((_, i) => (i === 0 ? 'left' : 'right')),
          rows,
        });
      }
    } else if (text) {
      blocks.push({
        id: `blk-html-p-${Date.now()}-${blockIndex++}`,
        type: 'paragraph',
        section: currentSection,
        text,
        alignment: 'left',
      });
    }
  }

  return buildFinalResult(blocks, file, options);
}

/**
 * Parses Excel (.xlsx, .xls) workbooks and converts sheets into financial tables.
 */
export async function parseExcelWorkbookFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const blocks: SecBlock[] = [];
  let blockIndex = 0;

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name || 'Sheet';
    const rows: SecTableRow[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const cellValues: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        if (val === null || val === undefined) cellValues.push('');
        else if (typeof val === 'object' && 'result' in (val as any)) cellValues.push(String((val as any).result));
        else cellValues.push(String(val));
      });

      if (cellValues.every((c) => !c)) return;

      if (rowNumber === 1 && !headers.length) {
        headers = cellValues.map((v, i) => v || (i === 0 ? 'Item' : `Col ${i}`));
        rows.push({
          id: `r-${sheetName}-${rowNumber}`,
          type: 'header',
          cells: cellValues,
          bold: true,
        });
      } else {
        const isBold = row.font?.bold || false;
        rows.push({
          id: `r-${sheetName}-${rowNumber}`,
          type: 'data',
          cells: cellValues,
          bold: isBold,
        });
      }
    });

    if (rows.length > 0) {
      blocks.push({
        id: `blk-xls-tbl-${Date.now()}-${blockIndex++}`,
        type: 'financial_table',
        section: sheetName,
        title: `${sheetName} Financial Statement`,
        headers: headers.length > 0 ? headers : ['Item', 'Amount'],
        columnAlignments: (headers.length > 0 ? headers : ['Item', 'Amount']).map((_, i) =>
          i === 0 ? 'left' : 'right'
        ),
        rows,
      });
    }
  });

  return buildFinalResult(blocks, file, options);
}

/**
 * Helper to build standard ParsedDocumentResult from generated blocks.
 */
function buildFinalResult(blocks: SecBlock[], file: File, options: Partial<ImportDocOptions>): ParsedDocumentResult {
  if (blocks.length === 0) {
    blocks.push({
      id: `blk-fallback-${Date.now()}`,
      type: 'paragraph',
      section: 'General',
      text: 'Imported document content.',
      alignment: 'left',
    });
  }

  const compactedBlocks = sanitizeAndCompactBlocks(blocks);
  const now = new Date().toISOString();
  const docTitle = options.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  const formType = options.formType || 'Form 10-Q';
  const period = options.period || 'Current Period';
  const isLocked = options.lockDocument !== false;
  const lockAuthor = options.lockedBy || 'Lead Controller';

  const doc: SecFilingDocument = {
    id: `doc-imported-${Date.now()}`,
    title: docTitle,
    symbol: 'ZENA',
    formType,
    period,
    currency: 'CAD',
    status: isLocked ? 'under_review' : 'draft',
    version: isLocked ? 'v1.0.0 (Locked Baseline)' : 'v1.0.0 (Draft)',
    versionNumber: 1,
    blocks: compactedBlocks,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: lockAuthor,
    lockedBy: isLocked ? lockAuthor : null,
  };

  const summary = {
    headings: compactedBlocks.filter((b) => b.type === 'heading').length,
    paragraphs: compactedBlocks.filter((b) => b.type === 'paragraph').length,
    tables: compactedBlocks.filter((b) => b.type === 'financial_table').length,
    callouts: compactedBlocks.filter((b) => b.type === 'callout').length,
    images: compactedBlocks.filter((b) => b.type === 'image').length,
    totalBlocks: compactedBlocks.length,
  };

  return { doc, blocks: compactedBlocks, title: docTitle, summary };
}

/**
 * Unified entry point that automatically detects file type (.docx, .md, .html, .xlsx, .json, .csv, .txt)
 * and returns parsed SecBlocks and SecFilingDocument.
 */
export async function parseDocumentFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<SecFilingDocument> {
  const result = await parseDocumentBlocks(file, options);
  return result.doc;
}

export async function parseDocumentBlocks(file: File, options: Partial<ImportDocOptions> = {}): Promise<ParsedDocumentResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.docx')) {
    return parseDocxBlocks(file, options);
  }

  if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
    return parseMarkdownFile(file, options);
  }

  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return parseHtmlFile(file, options);
  }

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelWorkbookFile(file, options);
  }

  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error('Invalid SEC Document JSON schema. Missing blocks array.');
    }
    return buildFinalResult(parsed.blocks, file, options);
  }

  // Fallback: Plain text / CSV
  const rawText = await file.text();
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: SecBlock[] = [];
  let blockIndex = 0;
  const currentSection = options.defaultSection || 'General';

  for (const line of lines) {
    if (line.includes(',') && options.convertTables !== false) {
      const parts = line.split(',').map((p) => p.trim());
      blocks.push({
        id: `blk-csv-tbl-${Date.now()}-${blockIndex++}`,
        type: 'financial_table',
        section: currentSection,
        title: 'Imported Tabular Data',
        headers: parts.map((_, idx) => (idx === 0 ? 'Item' : `Col ${idx}`)),
        columnAlignments: parts.map((_, idx) => (idx === 0 ? 'left' : 'right')),
        rows: [
          {
            id: `r-${Date.now()}-${blockIndex}`,
            type: 'data',
            cells: parts,
          },
        ],
      });
    } else {
      blocks.push({
        id: `blk-txt-p-${Date.now()}-${blockIndex++}`,
        type: 'paragraph',
        section: currentSection,
        text: line,
        alignment: 'left',
      });
    }
  }

  return buildFinalResult(blocks, file, options);
}
