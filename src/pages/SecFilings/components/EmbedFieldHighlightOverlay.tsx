import { forwardRef, useMemo, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useEmbedNotes } from '../embed/EmbedNotesContext';

function findMatchRange(text: string, rawQuote: string): { start: number; end: number } | null {
  const needle = rawQuote.trim();
  if (!needle) return null;

  const idx = text.indexOf(needle);
  if (idx !== -1) return { start: idx, end: idx + needle.length };

  if (needle.includes('\n')) {
    const firstLine = needle.split('\n').map((s) => s.trim()).find(Boolean);
    if (firstLine) {
      const lineIdx = text.indexOf(firstLine);
      if (lineIdx !== -1) return { start: lineIdx, end: lineIdx + firstLine.length };
    }
  }

  // Fallback: match ignoring minor whitespace differences inside the selection
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  try {
    const match = new RegExp(escaped).exec(text);
    if (match) return { start: match.index, end: match.index + match[0].length };
  } catch {
    // ignore invalid regex fallback
  }
  return null;
}

/**
 * Renders translucent highlight marks directly behind a paragraph/heading <textarea>
 * so partial-word and full-sentence highlights align without scroll/resize drift.
 */
export function EmbedFieldHighlightOverlay({
  text,
  style,
  className,
}: {
  text: string;
  style: CSSProperties;
  className: string;
}) {
  const { notes, activeNoteId } = useEmbedNotes();

  const segments = useMemo(() => {
    if (!text || !notes.length) return null;
    const ranges: { start: number; end: number; color: string; id: string }[] = [];
    for (const note of notes) {
      if (note.resolved || !note.quote.trim()) continue;
      const match = findMatchRange(text, note.quote);
      if (match) ranges.push({ ...match, color: note.color, id: note.id });
    }
    if (!ranges.length) return null;
    ranges.sort((a, b) => a.start - b.start);

    const out: ReactNode[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start < cursor) continue;
      if (r.start > cursor) out.push(text.slice(cursor, r.start));
      out.push(
        <mark
          key={r.id}
          data-embed-note={r.id}
          style={{
            color: 'transparent',
            backgroundColor: `${r.color}44`,
            borderBottom: `2px solid ${r.color}`,
            borderRadius: '2px',
            outline: r.id === activeNoteId ? `2px solid ${r.color}` : undefined,
          }}
        >
          {text.slice(r.start, r.end)}
        </mark>,
      );
      cursor = r.end;
    }
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  }, [text, notes, activeNoteId]);

  if (!segments) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        ...style,
        color: 'transparent',
        backgroundColor: 'transparent',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}
      className={`${className} pointer-events-none absolute inset-0 overflow-hidden select-none`}
    >
      {segments}
    </div>
  );
}

/** Wraps a block <textarea> with its highlight overlay in a single element so BlockItem stays compact. */
export const HighlightedBlockTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { text: string }
>(({ text, style, className = '', ...rest }, ref) => (
  <>
    <EmbedFieldHighlightOverlay
      text={text}
      style={{
        fontFamily: style?.fontFamily,
        fontSize: style?.fontSize,
        textAlign: style?.textAlign,
        fontStyle: style?.fontStyle,
        fontWeight: style?.fontWeight,
        lineHeight: style?.lineHeight,
      }}
      className="w-full rounded px-1 py-0 m-0 p-0"
    />
    <textarea
      ref={ref}
      data-embed-field-managed="1"
      style={style}
      className={`relative z-[1] ${className}`}
      {...rest}
    />
  </>
));
