import React from 'react';
import { Checkbox } from '../../../components/ui/checkbox';
import type { SecBlock, SecBlockDiff } from '../../../types/secFiling';

/** What a block of a script is called to the person reviewing it. */
export function scriptBlockLabel(block?: SecBlock): string {
  if (!block) return 'Block';
  if (block.type === 'heading') return 'Script title';
  if (block.type === 'financial_table') return 'Script table';
  const text = String((block as any).text ?? '').trim().toLowerCase();
  if (text.startsWith('storyline')) return 'Storyline';
  if (text.startsWith('hook score')) return 'Hook score line';
  if (text.startsWith('footage and compliance')) return 'Footage & compliance note';
  return 'Text';
}

const blockText = (block?: SecBlock): string => {
  const b = block as any;
  return String(b?.text ?? b?.content ?? b?.title ?? '').trim();
};

const STATUS_STYLE: Record<string, { label: string; chip: string; bar: string }> = {
  added: { label: 'Added', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', bar: 'border-l-emerald-500' },
  modified: { label: 'Edited', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', bar: 'border-l-amber-500' },
  deleted: { label: 'Removed', chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', bar: 'border-l-red-500' },
  unchanged: { label: 'Unchanged', chip: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400', bar: 'border-l-slate-300' },
};

const Before: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800 line-through decoration-red-400/70 dark:bg-red-950/30 dark:text-red-300">{text}</p>
);

const After: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-md bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{text}</p>
);

const TextChange: React.FC<{ diff: SecBlockDiff }> = ({ diff }) => {
  const before = blockText(diff.originalBlock);
  const after = blockText(diff.proposedBlock);
  if (diff.status === 'unchanged') return <p className="truncate text-[13px] text-slate-500">{after || before}</p>;
  return (
    <div className="space-y-1.5">
      {diff.status !== 'added' && before && before !== after && <Before text={before} />}
      {diff.status !== 'deleted' && after && before !== after && <After text={after} />}
    </div>
  );
};

const CellChanges: React.FC<{ diff: SecBlockDiff }> = ({ diff }) => (
  <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
    {(diff.tableCellDiffs ?? []).map((c, i) => (
      <li key={`${c.rowId ?? c.rowIndex}-${c.colIndex}-${i}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-[12px] dark:border-zinc-800">
        <span className="font-semibold text-slate-700 dark:text-zinc-200">
          {c.status === 'row_added' ? 'New beat' : c.status === 'row_deleted' ? 'Removed beat' : `${c.rowLabel || `Row ${c.rowIndex + 1}`} · ${c.headerLabel || `Column ${c.colIndex + 1}`}`}
        </span>
        {c.status !== 'row_added' && c.oldValue && <span className="ml-2 text-red-700 line-through dark:text-red-300">{c.oldValue}</span>}
        {c.status !== 'row_deleted' && c.newValue && <span className="ml-2 text-emerald-800 dark:text-emerald-300">{c.newValue}</span>}
      </li>
    ))}
  </ul>
);

interface ScriptChangeCardProps {
  diff: SecBlockDiff;
  author: string;
  checked: boolean;
  active: boolean;
  onToggle: (blockId: string) => void;
}

/** One block of the script that was changed: what it was, what it is now, and whether to take it. */
export const ScriptChangeCard: React.FC<ScriptChangeCardProps> = ({ diff, author, checked, active, onToggle }) => {
  const style = STATUS_STYLE[diff.status];
  const block = diff.proposedBlock ?? diff.originalBlock;
  const changed = diff.status !== 'unchanged';
  const isTable = block?.type === 'financial_table';
  const noTextChange = changed && !isTable && blockText(diff.originalBlock) === blockText(diff.proposedBlock);

  return (
    <article
      id={`script-diff-${diff.blockId}`}
      className={`rounded-lg border border-l-4 bg-white p-3 shadow-xs dark:bg-zinc-900 ${style.bar} ${active ? 'ring-2 ring-blue-400/60' : 'border-slate-200 dark:border-zinc-800'}`}
    >
      <header className="mb-2 flex items-center gap-2">
        {changed && <Checkbox checked={checked} onCheckedChange={() => onToggle(diff.blockId)} aria-label={`Merge ${scriptBlockLabel(block)}`} />}
        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{scriptBlockLabel(block)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>{style.label}</span>
        {changed && <span className="ml-auto text-[11px] text-slate-400">by {author}</span>}
      </header>
      {isTable && changed ? <CellChanges diff={diff} /> : <TextChange diff={diff} />}
      {noTextChange && (
        <div className="flex flex-wrap gap-1">
          {(diff.changeTags ?? []).map((t) => (
            <span key={t.label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{t.label}</span>
          ))}
        </div>
      )}
    </article>
  );
};
