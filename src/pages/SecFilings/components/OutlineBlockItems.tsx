import type { SecBlock } from '../../../types/secFiling';
import { FileText, Heading, Image, MessageSquare, Minus, Table } from 'lucide-react';

type Props = {
  blocks: SecBlock[];
  section: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onSelectSection: (section: string) => void;
};

function blockLabel(block: SecBlock): string {
  switch (block.type) {
    case 'heading': return block.text || 'Scene heading';
    case 'paragraph': return block.text || 'Empty script paragraph';
    case 'financial_table': return `Script table: ${block.title || 'Scenes'} (${block.rows.length} rows)`;
    case 'image': return block.caption || block.alt || 'Reference image';
    case 'callout': return block.title || block.content || 'Production note';
    case 'divider': return block.label || 'Scene break';
    default: return 'Script content';
  }
}

function OutlineBlockRow({ block, selectedBlockId, onSelectBlock, onSelectSection }: Omit<Props, 'blocks' | 'section'> & { block: SecBlock }) {
  const icons = { heading: Heading, paragraph: FileText, financial_table: Table, image: Image, callout: MessageSquare, divider: Minus };
  const Icon = icons[block.type as keyof typeof icons] || FileText;
  const label = blockLabel(block).replace(/\s+/g, ' ').trim();
  const select = () => {
    onSelectSection(block.section);
    onSelectBlock?.(block.id);
    requestAnimationFrame(() => document.getElementById(block.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  return (
    <li>
      <button type="button" onClick={select} title={label} aria-current={selectedBlockId === block.id ? 'true' : undefined} data-outline-block-id={block.id}
        className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-slate-600 hover:bg-blue-50 aria-[current=true]:bg-blue-50 aria-[current=true]:text-blue-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
        <Icon className="h-3 w-3 shrink-0" /><span className="truncate">{label}</span>
      </button>
    </li>
  );
}

export function OutlineBlockItems({ blocks, section, ...props }: Props) {
  const items = blocks.filter((block) => block.section === section);
  return (
    <ul aria-label={`${section} items`} className="ml-5 space-y-0.5 border-l border-slate-200 pl-2 dark:border-zinc-700">
      {items.map((block) => <OutlineBlockRow key={block.id} block={block} {...props} />)}
    </ul>
  );
}
