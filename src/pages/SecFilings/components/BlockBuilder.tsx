import React, { useState, useMemo, useEffect } from 'react';
import type { SecBlock, SecBlockType, SecBlockDiff, SecBlockSpacing, AttachedSpreadsheet } from '../../../types/secFiling';
import { BlockItem } from './BlockItem';
import { InlineAddBlock } from './InlineAddBlock';
import type { FinancialTableTemplate } from '../../../data/financialTableTemplates';
import { paginateBlocks } from '../../../utils/secFilingPagination';
import {
  FileText,
  PlusCircle,
  Columns,
  ZoomIn,
  ZoomOut,
  Sliders,
  BookOpen,
  MoveVertical,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  FolderInput,
  X,
  Search,
  Maximize2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../../../components/ui/dropdown-menu';

interface BlockBuilderProps {
  blocks: SecBlock[];
  filteredBlocks: SecBlock[];
  selectedBlockId: string | null;
  selectedBlockIds?: string[];
  onSelectBlock: (id: string | null) => void;
  onToggleBlockSelection?: (id: string, multiSelect?: boolean) => void;
  onSelectAllBlocks?: () => void;
  onClearSelection?: () => void;
  onAddBlock: (index: number, type: SecBlockType, customBlock?: Partial<SecBlock>) => void;
  /** Statement templates, from the API. Falls back to the bundled set. */
  tableTemplates?: FinancialTableTemplate[];
  onUpdateBlock: (id: string, updates: Partial<SecBlock>) => void;
  onMoveBlock: (id: string, direction: 'up' | 'down') => void;
  onMoveMultipleBlocks?: (ids: string[], direction: 'up' | 'down') => void;
  onDuplicateBlock: (id: string) => void;
  onDuplicateMultipleBlocks?: (ids: string[]) => void;
  onDeleteBlock: (id: string) => void;
  onDeleteMultipleBlocks?: (ids: string[]) => void;
  onMoveMultipleBlocksToSection?: (ids: string[], section: string) => void;
  onUpdateMultipleBlocksSpacing?: (ids: string[], spacing: SecBlockSpacing) => void;
  documentSections?: string[];
  diffs?: SecBlockDiff[];
  viewMode?: 'word' | 'blocks';
  onToggleViewMode?: (mode: 'word' | 'blocks') => void;
  attachedSpreadsheet?: AttachedSpreadsheet | null;
  onOpenSpreadsheet?: (cellRef?: string, tabName?: string) => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
  activeMatchBlockId?: string | null;
  matchingBlockIds?: string[];
  onClearSearch?: () => void;
}

export const BlockBuilder: React.FC<BlockBuilderProps> = ({
  blocks,
  filteredBlocks,
  selectedBlockId,
  selectedBlockIds = [],
  onSelectBlock,
  onToggleBlockSelection,
  onSelectAllBlocks,
  onClearSelection,
  onAddBlock,
  tableTemplates,
  onUpdateBlock,
  onMoveBlock,
  onMoveMultipleBlocks,
  onDuplicateBlock,
  onDuplicateMultipleBlocks,
  onDeleteBlock,
  onDeleteMultipleBlocks,
  onMoveMultipleBlocksToSection,
  onUpdateMultipleBlocksSpacing,
  documentSections = [],
  diffs = [],
  viewMode = 'word',
  onToggleViewMode,
  attachedSpreadsheet,
  onOpenSpreadsheet,
  onOpenCellPicker,
  searchQuery,
  activeMatchBlockId,
  matchingBlockIds = [],
  onClearSearch
}) => {
  const diffMap = useMemo(() => new Map<string, SecBlockDiff>(diffs.map((d) => [d.blockId, d])), [diffs]);
  const blockIndexMap = useMemo(() => new Map<string, number>(blocks.map((b, i) => [b.id, i])), [blocks]);
  const selectedSet = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [isMultiPageLayout, setIsMultiPageLayout] = useState<boolean>(true);
  const [globalSpacing, setGlobalSpacing] = useState<SecBlockSpacing>('normal');
  const [docWidth, setDocWidth] = useState<'standard' | 'wide' | 'full'>('standard');

  const sheetWidthClass =
    docWidth === 'full'
      ? 'w-full max-w-none'
      : docWidth === 'wide'
      ? 'w-full max-w-[1380px]'
      : 'w-full max-w-[920px] xl:max-w-[960px]';

  // Keyboard shortcut listener for multi-block movement (Alt+Up / Alt+Down / Ctrl+Shift+Up / Ctrl+Shift+Down / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClearSelection?.();
        return;
      }

      const isMoveUp =
        (e.altKey && e.key === 'ArrowUp') ||
        (e.ctrlKey && e.shiftKey && e.key === 'ArrowUp') ||
        (e.altKey && e.shiftKey && e.key === 'ArrowUp');

      const isMoveDown =
        (e.altKey && e.key === 'ArrowDown') ||
        (e.ctrlKey && e.shiftKey && e.key === 'ArrowDown') ||
        (e.altKey && e.shiftKey && e.key === 'ArrowDown');

      if (isMoveUp) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedBlockIds.length > 0) {
          onMoveMultipleBlocks?.(selectedBlockIds, 'up');
        } else if (selectedBlockId) {
          onMoveBlock(selectedBlockId, 'up');
        }
      } else if (isMoveDown) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedBlockIds.length > 0) {
          onMoveMultipleBlocks?.(selectedBlockIds, 'down');
        } else if (selectedBlockId) {
          onMoveBlock(selectedBlockId, 'down');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedBlockIds, selectedBlockId, onMoveMultipleBlocks, onMoveBlock, onClearSelection]);

  // Global click-away listener: clears selected block when clicking off to the side or on canvas margins
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // If clicked inside a block item, floating toolbar, popover, or dropdown menu, do not deselect
      const isInsideBlockOrToolbar = target.closest(
        '[data-block-item="true"], [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper], [data-slot="popover-content"], [data-slot="dropdown-menu-content"]'
      );

      if (!isInsideBlockOrToolbar) {
        onSelectBlock(null);
        onClearSelection?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onSelectBlock, onClearSelection]);

  // Paginate blocks dynamically taking global spacing into account
  const pages = useMemo(() => {
    return paginateBlocks(filteredBlocks, globalSpacing);
  }, [filteredBlocks, globalSpacing]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(150, Math.max(75, prev + delta)));
  };

  const scrollToPage = (pageIndex: number) => {
    const el = document.getElementById(`doc-page-${pageIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-3">
      {/* Document Canvas Header & Ribbon Strip */}
      <div className={`${sheetWidthClass} flex items-center justify-between px-4 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-300 shadow-sm sticky top-[108px] z-20 transition-all duration-150`}>
        <div className="flex items-center gap-3">
          {/* Document / Block Mode Indicator & Page Count */}
          <div className="flex items-center gap-1.5 font-bold text-[#0E2841] dark:text-blue-400">
            {viewMode === 'word' ? (
              <FileText className="w-4 h-4 text-blue-600" />
            ) : (
              <Columns className="w-4 h-4 text-blue-600" />
            )}
            <span>{viewMode === 'word' ? 'Word Document' : 'Block Canvas'}</span>
          </div>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
            <BookOpen className="w-3 h-3" />
            <span>
              {pages.length} {pages.length === 1 ? 'Page' : 'Pages'} (Letter 8.5" × 11")
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas Width Mode Dropdown (Standard Letter vs Wide Sheet vs Full Width) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 font-medium"
                title="Adjust Canvas Document Width (Fit Screen / Wide Tables)"
              >
                <Maximize2 className="w-3 h-3 text-blue-600" />
                <span className="capitalize">
                  {docWidth === 'wide' ? 'Wide (1380px)' : docWidth === 'full' ? 'Full Screen' : 'Letter (980px)'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Document Canvas Width
              </div>
              <DropdownMenuItem
                onClick={() => setDocWidth('wide')}
                className={`flex flex-col items-start py-1.5 cursor-pointer ${
                  docWidth === 'wide' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Wide Sheet (1380px)</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5.5">Best for wide multi-period tables</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDocWidth('full')}
                className={`flex flex-col items-start py-1.5 cursor-pointer ${
                  docWidth === 'full' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Columns className="w-3.5 h-3.5 text-blue-600" />
                  <span>Full Screen (100% Fluid)</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5.5">Uses full width with 0 wasted space</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDocWidth('standard')}
                className={`flex flex-col items-start py-1.5 cursor-pointer ${
                  docWidth === 'standard' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Standard Letter (980px)</span>
                </div>
                <span className="text-[10px] text-slate-400 pl-5.5">Exact printable letter proportion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Global Spacing Dropdown (Closer / Farther apart) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 font-medium"
              >
                <MoveVertical className="w-3 h-3 text-blue-600" />
                <span className="capitalize">{globalSpacing} Spacing</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Block Spacing & Padding
              </div>
              <DropdownMenuItem
                onClick={() => setGlobalSpacing('compact')}
                className={`flex items-center justify-between py-1.5 ${
                  globalSpacing === 'compact' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <span>Compact (Closer)</span>
                <span className="text-[10px] text-slate-400">Tight</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setGlobalSpacing('normal')}
                className={`flex items-center justify-between py-1.5 ${
                  globalSpacing === 'normal' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <span>Normal (Default)</span>
                <span className="text-[10px] text-slate-400">1.35x</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setGlobalSpacing('relaxed')}
                className={`flex items-center justify-between py-1.5 ${
                  globalSpacing === 'relaxed' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <span>Relaxed (Farther)</span>
                <span className="text-[10px] text-slate-400">1.5x</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setGlobalSpacing('loose')}
                className={`flex items-center justify-between py-1.5 ${
                  globalSpacing === 'loose' ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                }`}
              >
                <span>Loose (Wide Gaps)</span>
                <span className="text-[10px] text-slate-400">1.8x</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page Jump Selector */}
          {pages.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs">
              <span className="text-[11px] text-slate-500">Jump:</span>
              <select
                onChange={(e) => scrollToPage(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                defaultValue={1}
              >
                {pages.map((p) => (
                  <option key={p.pageNumber} value={p.pageNumber} className="dark:bg-zinc-900">
                    P. {p.pageNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Multi-Page vs Continuous Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsMultiPageLayout(!isMultiPageLayout)}
            className={`h-7 px-2 text-xs gap-1 ${
              isMultiPageLayout
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
            }`}
            title="Toggle Multi-Page Sheet Layout"
          >
            <span>{isMultiPageLayout ? 'Pages' : 'Continuous'}</span>
          </Button>

          {/* Multi-Select / Select All Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedBlockIds.length > 0) {
                onClearSelection?.();
              } else {
                onSelectAllBlocks?.();
              }
            }}
            className={`h-7 px-2 text-xs gap-1 ${
              selectedBlockIds.length > 0
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title={selectedBlockIds.length > 0 ? 'Clear Selection' : 'Select All Blocks'}
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {selectedBlockIds.length > 0 ? `${selectedBlockIds.length} Selected` : 'Select All'}
            </span>
          </Button>

          {/* Ruler Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowRuler(!showRuler)}
            className={`h-7 px-2 text-xs gap-1 ${
              showRuler ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 font-semibold' : 'text-slate-500'
            }`}
            title="Toggle Word Ruler"
          >
            <Sliders className="w-3 h-3" />
            <span className="hidden md:inline">Ruler</span>
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700 text-xs">
            <button
              type="button"
              onClick={() => handleZoom(-10)}
              title="Zoom Out"
              disabled={zoomLevel <= 75}
              className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded disabled:opacity-30"
            >
              <ZoomOut className="w-3 h-3 text-slate-600 dark:text-zinc-300" />
            </button>
            <span className="px-1.5 font-mono text-[11px] font-semibold text-slate-700 dark:text-zinc-300 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(10)}
              title="Zoom In"
              disabled={zoomLevel >= 150}
              className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded disabled:opacity-30"
            >
              <ZoomIn className="w-3 h-3 text-slate-600 dark:text-zinc-300" />
            </button>
            {zoomLevel !== 100 && (
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom to 100%"
                className="px-1 text-[10px] text-blue-600 hover:underline"
              >
                100%
              </button>
            )}
          </div>

          {/* View Mode Toggle (Document vs Block Grid) */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onToggleViewMode?.('word')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'word'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Word View</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleViewMode?.('blocks')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'blocks'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Block Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document Horizontal Ruler */}
      {showRuler && viewMode === 'word' && (
        <div className={`${sheetWidthClass} bg-slate-200 dark:bg-zinc-800 rounded-t-sm border-x border-t border-slate-300 dark:border-zinc-700 select-none overflow-hidden transition-all duration-150`}>
          <div className="flex items-center h-5 text-[9px] font-mono text-slate-600 dark:text-zinc-400">
            {/* Left 1-inch margin gray zone */}
            <div className="w-12 sm:w-16 md:w-20 lg:w-22 bg-slate-300 dark:bg-zinc-700 h-full border-r border-slate-400 flex items-center justify-center font-bold text-[8px]">
              ◀ 1"
            </div>

            {/* 6.5-inch printable white zone */}
            <div className="flex-1 bg-white dark:bg-zinc-900 h-full flex items-center justify-between px-3 text-[8px] text-slate-400">
              <span>| 1"</span>
              <span>| 2"</span>
              <span>| 3"</span>
              <span>| 4"</span>
              <span>| 5"</span>
              <span>| 6"</span>
              <span>| 7"</span>
              <span>8.5"</span>
            </div>

            {/* Right 1-inch margin gray zone */}
            <div className="w-12 sm:w-16 md:w-20 lg:w-22 bg-slate-300 dark:bg-zinc-700 h-full border-l border-slate-400 flex items-center justify-center font-bold text-[8px]">
              1" ▶
            </div>
          </div>
        </div>
      )}

      {/* Document Page Simulation Sheets */}
      <div
        className="w-full flex flex-col items-center transition-all duration-200"
        style={{
          transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
          transformOrigin: 'top center'
        }}
      >
        {filteredBlocks.length === 0 ? (
          <div className={`${sheetWidthClass} bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 p-12 text-center space-y-4 min-h-[500px] flex flex-col items-center justify-center`}>
            {searchQuery?.trim() ? (
              <>
                <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600">
                  <Search className="w-6 h-6" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-base font-semibold text-slate-800 dark:text-zinc-100">
                    No blocks match "{searchQuery}"
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    No headings, paragraphs, statement line items, or spreadsheet-linked values match this term. Try typing partial words, or search by account names or numbers.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {onClearSearch && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClearSearch}
                      className="text-xs gap-1.5 border-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Search</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAddBlock(0, 'heading')}
                    className="text-xs gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add New Block</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">No matching content found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Adjust your search or add a block to begin drafting.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => onAddBlock(0, 'heading')}
                  className="text-xs gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Heading</span>
                </Button>
              </>
            )}
          </div>
        ) : isMultiPageLayout ? (
          /* Multi-Page Paginated Sheets */
          pages.map((page, pageIdx) => (
            <React.Fragment key={page.pageNumber}>
              <div
                id={`doc-page-${page.pageNumber}`}
                onClick={() => onSelectBlock(null)}
                className={`${sheetWidthClass} scroll-mt-32 ${
                  viewMode === 'word'
                    ? 'bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 px-8 sm:px-12 md:px-18 lg:px-22 py-12 md:py-14'
                    : 'bg-slate-50/50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 shadow-xl rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 p-6 md:p-8'
                } mb-8 relative transition-all duration-200 flex flex-col justify-between overflow-hidden`}
                style={{
                  minHeight: viewMode === 'word' ? '1056px' : 'auto',
                  fontFamily: viewMode === 'word' ? 'Calibri, "Segoe UI", Arial, sans-serif' : undefined
                }}
              >
                {/* Floating Page Number Indicator on Top Corner */}
                <div className="absolute right-4 top-3 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full select-none z-10 border border-slate-200 dark:border-zinc-700">
                  Page {page.pageNumber} of {pages.length}
                </div>

                <div className="relative z-10">
                  {/* Document Header */}
                  <div className="pb-3 mb-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans select-none">
                    <span className="font-semibold tracking-tight text-[#0E2841] dark:text-blue-400">
                      ZenaTech, Inc. — Form 6-K Interim Report
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {viewMode === 'blocks' ? `Page ${page.pageNumber} • Block View` : 'Six Months Ended June 30, 2026'}
                    </span>
                  </div>

                  {/* If page 1, show top add block bar */}
                  {pageIdx === 0 && (
                    <InlineAddBlock tableTemplates={tableTemplates}
                      onAdd={(type, customBlock) => onAddBlock(0, type, customBlock)}
                      className="mb-2"
                      isAlwaysVisible={blocks.length === 0}
                    />
                  )}

                  {/* Blocks inside this page */}
                  <div className={viewMode === 'blocks' ? 'space-y-3' : ''}>
                    {page.blocks.map((block) => {
                      const actualIndex = blockIndexMap.get(block.id) ?? 0;
                      const diffInfo = diffMap.get(block.id);

                      return (
                        <React.Fragment key={block.id}>
                          <BlockItem tableTemplates={tableTemplates}
                            block={block}
                            index={actualIndex}
                            totalBlocks={blocks.length}
                            isSelected={selectedBlockId === block.id}
                            isMultiSelected={selectedSet.has(block.id)}
                            onSelect={() => onSelectBlock(block.id)}
                            onToggleSelect={(multi) => onToggleBlockSelection?.(block.id, multi)}
                            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
                            onMoveUp={() => onMoveBlock(block.id, 'up')}
                            onMoveDown={() => onMoveBlock(block.id, 'down')}
                            onDuplicate={() => onDuplicateBlock(block.id)}
                            onDelete={() => onDeleteBlock(block.id)}
                            diffType={diffInfo?.status}
                            tableCellDiffs={diffInfo?.tableCellDiffs}
                            viewMode={viewMode}
                            globalSpacing={globalSpacing}
                            attachedSpreadsheet={attachedSpreadsheet}
                            onOpenSpreadsheet={onOpenSpreadsheet}
                            onOpenCellPicker={onOpenCellPicker}
                            searchQuery={searchQuery}
                            isActiveSearchMatch={activeMatchBlockId === block.id}
                            isSearchMatch={matchingBlockIds?.includes(block.id)}
                          />

                          {/* Inline Add Bar below each block */}
                          <InlineAddBlock tableTemplates={tableTemplates} index={actualIndex + 1} onAddBlock={onAddBlock} />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Document Page Footer */}
                <div className="pt-6 mt-8 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans select-none relative z-10">
                  <span className="italic">Confidential — Review Copy (v22)</span>
                  <span className="font-bold text-[#0E2841] dark:text-blue-400">
                    Page {page.pageNumber} of {pages.length}
                  </span>
                  <span>Unaudited</span>
                </div>
              </div>

              {/* Visual Page Break Gap between Sheets */}
              {pageIdx < pages.length - 1 && (
                <div className={`${sheetWidthClass} flex items-center justify-center gap-3 my-2 text-slate-400 select-none`}>
                  <div className="h-px bg-slate-300 dark:bg-zinc-700 flex-1" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500 bg-slate-200 dark:bg-zinc-800 px-3 py-1 rounded-full shadow-xs">
                    Page Break • Next: Page {page.pageNumber + 1}
                  </span>
                  <div className="h-px bg-slate-300 dark:bg-zinc-700 flex-1" />
                </div>
              )}
            </React.Fragment>
          ))
        ) : (
          /* Continuous Single Sheet View / Continuous Block Mode */
          <div
            onClick={() => onSelectBlock(null)}
            className={`${sheetWidthClass} ${
              viewMode === 'word'
                ? 'bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300/80 px-8 sm:px-12 md:px-18 lg:px-22 py-12 md:py-14'
                : 'bg-slate-50/50 dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 shadow-xl rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-3'
            } transition-all duration-200 relative overflow-hidden`}
            style={{
              minHeight: '1100px',
              fontFamily: viewMode === 'word' ? 'Calibri, "Segoe UI", Arial, sans-serif' : undefined
            }}
          >
            {/* Header */}
            <div className="pb-4 mb-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans select-none relative z-10">
              <span className="font-semibold tracking-tight text-[#0E2841] dark:text-blue-400">
                ZenaTech, Inc. — Form 6-K Interim Report
              </span>
              <span>Six Months Ended June 30, 2026</span>
            </div>

            {/* Top Add Block Bar */}
            <div className="relative z-10">
              <InlineAddBlock tableTemplates={tableTemplates}
                onAdd={(type, customBlock) => onAddBlock(0, type, customBlock)}
                className="mb-2"
                isAlwaysVisible={blocks.length === 0}
              />
            </div>

            {/* Blocks List */}
            <div className={`relative z-10 ${viewMode === 'blocks' ? 'space-y-3' : ''}`}>
              {filteredBlocks.map((block) => {
                const actualIndex = blockIndexMap.get(block.id) ?? 0;
                const diffInfo = diffMap.get(block.id);

                return (
                  <React.Fragment key={block.id}>
                    <BlockItem tableTemplates={tableTemplates}
                      block={block}
                      index={actualIndex}
                      totalBlocks={blocks.length}
                      isSelected={selectedBlockId === block.id}
                      isMultiSelected={selectedSet.has(block.id)}
                      onSelect={() => onSelectBlock(block.id)}
                      onToggleSelect={(multi) => onToggleBlockSelection?.(block.id, multi)}
                      onUpdate={(updates) => onUpdateBlock(block.id, updates)}
                      onMoveUp={() => onMoveBlock(block.id, 'up')}
                      onMoveDown={() => onMoveBlock(block.id, 'down')}
                      onDuplicate={() => onDuplicateBlock(block.id)}
                      onDelete={() => onDeleteBlock(block.id)}
                      diffType={diffInfo?.status}
                      tableCellDiffs={diffInfo?.tableCellDiffs}
                      viewMode={viewMode}
                      globalSpacing={globalSpacing}
                      attachedSpreadsheet={attachedSpreadsheet}
                      onOpenSpreadsheet={onOpenSpreadsheet}
                      onOpenCellPicker={onOpenCellPicker}
                      searchQuery={searchQuery}
                      isActiveSearchMatch={activeMatchBlockId === block.id}
                      isSearchMatch={matchingBlockIds?.includes(block.id)}
                    />

                    {/* Inline Add Bar below each block */}
                    <InlineAddBlock tableTemplates={tableTemplates} onAdd={(type, customBlock) => onAddBlock(actualIndex + 1, type, customBlock)} />
                  </React.Fragment>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-10 mt-12 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-sans select-none relative z-10">
              <span className="italic">Confidential — Review Copy (v22)</span>
              <span>Unaudited Interim Financial Statements</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Selection & Multi-Move Action Toolbar */}
      {selectedBlockIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-[#0E2841] text-white rounded-full shadow-2xl border border-blue-400/40 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-blue-400/30">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold font-mono tracking-wide">
              {selectedBlockIds.length} {selectedBlockIds.length === 1 ? 'Block' : 'Blocks'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Move Up */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onMoveMultipleBlocks?.(selectedBlockIds, 'up')}
              className="h-7 px-2.5 text-xs gap-1 text-white hover:bg-white/20 hover:text-white font-medium"
              title="Move selected blocks UP together (Alt+Up)"
            >
              <ArrowUp className="w-3.5 h-3.5 text-blue-300" />
              <span>Move Up</span>
            </Button>

            {/* Move Down */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onMoveMultipleBlocks?.(selectedBlockIds, 'down')}
              className="h-7 px-2.5 text-xs gap-1 text-white hover:bg-white/20 hover:text-white font-medium"
              title="Move selected blocks DOWN together (Alt+Down)"
            >
              <ArrowDown className="w-3.5 h-3.5 text-blue-300" />
              <span>Move Down</span>
            </Button>

            {/* Move to Section */}
            {documentSections && documentSections.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-xs gap-1 text-white hover:bg-white/20 hover:text-white font-medium"
                    title="Assign selected blocks to Section"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-cyan-300" />
                    <span>To Section</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 p-1 text-xs max-h-60 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Move Blocks To Section
                  </div>
                  {documentSections.map((sec) => (
                    <DropdownMenuItem
                      key={sec}
                      onClick={() => onMoveMultipleBlocksToSection?.(selectedBlockIds, sec)}
                      className="text-xs truncate cursor-pointer"
                    >
                      {sec}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Batch Spacing */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs gap-1 text-white hover:bg-white/20 hover:text-white font-medium"
                  title="Change Spacing for all selected blocks"
                >
                  <MoveVertical className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Spacing</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-40 p-1 text-xs">
                <DropdownMenuItem onClick={() => onUpdateMultipleBlocksSpacing?.(selectedBlockIds, 'compact')}>
                  Compact (Tight)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMultipleBlocksSpacing?.(selectedBlockIds, 'normal')}>
                  Normal (1.35x)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMultipleBlocksSpacing?.(selectedBlockIds, 'relaxed')}>
                  Relaxed (1.5x)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateMultipleBlocksSpacing?.(selectedBlockIds, 'loose')}>
                  Loose (1.8x)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Duplicate */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDuplicateMultipleBlocks?.(selectedBlockIds)}
              className="h-7 px-2.5 text-xs gap-1 text-white hover:bg-white/20 hover:text-white font-medium"
              title="Duplicate selected blocks"
            >
              <Copy className="w-3.5 h-3.5 text-amber-300" />
              <span>Duplicate</span>
            </Button>

            {/* Delete */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDeleteMultipleBlocks?.(selectedBlockIds)}
              className="h-7 px-2.5 text-xs gap-1 text-red-300 hover:bg-red-500/30 hover:text-red-200 font-medium"
              title="Delete selected blocks"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          </div>

          {/* Clear Selection */}
          <button
            type="button"
            onClick={onClearSelection}
            title="Deselect all (Esc)"
            className="ml-1 p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};




