import type { SecBlock, AttachedSpreadsheet } from '../types/secFiling';
import { interpolateVariables } from './documentVariables';

/**
 * Normalizes text for search comparison:
 * - Converts to lowercase
 * - Replaces curly/smart single quotes, double quotes, and accent characters
 * - Replaces en-dashes, em-dashes, and various dashes with regular hyphens
 * - Replaces non-breaking spaces (\u00A0) and tabs with standard single spaces
 * - Collapses consecutive whitespace into single spaces
 */
export function normalizeSearchText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4\u00E2\u20AC\u2122]+/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]+/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips punctuation and symbols for loose comparison.
 * e.g. "ZenaTech, Inc." -> "zenatech inc"
 * e.g. "June 30, 2026" -> "june 30 2026"
 * e.g. "Note 1 — Organization" -> "note 1 organization"
 */
export function stripPunctuation(text: string): string {
  if (!text) return '';
  return text
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes numeric strings by stripping currency symbols, commas, and spaces.
 * e.g. "$639,739.32" -> "639739.32"
 * e.g. "639,739" -> "639739"
 */
export function normalizeNumericString(text: string): string {
  if (!text) return '';
  return text.replace(/[$,\s]/g, '');
}

/**
 * Extracts all searchable text fields from any SecBlock,
 * including raw content, section names, and live spreadsheet-evaluated cell values.
 */
export function extractBlockSearchableStrings(
  block: SecBlock,
  spreadsheet?: AttachedSpreadsheet | null
): string[] {
  const parts: string[] = [];

  // Every block has an optional section title
  if (block.section) parts.push(block.section);

  switch (block.type) {
    case 'heading': {
      if (block.text) {
        parts.push(block.text);
        if (spreadsheet) {
          parts.push(interpolateVariables(block.text, spreadsheet));
        }
      }
      break;
    }

    case 'paragraph': {
      if (block.noteNumber) parts.push(block.noteNumber);
      if (block.text) {
        parts.push(block.text);
        if (spreadsheet) {
          parts.push(interpolateVariables(block.text, spreadsheet));
        }
      }
      break;
    }

    case 'callout': {
      if (block.title) parts.push(block.title);
      if (block.content) {
        parts.push(block.content);
        if (spreadsheet) {
          parts.push(interpolateVariables(block.content, spreadsheet));
        }
      }
      if (block.variant) parts.push(block.variant);
      break;
    }

    case 'financial_table': {
      if (block.title) parts.push(block.title);

      if (Array.isArray(block.headers)) {
        for (const h of block.headers) {
          if (h) parts.push(h);
        }
      }

      if (Array.isArray(block.periodHeaders)) {
        for (const ph of block.periodHeaders) {
          if (ph && Array.isArray(ph.lines)) {
            parts.push(...ph.lines);
          }
        }
      }

      if (Array.isArray(block.footnotes)) {
        for (const fn of block.footnotes) {
          if (fn) parts.push(fn);
        }
      }

      if (Array.isArray(block.rows)) {
        for (const r of block.rows) {
          if (Array.isArray(r.cells)) {
            for (const c of r.cells) {
              if (c) {
                parts.push(c);
                if (spreadsheet && c.includes('@')) {
                  parts.push(interpolateVariables(c, spreadsheet));
                }
              }
            }
          }
        }
      }
      break;
    }

    case 'metadata': {
      if (block.documentTitle) parts.push(block.documentTitle);
      if (block.companyName) parts.push(block.companyName);
      if (block.formType) parts.push(block.formType);
      if (block.periodEnded) parts.push(block.periodEnded);
      if (block.cik) parts.push(block.cik);
      if (block.currency) parts.push(block.currency);
      if (block.fiscalYear) parts.push(block.fiscalYear);
      if (block.jurisdiction) parts.push(block.jurisdiction);
      if (block.symbol) parts.push(block.symbol);
      break;
    }

    case 'signature': {
      if (block.title) parts.push(block.title);
      if (Array.isArray(block.officers)) {
        for (const s of block.officers) {
          if (s.name) parts.push(s.name);
          if (s.title) parts.push(s.title);
          if (s.signatureText) parts.push(s.signatureText);
          if (s.email) parts.push(s.email);
          if (s.phoneNumber) parts.push(s.phoneNumber);
        }
      }
      break;
    }

    case 'image': {
      if (block.alt) parts.push(block.alt);
      if (block.caption) parts.push(block.caption);
      break;
    }

    case 'divider': {
      break;
    }
  }

  return parts.filter(Boolean);
}

/**
 * Tests whether a given SecBlock matches a search query string.
 * Supports:
 * 1. Exact normalized substring match
 * 2. Punctuation-stripped loose match (e.g. "ZenaTech Inc" -> "ZenaTech, Inc.")
 * 3. Numeric/currency normalization (e.g. "639739" -> "$639,739")
 * 4. Multi-term keyword match (all words in the query exist in the block)
 */
export function blockMatchesQuery(
  block: SecBlock,
  query: string,
  spreadsheet?: AttachedSpreadsheet | null
): boolean {
  if (!query || !query.trim()) return true;

  const rawQ = normalizeSearchText(query);
  if (!rawQ) return true;

  const allStrings = extractBlockSearchableStrings(block, spreadsheet);
  if (allStrings.length === 0) return false;

  const combinedRaw = allStrings.join(' ');
  const normCombined = normalizeSearchText(combinedRaw);

  // 1. Direct normalized substring check
  if (normCombined.includes(rawQ)) return true;

  // 2. Punctuation-stripped check
  const cleanQ = stripPunctuation(rawQ);
  const cleanCombined = stripPunctuation(normCombined);
  if (cleanQ && cleanCombined.includes(cleanQ)) return true;

  // 3. Numeric / currency search (e.g. searching "639739" when doc has "$639,739.32")
  const numQ = normalizeNumericString(rawQ);
  if (numQ.length >= 2 && /^\d+(\.\d+)?$/.test(numQ)) {
    const numCombined = normalizeNumericString(normCombined);
    if (numCombined.includes(numQ)) return true;
  }

  // 4. Multi-token match (all words must be present in the block)
  const tokens = rawQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokensMatch = tokens.every((tok) => {
      if (normCombined.includes(tok)) return true;
      const cleanTok = stripPunctuation(tok);
      if (cleanTok && cleanCombined.includes(cleanTok)) return true;
      const numTok = normalizeNumericString(tok);
      if (numTok.length >= 2 && normalizeNumericString(normCombined).includes(numTok)) return true;
      return false;
    });
    if (allTokensMatch) return true;
  }

  return false;
}

/**
 * Counts total occurrences of query terms in a block.
 */
export function countBlockMatches(
  block: SecBlock,
  query: string,
  spreadsheet?: AttachedSpreadsheet | null
): number {
  if (!query || !query.trim()) return 0;
  const rawQ = normalizeSearchText(query);
  if (!rawQ) return 0;

  const allStrings = extractBlockSearchableStrings(block, spreadsheet);
  let count = 0;

  for (const str of allStrings) {
    const norm = normalizeSearchText(str);
    let pos = 0;
    while ((pos = norm.indexOf(rawQ, pos)) !== -1) {
      count++;
      pos += rawQ.length;
    }
  }

  return count;
}
