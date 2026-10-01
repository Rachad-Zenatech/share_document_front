import JSZip from 'jszip';
import type { SecFilingDocument, SecBlock, SecFinancialTableBlock, SecTableRow } from '../types/secFiling';
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
}

export async function parseDocxFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<SecFilingDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('Invalid Word document (.docx). Missing document.xml.');
  }

  const xmlText = await docXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Could not find document body in DOCX.');
  }

  const blocks: SecBlock[] = [];
  let currentSection = 'General';
  let blockIndex = 0;
  const shouldConvertTables = options.convertTables !== false;
  const shouldIncludeLogo = options.includeLogo !== false;

  // Insert logo at the top if requested
  if (shouldIncludeLogo) {
    blocks.push({
      id: `blk-import-${Date.now()}-${blockIndex++}`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    });
  }

  const children = Array.from(body.children);

  for (const node of children) {
    const nodeName = node.nodeName;

    // 1. Paragraph / Heading node (<w:p>)
    if (nodeName === 'w:p') {
      const textNodes = Array.from(node.getElementsByTagName('w:t'));
      const text = textNodes.map((t) => t.textContent || '').join('').trim();

      if (!text) continue;

      // Check if heading or pStyle
      const pStyle = node.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
      const jc = node.getElementsByTagName('w:jc')[0]?.getAttribute('w:val') || 'left';
      const isBold = node.getElementsByTagName('w:b').length > 0;
      const alignment = jc === 'center' ? 'center' : jc === 'right' ? 'right' : 'left';

      const isHeading1 = /heading\s*1/i.test(pStyle) || (isBold && text.length < 80 && (alignment === 'center' || /^(UNITED STATES|FORM |PART |ITEM |NOTE )/i.test(text)));
      const isHeading2 = /heading\s*2/i.test(pStyle) || (isBold && text.length < 100);

      if (isHeading1) {
        if (text.length < 40 && !text.includes('.')) {
          currentSection = text;
        }
        blocks.push({
          id: `blk-import-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 1,
          text,
          alignment,
          bold: true,
          color: '#0E2841',
        });
      } else if (isHeading2) {
        blocks.push({
          id: `blk-import-${Date.now()}-${blockIndex++}`,
          type: 'heading',
          section: currentSection,
          level: 2,
          text,
          alignment,
          bold: true,
        });
      } else {
        blocks.push({
          id: `blk-import-${Date.now()}-${blockIndex++}`,
          type: 'paragraph',
          section: currentSection,
          text,
          alignment,
          bold: isBold,
        });
      }
    }

    // 2. Table node (<w:tbl>) -> Converted to rich financial_table block!
    else if (nodeName === 'w:tbl') {
      const trNodes = Array.from(node.getElementsByTagName('w:tr'));
      if (trNodes.length === 0) continue;

      if (!shouldConvertTables) {
        // If table conversion is disabled, convert each row into plain text paragraphs
        for (const tr of trNodes) {
          const tcNodes = Array.from(tr.getElementsByTagName('w:tc'));
          const line = tcNodes.map((tc) => {
            const tNodes = Array.from(tc.getElementsByTagName('w:t'));
            return tNodes.map((t) => t.textContent || '').join(' ').trim();
          }).filter(Boolean).join('   |   ');

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
        const tcNodes = Array.from(tr.getElementsByTagName('w:tc'));
        const cells: string[] = tcNodes.map((tc) => {
          const tNodes = Array.from(tc.getElementsByTagName('w:t'));
          return tNodes.map((t) => t.textContent || '').join(' ').trim();
        });

        // Skip completely empty rows
        if (cells.every((c) => !c)) continue;

        const isRowBold = tr.getElementsByTagName('w:b').length > 0;
        const shadingVal = tr.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill');
        const hasShading = shadingVal && shadingVal !== 'auto' && shadingVal !== 'none' && shadingVal !== 'FFFFFF';

        if (rIdx === 0 && !detectedHeaders.length) {
          detectedHeaders = cells.map((c, i) => c || (i === 0 ? 'Description' : `Col ${i}`));
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'header',
            cells,
            bold: true,
          });
        } else if (hasShading || (isRowBold && cells.filter(Boolean).length <= 2)) {
          rows.push({
            id: `row-import-${rIdx}`,
            type: 'category_header',
            cells,
            bold: true,
            shading: '#CCECFF',
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
        // Find maximum number of columns
        const maxCols = Math.max(...rows.map((r) => r.cells.length), detectedHeaders.length || 2);
        while (detectedHeaders.length < maxCols) {
          detectedHeaders.push(`Col ${detectedHeaders.length}`);
        }

        // Alignments: left for first column, right for numeric columns
        const columnAlignments: ('left' | 'right' | 'center')[] = detectedHeaders.map((_, i) =>
          i === 0 ? 'left' : 'right'
        );

        // Normalize rows cell counts
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
          title: `Financial Statement Table ${blockIndex}`,
          headers: detectedHeaders,
          columnAlignments,
          rows: normalizedRows,
          spacing: 'normal',
        };

        blocks.push(tableBlock);
      }
    }
  }

  // If no blocks parsed, provide default fallback
  if (blocks.length <= 1) {
    blocks.push({
      id: `blk-import-fallback-${Date.now()}`,
      type: 'paragraph',
      section: 'General',
      text: 'Imported document content.',
      alignment: 'left',
    });
  }

  const compactedBlocks = sanitizeAndCompactBlocks(blocks);
  const now = new Date().toISOString();
  const docTitle = options.title || file.name.replace(/\.[^/.]+$/, '');
  const formType = options.formType || 'Form 10-Q';
  const period = options.period || 'Current Period';
  const isLocked = options.lockDocument !== false; // Default to locked baseline
  const lockAuthor = options.lockedBy || 'Lead Controller';

  const importedDoc: SecFilingDocument = {
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

  return importedDoc;
}

export async function parseDocumentFile(file: File, options: Partial<ImportDocOptions> = {}): Promise<SecFilingDocument> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.docx')) {
    return parseDocxFile(file, options);
  }

  // Handle JSON Import
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error('Invalid SEC Document JSON schema. Missing blocks array.');
    }

    const now = new Date().toISOString();
    const isLocked = options.lockDocument !== false;
    const lockAuthor = options.lockedBy || 'Lead Controller';

    const importedDoc: SecFilingDocument = {
      ...parsed,
      id: `doc-imported-${Date.now()}`,
      title: options.title || parsed.title || file.name.replace(/\.[^/.]+$/, ''),
      formType: options.formType || parsed.formType || 'Form 10-Q',
      period: options.period || parsed.period || 'Current Period',
      status: isLocked ? 'under_review' : (parsed.status || 'draft'),
      lockedBy: isLocked ? lockAuthor : null,
      blocks: sanitizeAndCompactBlocks(parsed.blocks),
      createdAt: now,
      updatedAt: now,
      lastModifiedBy: lockAuthor,
    };

    return importedDoc;
  }

  // Handle Plain Text / CSV Import
  const rawText = await file.text();
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: SecBlock[] = [];
  let blockIndex = 0;

  if (options.includeLogo !== false) {
    blocks.push({
      id: `blk-import-${Date.now()}-${blockIndex++}`,
      type: 'image',
      section: 'Cover Page',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 260,
      spacingTop: 0,
    });
  }

  for (const line of lines) {
    if (line.includes(',') && options.convertTables !== false) {
      const parts = line.split(',').map((p) => p.trim());
      blocks.push({
        id: `blk-import-row-${Date.now()}-${blockIndex++}`,
        type: 'financial_table',
        section: 'Financial Data',
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
        id: `blk-import-p-${Date.now()}-${blockIndex++}`,
        type: 'paragraph',
        section: 'General',
        text: line,
        alignment: 'left',
      });
    }
  }

  const now = new Date().toISOString();
  const isLocked = options.lockDocument !== false;
  const lockAuthor = options.lockedBy || 'Lead Controller';

  return {
    id: `doc-imported-${Date.now()}`,
    title: options.title || file.name.replace(/\.[^/.]+$/, ''),
    symbol: 'ZENA',
    formType: options.formType || 'Form 10-Q',
    period: options.period || 'Current Period',
    currency: 'CAD',
    status: isLocked ? 'under_review' : 'draft',
    version: isLocked ? 'v1.0.0 (Locked Baseline)' : 'v1.0.0 (Draft)',
    versionNumber: 1,
    blocks: sanitizeAndCompactBlocks(blocks),
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: lockAuthor,
    lockedBy: isLocked ? lockAuthor : null,
  };
}
