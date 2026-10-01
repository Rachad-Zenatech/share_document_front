import React, { useState } from 'react';
import {
  Plus,
  Heading,
  AlignLeft,
  Table as TableIcon,
  AlertCircle,
  FileSignature,
  Minus,
  Tag,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';
import type { SecBlock, SecBlockType } from '../../../types/secFiling';
import { FINANCIAL_TABLE_TEMPLATES } from '../../../data/financialTableTemplates';
import type { FinancialTableTemplate } from '../../../data/financialTableTemplates';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';

interface InlineAddBlockProps {
  index?: number;
  onAddBlock?: (index: number, type: SecBlockType, customBlock?: Partial<SecBlock>) => void;
  onAdd?: (type: SecBlockType, customBlock?: Partial<SecBlock>) => void;
  className?: string;
  isAlwaysVisible?: boolean;
  /** Statement templates, from the API. Falls back to the bundled set. */
  tableTemplates?: FinancialTableTemplate[];
}

const BLOCK_OPTIONS: {
  type: SecBlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
    {
      type: 'paragraph',
      label: 'Paragraph / Disclosure',
      desc: 'Standard financial text and narrative disclosure',
      icon: AlignLeft,
      color: 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
    },
    {
      type: 'heading',
      label: 'Section Heading / New Section',
      desc: 'Starts a section; name on page sets document section name',
      icon: Heading,
      color: 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
    },
    {
      type: 'image',
      label: 'Picture / Corporate Logo',
      desc: 'Embed company logos, charts, or images',
      icon: ImageIcon,
      color: 'text-pink-500 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40'
    },
    {
      type: 'financial_table',
      label: 'Financial Statement Table',
      desc: 'Multi-column statement grid with notes and totals',
      icon: TableIcon,
      color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      type: 'callout',
      label: 'Auditor / Notice Box',
      desc: 'Highlighted unreviewed or regulatory callout',
      icon: AlertCircle,
      color: 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
    },
    {
      type: 'signature',
      label: 'Officer Signatures',
      desc: 'CEO/CFO certification sign-off block',
      icon: FileSignature,
      color: 'text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
    },
    {
      type: 'divider',
      label: 'Section / Page Break',
      desc: 'Visual divider or hard print page break',
      icon: Minus,
      color: 'text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800'
    },
    {
      type: 'metadata',
      label: 'SEC Filing Header & CIK',
      desc: 'SEC EDGAR taxonomy and period metadata',
      icon: Tag,
      color: 'text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40'
    }
  ];

const InlineAddBlockComponent: React.FC<InlineAddBlockProps> = ({
  index,
  onAddBlock,
  onAdd,
  className = '',
  isAlwaysVisible = false,
  tableTemplates = FINANCIAL_TABLE_TEMPLATES
}) => {
  const [open, setOpen] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);

  const handleAdd = (type: SecBlockType, customBlock?: Partial<SecBlock>) => {
    if (onAddBlock && typeof index === 'number') {
      onAddBlock(index, type, customBlock);
    } else if (onAdd) {
      onAdd(type, customBlock);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTemplatesExpanded(false);
  };

  const closeMenu = () => {
    setOpen(false);
    setTemplatesExpanded(false);
  };

  const menuHeader = (
    <div className="px-2 py-1.5 border-b border-slate-100 dark:border-zinc-800 mb-1">
      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
        Insert SEC Filing Block
      </p>
      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
        Select a block type to add to the document
      </p>
    </div>
  );

  // Shared block-type list, used by the "Add First Block" and the inline seam menus.
  const blockOptionList = (
    <div className="grid grid-cols-1 gap-1 max-h-80 overflow-y-auto pr-1">
      {BLOCK_OPTIONS.map((item) => {
        const Icon = item.icon;

        // Financial statement tables expand on click into the statement templates so a
        // contributor can build a balance sheet, income statement, cash flows, etc.
        if (item.type === 'financial_table') {
          return (
            <div key={item.type}>
              <button
                type="button"
                onClick={() => setTemplatesExpanded((prev) => !prev)}
                aria-expanded={templatesExpanded}
                className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors group/btn cursor-pointer ${
                  templatesExpanded
                    ? 'bg-slate-100 dark:bg-zinc-800/70'
                    : 'hover:bg-slate-100 dark:hover:bg-zinc-800/70'
                }`}
              >
                <div className={`p-1.5 rounded-md ${item.color} shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-900 dark:text-zinc-100 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                    {templatesExpanded
                      ? 'Pick a statement template below'
                      : 'Click to build from a statement template'}
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 mt-1 text-slate-400 transition-transform ${
                    templatesExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {templatesExpanded && (
                <div className="mt-1 ml-3 pl-2 border-l-2 border-emerald-200 dark:border-emerald-900 space-y-0.5">
                  <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                    Build table from template
                  </div>
                  {tableTemplates.map((tpl) => {
                    const TplIcon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          handleAdd('financial_table', tpl.block as Partial<SecBlock>);
                          closeMenu();
                        }}
                        className="w-full flex items-start gap-2 p-1.5 rounded-md text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors group/tpl cursor-pointer"
                      >
                        <div className={`p-1 rounded ${tpl.color} shrink-0 mt-0.5`}>
                          <TplIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-slate-900 dark:text-zinc-100 truncate group-hover/tpl:text-emerald-700 dark:group-hover/tpl:text-emerald-400">
                              {tpl.name}
                            </span>
                            {tpl.badge && (
                              <span className="shrink-0 px-1 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-mono text-slate-500 dark:text-zinc-400">
                                {tpl.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                            {tpl.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.type}
            type="button"
            onClick={() => {
              handleAdd(item.type);
              closeMenu();
            }}
            className="flex items-start gap-3 p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors group/btn cursor-pointer"
          >
            <div className={`p-1.5 rounded-md ${item.color} shrink-0 mt-0.5`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-zinc-100 group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400">
                {item.label}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                {item.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  // When empty or explicitly always visible (like the top inserter when 0 blocks)
  if (isAlwaysVisible) {
    return (
      <div className={`group relative flex items-center justify-center select-none py-3 my-2 ${className}`}>
        <div className="absolute inset-x-0 h-px border-t border-dashed border-slate-300 dark:border-zinc-700" />
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Block</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="w-[22rem] p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-xl z-50"
          >
            {menuHeader}
            {blockOptionList}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Keep the insertion seam in normal flow. The previous zero-height, absolutely
  // positioned hotspot sat on top of nearby short headings and intercepted their clicks.
  return (
    <div
      className={`group/inserter relative w-full select-none z-20 transition-[height] duration-100 ${
        open ? 'h-6' : 'h-1 hover:h-6'
      } ${className}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-full flex items-center justify-center transition-opacity ${open
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none group-hover/inserter:opacity-100 group-hover/inserter:pointer-events-auto'
          }`}
      >
        {/* Subtle dashed line connecting across the seam */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-blue-400/80 dark:border-blue-500/80" />

        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-700 text-[10px] font-semibold text-blue-600 dark:text-blue-400 shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Block</span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="center"
            className="w-[22rem] p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl rounded-xl z-50"
          >
            {menuHeader}
            {blockOptionList}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export const InlineAddBlock = React.memo(InlineAddBlockComponent);
