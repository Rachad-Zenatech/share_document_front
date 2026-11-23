import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEmbedNotes } from '../embed/EmbedNotesContext';

type Props = {
  initialValue: string;
  onCommit: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
  searchQuery?: string;
};

export function ScriptTableCell({ initialValue, onCommit, onFocus, placeholder, title, style, className, searchQuery }: Props) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setValue(initialValue); }, [initialValue]);
  useEffect(() => {
    if (value === initialValue) return;
    const timer = window.setTimeout(() => onCommit(value), 350);
    return () => window.clearTimeout(timer);
  }, [value, initialValue, onCommit]);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const fit = () => { field.style.height = '0px'; field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`; };
    fit();
    let previousWidth = field.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === previousWidth) return;
      previousWidth = field.clientWidth;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fit);
    });
    observer.observe(field);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [value]);
  const { readOnly, notes, activeNoteId } = useEmbedNotes();
  const segments = useMemo(() => {
    if (!value || !notes.length) return null;
    const ranges: { start: number; end: number; color: string; id: string }[] = [];
    for (const note of notes) {
      if (note.resolved || !note.quote.trim()) continue;
      const needle = note.quote.trim();
      let idx = value.indexOf(needle);
      let len = needle.length;
      if (idx === -1 && needle.includes('\n')) {
        const firstLine = needle.split('\n').map((s) => s.trim()).find(Boolean);
        if (firstLine) {
          idx = value.indexOf(firstLine);
          len = firstLine.length;
        }
      }
      if (idx !== -1) ranges.push({ start: idx, end: idx + len, color: note.color, id: note.id });
    }
    if (!ranges.length) return null;
    ranges.sort((a, b) => a.start - b.start);
    const out: ReactNode[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start < cursor) continue;
      if (r.start > cursor) out.push(value.slice(cursor, r.start));
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
          {value.slice(r.start, r.end)}
        </mark>,
      );
      cursor = r.end;
    }
    if (cursor < value.length) out.push(value.slice(cursor));
    return out;
  }, [readOnly, value, notes, activeNoteId]);

  const query = searchQuery?.trim().toLowerCase();
  const highlight = query && value.toLowerCase().includes(query) ? 'ring-2 ring-amber-400 bg-amber-100/80' : '';
  const sharedStyle: CSSProperties = {
    ...style,
    display: 'block',
    width: '100%',
    minWidth: 0,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  };
  return (
    <div className="relative w-full">
      {segments && (
        <div
          aria-hidden="true"
          style={{ ...sharedStyle, color: 'transparent', backgroundColor: 'transparent' }}
          className={`${className ?? ''} pointer-events-none absolute inset-0 overflow-hidden select-none`}
        >
          {segments}
        </div>
      )}
      <textarea
        ref={ref}
        data-script-cell="1"
        rows={1}
        wrap="soft"
        readOnly={readOnly}
        value={value}
        aria-label={title || 'Script table cell'}
        placeholder={placeholder}
        title={title}
        onFocus={onFocus}
        onChange={(event) => { if (!readOnly) setValue(event.target.value); }}
        onBlur={() => { if (!readOnly && value !== initialValue) onCommit(value); }}
        style={{ ...sharedStyle, resize: 'none', overflow: 'hidden', position: 'relative', zIndex: 1, backgroundColor: segments ? 'transparent' : style?.backgroundColor }}
        className={`${className ?? ''} ${highlight}`}
      />
    </div>
  );
}
