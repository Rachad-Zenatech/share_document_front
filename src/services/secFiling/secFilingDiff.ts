import type {
  SecBlock,
  SecBlockDiff,
  SecTableCellDiff,
  SecChangeCategory,
  SecChangeTag
} from '../../types/secFiling';
import { INITIAL_SEC_FILING_DOC } from '../../data/initialSecFilingData';

export function compactFinancialTableBlock(table: SecBlock): SecBlock {
  if (table.type !== 'financial_table' || !table.rows) return table;

  let inSection = false;
  const rows = table.rows.map((r: any, idx: number) => {
    let indent = r.indent;
    if (indent === undefined || indent === null) {
      const firstCell = (r.cells && r.cells[0]) ? String(r.cells[0]).trim() : '';
      const isSection =
        r.type === 'section_title' ||
        r.type === 'category_header' ||
        (r.shading && r.cells.slice(1).every((c: any) => !c || String(c).trim() === '' || String(c).trim() === '-'));
      const isTotal =
        r.type === 'total' ||
        r.doubleUnderline ||
        /^total\b/i.test(firstCell) ||
        /^net\s+(loss|income|comprehensive)/i.test(firstCell) ||
        /^cash\s+(used|provided)\b/i.test(firstCell);
      const isSubtotal = r.type === 'subtotal' || r.underline;
      const isHeader =
        r.type === 'header' ||
        (!firstCell && idx < 4) ||
        /^(assets|liabilities|equity|revenue|operating activities)/i.test(firstCell);

      if (isSection) {
        inSection = true;
        indent = 0;
      } else if (isTotal) {
        indent = 2;
      } else if (isSubtotal) {
        indent = 1;
      } else if (isHeader) {
        indent = 0;
      } else if (r.type === 'data') {
        indent = inSection || firstCell ? 1 : 0;
      } else {
        indent = 0;
      }
    }

    return {
      ...r,
      cells: [...(r.cells || [])],
      indent: indent ?? 0,
    };
  });

  return {
    ...table,
    headers: [...(table.headers || [])],
    columnAlignments: [...(table.columnAlignments || [])],
    rows,
  } as any;
}

