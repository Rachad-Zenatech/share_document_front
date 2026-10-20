import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber
} from 'docx';
import type { SecFilingDocument } from '../types/secFiling';
import { ZENATECH_LOGO_DATA_URL } from '../data/zenatechLogoAsset';
import { interpolateVariables } from './documentVariables';

export const sanitizeTableCells = (cells: string[]): string[] => {
  const result = [...cells];
  for (let i = 0; i < result.length - 1; i++) {
    const c = (result[i] || '').trim();
    const nextC = (result[i + 1] || '').trim();
    if (c.startsWith('(') && !c.endsWith(')') && nextC === ')') {
      result[i] = `${c})`;
      result[i + 1] = '';
    } else if (c.startsWith('(') && !c.endsWith(')') && !result.slice(i).some((x) => x.includes(')'))) {
      result[i] = `${c})`;
    }
  }
  if (result.length > 0) {
    const last = (result[result.length - 1] || '').trim();
    if (last.startsWith('(') && !last.endsWith(')')) {
      result[result.length - 1] = `${last})`;
    }
  }
  return result;
};

const isComparativeDateHeaderCell = (text: string, rowIndex: number, _colIndex?: number): boolean => {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  if (/^As of$/i.test(trimmed)) return true;
  if (/^Notes?(\s*Ref)?$/i.test(trimmed)) return true;
  if (/^(Three|Six|Nine|Twelve)\s+months\s+ended/i.test(trimmed)) return true;
  if (/^Six\s+months\s+20\d\d/i.test(trimmed)) return true;
  if (/^(Q[1-4]|FY)\s*20\d\d/i.test(trimmed)) return true;
  if (
    rowIndex <= 3 &&
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?(\s+\d{4})?(\s+in\s+[$a-zA-Z]+)?$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (rowIndex <= 3 && /^(19|20)\d{2}(\s+in\s+[$a-zA-Z]+)?$/.test(trimmed)) {
    return true;
  }
  return false;
};

export const isMajorStatementHeaderCell = (text: string): boolean => {
  if (!text) return false;
  const normalized = text
    .replace(/&rsquo;|&#8217;|&#39;|&lsquo;/gi, "'")
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4\u00E2\u20AC\u2122]+/g, "'")
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:.,]+$/, '');

  if (!normalized) return false;

  return /^(Assets|Liabilities(\s*(and|&)\s*((shareholder|stockholder)['s]*|total)?\s*(equity|deficit))?|(shareholder|stockholder)['s]*\s*(equity|deficit)):?$/i.test(
    normalized
  );
};

const getTopSpacingTwips = (spacingTop: number | undefined, defaultTwips: number): number => {
  if (typeof spacingTop === 'number') {
    return Math.max(0, Math.round(spacingTop * 15));
  }
  return defaultTwips;
};

type DocxImageType = 'jpg' | 'png' | 'gif' | 'bmp';

const getDocxImageType = (mimeType: string, url: string): DocxImageType => {
  const source = `${mimeType} ${url}`.toLowerCase();
  if (source.includes('jpeg') || source.includes('.jpg') || source.includes('.jpeg')) return 'jpg';
  if (source.includes('gif')) return 'gif';
  if (source.includes('bmp')) return 'bmp';
  return 'png';
};

const loadImageForDocx = async (url?: string, requestedWidth?: number, requestedHeight?: number) => {
  const targetUrl = url || ZENATECH_LOGO_DATA_URL;

  // 1. Direct Base64 Data URI handling (100% reliable offline / browser memory)
  if (targetUrl.startsWith('data:')) {
    const [header, base64Data] = targetUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const width = Math.min(requestedWidth || 260, 600);
    const height = requestedHeight || Math.round(width * 0.38);
    return {
      data: bytes,
      type: getDocxImageType(mimeType, targetUrl),
      width,
      height
    };
  }

  // 2. HTTP / Fetch handling
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`Unable to retrieve image (${response.status})`);

  const imageBlob = await response.blob();
  const objectUrl = URL.createObjectURL(imageBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('Unsupported image format'));
      candidate.src = objectUrl;
    });
    const naturalWidth = image.naturalWidth || 260;
    const naturalHeight = image.naturalHeight || 160;
    const width = Math.min(requestedWidth || naturalWidth, 600);
    const height = requestedHeight || Math.round(width * (naturalHeight / naturalWidth));
    return {
      data: new Uint8Array(await imageBlob.arrayBuffer()),
      type: getDocxImageType(imageBlob.type, targetUrl),
      width,
      height
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Dynamically exports any SEC Filing Document (including added/removed/reordered blocks)
 * into a beautifully formatted Word (.docx) document.
 */
export async function exportSecFilingToDocx(doc: SecFilingDocument): Promise<Blob> {
  const children: any[] = [];

  for (const block of doc.blocks) {
    if (block.type === 'metadata') {
      // Dynamic Filing Metadata Cover Block
      if (block.companyName) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER as any,
            children: [
              new TextRun({
                text: block.companyName,
                bold: true,
                size: 28,
                color: '0E2841',
                font: 'Calibri'
              })
            ],
            spacing: { before: getTopSpacingTwips(block.spacingTop, 200), after: 100 }
          })
        );
      }

      if (block.documentTitle || block.formType) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER as any,
            children: [
              new TextRun({
                text: block.documentTitle || block.formType,
                bold: true,
                size: 24,
                color: '0E2841',
                font: 'Calibri'
              })
            ],
            spacing: { after: 100 }
          })
        );
      }

      if (block.periodEnded) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER as any,
            children: [
              new TextRun({
                text: `For the Period Ended ${block.periodEnded}`,
                bold: true,
                size: 22,
                font: 'Calibri'
              })
            ],
            spacing: { after: 80 }
          })
        );
      }

      const currencyText = block.currency ? `Expressed in ${block.currency}` : '';
      if (currencyText) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER as any,
            children: [
              new TextRun({
                text: `${currencyText} — Unaudited`,
                italics: true,
                size: 20,
                font: 'Calibri'
              })
            ],
            spacing: { after: 300 }
          })
        );
      }
    } else if (block.type === 'heading') {
      let headingLevel: any = HeadingLevel.HEADING_1;
      let size = 24;
      if (block.level === 2) {
        headingLevel = HeadingLevel.HEADING_2;
        size = 22;
      } else if (block.level === 3) {
        headingLevel = HeadingLevel.HEADING_3;
        size = 20;
      } else if (block.level === 4) {
        headingLevel = HeadingLevel.HEADING_4;
        size = 18;
      }

      let alignment: any = AlignmentType.LEFT;
      if (block.alignment === 'center') alignment = AlignmentType.CENTER;
      if (block.alignment === 'right') alignment = AlignmentType.RIGHT;

      const interpolatedHeadingText = interpolateVariables(block.text, doc.attachedSpreadsheet);
      const isStatementTitle = interpolatedHeadingText.includes('Statements of');

      const headingColor = block.color
        ? block.color.replace('#', '')
        : block.level <= 2
        ? '0E2841'
        : '000000';

      children.push(
        new Paragraph({
          heading: headingLevel,
          alignment,
          pageBreakBefore: isStatementTitle,
          children: [
            new TextRun({
              text: interpolatedHeadingText,
              bold: block.bold ?? true,
              italics: block.italic ?? false,
              size,
              color: headingColor,
              font: 'Calibri'
            })
          ],
          spacing: { before: getTopSpacingTwips(block.spacingTop, isStatementTitle ? 0 : 200), after: 100 }
        })
      );
    } else if (block.type === 'paragraph') {
      let alignment: any = AlignmentType.LEFT;
      if (block.alignment === 'center') alignment = AlignmentType.CENTER;
      if (block.alignment === 'right') alignment = AlignmentType.RIGHT;
      if (block.alignment === 'justify') alignment = AlignmentType.JUSTIFIED;

      const textColor = block.color ? block.color.replace('#', '') : '000000';
      const interpolatedParaText = interpolateVariables(block.text, doc.attachedSpreadsheet);

      children.push(
        new Paragraph({
          alignment,
          children: [
            new TextRun({
              text: interpolatedParaText,
              bold: block.bold ?? false,
              italics: block.italic ?? false,
              size: 20,
              color: textColor,
              font: 'Calibri'
            })
          ],
          spacing: { before: getTopSpacingTwips(block.spacingTop, 60), after: 80, line: 260 }
        })
      );
    } else if (block.type === 'callout') {
      const calloutTop = getTopSpacingTwips(block.spacingTop, 160);
      if (calloutTop > 0) {
        children.push(new Paragraph({ spacing: { before: calloutTop, after: 0 } }));
      }
      const calloutTitle = block.title ? interpolateVariables(block.title, doc.attachedSpreadsheet) : '';
      const calloutContent = block.content ? interpolateVariables(block.content, doc.attachedSpreadsheet) : '';
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    calloutTitle
                      ? new Paragraph({
                          children: [
                            new TextRun({
                              text: calloutTitle,
                              bold: true,
                              size: 19,
                              color: '0E2841',
                              font: 'Calibri'
                            })
                          ],
                          spacing: { after: 60 }
                        })
                      : new Paragraph({ text: '' }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: calloutContent,
                          italics: true,
                          size: 18,
                          font: 'Calibri'
                        })
                      ]
                    })
                  ],
                  margins: { top: 100, bottom: 100, left: 140, right: 140 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
                    left: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
                    right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
                  }
                })
              ]
            })
          ]
        }),
        new Paragraph({ spacing: { after: 120 } })
      );
    } else if (block.type === 'financial_table') {
      const tableRows: TableRow[] = [];

      const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
      const singleLine = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
      const doubleLine = { style: BorderStyle.DOUBLE, size: 8, color: '000000' };

      // Dynamic Table Headers: Sanitize "Col X" and avoid redundant fake header rows
      const rawHeaders = block.headers || [];
      const cleanedHeaders = rawHeaders.map((h) => (/^Col\s*\d+$/i.test(h?.trim() || '') ? '' : h));
      const hasMeaningfulHeader = cleanedHeaders.some((h) => h && h.trim().length > 0);
      const firstRowIsHeader = block.rows && block.rows.length > 0 && block.rows[0].type === 'header';

      if (hasMeaningfulHeader && !firstRowIsHeader) {
        const headerFill = (block.headerShading || 'FFFFFF').replace('#', '');
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: cleanedHeaders.map((h, i) => {
              const align = block.columnAlignments[i] || (i === 0 ? 'left' : 'center');
              const alignment = align === 'right' ? AlignmentType.RIGHT : align === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER;
              const headerText = interpolateVariables(h || '', doc.attachedSpreadsheet);
              const lines = headerText.split('\n');
              return new TableCell({
                shading: { fill: headerFill },
                children: lines.map((line) => new Paragraph({
                  alignment: alignment as any,
                  spacing: { before: 0, after: 0, line: 240 },
                  children: [
                    new TextRun({
                      text: line,
                      bold: true,
                      size: 18,
                      color: '0E2841',
                      font: 'Calibri'
                    })
                  ]
                })),
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
                borders: {
                  top: noBorder,
                  left: noBorder,
                  right: noBorder,
                  bottom: singleLine
                }
              });
            })
          })
        );
      }

      // Dynamic Data Rows
      for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
        const row = block.rows[rowIndex];
        const isSection = row.type === 'section_title' || row.type === 'category_header';
        const isDateHeaderRow = !isSection && row.cells.some((c, cIdx) => cIdx > 0 && isComparativeDateHeaderCell(c, rowIndex, cIdx));
        const isMajorHeaderRow = !isSection && row.cells.some(c => isMajorStatementHeaderCell(c));
        const isHeaderLikeRow = !isSection && (row.type === 'header' || isDateHeaderRow || isMajorHeaderRow);
        const fillHex = isHeaderLikeRow
          ? undefined
          : row.shading
          ? row.shading.replace('#', '')
          : isSection
          ? 'DAE9F7'
          : undefined;

        tableRows.push(
          new TableRow({
            children: row.cells.map((cellText, colIndex) => {
              const isDateHeader = !isSection && isComparativeDateHeaderCell(cellText, rowIndex, colIndex);
              const isMajorHeader = !isSection && (isMajorStatementHeaderCell(cellText) || (isMajorHeaderRow && colIndex === 0));
              const defaultAlign = block.columnAlignments[colIndex] || (colIndex === 0 ? 'left' : 'right');
              // An explicit per-cell override wins over per-row alignment, header auto-centering, and column default.
              const align = row.cellAlignments?.[colIndex]
                ? row.cellAlignments[colIndex]
                : row.align
                ? row.align
                : (isDateHeader || isMajorHeader || ((row.type === 'header' || isMajorHeaderRow) && colIndex === 0)) ? 'center' : defaultAlign;
              const isFirstCol = colIndex === 0;
              const maxAllowedIndent = (row.type === 'header' || isMajorHeaderRow) ? 1 : 3;
              const effectiveIndent = Math.min(row.indent || 0, maxAllowedIndent);
              const indent = isFirstCol && effectiveIndent ? effectiveIndent * 200 : 0;
              const sanitizedCells = sanitizeTableCells(row.cells);
              const rawCellVal = sanitizedCells[colIndex] ?? cellText;
              const cellVal = interpolateVariables(rawCellVal, doc.attachedSpreadsheet);
              const lines = (cellVal || '').split('\n');

              let topBorder: any = noBorder;
              let bottomBorder: any = noBorder;

              if (row.type === 'subtotal') {
                topBorder = singleLine;
                bottomBorder = singleLine;
              } else if (row.type === 'total') {
                topBorder = singleLine;
                bottomBorder = doubleLine;
              }

              const alignment = align === 'center'
                ? (AlignmentType.CENTER as any)
                : align === 'right'
                ? (AlignmentType.RIGHT as any)
                : (AlignmentType.LEFT as any);

              return new TableCell({
                shading: (fillHex && !isDateHeader && !isMajorHeader && row.type !== 'header') ? { fill: fillHex } : undefined,
                children: lines.map((line) => new Paragraph({
                  alignment,
                  indent: indent > 0 ? { left: indent } : undefined,
                  spacing: { before: 0, after: 0, line: 240 },
                  children: [
                    new TextRun({
                      text: line,
                      bold: isDateHeader || isMajorHeader || row.bold || row.type === 'total' || row.type === 'section_title' || row.type === 'category_header' || row.type === 'header',
                      italics: row.italic,
                      size: 18,
                      font: 'Calibri'
                    })
                  ]
                })),
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                borders: {
                  top: topBorder,
                  left: noBorder,
                  right: noBorder,
                  bottom: bottomBorder
                }
              });
            })
          })
        );
      }

      const tableTop = getTopSpacingTwips(block.spacingTop, 100);
      if (tableTop > 0) {
        children.push(new Paragraph({ spacing: { before: tableTop, after: 0 } }));
      }
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      );

      // Dynamic Footnotes
      if (block.footnotes && block.footnotes.length > 0) {
        for (const fn of block.footnotes) {
          const fnText = interpolateVariables(fn, doc.attachedSpreadsheet);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: fnText,
                  italics: true,
                  size: 17,
                  color: '555555',
                  font: 'Calibri'
                })
              ],
              spacing: { before: 60, after: 120 }
            })
          );
        }
      } else {
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
    } else if (block.type === 'signature') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.title || 'SIGNATURES',
              bold: true,
              size: 22,
              color: '0E2841',
              font: 'Calibri'
            })
          ],
          spacing: { before: 200, after: 100 }
        })
      );

      for (const officer of block.officers) {
        const sigText = officer.signed && officer.signatureText
          ? officer.signatureText
          : officer.signed && officer.name
          ? `/s/ ${officer.name}`
          : '/s/ ____________________________';

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: sigText,
                bold: true,
                size: 20,
                font: 'Calibri'
              })
            ],
            spacing: { before: 80 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${officer.name} — ${officer.title}`,
                size: 19,
                font: 'Calibri'
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${officer.date}`,
                italics: true,
                size: 18,
                font: 'Calibri'
              })
            ],
            spacing: { after: 140 }
          })
        );
      }
    } else if (block.type === 'divider') {
      if (block.pageBreak) {
        children.push(
          new Paragraph({
            pageBreakBefore: true,
            children: block.label
              ? [
                  new TextRun({
                    text: block.label,
                    bold: true,
                    size: 18,
                    color: '666666',
                    font: 'Calibri'
                  })
                ]
              : []
          })
        );
      }
    } else if (block.type === 'image') {
      let alignment: any = AlignmentType.CENTER;
      if (block.alignment === 'left') alignment = AlignmentType.LEFT;
      if (block.alignment === 'right') alignment = AlignmentType.RIGHT;

      try {
        const image = await loadImageForDocx(block.url, block.width, block.height);
        children.push(
          new Paragraph({
            alignment,
            children: [
              new ImageRun({
                data: image.data,
                type: image.type,
                transformation: { width: image.width, height: image.height }
              })
            ],
            spacing: { before: getTopSpacingTwips(block.spacingTop, 100), after: block.caption ? 40 : 120 }
          })
        );
      } catch {
        children.push(
          new Paragraph({
            alignment,
            children: [
              new TextRun({
                text: `[Image unavailable: ${block.alt || 'Corporate Logo / Graphic'}]`,
                italics: true,
                size: 18,
                color: '666666',
                font: 'Calibri'
              })
            ],
            spacing: { before: getTopSpacingTwips(block.spacingTop, 100), after: block.caption ? 40 : 120 }
          })
        );
      }

      if (block.caption) {
        children.push(
          new Paragraph({
            alignment,
            children: [
              new TextRun({
                text: block.caption,
                italics: true,
                size: 16,
                color: '888888',
                font: 'Calibri'
              })
            ],
            spacing: { after: 120 }
          })
        );
      }
    }
  }

  const docxDocument = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT as any,
                children: [
                  new TextRun({
                    text: `${doc.symbol || 'SEC Filing'} — ${doc.period || doc.version}`,
                    italics: true,
                    size: 16,
                    color: '888888',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER as any,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    color: '888888',
                    font: 'Calibri'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '888888',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  return await Packer.toBlob(docxDocument);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Dynamically prints or exports any SEC Filing Document to PDF using native browser rendering.
 */
export function printSecFiling(doc: SecFilingDocument) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print/export the SEC filing to PDF.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${doc.title || 'SEC Filing'} - ${doc.version}</title>
        <style>
          @page {
            size: letter;
            margin: 1in;
          }
          body {
            font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10.5pt;
            line-height: 1.35;
            color: #111;
            margin: 0;
            padding: 24px;
          }
          .page-break {
            page-break-before: always;
          }
          .sec-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .sec-header h1 {
            font-size: 15pt;
            margin: 0 0 4px 0;
            font-weight: bold;
            color: #0E2841;
          }
          .sec-header h2 {
            font-size: 13pt;
            margin: 0 0 4px 0;
            font-weight: bold;
            color: #0E2841;
          }
          .sec-header p {
            margin: 2px 0;
            font-style: italic;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 9.5pt;
          }
          th {
            background-color: #CCECFF;
            color: #0E2841;
            border-bottom: 1.5pt solid #0E2841;
            padding: 6px 6px;
            font-weight: bold;
          }
          td {
            padding: 3px 6px;
            border: none;
          }
          .subtotal td {
            border-top: 1pt solid #000;
            border-bottom: 1pt solid #000;
            font-weight: bold;
          }
          .total td {
            border-top: 1pt solid #000;
            border-bottom: 3pt double #000;
            font-weight: bold;
          }
          .section_title td, .category_header td {
            background-color: #DAE9F7;
            font-weight: bold;
            color: #0E2841;
          }
          .align-left { text-align: left; }
          .align-center { text-align: center; }
          .align-right { text-align: right; }
          .indent-1 { padding-left: 16px; }
          .indent-2 { padding-left: 32px; }
          .indent-3 { padding-left: 48px; }
          .callout {
            border: 1pt solid #cbd5e1;
            border-left: 3pt solid #2563eb;
            background: #f8fafc;
            padding: 10px 14px;
            margin: 14px 0;
            font-size: 9.5pt;
          }
          .signatures {
            margin-top: 30px;
          }
          .signature-item {
            margin-bottom: 20px;
          }
          @media print {
            body { padding: 0; }
            th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="sec-document">
          ${doc.blocks
            .map((b) => {
              if (b.type === 'metadata') {
                return `
                  <div class="sec-header">
                    <h1>${b.companyName || 'ZenaTech, Inc.'}</h1>
                    <h2>${b.documentTitle || b.formType || 'Consolidated Financial Statements'}</h2>
                    ${b.periodEnded ? `<p><strong>For the Period Ended ${b.periodEnded}</strong></p>` : ''}
                    ${b.currency ? `<p>Expressed in ${b.currency} — Unaudited</p>` : ''}
                  </div>
                `;
              }
              if (b.type === 'heading') {
                const alignClass = `align-${b.alignment || 'left'}`;
                const headingText = interpolateVariables(b.text, doc.attachedSpreadsheet);
                const isStatement = headingText.includes('Statements of');
                const topMargin = typeof b.spacingTop === 'number' ? `${b.spacingTop}px` : '14px';
                return `<h${b.level} class="${alignClass} ${isStatement ? 'page-break' : ''}" style="margin: ${topMargin} 0 6px 0; font-weight: bold; color: ${b.color || '#0E2841'};">${headingText}</h${b.level}>`;
              }
              if (b.type === 'paragraph') {
                const alignClass = `align-${b.alignment || 'left'}`;
                const topMargin = typeof b.spacingTop === 'number' ? `${b.spacingTop}px` : '5px';
                const paraText = interpolateVariables(b.text, doc.attachedSpreadsheet);
                return `<p class="${alignClass}" style="margin: ${topMargin} 0; color: ${b.color || 'inherit'};">${paraText}</p>`;
              }
              if (b.type === 'callout') {
                const cTitle = b.title ? interpolateVariables(b.title, doc.attachedSpreadsheet) : '';
                const cContent = b.content ? interpolateVariables(b.content, doc.attachedSpreadsheet) : '';
                return `
                  <div class="callout" style="margin-top: ${typeof b.spacingTop === 'number' ? `${b.spacingTop}px` : '14px'};">
                    ${cTitle ? `<strong>${cTitle}</strong><br/>` : ''}
                    <em>${cContent}</em>
                  </div>
                `;
              }
              if (b.type === 'financial_table') {
                const headerBg = b.headerShading || '#FFFFFF';
                const topMargin = typeof b.spacingTop === 'number' ? `${b.spacingTop}px` : '14px';
                return `
                  <table style="margin-top: ${topMargin};">
                    <thead>
                      <tr style="background-color: ${headerBg};">
                        ${b.headers
                          .map((h, i) => {
                            const cleaned = /^Col\s*\d+$/i.test(h?.trim() || '') ? '' : interpolateVariables(h || '', doc.attachedSpreadsheet);
                            return `<th class="align-${b.columnAlignments[i] || 'left'}">${cleaned}</th>`;
                          })
                          .join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${b.rows
                        .map((r, rIdx) => {
                          const isSection = r.type === 'category_header' || r.type === 'section_title';
                          const isDateHeaderRow = !isSection && r.cells.some((c, i) => i > 0 && isComparativeDateHeaderCell(c, rIdx, i));
                          const isMajorHeaderRow = !isSection && r.cells.some(c => isMajorStatementHeaderCell(c));
                          const isHeaderLikeRow = !isSection && (r.type === 'header' || isDateHeaderRow || isMajorHeaderRow);
                          const rowClass = r.type === 'total' ? 'total' : r.type === 'subtotal' ? 'subtotal' : isHeaderLikeRow ? 'date_header' : isSection ? 'category_header section_title' : '';
                          const rowBg = isHeaderLikeRow ? 'background-color: transparent;' : (r.shading ? `background-color: ${r.shading};` : isSection ? 'background-color: #DAE9F7;' : '');
                          return `
                            <tr class="${rowClass}" style="${rowBg}">
                              ${sanitizeTableCells(r.cells)
                                .map((c, i) => {
                                  const rawCell = c;
                                  const cellVal = interpolateVariables(rawCell, doc.attachedSpreadsheet);
                                  const isDateHeader = !isSection && isComparativeDateHeaderCell(cellVal, rIdx, i);
                                  const isMajorHeader = !isSection && (isMajorStatementHeaderCell(cellVal) || (isMajorHeaderRow && i === 0));
                                  const alignVal = r.cellAlignments?.[i]
                                    ? r.cellAlignments[i]
                                    : r.align
                                    ? r.align
                                    : (isDateHeader || isMajorHeader || ((r.type === 'header' || isMajorHeaderRow) && i === 0)) ? 'center' : (b.columnAlignments[i] || (i === 0 ? 'left' : 'right'));
                                  const align = `align-${alignVal}`;
                                  const maxAllowedIndent = (r.type === 'header' || isMajorHeaderRow) ? 1 : 3;
                                  const effectiveIndent = Math.min(r.indent || 0, maxAllowedIndent);
                                  const indent = i === 0 && effectiveIndent ? `indent-${effectiveIndent}` : '';
                                  const bold = isDateHeader || isMajorHeader || r.bold || r.type === 'section_title' || r.type === 'header' ? 'font-weight: bold;' : '';
                                  const italic = r.italic ? 'font-style: italic;' : '';
                                  return `<td class="${align} ${indent}" style="text-align: ${alignVal}; ${bold} ${italic}">${cellVal || '&nbsp;'}</td>`;
                                })
                                .join('')}
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                  ${
                    b.footnotes
                      ? b.footnotes.map((fn) => `<p style="font-size: 8.5pt; font-style: italic;">${interpolateVariables(fn, doc.attachedSpreadsheet)}</p>`).join('')
                      : ''
                  }
                `;
              }
              if (b.type === 'signature') {
                return `
                  <div class="signatures">
                    <h3>${b.title || 'SIGNATURES'}</h3>
                    ${b.officers
                      .map(
                        (off) => {
                          const sig = off.signed && off.signatureText
                            ? off.signatureText
                            : off.signed && off.name
                            ? `/s/ ${off.name}`
                            : '/s/ ____________________________';
                          return `
                      <div class="signature-item">
                        <p><strong>${sig}</strong><br/>
                        ${off.name ? `${off.name} — ` : ''}${off.title}<br/>
                        <em>Date: ${off.date || '____________________'}</em></p>
                      </div>
                    `;
                        }
                      )
                      .join('')}
                  </div>
                `;
              }
              if (b.type === 'divider') {
                return b.pageBreak ? '<div class="page-break"></div>' : '<hr style="border: 0.5pt solid #ccc; margin: 20px 0;" />';
              }
              if (b.type === 'image') {
                const alignClass = `align-${b.alignment || 'center'}`;
                return `
                  <div class="${alignClass}" style="margin: 14px 0; text-align: ${b.alignment || 'center'};">
                    <img src="${b.url || '/Picture1.jpg'}" alt="${b.alt || 'Graphic'}" style="max-width: ${b.width || 260}px; width: 100%; height: auto; display: inline-block;" />
                    ${b.caption ? `<p style="font-size: 8.5pt; font-style: italic; color: #666; margin-top: 4px;">${b.caption}</p>` : ''}
                  </div>
                `;
              }
              return '';
            })
            .join('')}
        </div>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
