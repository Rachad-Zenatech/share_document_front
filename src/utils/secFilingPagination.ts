import type { SecBlock, SecBlockSpacing } from '../types/secFiling';

export interface PaginatedPage {
  pageNumber: number;
  blocks: SecBlock[];
  estimatedHeight: number;
}

const PAGE_USABLE_HEIGHT = 820; // 1056px Letter height - 2x 96px (1-inch margins) - 44px header/footer

const SPACING_MULTIPLIERS: Record<SecBlockSpacing, number> = {
  compact: 0.8,
  normal: 1.0,
  relaxed: 1.25,
  loose: 1.55
};

/**
 * Estimates the pixel height of a block in the Word document canvas
 */
export function estimateBlockHeight(block: SecBlock, globalSpacing: SecBlockSpacing = 'normal'): number {
  const spacing = block.spacing || globalSpacing;
  const mult = SPACING_MULTIPLIERS[spacing] || 1.0;

  let baseHeight: number;

  switch (block.type) {
    case 'metadata':
      baseHeight = 180;
      break;
    case 'heading': {
      if (block.level === 1) baseHeight = 56;
      else if (block.level === 2) baseHeight = 46;
      else if (block.level === 3) baseHeight = 38;
      else baseHeight = 32;
      break;
    }
    case 'paragraph': {
      const textLen = block.text?.length || 0;
      const lines = Math.max(1, Math.ceil(textLen / 90));
      baseHeight = lines * 22 + 10;
      break;
    }
    case 'financial_table': {
      const rowCount = block.rows?.length || 0;
      const headerHeight = 36;
      const footnoteHeight = block.footnotes?.length ? block.footnotes.length * 18 + 10 : 0;
      baseHeight = headerHeight + rowCount * 26 + footnoteHeight + 20;
      break;
    }
    case 'callout': {
      const textLen = block.content?.length || 0;
      const lines = Math.max(2, Math.ceil(textLen / 80));
      baseHeight = lines * 20 + 44;
      break;
    }
    case 'signature': {
      baseHeight = 150;
      break;
    }
    case 'divider': {
      baseHeight = 40;
      break;
    }
    case 'image': {
      const width = (block as any).width || 260;
      const captionHeight = (block as any).caption ? 24 : 0;
      // Aspect ratio estimation ~0.35 - 0.45 for corporate logos/figures + caption
      baseHeight = Math.round(width * 0.38) + captionHeight + 16;
      break;
    }
    default:
      baseHeight = 40;
  }

  return Math.round(baseHeight * mult);
}

/**
 * Groups blocks into discrete US Letter pages based on height, explicit page breaks, and spacing
 */
export function paginateBlocks(
  blocks: SecBlock[],
  globalSpacing: SecBlockSpacing = 'normal'
): PaginatedPage[] {
  if (!blocks || blocks.length === 0) {
    return [{ pageNumber: 1, blocks: [], estimatedHeight: 0 }];
  }

  const pages: PaginatedPage[] = [];
  let currentPageBlocks: SecBlock[] = [];
  let currentHeight = 0;
  let pageNumber = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockHeight = estimateBlockHeight(block, globalSpacing);

    // Check if block is an explicit page break
    if (block.type === 'divider') {
      if (currentPageBlocks.length > 0) {
        pages.push({
          pageNumber,
          blocks: currentPageBlocks,
          estimatedHeight: currentHeight
        });
        pageNumber++;
        currentPageBlocks = [block];
        currentHeight = blockHeight;
        continue;
      }
    }

    // Check if adding this block overflows the printable page height
    if (currentPageBlocks.length > 0 && currentHeight + blockHeight > PAGE_USABLE_HEIGHT) {
      pages.push({
        pageNumber,
        blocks: currentPageBlocks,
        estimatedHeight: currentHeight
      });
      pageNumber++;
      currentPageBlocks = [block];
      currentHeight = blockHeight;
    } else {
      currentPageBlocks.push(block);
      currentHeight += blockHeight;
    }
  }

  // Push final page
  if (currentPageBlocks.length > 0) {
    pages.push({
      pageNumber,
      blocks: currentPageBlocks,
      estimatedHeight: currentHeight
    });
  }

  return pages.length > 0 ? pages : [{ pageNumber: 1, blocks: [], estimatedHeight: 0 }];
}
