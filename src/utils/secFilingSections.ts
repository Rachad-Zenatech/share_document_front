import type { SecBlock } from '../types/secFiling';

/**
 * Moves the run of blocks starting at `start` that are still in `fromSection` into
 * `toSection`, stopping at the first block from another section. This is how a heading
 * takes over the rest of the section it was placed in.
 */
export function moveRunToSection(blocks: SecBlock[], start: number, fromSection: string, toSection: string): SecBlock[] {
  const next = [...blocks];
  const now = new Date().toISOString();
  for (let i = start; i < next.length && next[i].section === fromSection; i++) {
    next[i] = { ...next[i], section: toSection, updatedAt: now };
  }
  return next;
}

// Placeholder text older builds gave a heading inserted into an existing section,
// while leaving it in that section, so it never reached Document Sections.
const LEGACY_HEADING_PLACEHOLDER = /^new section heading$/i;

/**
 * Gives each legacy placeholder heading that is still inside another section its own
 * section, carrying the blocks after it along. Returns null when nothing needed fixing.
 */
export function repairLegacySectionHeadings(blocks: SecBlock[]): SecBlock[] | null {
  let next = blocks;
  let changed = false;
  const seen = new Set<string>();
  for (let i = 0; i < next.length; i++) {
    const b = next[i];
    if (b.type === 'heading' && seen.has(b.section) && LEGACY_HEADING_PLACEHOLDER.test(b.text.trim())) {
      const existing = new Set(next.map((x) => x.section));
      let name = 'New Section Heading';
      let c = 2;
      while (existing.has(name)) name = `New Section Heading ${c++}`;
      next = moveRunToSection(next, i, b.section, name);
      changed = true;
    }
    seen.add(next[i].section);
  }
  return changed ? next : null;
}
