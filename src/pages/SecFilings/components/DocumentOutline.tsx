import React, { useMemo } from 'react';
import {
  ListFilter,
  Layers,
  FileSpreadsheet,
  BookOpen,
  Bookmark,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Plus,
  Menu,
} from 'lucide-react';
import type { SecBlock } from '../../../types/secFiling';
import { Badge } from '../../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../../components/ui/dropdown-menu';

interface DocumentOutlineProps {
  sections: string[];
  activeSection: string;
  onSelectSection: (section: string) => void;
  totalBlocks: number;
  blocks?: SecBlock[];
  sectionCounts?: Record<string, number>;
  onMoveSection?: (sectionName: string, direction: 'up' | 'down') => void;
  onReorderSection?: (sectionName: string, targetIndex: number) => void;
  onCreateSection?: () => void;
  className?: string;
}

const DocumentOutlineComponent: React.FC<DocumentOutlineProps> = ({
  sections,
  activeSection,
  onSelectSection,
  totalBlocks,
  blocks = [],
  sectionCounts,
  onMoveSection,
  onReorderSection,
  onCreateSection,
  className = ''
}) => {
  const getSectionIcon = (section: string) => {
    if (
      section.includes('Statements of') ||
      section.includes('Position') ||
      section.includes('Loss') ||
      section.includes('Cash')
    ) {
      return FileSpreadsheet;
    }
    if (
      section.startsWith('Note') ||
      section.startsWith('NOTE') ||
      section.includes('NATURE') ||
      section.includes('ACCOUNTING')
    ) {
      return BookOpen;
    }
    if (section.includes('Cover') || section.includes('Header')) {
      return Bookmark;
    }
    return Layers;
  };

  // Block counts per section
  // Drag and drop state for section movement
  const [draggedSec, setDraggedSec] = React.useState<string | null>(null);
  const [dragOverSec, setDragOverSec] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<'above' | 'below' | null>(null);

  const handleDragStart = (e: React.DragEvent, secName: string) => {
    e.dataTransfer.setData('text/plain', secName);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSec(secName);
  };

  const handleDragOver = (e: React.DragEvent, targetSec: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSec && draggedSec !== targetSec) {
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const pos = e.clientY < midY ? 'above' : 'below';
      setDragOverSec(targetSec);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSec(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedSec(null);
    setDragOverSec(null);
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetSec: string, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceSec = e.dataTransfer.getData('text/plain') || draggedSec;
    if (!sourceSec || sourceSec === targetSec || !onReorderSection) {
      handleDragEnd();
      return;
    }

    const sourceIdx = sections.indexOf(sourceSec);
    if (sourceIdx === -1) {
      handleDragEnd();
      return;
    }

    let destIdx = targetIdx;
    if (dropPosition === 'below' && destIdx < sourceIdx) {
      destIdx += 1;
    } else if (dropPosition === 'above' && destIdx > sourceIdx) {
      destIdx -= 1;
    }

    onReorderSection(sourceSec, destIdx);
    handleDragEnd();
  };

  const effectiveSectionCounts = useMemo(() => {
    if (sectionCounts) return sectionCounts;
    const map: Record<string, number> = {};
    blocks.forEach((b) => {
      if (b.section) {
        map[b.section] = (map[b.section] || 0) + 1;
      }
    });
    return map;
  }, [sectionCounts, blocks]);

  return (
    <div
      className={`w-full h-full flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden ${className}`}
    >
      {/* 1. Header (Fixed top of sidebar) */}
      <div className="flex items-center justify-between p-3 pb-2.5 border-b border-slate-100 dark:border-zinc-800 shrink-0 bg-white/95 dark:bg-zinc-900/95">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-xs text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Document Sections
            </h3>
          </div>
          <p className="text-[10px] text-slate-400">Reorder whole sections or jump to section</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-zinc-800 font-mono">
            {totalBlocks} blocks
          </Badge>
          {onCreateSection && (
            <button
              type="button"
              onClick={onCreateSection}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-400 text-[10px] font-medium transition-colors cursor-pointer border border-blue-200 dark:border-blue-800/60 shadow-2xs"
              title="Add a new section to document"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. All Sections View Button (Pinned below header) */}
      <div className="px-2.5 pt-2 shrink-0">
        <button
          type="button"
          onClick={() => onSelectSection('ALL')}
          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
            activeSection === 'ALL'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span className="truncate">View Entire Filing (All)</span>
          </div>
          {activeSection === 'ALL' && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-600" />}
        </button>
        <div className="h-px bg-slate-100 dark:bg-zinc-800 my-1.5" />
      </div>

      {/* 3. Section List with Left Sandwich Menu Drag-and-Drop (Scrolls independently within full-height side) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1 overscroll-contain">
        {sections.map((sec, idx) => {
          const Icon = getSectionIcon(sec);
          const isSelected = activeSection === sec;
          const isFirst = idx === 0;
          const isLast = idx === sections.length - 1;
          const count = effectiveSectionCounts[sec] || 0;
          const isBeingDragged = draggedSec === sec;
          const isOver = dragOverSec === sec;

          let dropIndicatorClass = '';
          if (isOver && !isBeingDragged) {
            dropIndicatorClass =
              dropPosition === 'above'
                ? 'border-t-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/40'
                : 'border-b-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/40';
          }

          return (
            <div
              key={sec}
              onDragOver={(e) => handleDragOver(e, sec)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, sec, idx)}
              className={`w-full flex items-center gap-1 p-1 rounded-lg text-xs transition-all group relative ${
                isBeingDragged ? 'opacity-35 scale-[0.98] border border-dashed border-blue-400 bg-blue-50/20' : ''
              } ${dropIndicatorClass} ${
                isSelected && !isBeingDragged && !isOver
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs'
                  : !isBeingDragged && !isOver
                  ? 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                  : ''
              }`}
            >
              {/* Left Sandwich Bar Menu Handle: Drag up/down or click for section actions */}
              <div className="shrink-0 flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, sec)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag up or down to move whole section, or click for actions"
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors cursor-grab active:cursor-grabbing group-hover:text-slate-600 dark:group-hover:text-zinc-200"
                    >
                      <Menu className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-56 p-1 text-xs z-50">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Section Actions</span>
                      <span className="font-mono text-slate-400">({count} blocks)</span>
                    </div>

                    <DropdownMenuSeparator />

                    {onMoveSection && (
                      <>
                        <DropdownMenuItem
                          disabled={isFirst}
                          onClick={() => onMoveSection(sec, 'up')}
                          className="gap-2 cursor-pointer py-1.5"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                          <span>Move Section Up (1 Step)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isLast}
                          onClick={() => onMoveSection(sec, 'down')}
                          className="gap-2 cursor-pointer py-1.5"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                          <span>Move Section Down (1 Step)</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    {onReorderSection && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={isFirst}
                          onClick={() => onReorderSection(sec, 0)}
                          className="gap-2 cursor-pointer py-1.5"
                        >
                          <ChevronsUp className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Move to Top of Document</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isLast}
                          onClick={() => onReorderSection(sec, sections.length - 1)}
                          className="gap-2 cursor-pointer py-1.5"
                        >
                          <ChevronsDown className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Move to Bottom of Document</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Click to filter section */}
              <button
                type="button"
                onClick={() => onSelectSection(sec)}
                className="flex items-center gap-2 truncate flex-1 text-left py-1 cursor-pointer min-w-0"
                title={`Jump to section: ${sec} (${count} blocks)`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="truncate flex-1">{sec}</span>
                {count > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0 pr-1">
                    ({count})
                  </span>
                )}
              </button>

              {isSelected && <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-auto text-blue-600 pr-0.5" />}
            </div>
          );
        })}
      </div>

      {/* 4. Subtle Bottom Summary Bar (Guarantees bottom is anchored and visible) */}
      <div className="px-3 py-1.5 bg-slate-50/80 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 shrink-0 flex items-center justify-between text-[10px] text-slate-400">
        <span>{sections.length} total sections</span>
        <span className="font-mono">drag handle to reorder</span>
      </div>
    </div>
  );
};

export const DocumentOutline = React.memo(DocumentOutlineComponent);