export function computeFinancialTableCellDiffs(
  orig: SecBlock,
  proposed: SecBlock
): {
  tableCellDiffs: SecTableCellDiff[];
  changeTags: SecChangeTag[];
  cellCount: number;
} {
  if (orig.type !== 'financial_table' || proposed.type !== 'financial_table') {
    return { tableCellDiffs: [], changeTags: [], cellCount: 0 };
  }

  const tableCellDiffs: SecTableCellDiff[] = [];
  const origRows = orig.rows || [];
  const propRows = proposed.rows || [];
  const origHeaders = orig.headers || [];
  const propHeaders = proposed.headers || [];

  const maxR = Math.max(origRows.length, propRows.length);
  for (let r = 0; r < maxR; r++) {
    const origR = origRows[r];
    const propR = propRows[r];

    if (!origR && propR) {
      // Entire row added in proposal
      const rowLabel = propR.cells?.[0] || `Row ${r + 1}`;
      tableCellDiffs.push({
        rowIndex: r,
        colIndex: 0,
        rowId: propR.id,
        rowLabel,
        headerLabel: 'Full Row',
        oldValue: '',
        newValue: propR.cells?.filter(Boolean).join(' | ') || '(New Row Added)',
        status: 'row_added'
      });
    } else if (origR && !propR) {
      // Entire row deleted in proposal
      const rowLabel = origR.cells?.[0] || `Row ${r + 1}`;
      tableCellDiffs.push({
        rowIndex: r,
        colIndex: 0,
        rowId: origR.id,
        rowLabel,
        headerLabel: 'Full Row',
        oldValue: origR.cells?.filter(Boolean).join(' | ') || '(Row Deleted)',
        newValue: '',
        status: 'row_deleted'
      });
    } else if (origR && propR) {
      const maxC = Math.max(origR.cells?.length || 0, propR.cells?.length || 0);
      const rowLabel = (propR.cells?.[0] || origR.cells?.[0] || `Row ${r + 1}`).trim();

      for (let c = 0; c < maxC; c++) {
        const rawOld = origR.cells?.[c] ?? '';
        const rawNew = propR.cells?.[c] ?? '';
        if (rawOld.trim() !== rawNew.trim()) {
          const headerLabel = (propHeaders[c] || origHeaders[c] || `Column ${c + 1}`).trim();
          tableCellDiffs.push({
            rowIndex: r,
            colIndex: c,
            rowId: propR.id || origR.id,
            rowLabel,
            headerLabel,
            oldValue: rawOld,
            newValue: rawNew,
            status: 'cell_modified'
          });
        }
      }
    }
  }

  // Also check if headers were modified
  const maxH = Math.max(origHeaders.length, propHeaders.length);
  for (let c = 0; c < maxH; c++) {
    const rawOld = origHeaders[c] ?? '';
    const rawNew = propHeaders[c] ?? '';
    if (rawOld.trim() !== rawNew.trim()) {
      tableCellDiffs.push({
        rowIndex: -1,
        colIndex: c,
        rowLabel: 'Table Header',
        headerLabel: `Column ${c + 1}`,
        oldValue: rawOld,
        newValue: rawNew,
        status: 'cell_modified'
      });
    }
  }

  const changeTags: SecChangeTag[] = [];
  const modifiedCells = tableCellDiffs.filter((d) => d.status === 'cell_modified');
  const addedRows = tableCellDiffs.filter((d) => d.status === 'row_added');
  const deletedRows = tableCellDiffs.filter((d) => d.status === 'row_deleted');

  if (modifiedCells.length > 0) {
    if (modifiedCells.length === 1) {
      const single = modifiedCells[0];
      changeTags.push({
        category: 'financial_data',
        label: `${single.rowLabel}: "${single.oldValue || 'empty'}" → "${single.newValue || 'empty'}"`,
        detail: `${single.rowLabel} [${single.headerLabel}]: "${single.oldValue}" → "${single.newValue}"`
      });
    } else if (modifiedCells.length <= 3) {
      const labels = Array.from(new Set(modifiedCells.map((c) => c.rowLabel).filter(Boolean)));
      changeTags.push({
        category: 'financial_data',
        label: `Table cells: ${labels.join(', ')}`,
        detail: modifiedCells.map((c) => `${c.rowLabel} [${c.headerLabel}]: "${c.oldValue}" → "${c.newValue}"`).join('; ')
      });
    } else {
      changeTags.push({
        category: 'financial_data',
        label: `Financial Table: ${modifiedCells.length} cells modified`,
        detail: modifiedCells.map((c) => `${c.rowLabel} [${c.headerLabel}]: "${c.oldValue}" → "${c.newValue}"`).join('; ')
      });
    }
  }

  if (addedRows.length > 0) {
    changeTags.push({
      category: 'structure',
      label: `Table: ${addedRows.length} row(s) added`
    });
  }

  if (deletedRows.length > 0) {
    changeTags.push({
      category: 'structure',
      label: `Table: ${deletedRows.length} row(s) deleted`
    });
  }

  return {
    tableCellDiffs,
    changeTags,
    cellCount: tableCellDiffs.length
  };
}


