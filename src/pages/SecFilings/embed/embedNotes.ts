import type { EmbedNote } from '../../../types/scriptReview';

function textNodesUnder(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, button, [data-toolbar], [data-embed-mirror]')) return NodeFilter.FILTER_REJECT;
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes: Text[] = [];
  for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
    nodes.push(cur as Text);
  }
  return nodes;
}

export function readDomSelection(root: HTMLElement): { quote: string; start: number } | null {
  const active = document.activeElement;
  if (
    active &&
    root.contains(active) &&
    (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)
  ) {
    const startIdx = active.selectionStart ?? 0;
    const endIdx = active.selectionEnd ?? 0;
    if (endIdx > startIdx) {
      const quote = active.value.slice(startIdx, endIdx).trim();
      if (quote) {
        const full = root.innerText || active.value;
        const pos = full.indexOf(quote);
        return { quote: quote.slice(0, 400), start: pos >= 0 ? pos : startIdx };
      }
    }
  }

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const quote = sel.toString().trim();
  if (!quote) return null;
  const full = root.innerText || '';
  const start = Math.max(0, full.indexOf(quote));
  return { quote: quote.slice(0, 400), start };
}

export function clearEmbedHighlights(root: HTMLElement): void {
  root.querySelectorAll('[data-embed-mirror]').forEach((el) => el.remove());
  root.querySelectorAll('mark[data-embed-note]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
  root.querySelectorAll<HTMLElement>('[data-embed-note-field]').forEach((el) => {
    delete el.dataset.embedNote;
    delete el.dataset.embedNoteField;
    el.style.backgroundColor = '';
    el.style.position = '';
    el.style.zIndex = '';
    el.title = '';
  });
}

function applyTextHighlight(root: HTMLElement, note: EmbedNote, needle: string, activeNoteId: string | null): boolean {
  for (const node of textNodesUnder(root)) {
    const val = node.nodeValue || '';
    const idx = val.indexOf(needle);
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + needle.length);
    const mark = document.createElement('mark');
    mark.dataset.embedNote = note.id;
    mark.title = note.text || 'Highlighted for review';
    mark.style.backgroundColor = `${note.color}33`;
    mark.style.borderBottom = `2px solid ${note.color}`;
    mark.style.borderRadius = '2px';
    mark.style.cursor = 'pointer';
    if (note.id === activeNoteId) mark.style.outline = `2px solid ${note.color}`;
    try {
      range.surroundContents(mark);
      return true;
    } catch {
      // Skip cross-element selections cleanly
    }
  }
  return false;
}

type FieldMatch = { start: number; end: number; note: EmbedNote };

function renderFieldMirror(
  root: HTMLElement,
  field: HTMLInputElement | HTMLTextAreaElement,
  matches: FieldMatch[],
  activeNoteId: string | null,
): void {
  const rootRect = root.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  field.dataset.embedNoteField = '1';
  field.dataset.embedNote = matches[0].note.id;
  field.title = matches[0].note.text || 'Highlighted for review';

  const cs = getComputedStyle(field);
  const mirror = document.createElement('div');
  mirror.dataset.embedMirror = '1';
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.position = 'absolute';
  mirror.style.left = `${rect.left - rootRect.left + root.scrollLeft}px`;
  mirror.style.top = `${rect.top - rootRect.top + root.scrollTop}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.boxSizing = 'border-box';
  mirror.style.padding = cs.padding;
  mirror.style.borderTop = `${cs.borderTopWidth} solid transparent`;
  mirror.style.borderRight = `${cs.borderRightWidth} solid transparent`;
  mirror.style.borderBottom = `${cs.borderBottomWidth} solid transparent`;
  mirror.style.borderLeft = `${cs.borderLeftWidth} solid transparent`;
  mirror.style.font = cs.font;
  mirror.style.letterSpacing = cs.letterSpacing;
  mirror.style.lineHeight = cs.lineHeight;
  mirror.style.textAlign = cs.textAlign;
  mirror.style.whiteSpace = field instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.wordBreak = cs.wordBreak;
  mirror.style.overflowWrap = cs.overflowWrap;
  mirror.style.overflow = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.backgroundColor = 'transparent';
  mirror.style.color = 'transparent';
  mirror.style.zIndex = '20';

  const text = field.value;
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const m of sorted) {
    if (m.start < cursor) continue;
    if (m.start > cursor) mirror.appendChild(document.createTextNode(text.slice(cursor, m.start)));
    const mark = document.createElement('mark');
    mark.dataset.embedNote = m.note.id;
    mark.style.color = 'transparent';
    mark.style.backgroundColor = `${m.note.color}44`;
    mark.style.borderBottom = `2px solid ${m.note.color}`;
    mark.style.borderRadius = '2px';
    if (m.note.id === activeNoteId) mark.style.outline = `2px solid ${m.note.color}`;
    mark.textContent = text.slice(m.start, m.end);
    mirror.appendChild(mark);
    cursor = m.end;
  }
  if (cursor < text.length) mirror.appendChild(document.createTextNode(text.slice(cursor)));

  root.appendChild(mirror);
}

export function applyEmbedHighlights(root: HTMLElement, notes: EmbedNote[], activeNoteId: string | null): void {
  clearEmbedHighlights(root);
  const open = notes.filter((n) => !n.resolved && n.quote.trim());
  const fieldMatches = new Map<HTMLInputElement | HTMLTextAreaElement, FieldMatch[]>();
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea:not([data-script-cell]), input[type="text"], input:not([type])',
    ),
  );

  for (const note of open) {
    const needle = note.quote.trim();
    if (applyTextHighlight(root, note, needle, activeNoteId)) continue;

    let matched = false;
    for (const field of fields) {
      const idx = field.value ? field.value.indexOf(needle) : -1;
      if (idx !== -1) {
        const list = fieldMatches.get(field) ?? [];
        list.push({ start: idx, end: idx + needle.length, note });
        fieldMatches.set(field, list);
        matched = true;
        break;
      }
    }
    if (!matched && needle.includes('\n')) {
      const firstLine = needle.split('\n').map((s) => s.trim()).find(Boolean);
      if (!firstLine) continue;
      if (applyTextHighlight(root, note, firstLine, activeNoteId)) continue;
      for (const field of fields) {
        const idx = field.value ? field.value.indexOf(firstLine) : -1;
        if (idx !== -1) {
          const list = fieldMatches.get(field) ?? [];
          list.push({ start: idx, end: idx + firstLine.length, note });
          fieldMatches.set(field, list);
          break;
        }
      }
    }
  }

  fieldMatches.forEach((matches, field) => renderFieldMirror(root, field, matches, activeNoteId));
}

export function scrollToEmbedNote(root: HTMLElement, id: string): void {
  const el = root.querySelector(`[data-embed-note="${CSS.escape(id)}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
