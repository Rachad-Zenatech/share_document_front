/** Focus evidence in the live editor without editing or saving document content. */
const FOCUS = 'script-compliance-focus';
const ATTRIBUTE = 'data-script-compliance-focus';
const words = /[\p{L}\p{N}_$%']+/gu;

export function parseScriptFocus(data: unknown): { requestId: number; terms: string[] } | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as { requestId?: unknown; terms?: unknown };
  if (typeof value.requestId !== 'number' || !Number.isSafeInteger(value.requestId) || !Array.isArray(value.terms) || !value.terms.length || value.terms.length > 20) return null;
  if (!value.terms.every((term) => typeof term === 'string' && term.trim().length > 0 && term.length <= 4000)) return null;
  return { requestId: value.requestId as number, terms: value.terms as string[] };
}

function evidenceCandidates(raw: string): string[] {
  // Compliance evidence may describe a row as "[0:27] Visual: ..." even though
  // the timecode lives in its own cell and the column label is only a header.
  const passage = raw.replace(/^\s*(?:\[\s*)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*\])?\s*(?:[|–—-]\s*)?/, '');
  const cell = passage.replace(/^\s*(?:visuals?|voice[ -]?over|supers?|on[ -]?screen(?:\s+text)?|narration|audio)\s*:\s*/i, '');
  return [...new Set([raw, passage, cell])];
}

export function scriptFocusMatch(text: string, terms: string[]): { start: number; end: number } | null {
  for (const raw of terms) {
    for (const term of evidenceCandidates(raw)) {
      const tokens = term.replace(/[‘’]/g, "'").match(words);
      if (!tokens?.length) continue;
      const parts = tokens.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['‘’]"));
      const match = new RegExp(`(^|[^\\p{L}\\p{N}_$%'‘’])(${parts.join("[^\\p{L}\\p{N}_$%'‘’]+")})(?![\\p{L}\\p{N}_$%'‘’])`, 'iu').exec(text);
      if (match) return { start: match.index + match[1].length, end: match.index + match[1].length + match[2].length };
    }
  }
  return null;
}

export function clearScriptFocus(): void {
  CSS.highlights?.delete(FOCUS);
  document.querySelectorAll(`[${ATTRIBUTE}]`).forEach((node) => node.removeAttribute(ATTRIBUTE));
}

function markElement(element: HTMLElement): void {
  const target = element.closest<HTMLElement>('td,th') ?? element;
  target.setAttribute(ATTRIBUTE, '');
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

function focusText(root: HTMLElement, terms: string[]): boolean {
  const slices: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '';
  let previous: Element | null = null;
  for (let next = walker.nextNode(); next; next = walker.nextNode()) {
    const parent = next.parentElement;
    if (!parent || parent.closest('button,input,textarea,select,script,style,[data-chrome],[aria-hidden="true"]') || !parent.getClientRects().length) continue;
    const block = parent.closest('td,th,p,h1,h2,h3,li') ?? root;
    if (slices.length && block !== previous) text += '\n';
    previous = block;
    const start = text.length;
    text += next.textContent ?? '';
    slices.push({ node: next as Text, start, end: text.length });
  }
  const match = scriptFocusMatch(text, terms);
  if (!match) return false;
  const first = slices.find((slice) => slice.end > match.start);
  const last = slices.find((slice) => slice.end >= match.end);
  if (!first || !last) return false;
  const range = document.createRange();
  range.setStart(first.node, match.start - first.start);
  range.setEnd(last.node, match.end - last.start);
  if (CSS.highlights && typeof Highlight !== 'undefined') CSS.highlights.set(FOCUS, new Highlight(range));
  else {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  const element = first.node.parentElement;
  if (element) markElement(element);
  return true;
}

export function focusScriptPassage(terms: string[]): boolean {
  clearScriptFocus();
  const roots = [...document.querySelectorAll<HTMLElement>('[data-block-item="true"]')];
  for (const root of roots) if (focusText(root, terms)) return true;
  for (const root of roots) {
    for (const field of root.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('textarea,input')) {
      if (!field.getClientRects().length) continue;
      const match = scriptFocusMatch(field.value, terms);
      if (!match) continue;
      field.focus({ preventScroll: true });
      field.setSelectionRange(match.start, match.end);
      markElement(field);
      return true;
    }
  }
  return false;
}
