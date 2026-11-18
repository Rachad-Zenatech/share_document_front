import type { SecBlock, SecChangeProposal, SecVersionSnapshot } from '../types/secFiling';

/** Script tables must not inherit financial-statement indentation or header repair. */
export function isScriptTable(block: SecBlock): boolean {
  if (block.type !== 'financial_table') return false;
  return /^script(?: details)?$/i.test(block.section) ||
    (block.headers.some((header) => /voiceover/i.test(header)) && block.headers.some((header) => /visual|footage/i.test(header)));
}

export function defaultBlockSpacingTop(block: SecBlock): number {
  if (block.type === 'heading') return block.level === 1 ? 12 : block.level === 2 ? 8 : 6;
  if (block.type === 'financial_table') return 10;
  if (block.type === 'image') return 8;
  if (block.type === 'signature') return 14;
  if (block.type === 'divider') return 12;
  return block.spacing === 'compact' ? 2 : block.spacing === 'relaxed' ? 8 : block.spacing === 'loose' ? 12 : 4;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, item]) =>
    key !== 'updatedAt' && key !== 'modifiedBy' && item !== undefined
  ).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
}

/** Compare document meaning, preserving whitespace, line breaks and intentional layout. */
export function comparableBlock(block: SecBlock): SecBlock {
  const copy: Record<string, unknown> = { ...block, spacing: block.spacing || 'normal',
    spacingTop: block.spacingTop ?? defaultBlockSpacingTop(block), spacingBottom: block.spacingBottom ?? 0 };
  if (block.type === 'heading' || block.type === 'paragraph') {
    copy.alignment = block.alignment || 'left';
    copy.bold = block.type === 'heading' ? block.bold !== false : !!block.bold;
    copy.italic = !!block.italic;
    copy.underline = !!block.underline;
    copy.fontSize = block.fontSize || (block.type === 'paragraph' ? 14 : block.level === 1 ? 20 : block.level === 2 ? 16 : 14.5);
    copy.lineSpacing = block.lineSpacing || (block.type === 'heading' ? 1.2 : 1.3);
  }
  if (block.type === 'financial_table') {
    const script = isScriptTable(block);
    copy.rows = block.rows.map((row) => {
      const normalized: Record<string, unknown> = { ...row, bold: !!row.bold, italic: !!row.italic,
        underline: !!row.underline, doubleUnderline: !!row.doubleUnderline };
      delete normalized.id;
      if (script) delete normalized.indent;
      else normalized.indent = row.indent || 0;
      if (!row.cellAlignments?.some(Boolean)) delete normalized.cellAlignments;
      return normalized;
    });
    for (const key of ['boldColumns', 'periodHeaders', 'footnotes']) {
      if (!Array.isArray(copy[key]) || !(copy[key] as unknown[]).length) delete copy[key];
    }
  }
  return stableValue(copy) as SecBlock;
}

export function blocksEqual(first: SecBlock, second: SecBlock): boolean {
  return first === second || JSON.stringify(comparableBlock(first)) === JSON.stringify(comparableBlock(second));
}

/** Added/deleted neighbors do not make otherwise stationary blocks look moved. */
export function movedBlockIds(base: SecBlock[], proposed: SecBlock[]): Set<string> {
  const baseIds = new Set(base.map((block) => block.id));
  const proposedIds = new Set(proposed.map((block) => block.id));
  const before = base.filter((block) => proposedIds.has(block.id)).map((block) => block.id);
  const after = proposed.filter((block) => baseIds.has(block.id)).map((block) => block.id);
  return new Set(after.filter((id, index) => id !== before[index]));
}

/** Prefer the exact branch snapshot; older branches can use their recorded version. */
export function proposalBaseBlocks(proposal: Pick<SecChangeProposal, 'baseSnapshotBlocks' | 'baseVersionNumber'>, history: SecVersionSnapshot[]): SecBlock[] | undefined {
  return proposal.baseSnapshotBlocks || history.find((version) => version.versionNumber === proposal.baseVersionNumber)?.blocks;
}