export function calculateDiffs(baseBlocks: SecBlock[], proposedBlocks: SecBlock[], originSnapshotBlocks?: SecBlock[]): SecBlockDiff[] {
    const diffs: SecBlockDiff[] = [];
    const baseMap = new Map<string, SecBlock>(baseBlocks.map((b) => [b.id, b]));
    const proposedMap = new Map<string, SecBlock>(proposedBlocks.map((b) => [b.id, b]));

    for (const pBlock of proposedBlocks) {
      const orig = baseMap.get(pBlock.id);
      if (!orig) {
        diffs.push({
          blockId: pBlock.id,
          status: 'added',
          proposedBlock: pBlock,
          changeCategories: ['structure', 'content'],
          changeTags: [
            { category: 'structure', label: `New ${pBlock.type.replace('_', ' ')} block added` }
          ]
        });
      } else if (orig === pBlock) {
        // FAST-PATH: Pointer equality confirms 0 changes in O(1) time
        diffs.push({
          blockId: pBlock.id,
          status: 'unchanged',
          originalBlock: orig,
          proposedBlock: pBlock
        });
      } else {
        const isSame = JSON.stringify(orig) === JSON.stringify(pBlock);
        if (isSame) {
          diffs.push({
            blockId: pBlock.id,
            status: 'unchanged',
            originalBlock: orig,
            proposedBlock: pBlock
          });
        } else {
          const fieldDiffs: { field: string; oldValue: any; newValue: any }[] = [];
          const changeTags: SecChangeTag[] = [];
          const categorySet = new Set<SecChangeCategory>();

          // 1. Spacing changes
          const origSpacingTop = orig.spacingTop ?? 0;
          const propSpacingTop = pBlock.spacingTop ?? 0;
          if (origSpacingTop !== propSpacingTop) {
            fieldDiffs.push({ field: 'spacingTop', oldValue: origSpacingTop, newValue: propSpacingTop });
            categorySet.add('spacing');
            const diffPx = propSpacingTop - origSpacingTop;
            changeTags.push({
              category: 'spacing',
              label: `Top Spacing: ${origSpacingTop}px → ${propSpacingTop}px`,
              detail: `Top spacing altered by ${diffPx > 0 ? '+' : ''}${diffPx}px`
            });
          }

          const origSpacingBottom = orig.spacingBottom ?? 0;
          const propSpacingBottom = pBlock.spacingBottom ?? 0;
          if (origSpacingBottom !== propSpacingBottom) {
            fieldDiffs.push({ field: 'spacingBottom', oldValue: origSpacingBottom, newValue: propSpacingBottom });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Bottom Spacing: ${origSpacingBottom}px → ${propSpacingBottom}px`
            });
          }

          const origSpacingPreset = orig.spacing || 'normal';
          const propSpacingPreset = pBlock.spacing || 'normal';
          if (origSpacingPreset !== propSpacingPreset) {
            fieldDiffs.push({ field: 'spacing', oldValue: origSpacingPreset, newValue: propSpacingPreset });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Spacing Preset: ${origSpacingPreset} → ${propSpacingPreset}`
            });
          }

          const origLineSpacing = (orig as any).lineSpacing;
          const propLineSpacing = (pBlock as any).lineSpacing;
          if (origLineSpacing !== propLineSpacing && (origLineSpacing || propLineSpacing)) {
            fieldDiffs.push({ field: 'lineSpacing', oldValue: origLineSpacing, newValue: propLineSpacing });
            categorySet.add('spacing');
            changeTags.push({
              category: 'spacing',
              label: `Line Height: ${origLineSpacing || '1.0'} → ${propLineSpacing || '1.0'}`
            });
          }

          // 2. Typography & Font Styling changes
          const origBold = !!(orig as any).bold;
          const propBold = !!(pBlock as any).bold;
          if (origBold !== propBold) {
            fieldDiffs.push({ field: 'bold', oldValue: origBold, newValue: propBold });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propBold ? 'Font: Bold Added' : 'Font: Bold Removed'
            });
          }

          const origItalic = !!(orig as any).italic;
          const propItalic = !!(pBlock as any).italic;
          if (origItalic !== propItalic) {
            fieldDiffs.push({ field: 'italic', oldValue: origItalic, newValue: propItalic });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propItalic ? 'Font: Italic Added' : 'Font: Italic Removed'
            });
          }

          const origUnderline = !!(orig as any).underline;
          const propUnderline = !!(pBlock as any).underline;
          if (origUnderline !== propUnderline) {
            fieldDiffs.push({ field: 'underline', oldValue: origUnderline, newValue: propUnderline });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: propUnderline ? 'Font: Underline Added' : 'Font: Underline Removed'
            });
          }

          const origFontSize = (orig as any).fontSize;
          const propFontSize = (pBlock as any).fontSize;
          if (origFontSize !== propFontSize && (origFontSize || propFontSize)) {
            fieldDiffs.push({ field: 'fontSize', oldValue: origFontSize, newValue: propFontSize });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Font Size: ${origFontSize || 'Default'} → ${propFontSize || 'Default'}pt`
            });
          }

          const origAlignment = (orig as any).alignment;
          const propAlignment = (pBlock as any).alignment;
          if (origAlignment !== propAlignment && (origAlignment || propAlignment)) {
            fieldDiffs.push({ field: 'alignment', oldValue: origAlignment, newValue: propAlignment });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Alignment: ${origAlignment || 'left'} → ${propAlignment || 'left'}`
            });
          }

          const origLevel = (orig as any).level;
          const propLevel = (pBlock as any).level;
          if (origLevel !== propLevel && (origLevel || propLevel)) {
            fieldDiffs.push({ field: 'level', oldValue: origLevel, newValue: propLevel });
            categorySet.add('typography');
            changeTags.push({
              category: 'typography',
              label: `Heading Level: H${origLevel || 2} → H${propLevel || 2}`
            });
          }

          // 3. Section & Structural Move
          if (orig.section !== pBlock.section) {
            fieldDiffs.push({ field: 'section', oldValue: orig.section, newValue: pBlock.section });
            categorySet.add('structure');
            changeTags.push({
              category: 'structure',
              label: `Moved Section: "${orig.section}" → "${pBlock.section}"`
            });
          }

          // 4. Text & Narrative Content
          const origText = (orig as any).text;
          const propText = (pBlock as any).text;
          if (origText !== propText && (origText !== undefined || propText !== undefined)) {
            fieldDiffs.push({ field: 'text', oldValue: origText, newValue: propText });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Text Disclosure Modified'
            });
          }

          const origTitle = (orig as any).title;
          const propTitle = (pBlock as any).title;
          if (origTitle !== propTitle && (origTitle !== undefined || propTitle !== undefined)) {
            fieldDiffs.push({ field: 'title', oldValue: origTitle, newValue: propTitle });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: `Title: "${origTitle}" → "${propTitle}"`
            });
          }

          const origContent = (orig as any).content;
          const propContent = (pBlock as any).content;
          if (origContent !== propContent && (origContent !== undefined || propContent !== undefined)) {
            fieldDiffs.push({ field: 'content', oldValue: origContent, newValue: propContent });
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Callout Notice Content Edited'
            });
          }

          let tableCellDiffs: SecTableCellDiff[] | undefined = undefined;

          // 5. Financial Statements & Table Rows
          if (orig.type === 'financial_table' && pBlock.type === 'financial_table') {
            const tableDiffResult = computeFinancialTableCellDiffs(orig, pBlock);
            if (tableDiffResult.cellCount > 0) {
              categorySet.add('financial_data');
              tableCellDiffs = tableDiffResult.tableCellDiffs;
              changeTags.push(...tableDiffResult.changeTags);

              for (const cd of tableDiffResult.tableCellDiffs) {
                fieldDiffs.push({
                  field: `${cd.rowLabel} [${cd.headerLabel}]`,
                  oldValue: cd.oldValue,
                  newValue: cd.newValue
                });
              }
            }
          }

          // 6. Signatures
          if (orig.type === 'signature' && pBlock.type === 'signature') {
            if (JSON.stringify(orig.officers) !== JSON.stringify(pBlock.officers)) {
              categorySet.add('signature');
              changeTags.push({
                category: 'signature',
                label: 'Signatory Officers Updated'
              });
            }
          }

          if (changeTags.length === 0) {
            categorySet.add('content');
            changeTags.push({
              category: 'content',
              label: 'Block properties modified'
            });
          }

          const categories = Array.from(categorySet);
          const isSpacingOnly = categories.length === 1 && categories[0] === 'spacing';
          const isTypographyOnly = categories.length === 1 && categories[0] === 'typography';
          const isContentModified = categories.includes('content') || categories.includes('financial_data');

          diffs.push({
            blockId: pBlock.id,
            status: 'modified',
            originalBlock: orig,
            proposedBlock: pBlock,
            fieldDiffs,
            tableCellDiffs,
            changeCategories: categories,
            changeTags,
            isSpacingOnly,
            isTypographyOnly,
            isContentModified
          });
        }
      }
    }

    for (const bBlock of baseBlocks) {
      if (!proposedMap.has(bBlock.id)) {
        // Check if this block existed in the original base document when the proposal was branched
        // If it was added to Live after the proposal was created, the contributor did NOT delete it!
        const initialBlocks = originSnapshotBlocks || INITIAL_SEC_FILING_DOC.blocks;
        const existedInInitial = initialBlocks.some((initB) => initB.id === bBlock.id);

        if (existedInInitial) {
          // Genuinely deleted by contributor in proposal
          diffs.push({
            blockId: bBlock.id,
            status: 'deleted',
            originalBlock: bBlock,
            changeCategories: ['structure', 'content'],
            changeTags: [
              { category: 'structure', label: `${bBlock.type.replace('_', ' ')} block deleted by contributor` }
            ]
          });
        } else {
          // Block was added to Live directly; contributor proposal simply didn't have it.
          // Preserve as unchanged live content so it is NOT marked as deleted.
          diffs.push({
            blockId: bBlock.id,
            status: 'unchanged',
            originalBlock: bBlock,
            proposedBlock: bBlock
          });
        }
      }
    }

    return diffs;
}
