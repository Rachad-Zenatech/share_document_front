import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Plus,
  AlertCircle,
  Tag,
  CheckSquare,
  Square,
  Upload,
  FolderArchive,
  Menu,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  GripVertical,
  LayoutTemplate,
  Undo2,
  Edit2,
  PlusCircle,
  Check,
  Save,
  Smartphone,
  Table2,
  ExternalLink,
  Unlink
} from 'lucide-react';
import { MediaBucketModal } from './MediaBucketModal';
import { TableTemplateModal, findMatchingTemplate, sanitizeTableBlock } from './TableTemplateModal';
import { MobileSigningModal } from './MobileSigningModal';
import { useUpdateFinancialTableTemplate } from '../../../hooks/useFinancialTableTemplates';
import { toast } from 'sonner';
import { mediaBucketService } from '../../../services/mediaBucketService';
import { compactFinancialTableBlock } from '../../../services/secFilingService';
import { FINANCIAL_TABLE_TEMPLATES } from '../../../data/financialTableTemplates';
import type { FinancialTableTemplate } from '../../../data/financialTableTemplates';
import { ZENATECH_LOGO_DATA_URL } from '../../../data/zenatechLogoAsset';
import type {
  SecBlock,
  SecHeadingBlock,
  SecParagraphBlock,
  SecFinancialTableBlock,
  SecCalloutBlock,
  SecSignatureBlock,
  SecDividerBlock,
  SecMetadataBlock,
  SecImageBlock,
  SecTableRow,
  SecBlockSpacing,
  SecTableCellDiff,
  AttachedSpreadsheet
} from '../../../types/secFiling';
import { interpolateVariables, hasDocumentVariables } from '../../../utils/documentVariables';
import { DocumentVariableRenderer } from './DocumentVariableRenderer';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../../../components/ui/dropdown-menu';

const NUMERIC_OR_FINANCIAL_RE = /^[$\d,.\s()–—\-+]+$/;

const isComparativeDateHeaderCell = (text: string, rowIndex: number, _colIndex?: number): boolean => {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  // A bare four-digit year in the top header rows is a period caption, not a figure.
  // This has to be tested before the numeric fast-path below, which would otherwise
  // reject "2026"/"2025" and leave them right-aligned with the money columns.
  if (rowIndex <= 3 && /^(19|20)\d{2}(\s+in\s+[$a-zA-Z]+)?$/.test(trimmed)) return true;
  // FAST-PATH: Financial numbers, dashes, currency symbols can never be date headers
  if (NUMERIC_OR_FINANCIAL_RE.test(trimmed)) return false;
  if (/^As of$/i.test(trimmed)) return true;
  if (/^Notes?(\s*Ref)?$/i.test(trimmed)) return true;
  if (/^(Three|Six|Nine|Twelve)\s+months\s+ended/i.test(trimmed)) return true;
  if (/^Six\s+months\s+20\d\d/i.test(trimmed)) return true;
  if (/^(Q[1-4]|FY)\s*20\d\d/i.test(trimmed)) return true;
  if (
    rowIndex <= 3 &&
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?(\s+\d{4})?(\s+in\s+[$a-zA-Z]+)?$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (rowIndex <= 3 && /^(19|20)\d{2}(\s+in\s+[$a-zA-Z]+)?$/.test(trimmed)) {
    return true;
  }
  return false;
};

export const isMajorStatementHeaderCell = (text: string): boolean => {
  if (!text) return false;
  const normalized = text
    .replace(/&rsquo;|&#8217;|&#39;|&lsquo;/gi, "'")
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4\u00E2\u20AC\u2122]+/g, "'")
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:.,]+$/, '');

  if (!normalized) return false;

  return /^(Assets|Liabilities(\s*(and|&)\s*((shareholder|stockholder)['s]*|total)?\s*(equity|deficit))?|(shareholder|stockholder)['s]*\s*(equity|deficit)):?$/i.test(
    normalized
  );
};

interface BlockItemProps {
  block: SecBlock;
  index: number;
  totalBlocks: number;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onToggleSelect?: (multiSelect: boolean) => void;
  onUpdate: (updates: Partial<SecBlock>) => void;
  /** Statement templates, from the API. Falls back to the bundled set. */
  tableTemplates?: FinancialTableTemplate[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isDiffModified?: boolean;
  diffType?: 'added' | 'modified' | 'deleted' | 'unchanged';
  tableCellDiffs?: SecTableCellDiff[];
  viewMode?: 'word' | 'blocks';
  globalSpacing?: SecBlockSpacing;
  attachedSpreadsheet?: AttachedSpreadsheet | null;
  onOpenSpreadsheet?: () => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
  isActiveSearchMatch?: boolean;
  isSearchMatch?: boolean;
}

const BlockItemComponent: React.FC<BlockItemProps> = ({
  block,
  index,
  totalBlocks,
  isSelected,
  isMultiSelected = false,
  onSelect,
  onToggleSelect,
  onUpdate,
  tableTemplates = FINANCIAL_TABLE_TEMPLATES,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  diffType,
  tableCellDiffs,
  viewMode = 'word',
  globalSpacing = 'normal',
  attachedSpreadsheet,
  onOpenSpreadsheet,
  onOpenCellPicker,
  searchQuery,
  isActiveSearchMatch = false,
  isSearchMatch = false
}) => {
  const isWordMode = viewMode === 'word';
  const effectiveSpacing = block.spacing || globalSpacing;
  const safeSpreadsheet = attachedSpreadsheet || undefined;
  
  // Default natural distance from the above block if not explicitly set
  const defaultSpacingTop =
    block.type === 'heading'
      ? (block as SecHeadingBlock).level === 1
        ? 12
        : (block as SecHeadingBlock).level === 2
        ? 8
        : 6
      : block.type === 'financial_table'
      ? 10
      : block.type === 'image'
      ? 8
      : block.type === 'signature'
      ? 14
      : block.type === 'divider'
      ? 12
      : effectiveSpacing === 'compact'
      ? 2
      : effectiveSpacing === 'relaxed'
      ? 8
      : effectiveSpacing === 'loose'
      ? 12
      : 4; // Default paragraph distance from above block

  const currentSpacingTop =
    typeof block.spacingTop === 'number' ? block.spacingTop : defaultSpacingTop;

  const [spacingInputText, setSpacingInputText] = useState<string>(String(currentSpacingTop));

  useEffect(() => {
    setSpacingInputText(String(currentSpacingTop));
  }, [currentSpacingTop]);

  const isTextType = block.type === 'heading' || block.type === 'paragraph';
  const currentAlign = (block as any).alignment || 'left';
  const isBold = (block as any).bold !== false && ((block as any).bold === true || block.type === 'heading');
  const isItalic = !!(block as any).italic;
  const isUnderline = !!(block as any).underline;
  const currentColor = (block as any).color || (block.type === 'heading' ? '#0E2841' : '#111827');
  const currentFontSize =
    (block as any).fontSize ||
    (block.type === 'heading'
      ? (block as SecHeadingBlock).level === 1
        ? 20
        : (block as SecHeadingBlock).level === 2
        ? 16
        : 14.5
      : 14);

  const currentFontFamily = (block as any).fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif';

  const isHighlighted = isSelected || isMultiSelected;

  let wrapperClass = isWordMode
    ? 'relative py-0 rounded-sm transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/30'
    : 'relative rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900/90 shadow-xs';

  if (isActiveSearchMatch) {
    wrapperClass = isWordMode
      ? 'relative z-30 py-0 rounded-sm ring-3 ring-amber-500 bg-amber-100/30 dark:bg-amber-950/40 shadow-md'
      : 'relative z-30 rounded-xl border-2 border-amber-500 ring-4 ring-amber-500/30 bg-amber-50/20 shadow-lg';
  } else if (isSearchMatch) {
    wrapperClass = isWordMode
      ? 'relative z-10 py-0 rounded-sm ring-1 ring-amber-400/80 bg-amber-50/15'
      : 'relative z-10 rounded-xl border border-amber-400/80 ring-2 ring-amber-400/20 bg-amber-50/10 shadow-xs';
  } else if (isHighlighted) {
    wrapperClass = isWordMode
      ? 'relative z-20 py-0 rounded-sm ring-2 ring-blue-500/70 bg-blue-50/25 dark:bg-blue-950/30'
      : 'relative z-20 rounded-xl border border-blue-500 ring-2 ring-blue-500/30 shadow-md bg-blue-50/10 dark:bg-zinc-900';
  } else if (diffType === 'added') {
    wrapperClass = 'relative py-0 border-l-4 border-emerald-500 bg-emerald-50/20 pl-2 rounded';
  } else if (diffType === 'modified') {
    wrapperClass = 'relative py-0 border-l-4 border-amber-500 bg-amber-50/20 pl-2 rounded';
  } else if (diffType === 'deleted') {
    wrapperClass = 'relative py-0 border-l-4 border-red-500 bg-red-50/20 pl-2 rounded opacity-60';
  }

  const updateSpacingTop = (delta: number) => {
    const next = Math.max(-60, Math.min(200, currentSpacingTop + delta));
    onUpdate({ spacingTop: next });
  };

  const setDirectSpacingTop = (val: number) => {
    onUpdate({ spacingTop: Math.max(-60, Math.min(200, val)) });
  };

  const updateFontSize = (delta: number) => {
    const next = Math.max(8, Math.min(48, currentFontSize + delta));
    onUpdate({ fontSize: next } as any);
  };

  const setAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    onUpdate({ alignment: align } as any);
  };

  const convertBlockType = (newType: 'h1' | 'h2' | 'h3' | 'paragraph') => {
    if (newType === 'paragraph') {
      onUpdate({
        type: 'paragraph',
        text: (block as any).text || '',
        bold: false,
        fontSize: 14
      } as any);
    } else {
      const level = newType === 'h1' ? 1 : newType === 'h2' ? 2 : 3;
      onUpdate({
        type: 'heading',
        level,
        text: (block as any).text || '',
        bold: true,
        fontSize: level === 1 ? 20 : level === 2 ? 16 : 14.5
      } as any);
    }
  };

  return (
    <div
      id={block.id}
      data-block-item="true"
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (onToggleSelect) {
            onToggleSelect(true);
          } else {
            onSelect(e);
          }
        } else {
          onSelect(e);
        }
      }}
      style={{
        marginTop: `${currentSpacingTop}px`,
        marginBottom: '0px'
      }}
      className={`group ${wrapperClass} scroll-mt-32`}
    >
      {/* Visual Top Gap Spacer Indicator (Only when clicked into the block and custom spacing is set) */}
      {currentSpacingTop !== 0 && isHighlighted && (
        <div
          className="w-full absolute -top-5 inset-x-0 h-5 flex items-center justify-center select-none z-20 pointer-events-auto"
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-blue-400/50" />
          <div className="relative z-10 flex items-center gap-1 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full text-[9px] font-mono shadow-xs">
            <span className="font-semibold">Distance from above: {currentSpacingTop}px</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSpacingTop(-2);
              }}
              className="hover:text-blue-800 font-bold px-0.5"
              title="Decrease gap (-2px)"
            >
              -
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSpacingTop(2);
              }}
              className="hover:text-blue-800 font-bold px-0.5"
              title="Increase gap (+2px)"
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDirectSpacingTop(0);
              }}
              className="text-slate-400 hover:text-red-500 pl-0.5 font-bold"
              title="Reset gap to 0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Floating Rich Formatting Toolbar (Appears ONLY when clicked into the box / selected) */}
      {isHighlighted && (
        <div
          className="absolute right-2 -top-12 sm:-top-13 z-50 flex items-center gap-1 px-3 py-1 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-300/90 dark:border-zinc-700 shadow-2xl text-xs select-none pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
        >
        {/* Selection Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSelect) {
              onToggleSelect(true);
            } else {
              onSelect(e);
            }
          }}
          title={isMultiSelected ? 'Deselect block (Part of Multi-Selection)' : 'Select block (Hold Shift/Ctrl for Multiple)'}
          className={`p-0.5 rounded flex items-center justify-center transition-colors ${
            isMultiSelected
              ? 'text-blue-600 font-bold'
              : 'text-slate-400 hover:text-blue-600'
          }`}
        >
          {isMultiSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-blue-600 fill-blue-50" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

        {/* Block Type & Heading Level Selector */}
        {isTextType ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                title="Change Text Style (H1, H2, H3, Paragraph)"
                className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-slate-100 hover:bg-blue-50 text-blue-700 dark:bg-zinc-800 dark:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <span>
                  {block.type === 'heading'
                    ? `H${(block as SecHeadingBlock).level || 1}`
                    : '¶'}
                </span>
                <span className="text-[9px] font-normal normal-case text-slate-500">
                  {block.type === 'heading'
                    ? `Heading ${(block as SecHeadingBlock).level}`
                    : 'Paragraph'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Text Style & Level
              </div>
              <DropdownMenuItem
                onClick={() => convertBlockType('h1')}
                className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#0E2841]">H1</span>
                  <span className="font-bold text-sm">Document Title (20pt)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => convertBlockType('h2')}
                className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0E2841]">H2</span>
                  <span className="font-bold text-xs">Statement Header (16pt)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => convertBlockType('h3')}
                className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0E2841]">H3</span>
                  <span className="font-semibold text-xs">Section Subtitle (14pt)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => convertBlockType('paragraph')}
                className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">¶</span>
                  <span>Standard Paragraph (14pt)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-[9px] font-mono uppercase font-bold text-slate-500 px-1">
            {block.type.replace('_', ' ')}
          </span>
        )}

        {/* Text Formatting Controls */}
        {isTextType && (
          <>
            <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

            {/* Font Family Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  title="Change Font Family"
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors max-w-[80px] truncate"
                >
                  {currentFontFamily.split(',')[0].replace(/"/g, '')}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44 p-1 text-xs">
                <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Font Family
                </div>
                {[
                  { name: 'Calibri (Word Standard)', family: 'Calibri, "Segoe UI", Arial, sans-serif' },
                  { name: 'Aptos (Modern Office)', family: 'Aptos, "Segoe UI", sans-serif' },
                  { name: 'Arial (Clean Sans)', family: 'Arial, Helvetica, sans-serif' },
                  { name: 'Times New Roman (Formal)', family: '"Times New Roman", Times, serif' },
                  { name: 'Georgia (Editorial)', family: 'Georgia, serif' },
                  { name: 'Garamond (Executive)', family: 'Garamond, "EB Garamond", serif' },
                  { name: 'Courier New (Monospace)', family: '"Courier New", Courier, monospace' }
                ].map((f) => (
                  <DropdownMenuItem
                    key={f.family}
                    onClick={() => onUpdate({ fontFamily: f.family } as any)}
                    className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
                    style={{ fontFamily: f.family }}
                  >
                    <span>{f.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Font Size Stepper & Dropdown */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded px-1 py-0.2 text-[9px] font-mono border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateFontSize(-1);
                }}
                title="Decrease font size (-1pt)"
                className="px-0.5 hover:text-blue-600 font-bold"
              >
                -
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    title="Font Size"
                    className="px-1 font-semibold text-slate-700 dark:text-zinc-200 hover:text-blue-600"
                  >
                    {currentFontSize}pt
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-28 p-1 text-xs">
                  <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                    Font Size
                  </div>
                  {[9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32].map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => onUpdate({ fontSize: size } as any)}
                      className={`text-xs py-1 cursor-pointer ${
                        currentFontSize === size ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                      }`}
                    >
                      <span>{size} pt</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateFontSize(1);
                }}
                title="Increase font size (+1pt)"
                className="px-0.5 hover:text-blue-600 font-bold"
              >
                +
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

            {/* Bold */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ bold: !isBold } as any);
              }}
              title="Toggle Bold"
              className={`p-1 rounded transition-colors ${
                isBold
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Bold className="w-3 h-3" />
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ italic: !isItalic } as any);
              }}
              title="Toggle Italic"
              className={`p-1 rounded transition-colors ${
                isItalic
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Italic className="w-3 h-3" />
            </button>

            {/* Underline */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ underline: !isUnderline } as any);
              }}
              title="Toggle Underline"
              className={`p-1 rounded transition-colors ${
                isUnderline
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Underline className="w-3 h-3" />
            </button>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

            {/* Link Cell from Attached Spreadsheet */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenCellPicker) {
                  onOpenCellPicker((cellRef, displayVal) => {
                    const token = `@${cellRef}{${displayVal}}`;
                    const curText = (block as any).text || (block as any).content || '';
                    if (block.type === 'heading' || block.type === 'paragraph') {
                      onUpdate({ text: curText ? `${curText} ${token}` : token } as any);
                    } else {
                      onUpdate({ content: curText ? `${curText} ${token}` : token } as any);
                    }
                  }, block.type === 'heading' ? (block as any).text : `${String(block.type).toUpperCase()} Block`);
                } else {
                  onOpenSpreadsheet?.();
                }
              }}
              title="Link a cell from the attached spreadsheet (e.g. @A1)"
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 transition-colors border border-emerald-300/80 shadow-2xs"
            >
              <Table2 className="w-3 h-3 text-emerald-600" />
              <span>Link Cell</span>
            </button>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

            {/* Direct Alignment Buttons (Left, Center, Right, Justify) */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded p-0.5 gap-0.5 border border-slate-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlignment('left');
                }}
                title="Align Left"
                className={`p-1 rounded transition-colors ${
                  currentAlign === 'left' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlignment('center');
                }}
                title="Align Center"
                className={`p-1 rounded transition-colors ${
                  currentAlign === 'center' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAlignment('right');
                }}
                title="Align Right"
                className={`p-1 rounded transition-colors ${
                  currentAlign === 'right' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                <AlignRight className="w-3 h-3" />
              </button>
              {block.type === 'paragraph' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlignment('justify');
                  }}
                  title="Justify"
                  className={`p-1 rounded transition-colors ${
                    currentAlign === 'justify' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700'
                  }`}
                >
                  <AlignJustify className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Font Color Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  title="Change Font Color"
                  className="p-1 rounded flex items-center gap-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 dark:border-zinc-700 shadow-2xs"
                    style={{ backgroundColor: currentColor }}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44 p-1.5 text-xs">
                <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Text Color
                </div>
                {[
                  { name: 'Corporate Navy', color: '#0E2841' },
                  { name: 'Charcoal Black', color: '#111827' },
                  { name: 'Muted Slate', color: '#64748B' },
                  { name: 'Executive Blue', color: '#2563EB' },
                  { name: 'Alert Red', color: '#DC2626' },
                  { name: 'Success Green', color: '#16A34A' },
                  { name: 'Warm Amber', color: '#B45309' }
                ].map((c) => (
                  <DropdownMenuItem
                    key={c.color}
                    onClick={() => onUpdate({ color: c.color } as any)}
                    className="flex items-center justify-between text-xs py-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="p-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Custom Color</span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => onUpdate({ color: e.target.value } as any)}
                    className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Picture / Image Specific Floating Controls */}
        {block.type === 'image' && (
          <>
            {/* Image Alignment */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded p-0.5 gap-0.5 border border-slate-200 dark:border-zinc-700">
              {(['left', 'center', 'right'] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ alignment: al } as any);
                  }}
                  title={`Align ${al.charAt(0).toUpperCase() + al.slice(1)}`}
                  className={`p-1 rounded transition-colors ${
                    ((block as SecImageBlock).alignment || 'center') === al
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700'
                  }`}
                >
                  {al === 'left' ? (
                    <AlignLeft className="w-3 h-3" />
                  ) : al === 'center' ? (
                    <AlignCenter className="w-3 h-3" />
                  ) : (
                    <AlignRight className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>

            {/* Image Width Presets */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded px-1 py-0.2 text-[9px] font-mono border border-slate-200 dark:border-zinc-700">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    title="Change Image Width"
                    className="px-1 font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>
                      {(block as SecImageBlock).width
                        ? `${(block as SecImageBlock).width}px`
                        : '260px'}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36 p-1 text-xs">
                  <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                    Picture Width
                  </div>
                  {[
                    { px: 120, label: '120px (Icon)' },
                    { px: 180, label: '180px (Small)' },
                    { px: 260, label: '260px (Standard Logo)' },
                    { px: 360, label: '360px (Medium)' },
                    { px: 480, label: '480px (Large)' },
                    { px: 650, label: '650px (Full Page)' }
                  ].map((w) => (
                    <DropdownMenuItem
                      key={w.px}
                      onClick={() => onUpdate({ width: w.px } as any)}
                      className={`text-xs py-1 cursor-pointer ${
                        ((block as SecImageBlock).width || 260) === w.px
                          ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50'
                          : ''
                      }`}
                    >
                      {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}

        <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

        {/* Top Spacing Gap Input with Label on top */}
        <div className="flex flex-col items-center justify-center px-2 py-0.5 bg-slate-100/90 dark:bg-zinc-800/90 rounded-md border border-slate-200/90 dark:border-zinc-700 shadow-2xs select-none">
          <span className="text-[8px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider leading-none mb-0.5 whitespace-nowrap">
            Top Spacing Gap
          </span>
          <div className="flex items-center gap-1 font-mono">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSpacingTop(-2);
              }}
              disabled={currentSpacingTop <= -60}
              title="Decrease top gap (-2px)"
              className="h-4 w-4 flex items-center justify-center rounded bg-slate-200/90 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-300 disabled:opacity-30 font-bold text-[10px]"
            >
              -
            </button>

            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 rounded px-1 h-5 shadow-2xs">
              <input
                type="text"
                inputMode="numeric"
                value={spacingInputText}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const raw = e.target.value;
                  // Allow empty or lone minus sign while typing negative numbers
                  if (raw === '' || raw === '-') {
                    setSpacingInputText(raw);
                    return;
                  }
                  if (/^-?\d*$/.test(raw)) {
                    setSpacingInputText(raw);
                    const val = parseInt(raw, 10);
                    if (!isNaN(val)) {
                      setDirectSpacingTop(val);
                    }
                  }
                }}
                onBlur={() => {
                  if (spacingInputText === '' || spacingInputText === '-') {
                    setSpacingInputText('0');
                    setDirectSpacingTop(0);
                  } else {
                    const parsed = parseInt(spacingInputText, 10);
                    if (!isNaN(parsed)) {
                      setSpacingInputText(String(parsed));
                      setDirectSpacingTop(parsed);
                    } else {
                      setSpacingInputText(String(currentSpacingTop));
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    updateSpacingTop(2);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    updateSpacingTop(-2);
                  } else if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-8 h-4 text-center font-bold text-[10px] text-blue-700 dark:text-blue-400 bg-transparent focus:outline-none"
                title="Write a number in pixels for top spacing gap (e.g. -10, 0, 16)"
              />
              <span className="text-[8px] text-slate-400 select-none">px</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSpacingTop(2);
              }}
              disabled={currentSpacingTop >= 200}
              title="Increase top gap (+2px)"
              className="h-4 w-4 flex items-center justify-center rounded bg-slate-200/90 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-300 disabled:opacity-30 font-bold text-[10px]"
            >
              +
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  title="Presets for Top Spacing Gap"
                  className="h-4 px-1 rounded bg-slate-200/60 dark:bg-zinc-700/60 hover:bg-slate-200 text-slate-600 dark:text-zinc-300 text-[9px] flex items-center gap-0.5 ml-0.5"
                >
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1 text-xs">
                <div className="px-2 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Top Spacing Gap Presets
                </div>
                {[
                  { px: -10, label: '-10px', desc: 'Pull up (-10px)' },
                  { px: -6, label: '-6px', desc: 'Close tuck (-6px)' },
                  { px: -4, label: '-4px', desc: 'Tuck under above' },
                  { px: -2, label: '-2px', desc: 'Very close (Subtitle)' },
                  { px: 0, label: '0px', desc: 'Flush (0 distance)' },
                  { px: 2, label: '2px', desc: 'Hairline distance' },
                  { px: 4, label: '4px', desc: 'Tight text distance' },
                  { px: 6, label: '6px', desc: 'Close distance' },
                  { px: 8, label: '8px', desc: 'Normal distance' },
                  { px: 12, label: '12px', desc: 'Moderate gap' },
                  { px: 16, label: '16px', desc: 'Section gap' },
                  { px: 24, label: '24px', desc: 'Large gap' }
                ].map((opt) => (
                  <DropdownMenuItem
                    key={opt.px}
                    onClick={() => setDirectSpacingTop(opt.px)}
                    className={`flex items-center justify-between text-xs py-1 cursor-pointer ${
                      currentSpacingTop === opt.px ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] text-slate-400">{opt.desc}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          title="Move Up in Document"
          className="h-5 w-5 text-slate-500 hover:text-blue-600 disabled:opacity-20"
        >
          <ChevronUp className="w-3 h-3" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={index === totalBlocks - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          title="Move Down in Document"
          className="h-5 w-5 text-slate-500 hover:text-blue-600 disabled:opacity-20"
        >
          <ChevronDown className="w-3 h-3" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate Block"
          className="h-5 w-5 text-slate-500 hover:text-blue-600"
        >
          <Copy className="w-3 h-3" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete Block"
          className="h-5 w-5 text-slate-500 hover:text-red-600"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      )}

      {/* Block Content Editor */}
      <div className="w-full">
            {block.type === 'heading' && (
              <HeadingBlockEditor
                block={block as SecHeadingBlock}
                onUpdate={(u) => onUpdate(u)}
                attachedSpreadsheet={safeSpreadsheet}
                onOpenSpreadsheet={onOpenSpreadsheet}
                onOpenCellPicker={onOpenCellPicker}
                searchQuery={searchQuery}
              />
            )}

            {block.type === 'paragraph' && (
              <ParagraphBlockEditor
                block={block as SecParagraphBlock}
                onUpdate={(u) => onUpdate(u)}
                attachedSpreadsheet={safeSpreadsheet}
                onOpenSpreadsheet={onOpenSpreadsheet}
                onOpenCellPicker={onOpenCellPicker}
                searchQuery={searchQuery}
              />
            )}

            {block.type === 'financial_table' && (
              <FinancialTableBlockEditor
                block={block as SecFinancialTableBlock}
                onUpdate={onUpdate}
                isSelected={isHighlighted}
                tableTemplates={tableTemplates}
                tableCellDiffs={tableCellDiffs}
                attachedSpreadsheet={safeSpreadsheet}
                onOpenSpreadsheet={onOpenSpreadsheet}
                onOpenCellPicker={onOpenCellPicker}
                searchQuery={searchQuery}
              />
            )}

            {block.type === 'callout' && (
              <CalloutBlockEditor
                block={block as SecCalloutBlock}
                onUpdate={(u) => onUpdate(u)}
                attachedSpreadsheet={safeSpreadsheet}
                onOpenSpreadsheet={onOpenSpreadsheet}
                onOpenCellPicker={onOpenCellPicker}
                searchQuery={searchQuery}
              />
            )}

        {block.type === 'signature' && (
          <SignatureBlockEditor
            block={block as SecSignatureBlock}
            onUpdate={onUpdate}
          />
        )}

        {block.type === 'divider' && (
          <DividerBlockEditor
            block={block as SecDividerBlock}
            onUpdate={(u) => onUpdate(u)}
          />
        )}

        {block.type === 'metadata' && (
          <MetadataBlockEditor
            block={block as SecMetadataBlock}
            onUpdate={(u) => onUpdate(u)}
            isWordMode={isWordMode}
          />
        )}

        {block.type === 'image' && (
          <ImageBlockEditor
            block={block as SecImageBlock}
            onUpdate={(u) => onUpdate(u)}
          />
        )}
      </div>
    </div>
  );
};

export const BlockItem = React.memo(BlockItemComponent, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.tableTemplates === next.tableTemplates &&
    prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.diffType === next.diffType &&
    prev.tableCellDiffs === next.tableCellDiffs &&
    prev.viewMode === next.viewMode &&
    prev.globalSpacing === next.globalSpacing &&
    prev.index === next.index &&
    prev.totalBlocks === next.totalBlocks &&
    prev.attachedSpreadsheet === next.attachedSpreadsheet &&
    prev.searchQuery === next.searchQuery &&
    prev.isActiveSearchMatch === next.isActiveSearchMatch &&
    prev.isSearchMatch === next.isSearchMatch
  );
});

/* ------------------------------------------------------------------------- */
/* 1. HEADING BLOCK EDITOR                                                   */
/* ------------------------------------------------------------------------- */
const HeadingBlockEditor: React.FC<{
  block: SecHeadingBlock;
  onUpdate: (u: Partial<SecHeadingBlock>) => void;
  attachedSpreadsheet?: AttachedSpreadsheet;
  onOpenSpreadsheet?: () => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
}> = ({ block, onUpdate, attachedSpreadsheet, onOpenSpreadsheet, onOpenCellPicker, searchQuery }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localText, setLocalText] = useState(block.text);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setLocalText(block.text);
  }, [block.text]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleInsertSpreadsheetCell = () => {
    if (!onOpenCellPicker) {
      onOpenSpreadsheet?.();
      return;
    }
    const el = textareaRef.current;
    const start = el ? el.selectionStart : localText.length;
    const end = el ? el.selectionEnd : localText.length;

    onOpenCellPicker((cellRef, displayVal) => {
      const token = `@${cellRef}{${displayVal}}`;
      const before = localText.substring(0, start);
      const after = localText.substring(end);
      const nextText = `${before}${token}${after}`;
      setLocalText(nextText);
      onUpdate({ text: nextText });

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const nextPos = start + token.length;
          textareaRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 50);
    }, block.text || 'Heading Block');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: val });
    }, 250);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (localText !== block.text) {
      onUpdate({ text: localText });
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localText, block.fontSize, block.fontFamily]);

  const defaultFontSize =
    block.level === 1 ? 20 : block.level === 2 ? 16 : block.level === 3 ? 14.5 : 13.5;
  const effectiveFontSize = block.fontSize || defaultFontSize;
  const hasVariables = /@[A-Za-z]{1,3}\d{1,4}/.test(localText);

  return (
    <div className="group/head relative m-0 p-0">
      <div className="relative">
        {(hasVariables || (searchQuery && searchQuery.trim())) && !isFocused ? (
          <div
            onClick={() => {
              setIsFocused(true);
              setTimeout(() => {
                textareaRef.current?.focus();
              }, 20);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            style={{
              color: block.color || '#0E2841',
              fontFamily: block.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              textAlign: block.alignment || 'left',
              textDecoration: block.underline ? 'underline' : 'none',
              fontStyle: block.italic ? 'italic' : 'normal',
              fontWeight: block.bold !== false ? 'bold' : 'normal',
              lineHeight: block.lineSpacing ? `${block.lineSpacing}` : '1.2'
            }}
            className="w-full min-h-[24px] cursor-text rounded px-1 py-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors m-0"
            title="Click to edit heading text"
          >
            <DocumentVariableRenderer
              text={localText}
              spreadsheet={attachedSpreadsheet}
              highlightQuery={searchQuery}
              onInspectCell={onOpenSpreadsheet}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            rows={1}
            value={localText}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              handleBlur();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            placeholder="Section Title..."
            style={{
              color: block.color || '#0E2841',
              fontFamily: block.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              textAlign: block.alignment || 'left',
              textDecoration: block.underline ? 'underline' : 'none',
              fontStyle: block.italic ? 'italic' : 'normal',
              fontWeight: block.bold !== false ? 'bold' : 'normal',
              lineHeight: block.lineSpacing ? `${block.lineSpacing}` : '1.2'
            }}
            className="w-full bg-transparent border-none focus:outline-none focus:bg-blue-50/20 dark:focus:bg-blue-950/20 rounded px-1 py-0 transition-colors resize-none overflow-hidden m-0 p-0"
          />
        )}

        {/* Right-click Floating Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 px-1 min-w-[210px] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleInsertSpreadsheetCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/50 text-left font-medium text-slate-800 dark:text-zinc-200 transition-colors"
            >
              <Table2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Link Cell from Spreadsheet...</span>
            </button>
            {onOpenSpreadsheet && (
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  onOpenSpreadsheet();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-600 dark:text-zinc-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Open Spreadsheet Editor</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 2. PARAGRAPH BLOCK EDITOR (Word Body Text)                                */
/* ------------------------------------------------------------------------- */
const ParagraphBlockEditor: React.FC<{
  block: SecParagraphBlock;
  onUpdate: (u: Partial<SecParagraphBlock>) => void;
  attachedSpreadsheet?: AttachedSpreadsheet;
  onOpenSpreadsheet?: () => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
}> = ({ block, onUpdate, attachedSpreadsheet, onOpenSpreadsheet, onOpenCellPicker, searchQuery }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localText, setLocalText] = useState(block.text);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setLocalText(block.text);
  }, [block.text]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleInsertSpreadsheetCell = () => {
    if (!onOpenCellPicker) {
      onOpenSpreadsheet?.();
      return;
    }
    const el = textareaRef.current;
    const start = el ? el.selectionStart : localText.length;
    const end = el ? el.selectionEnd : localText.length;

    onOpenCellPicker((cellRef, displayVal) => {
      const token = `@${cellRef}{${displayVal}}`;
      const before = localText.substring(0, start);
      const after = localText.substring(end);
      const nextText = `${before}${token}${after}`;
      setLocalText(nextText);
      onUpdate({ text: nextText });

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const nextPos = start + token.length;
          textareaRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 50);
    }, 'Paragraph Block');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: val });
    }, 250);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (localText !== block.text) {
      onUpdate({ text: localText });
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localText, block.fontSize, block.fontFamily]);

  const effectiveFontSize = block.fontSize || 14;
  const hasVariables = /@[A-Za-z]{1,3}\d{1,4}/.test(localText);

  return (
    <div className="relative group/p m-0 p-0">
      <div className="relative">
        {(hasVariables || (searchQuery && searchQuery.trim())) && !isFocused ? (
          <div
            onClick={() => {
              setIsFocused(true);
              setTimeout(() => {
                textareaRef.current?.focus();
              }, 20);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            style={{
              color: block.color || (block.bold ? '#0E2841' : '#111827'),
              fontFamily: block.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              textAlign: block.alignment || 'left',
              textDecoration: block.underline ? 'underline' : 'none',
              fontStyle: block.italic ? 'italic' : 'normal',
              fontWeight: block.bold ? 'bold' : 'normal',
              lineHeight: block.lineSpacing ? `${block.lineSpacing}` : '1.3'
            }}
            className="w-full min-h-[24px] cursor-text rounded px-1 py-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors m-0"
            title="Click to edit paragraph text"
          >
            <DocumentVariableRenderer
              text={localText}
              spreadsheet={attachedSpreadsheet}
              highlightQuery={searchQuery}
              onInspectCell={onOpenSpreadsheet}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            rows={1}
            value={localText}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              handleBlur();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            placeholder="Enter document paragraph text... (Right-click or use toolbar to link spreadsheet cell)"
            style={{
              color: block.color || (block.bold ? '#0E2841' : '#111827'),
              fontFamily: block.fontFamily || 'Calibri, "Segoe UI", Arial, sans-serif',
              fontSize: `${effectiveFontSize}px`,
              textAlign: block.alignment || 'left',
              textDecoration: block.underline ? 'underline' : 'none',
              fontStyle: block.italic ? 'italic' : 'normal',
              fontWeight: block.bold ? 'bold' : 'normal',
              lineHeight: block.lineSpacing ? `${block.lineSpacing}` : '1.3'
            }}
            className="w-full bg-transparent border-none focus:outline-none focus:bg-blue-50/15 dark:focus:bg-blue-950/20 rounded px-1 py-0 transition-colors resize-none overflow-hidden m-0 p-0"
          />
        )}

        {/* Floating Quick Action Button on Hover */}
        <div className="absolute top-0 right-1 opacity-0 group-hover/p:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleInsertSpreadsheetCell}
            title="Right-click anywhere in text or click here to link a cell from the attached spreadsheet"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 rounded border border-emerald-300/80 shadow-2xs transition-all"
          >
            <Table2 className="w-3 h-3 text-emerald-600" />
            <span>Link Cell</span>
          </button>
        </div>

        {/* Right-click Floating Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 px-1 min-w-[210px] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleInsertSpreadsheetCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/50 text-left font-medium text-slate-800 dark:text-zinc-200 transition-colors"
            >
              <Table2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Link Cell from Spreadsheet...</span>
            </button>
            {onOpenSpreadsheet && (
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  onOpenSpreadsheet();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-600 dark:text-zinc-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Open Spreadsheet Editor</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* TableCellInput: renders cell input with local state for instant 0ms typing feedback, debounced commit, and spreadsheet linking */
const TableCellInput: React.FC<{
  initialValue: string;
  onCommit: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  onFocus?: () => void;
  attachedSpreadsheet?: AttachedSpreadsheet;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  onOpenSpreadsheet?: () => void;
  rowIdx?: number;
  colIdx?: number;
  tableName?: string;
  searchQuery?: string;
}> = ({
  initialValue,
  onCommit,
  placeholder,
  style,
  className,
  title,
  onFocus,
  attachedSpreadsheet,
  onOpenCellPicker,
  onOpenSpreadsheet,
  rowIdx,
  colIdx,
  tableName,
  searchQuery
}) => {
  const [val, setVal] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setVal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCommit(next);
    }, 200);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val !== initialValue) {
      onCommit(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (val !== initialValue) {
        onCommit(val);
      }
    }
  };

  const isVariable = hasDocumentVariables(val);
  const displayValue = !isFocused && isVariable && attachedSpreadsheet
    ? interpolateVariables(val, attachedSpreadsheet)
    : val;

  const handleLinkCell = () => {
    if (!onOpenCellPicker) {
      onOpenSpreadsheet?.();
      return;
    }
    const cellLocation = `${tableName ? `"${tableName}" ` : ''}Cell R${(rowIdx ?? 0) + 1}:C${(colIdx ?? 0) + 1}`;
    onOpenCellPicker((cellRef, displayVal) => {
      const token = cellRef.startsWith('@')
        ? cellRef
        : `@${cellRef}${displayVal ? `{${displayVal}}` : ''}`;
      setVal(token);
      onCommit(token);
      toast.success(`Linked ${token} to ${cellLocation}!`);
    }, cellLocation);
  };

  const handleUnlinkCell = () => {
    const staticVal = attachedSpreadsheet ? interpolateVariables(val, attachedSpreadsheet) : val;
    setVal(staticVal);
    onCommit(staticVal);
    toast.info(`Unlinked formula. Value set to static "${staticVal}".`);
  };

  // Extract clean cell reference for hover tooltip (e.g. "@'06.30.26 TB'!B8" or "@B8")
  const cellRefMatch = val.match(/@(?:(?:'([^']+)'|([A-Za-z0-9_.\- ]+?))!)?([A-Za-z]{1,3}\d{1,4})/i);
  const hoverCellRef = cellRefMatch
    ? (cellRefMatch[1] || cellRefMatch[2] ? `'${cellRefMatch[1] || cellRefMatch[2]}'!${cellRefMatch[3].toUpperCase()}` : cellRefMatch[3].toUpperCase())
    : val;

  // Check if cell content matches the active search query
  const trimmedQ = searchQuery?.trim().toLowerCase();
  const isCellSearchMatch = Boolean(
    trimmedQ &&
    displayValue &&
    (
      displayValue.toLowerCase().includes(trimmedQ) ||
      (val && val.toLowerCase().includes(trimmedQ)) ||
      (
        trimmedQ.replace(/[$,\s]/g, '').length >= 2 &&
        displayValue.replace(/[$,\s]/g, '').includes(trimmedQ.replace(/[$,\s]/g, ''))
      )
    )
  );

  return (
    <div className="relative w-full group/cell">
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        placeholder={placeholder}
        style={style}
        className={`${className} ${
          isCellSearchMatch
            ? 'ring-2 ring-amber-400 bg-amber-100/80 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 font-bold'
            : isVariable && !isFocused
            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-b border-emerald-500/80 font-semibold'
            : ''
        }`}
        title={
          isVariable
            ? `Linked Cell: @${hoverCellRef} (Live Value: ${displayValue})\nClick to edit, right-click to unlink/change`
            : title || 'Right-click to link a spreadsheet cell'
        }
      />

      {/* Interactive FX formula badge when linked */}
      {isVariable && !isFocused && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleLinkCell();
          }}
          title={`Linked Cell: @${hoverCellRef}\nClick to change linked spreadsheet cell\nRight-click to unlink`}
          className="absolute -top-1.5 right-0 text-[8px] font-mono font-bold px-1 py-0 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-300/80 shadow-2xs cursor-pointer z-10"
        >
          fx
        </button>
      )}

      {/* Quick link button on hover or focus if cell is not yet linked */}
      {!isVariable && isFocused && onOpenCellPicker && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleLinkCell();
          }}
          title="Link cell from spreadsheet"
          className="absolute -top-2 right-0 text-[8px] font-mono font-bold px-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 shadow-2xs cursor-pointer z-10 flex items-center gap-0.5"
        >
          <Table2 className="w-2.5 h-2.5 text-emerald-600" />
          <span>fx</span>
        </button>
      )}

      {/* Right-click Floating Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 px-1 min-w-[220px] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
            Table Cell {rowIdx !== undefined && colIdx !== undefined ? `(Row ${rowIdx + 1}, Col ${colIdx + 1})` : ''}
          </div>
          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              handleLinkCell();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/50 text-left font-medium text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            <Table2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isVariable ? 'Change Linked Cell...' : 'Link Cell from Spreadsheet...'}</span>
          </button>
          {isVariable && (
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleUnlinkCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/50 text-left text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <Unlink className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Unlink (Keep as static text)</span>
            </button>
          )}
          {onOpenSpreadsheet && (
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onOpenSpreadsheet();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Open Spreadsheet Manager</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 3. FINANCIAL STATEMENT TABLE EDITOR (Authentic Word Financial Table)       */
/* ------------------------------------------------------------------------- */
const FinancialTableBlockEditor: React.FC<{
  block: SecFinancialTableBlock;
  onUpdate: (u: Partial<SecFinancialTableBlock>) => void;
  isSelected?: boolean;
  tableTemplates?: FinancialTableTemplate[];
  tableCellDiffs?: SecTableCellDiff[];
  attachedSpreadsheet?: AttachedSpreadsheet;
  onOpenSpreadsheet?: () => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
}> = ({
  block,
  onUpdate,
  isSelected = false,
  tableTemplates = FINANCIAL_TABLE_TEMPLATES,
  tableCellDiffs = [],
  attachedSpreadsheet,
  onOpenSpreadsheet,
  onOpenCellPicker,
  searchQuery
}) => {
  const updateTemplateMutation = useUpdateFinancialTableTemplate();
  const [draggedRowIdx, setDraggedRowIdx] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [templateModalMode, setTemplateModalMode] = useState<'create' | 'update'>('create');
  const [templateModalInitialId, setTemplateModalInitialId] = useState<string | undefined>(undefined);

  const cellDiffMap = useMemo(() => {
    const map = new Map<string, SecTableCellDiff>();
    if (tableCellDiffs && tableCellDiffs.length > 0) {
      for (const cd of tableCellDiffs) {
        map.set(`${cd.rowIndex}_${cd.colIndex}`, cd);
      }
    }
    return map;
  }, [tableCellDiffs]);

  const matchedTemplate = useMemo(() => {
    return findMatchingTemplate(tableTemplates, undefined, block.title);
  }, [tableTemplates, block.title]);

  const openCreateTemplateModal = () => {
    setTemplateModalMode('create');
    setTemplateModalInitialId(undefined);
    setIsTemplateModalOpen(true);
  };

  const openUpdateTemplateModal = (templateId?: string) => {
    setTemplateModalMode('update');
    setTemplateModalInitialId(templateId || matchedTemplate?.id);
    setIsTemplateModalOpen(true);
  };

  const handleDirectQuickUpdate = async (tpl: FinancialTableTemplate) => {
    try {
      const sanitized = sanitizeTableBlock(block);
      await updateTemplateMutation.mutateAsync({
        id: tpl.id,
        payload: {
          name: tpl.name,
          badge: tpl.badge,
          description: tpl.description,
          block: sanitized
        }
      });
      toast.success(`Template "${tpl.name}" updated successfully!`, {
        description: `Layout overwritten with active table (${block.headers.length} cols, ${block.rows.length} rows).`
      });
    } catch (err: any) {
      console.error('Failed to quick-update template:', err);
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to update template.');
    }
  };
  const [dragOverRowIdx, setDragOverRowIdx] = useState<number | null>(null);
  const [openRowMenuIdx, setOpenRowMenuIdx] = useState<number | null>(null);
  // Column of the cell the user last clicked into, so the toolbar can align "that
  // one column" without making them hunt through the column header menu.
  const [activeColIdx, setActiveColIdx] = useState<number | null>(null);

  const sanitizedBlockIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Only sanitize once per table block identity, not continuously during typing
    if (sanitizedBlockIdRef.current === block.id) return;
    sanitizedBlockIdRef.current = block.id;

    let needsUpdate = false;
    // Template header fills are part of the saved layout. Do not normalise the
    // standard financial-statement blues away when a database template is read.
    const nextHeaderShading = block.headerShading;

    const nextRows = block.rows.map((r, rIdx) => {
      const isCategory = r.type === 'category_header' || r.type === 'section_title';
      const isDateHeaderRow = !isCategory && (r.type === 'header' || r.cells.some((c, cIdx) => isComparativeDateHeaderCell(c, rIdx, cIdx)));
      const isMajorHeaderRow = !isCategory && r.cells.some(c => isMajorStatementHeaderCell(c));
      const isHeaderLikeRow = !isCategory && (r.type === 'header' || isDateHeaderRow || isMajorHeaderRow);
      if (isMajorHeaderRow && (r.type !== 'header' || r.shading || (r.indent && r.indent > 1))) {
        needsUpdate = true;
        const copy = { ...r, type: 'header' as const, bold: true };
        delete copy.shading;
        if (copy.indent && copy.indent > 1) {
          copy.indent = 1;
        }
        return copy;
      }
      if (isHeaderLikeRow && r.shading) {
        needsUpdate = true;
        const copy = { ...r };
        delete copy.shading;
        return copy;
      }
      return r;
    });

    const hasSplitParens = nextRows.some(r => r.cells.some(c => c.trim() === ')' || (c.trim().startsWith('(') && !c.trim().endsWith(')'))));
    const hasGhostCols = block.headers.length > 5 && block.headers.some(h => /^Col\s*\d+$/i.test(h.trim()) || h.trim() === '');

    if (hasSplitParens || hasGhostCols) {
      const compacted = compactFinancialTableBlock({ ...block, rows: nextRows, headerShading: nextHeaderShading } as any) as SecFinancialTableBlock;
      onUpdate(compacted);
      return;
    }

    if (needsUpdate) {
      onUpdate({
        headerShading: nextHeaderShading,
        rows: nextRows
      });
    }
  }, [block.id]);

  /**
   * Rebuilds this table from one of the standard statement layouts. Row ids are
   * regenerated so a template applied to several tables does not collide, and the
   * block's own id/type/section are left untouched so the block stays in place.
   */
  const applyTableTemplate = React.useCallback((templateId: string) => {
    const template = tableTemplates.find((t) => t.id === templateId);
    if (!template) return;

    const tpl = template.block;
    const stamp = Date.now();
    onUpdate({
      title: tpl.title ?? block.title,
      headers: [...(tpl.headers || block.headers)],
      headerShading: tpl.headerShading,
      periodHeaders: tpl.periodHeaders?.map((header) => ({
        ...header,
        lines: [...header.lines]
      })),
      columnAlignments: [...(tpl.columnAlignments || block.columnAlignments)],
      columnWidths: tpl.columnWidths ? [...tpl.columnWidths] : undefined,
      rows: (tpl.rows || []).map((r, rIdx) => ({
        ...r,
        cells: [...r.cells],
        ...(r.cellAlignments ? { cellAlignments: [...r.cellAlignments] } : {}),
        id: `r-${stamp}-${rIdx}-${Math.random().toString(36).substring(2, 6)}`
      })),
      footnotes: tpl.footnotes ? [...tpl.footnotes] : undefined
    });
  }, [tableTemplates, block.title, block.headers, block.columnAlignments, onUpdate]);

  const reorderRow = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= block.rows.length) return;
    const nextRows = [...block.rows];
    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);
    onUpdate({ rows: nextRows });
  };
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = [...block.rows];
    const targetRow = { ...nextRows[rowIndex] };
    const nextCells = [...targetRow.cells];
    nextCells[colIndex] = value;
    targetRow.cells = nextCells;
    nextRows[rowIndex] = targetRow;
    onUpdate({ rows: nextRows });
  };

  const handleHeaderChange = (colIndex: number, value: string) => {
    const nextHeaders = [...block.headers];
    nextHeaders[colIndex] = value;
    onUpdate({ headers: nextHeaders });
  };

  const addRow = (type: SecTableRow['type'] = 'data') => {
    addRowAt(block.rows.length, type);
  };

  const addRowAt = (targetIdx: number, type: SecTableRow['type'] = 'data') => {
    const newRow: SecTableRow = {
      id: `r-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      cells: block.headers.map(() => ''),
      bold: type === 'total' || type === 'section_title' || type === 'category_header',
      doubleUnderline: type === 'total',
      underline: type === 'subtotal' || type === 'total',
      shading: (type === 'section_title' || type === 'category_header') ? '#DAE9F7' : undefined
    };
    const nextRows = [...block.rows];
    const safeIdx = Math.max(0, Math.min(targetIdx, nextRows.length));
    nextRows.splice(safeIdx, 0, newRow);
    onUpdate({ rows: nextRows });
  };

  const moveRow = (rowIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && rowIndex === 0) return;
    if (direction === 'down' && rowIndex === block.rows.length - 1) return;
    const targetIdx = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    const nextRows = [...block.rows];
    const [moved] = nextRows.splice(rowIndex, 1);
    nextRows.splice(targetIdx, 0, moved);
    onUpdate({ rows: nextRows });
  };

  const duplicateRow = (rowIndex: number) => {
    const source = block.rows[rowIndex];
    const duplicated: SecTableRow = {
      ...source,
      id: `r-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      cells: [...source.cells]
    };
    const nextRows = [...block.rows];
    nextRows.splice(rowIndex + 1, 0, duplicated);
    onUpdate({ rows: nextRows });
  };

  const deleteRow = (rowIndex: number) => {
    const nextRows = block.rows.filter((_, i) => i !== rowIndex);
    onUpdate({ rows: nextRows });
  };

  const addColumn = () => {
    addColumnAt(block.headers.length, `Col ${block.headers.length + 1}`, 'right');
  };

  const addColumnAt = (
    targetIdx: number,
    headerName = 'New Period ($)',
    align: 'left' | 'center' | 'right' = 'right'
  ) => {
    const nextHeaders = [...block.headers];
    const nextAligns = [...block.columnAlignments];
    const safeIdx = Math.max(0, Math.min(targetIdx, nextHeaders.length));

    nextHeaders.splice(safeIdx, 0, headerName);
    nextAligns.splice(safeIdx, 0, align);

    const nextRows = block.rows.map((r) => {
      const nextCells = [...r.cells];
      nextCells.splice(safeIdx, 0, '');
      return { ...r, cells: nextCells };
    });

    onUpdate({
      headers: nextHeaders,
      columnAlignments: nextAligns,
      rows: nextRows
    });
  };

  const moveColumn = (colIndex: number, direction: 'left' | 'right') => {
    if (direction === 'left' && colIndex === 0) return;
    if (direction === 'right' && colIndex === block.headers.length - 1) return;
    const targetIdx = direction === 'left' ? colIndex - 1 : colIndex + 1;

    const nextHeaders = [...block.headers];
    const [movedHeader] = nextHeaders.splice(colIndex, 1);
    nextHeaders.splice(targetIdx, 0, movedHeader);

    const nextAligns = [...block.columnAlignments];
    const [movedAlign] = nextAligns.splice(colIndex, 1);
    nextAligns.splice(targetIdx, 0, movedAlign);

    const nextRows = block.rows.map((r) => {
      const nextCells = [...r.cells];
      const [movedCell] = nextCells.splice(colIndex, 1);
      nextCells.splice(targetIdx, 0, movedCell);
      return { ...r, cells: nextCells };
    });

    onUpdate({
      headers: nextHeaders,
      columnAlignments: nextAligns,
      rows: nextRows
    });
  };

  const duplicateColumn = (colIndex: number) => {
    const nextHeaders = [...block.headers];
    const nextAligns = [...block.columnAlignments];
    const currentHeader = block.headers[colIndex];
    const currentAlign = block.columnAlignments[colIndex] || 'right';

    nextHeaders.splice(colIndex + 1, 0, `${currentHeader} (Copy)`);
    nextAligns.splice(colIndex + 1, 0, currentAlign);

    const nextRows = block.rows.map((r) => {
      const nextCells = [...r.cells];
      nextCells.splice(colIndex + 1, 0, r.cells[colIndex] || '');
      return { ...r, cells: nextCells };
    });

    onUpdate({
      headers: nextHeaders,
      columnAlignments: nextAligns,
      rows: nextRows
    });
  };

  const deleteColumn = (colIndex: number) => {
    if (block.headers.length <= 1) {
      return;
    }
    const nextHeaders = block.headers.filter((_, i) => i !== colIndex);
    const nextAligns = block.columnAlignments.filter((_, i) => i !== colIndex);
    const nextRows = block.rows.map((r) => ({
      ...r,
      cells: r.cells.filter((_, i) => i !== colIndex)
    }));
    onUpdate({
      headers: nextHeaders,
      columnAlignments: nextAligns,
      rows: nextRows
    });
  };

  const setColumnAlignment = (colIndex: number, align: 'left' | 'center' | 'right') => {
    const nextAligns = [...block.columnAlignments];
    nextAligns[colIndex] = align;
    onUpdate({ columnAlignments: nextAligns });
  };

  const toggleRowIndent = (rowIndex: number) => {
    const nextRows = [...block.rows];
    const r = { ...nextRows[rowIndex] };
    const isHeaderRow = r.type === 'header' || r.cells.some(c => isMajorStatementHeaderCell(c));
    const maxIndent = isHeaderRow ? 1 : 3;
    const current = r.indent || 0;
    r.indent = current >= maxIndent ? 0 : current + 1;
    nextRows[rowIndex] = r;
    onUpdate({ rows: nextRows });
  };

  /** Sets or clears a row's background fill. `undefined` means no fill (white). */
  const setRowShading = (rowIndex: number, shading?: string) => {
    const nextRows = [...block.rows];
    const r = { ...nextRows[rowIndex] };
    if (shading) {
      r.shading = shading;
    } else {
      delete r.shading;
    }
    nextRows[rowIndex] = r;
    onUpdate({ rows: nextRows });
  };

  /** Sets or clears a single cell's alignment override (e.g. Row 5, Col 2 centered). `undefined` resets to row/column default. */
  const setCellAlignment = (rowIndex: number, colIndex: number, align?: 'left' | 'center' | 'right') => {
    const nextRows = [...block.rows];
    const r = { ...nextRows[rowIndex] };
    const nextCellAlignments = r.cellAlignments ? [...r.cellAlignments] : [];
    while (nextCellAlignments.length <= colIndex) {
      nextCellAlignments.push(undefined);
    }
    if (align) {
      nextCellAlignments[colIndex] = align;
    } else {
      nextCellAlignments[colIndex] = undefined;
    }
    if (nextCellAlignments.every((a) => !a)) {
      delete r.cellAlignments;
    } else {
      r.cellAlignments = nextCellAlignments;
    }
    nextRows[rowIndex] = r;
    onUpdate({ rows: nextRows });
  };

  /** Sets or clears a per-row alignment override. `undefined` falls back to the column. */
  const setRowAlignment = (rowIndex: number, align: SecTableRow['align']) => {
    const nextRows = [...block.rows];
    const r = { ...nextRows[rowIndex] };
    if (align) {
      r.align = align;
    } else {
      delete r.align;
    }
    nextRows[rowIndex] = r;
    onUpdate({ rows: nextRows });
  };

  const setRowType = (rowIndex: number, type: SecTableRow['type']) => {
    const nextRows = [...block.rows];
    const r = { ...nextRows[rowIndex] };
    r.type = type;
    r.bold = type === 'total' || type === 'section_title' || type === 'category_header' || type === 'header';
    r.doubleUnderline = type === 'total';
    r.underline = type === 'subtotal' || type === 'total';
    if (type === 'header') {
      if (r.indent && r.indent > 1) {
        r.indent = 1;
      }
      delete r.shading;
    } else if (type === 'section_title' || type === 'category_header') {
      r.shading = '#DAE9F7';
      r.indent = 0;
      r.cells = r.cells.map((c, i) => i === 0 ? c : (c.trim() === '-' ? '' : c));
    } else if (r.shading === '#DAE9F7') {
      r.shading = undefined;
    }
    nextRows[rowIndex] = r;
    onUpdate({ rows: nextRows });
  };

  // Memoize row-level classification to avoid running 1,200 regexes per render
  const rowMetadata = useMemo(() => {
    return block.rows.map((row, rowIdx) => {
      const isSection = row.type === 'section_title' || row.type === 'category_header';
      const isDateHeaderRow =
        !isSection && row.cells.some((c, cIdx) => cIdx > 0 && isComparativeDateHeaderCell(c, rowIdx, cIdx));
      const isMajorHeaderRow = !isSection && row.cells.some((c) => isMajorStatementHeaderCell(c));
      const isHeaderLikeRow = !isSection && (row.type === 'header' || isDateHeaderRow || isMajorHeaderRow);
      const isTotal = row.type === 'total' || row.doubleUnderline;
      const isSubtotal = row.type === 'subtotal';

      const cellMeta = row.cells.map((cellValue, colIdx) => {
        const isDateHeader = !isSection && isComparativeDateHeaderCell(cellValue, rowIdx, colIdx);
        const isMajorHeader = !isSection && (isMajorStatementHeaderCell(cellValue) || (isMajorHeaderRow && colIdx === 0));
        const isFirst = colIdx === 0;
        // An explicit per-cell alignment override wins over row alignment, header auto-centering, and column default.
        const cellAlignOverride = row.cellAlignments?.[colIdx];
        const align = cellAlignOverride
          ? cellAlignOverride
          : row.align
          ? row.align
          : isDateHeader || isMajorHeader || ((row.type === 'header' || isMajorHeaderRow) && isFirst)
          ? 'center'
          : block.columnAlignments[colIdx] || 'left';
        const maxAllowedIndent = (row.type === 'header' || isMajorHeaderRow) ? 1 : 3;
        const effectiveIndent = Math.min(row.indent || 0, maxAllowedIndent);
        const indentPadding =
          isFirst && effectiveIndent
            ? effectiveIndent === 1
              ? 'pl-6'
              : effectiveIndent === 2
              ? 'pl-10'
              : 'pl-14'
            : 'pl-1.5';
        return { isDateHeader, isMajorHeader, isFirst, align, indentPadding };
      });

      return {
        isDateHeaderRow,
        isMajorHeaderRow,
        isHeaderLikeRow,
        isTotal,
        isSubtotal,
        isSection,
        cellMeta
      };
    });
  }, [block.rows, block.columnAlignments]);

  return (
    <div
      className="my-3 space-y-1 font-sans"
      style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
    >
      {/* Table Title and Quick Add Controls. Shown in full while the block is
          selected so the alignment and template controls are not hover-only. */}
      <div
        className={`flex items-center justify-between gap-2 hover:opacity-100 transition-opacity pb-0.5 ${
          isSelected ? 'opacity-100' : 'opacity-60'
        }`}
      >
        <span className="text-[11px] font-bold text-[#0E2841] tracking-wide">
          {block.title || 'Financial Schedule'}
        </span>

        <div className="flex items-center gap-1">
          {/* Build this table from one of the standard statement layouts. Explicitly
              labelled as a replace, since it overwrites the current grid. Undo (Ctrl+Z)
              restores the previous table. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] gap-1 px-1.5 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                title="Apply standard layout or manage database templates"
              >
                <LayoutTemplate className="w-3 h-3" />
                <span>Table Templates</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[21rem] p-1.5 text-xs">
              <div className="px-2 py-1.5 border-b border-slate-100 dark:border-zinc-800 mb-1">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200">
                  Financial Statement Templates
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                  Click to apply layout. Undo with Ctrl+Z.
                </p>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-0.5 pr-0.5">
                {tableTemplates.map((tpl) => {
                  const TplIcon = tpl.icon;
                  const isCurrentMatch = matchedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => applyTableTemplate(tpl.id)}
                      className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 group cursor-pointer transition-colors ${
                        isCurrentMatch ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className={`p-1 rounded ${tpl.color} shrink-0 mt-0.5`}>
                          <TplIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-medium text-slate-900 dark:text-zinc-100 truncate">
                              {tpl.name}
                            </span>
                            {isCurrentMatch && (
                              <span className="shrink-0 px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                                Current
                              </span>
                            )}
                            {tpl.badge && !isCurrentMatch && (
                              <span className="shrink-0 px-1 rounded bg-slate-100 dark:bg-zinc-800 text-[9px] font-mono text-slate-500 dark:text-zinc-400">
                                {tpl.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                            {tpl.description}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Save/Overwrite button beside current/template + Edit metadata button */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={`Save current table layout to "${tpl.name}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectQuickUpdate(tpl);
                          }}
                          disabled={updateTemplateMutation.isPending}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                            isCurrentMatch
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                          }`}
                        >
                          <Save className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          title="Edit template details (name, description, color)"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUpdateTemplateModal(tpl.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 opacity-60 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                <button
                  type="button"
                  onClick={() => openCreateTemplateModal()}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors text-left cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Save Current Table as New Template...</span>
                </button>
                <button
                  type="button"
                  onClick={() => openUpdateTemplateModal(matchedTemplate?.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-left cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Manage / Update Existing Templates...</span>
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cell Alignment for the single focused cell (e.g. Row 5, Col 2) */}
          <div
            className="flex items-center gap-0.5 rounded border border-slate-200 dark:border-zinc-700 px-1 py-0.5 bg-slate-50/70 dark:bg-zinc-800/40"
            title={
              activeCell === null
                ? 'Click any table cell to align that single cell'
                : `Align single cell: Row ${activeCell.rowIdx + 1}, Col ${activeCell.colIdx + 1}`
            }
          >
            <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              {activeCell === null ? 'Cell' : `R${activeCell.rowIdx + 1} C${activeCell.colIdx + 1}`}
            </span>
            {([
              { value: 'left' as const, label: 'Align single cell left', Icon: AlignLeft },
              { value: 'center' as const, label: 'Center single cell', Icon: AlignCenter },
              { value: 'right' as const, label: 'Align single cell right', Icon: AlignRight }
            ]).map(({ value, label, Icon }) => {
              const customCellAlign =
                activeCell !== null
                  ? block.rows[activeCell.rowIdx]?.cellAlignments?.[activeCell.colIdx]
                  : undefined;
              const effectiveAlign =
                activeCell !== null
                  ? rowMetadata[activeCell.rowIdx]?.cellMeta[activeCell.colIdx]?.align || 'left'
                  : null;
              const isCustomActive = customCellAlign === value;
              const isInheritedActive = !customCellAlign && effectiveAlign === value;

              return (
                <button
                  key={value}
                  type="button"
                  disabled={activeCell === null}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    activeCell !== null &&
                    setCellAlignment(
                      activeCell.rowIdx,
                      activeCell.colIdx,
                      isCustomActive ? undefined : value
                    )
                  }
                  title={label}
                  className={`p-0.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    isCustomActive
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : isInheritedActive
                      ? 'bg-blue-600/70 text-white'
                      : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
            {activeCell !== null && block.rows[activeCell.rowIdx]?.cellAlignments?.[activeCell.colIdx] && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  activeCell !== null &&
                  setCellAlignment(activeCell.rowIdx, activeCell.colIdx, undefined)
                }
                title="Reset single cell to default column/row alignment"
                className="p-0.5 rounded text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Link Spreadsheet Cell to active focused cell */}
          <button
            type="button"
            disabled={activeCell === null}
            onClick={() => {
              if (activeCell !== null && onOpenCellPicker) {
                const cellLabel = `${block.title || 'Table'} Cell R${activeCell.rowIdx + 1}C${activeCell.colIdx + 1}`;
                onOpenCellPicker((cellRef, displayVal) => {
                  const token = cellRef.startsWith('@')
                    ? cellRef
                    : `@${cellRef}${displayVal ? `{${displayVal}}` : ''}`;
                  handleCellChange(activeCell.rowIdx, activeCell.colIdx, token);
                  toast.success(`Linked ${token} to ${cellLabel}!`);
                }, cellLabel);
              } else if (onOpenSpreadsheet) {
                onOpenSpreadsheet();
              }
            }}
            title={
              activeCell === null
                ? 'Click any table cell to link a spreadsheet cell value'
                : `Link spreadsheet cell into Row ${activeCell.rowIdx + 1}, Col ${activeCell.colIdx + 1}`
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-all cursor-pointer ${
              activeCell !== null
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 shadow-2xs'
                : 'opacity-40 cursor-not-allowed border-slate-200 dark:border-zinc-700 text-slate-400'
            }`}
          >
            <Table2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{activeCell !== null ? `Link R${activeCell.rowIdx + 1}C${activeCell.colIdx + 1}` : 'Link Cell'}</span>
          </button>

          {/* Column alignment for the column the user is in. */}
          <div
            className="flex items-center gap-0.5 rounded border border-slate-200 dark:border-zinc-700 px-1 py-0.5"
            title={
              activeColIdx === null
                ? 'Click a cell first, then align its column'
                : `Align entire column ${activeColIdx + 1}`
            }
          >
            <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              {activeColIdx === null ? 'Col' : `Col ${activeColIdx + 1}`}
            </span>
            {([
              { value: 'left' as const, label: 'Align column left', Icon: AlignLeft },
              { value: 'center' as const, label: 'Center column', Icon: AlignCenter },
              { value: 'right' as const, label: 'Align column right', Icon: AlignRight }
            ]).map(({ value, label, Icon }) => {
              const isActive =
                activeColIdx !== null && (block.columnAlignments[activeColIdx] || 'left') === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={activeColIdx === null}
                  // Keep the focused cell so the target column does not reset on click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeColIdx !== null && setColumnAlignment(activeColIdx, value)}
                  title={label}
                  className={`p-0.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addRow('data')}
            className="h-5 text-[10px] gap-1 px-1.5 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
            <span>Add Row</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addColumn}
            className="h-5 text-[10px] gap-1 px-1.5 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
            <span>Add Column</span>
          </Button>

        </div>
      </div>

      {/* Draft Diff Notification Banner if any cell was modified in proposal vs main */}
      {tableCellDiffs && tableCellDiffs.length > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 my-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-medium">
              <strong>{tableCellDiffs.length} table {tableCellDiffs.length === 1 ? 'change' : 'changes'}</strong> detected against Main (amber highlights).
            </span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-300 italic">
            Hover over highlighted cells to compare with Main
          </span>
        </div>
      )}

      {/* Authentic Word Financial Table Grid */}
      <div className="overflow-x-auto w-full my-1">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr
              style={{ backgroundColor: block.headerShading || undefined }}
              className="border-t border-b-2 border-slate-900 text-[#0E2841] bg-white dark:bg-zinc-900"
            >
              {/* Left Sandwich Bar Column Header */}
              <th className="w-9 min-w-[36px] max-w-[36px] p-1 text-center font-normal text-[10px] text-slate-400">
                #
              </th>

              {block.headers.map((header, colIdx) => {
                const align = block.columnAlignments[colIdx] || 'left';
                const isFirst = colIdx === 0;
                const headerDiff = cellDiffMap.get(`-1_${colIdx}`);
                const isHeaderChanged = !!headerDiff;

                return (
                  <th
                    key={colIdx}
                    className={`p-1 font-bold text-[#0E2841] ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} group/col relative ${
                      isFirst ? 'min-w-[220px] w-2/5' : 'min-w-[70px]'
                    }`}
                  >
                    <div className="flex items-center gap-1 justify-between">
                      <input
                        type="text"
                        value={header}
                        placeholder={`Col ${colIdx + 1}`}
                        title={headerDiff ? `Modified Header (Main value: "${headerDiff.oldValue || '(empty)'}")` : undefined}
                        onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                        onFocus={() => setActiveColIdx(colIdx)}
                        style={{ textAlign: align }}
                        className={`w-full bg-transparent font-bold text-[#0E2841] ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} hover:bg-white/60 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          isHeaderChanged ? 'ring-2 ring-amber-400 bg-amber-50/80 dark:bg-amber-950/50' : ''
                        }`}
                      />

                      {/* Column Sandwich Menu Button */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            title="Column actions: align, add, move, duplicate, delete"
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-700 hover:bg-white/80 transition-colors opacity-50 group-hover/col:opacity-100 shrink-0"
                          >
                            <Menu className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1 text-xs font-normal">
                          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Column {colIdx + 1}
                          </div>

                          {/* Alignment first: it is the control people come here for. */}
                          {([
                            { value: 'left' as const, label: 'Align Left', Icon: AlignLeft },
                            { value: 'center' as const, label: 'Align Center', Icon: AlignCenter },
                            { value: 'right' as const, label: 'Align Right', Icon: AlignRight }
                          ]).map(({ value, label, Icon }) => (
                            <DropdownMenuItem
                              key={value}
                              onClick={() => setColumnAlignment(colIdx, value)}
                              className={`flex items-center gap-2 py-1.5 cursor-pointer ${
                                align === value ? 'bg-blue-50 dark:bg-blue-950/50 font-semibold text-blue-700 dark:text-blue-300' : ''
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${align === value ? 'text-blue-600' : 'text-slate-500'}`} />
                              <span>{label}</span>
                              {align === value && <Check className="w-3 h-3 ml-auto text-blue-600" />}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />

                          {/* Add Column Left */}
                          <DropdownMenuItem
                            onClick={() => addColumnAt(colIdx, 'New Column', align)}
                            className="flex items-center gap-2 py-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <div className="flex items-center">
                              <Plus className="w-3.5 h-3.5" />
                              <ArrowLeft className="w-3 h-3 -ml-0.5" />
                            </div>
                            <span>Add Column Left</span>
                          </DropdownMenuItem>

                          {/* Add Column Right */}
                          <DropdownMenuItem
                            onClick={() => addColumnAt(colIdx + 1, 'New Column', align)}
                            className="flex items-center gap-2 py-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <div className="flex items-center">
                              <Plus className="w-3.5 h-3.5" />
                              <ArrowRight className="w-3 h-3 -ml-0.5" />
                            </div>
                            <span>Add Column Right</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Move Column Left */}
                          <DropdownMenuItem
                            disabled={colIdx === 0}
                            onClick={() => moveColumn(colIdx, 'left')}
                            className="flex items-center gap-2 py-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                            <span>Move Column Left</span>
                          </DropdownMenuItem>

                          {/* Move Column Right */}
                          <DropdownMenuItem
                            disabled={colIdx === block.headers.length - 1}
                            onClick={() => moveColumn(colIdx, 'right')}
                            className="flex items-center gap-2 py-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span>Move Column Right</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Duplicate Column */}
                          <DropdownMenuItem
                            onClick={() => duplicateColumn(colIdx)}
                            className="flex items-center gap-2 py-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Duplicate Column</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Delete Column */}
                          <DropdownMenuItem
                            disabled={block.headers.length <= 1}
                            onClick={() => deleteColumn(colIdx)}
                            className="flex items-center gap-2 py-1.5 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Delete Column</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIdx) => {
              const meta = rowMetadata[rowIdx] || {
                isTotal: row.type === 'total',
                isSubtotal: row.type === 'subtotal',
                isSection: row.type === 'section_title' || row.type === 'category_header',
                isHeaderLikeRow: row.type === 'header',
                isDateHeaderRow: false,
                isMajorHeaderRow: false,
                cellMeta: []
              };
              const { isTotal, isSubtotal, isSection, isHeaderLikeRow } = meta;
              let rowClass = 'hover:bg-blue-50/20 dark:hover:bg-zinc-800/40';
              const isRowAdded = cellDiffMap.get(`${rowIdx}_0`)?.status === 'row_added';
              if (isRowAdded) {
                rowClass = 'bg-emerald-50/50 dark:bg-emerald-950/30';
              } else if (isHeaderLikeRow) {
                rowClass = 'font-bold bg-white dark:bg-zinc-900 text-[#0E2841]';
              } else if (row.shading) {
                // custom row shading
              } else if (isTotal) {
                rowClass = 'font-bold bg-slate-50/40';
              } else if (isSubtotal) {
                rowClass = 'font-semibold';
              } else if (isSection) {
                rowClass = 'bg-[#DAE9F7] font-bold text-[#0E2841]';
              }

              const isBeingDragged = draggedRowIdx === rowIdx;
              const isOver = dragOverRowIdx === rowIdx && !isBeingDragged;

              return (
                <tr
                  key={row.id || rowIdx}
                  style={(!isHeaderLikeRow && row.shading) ? { backgroundColor: row.shading } : undefined}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverRowIdx !== rowIdx) {
                      setDragOverRowIdx(rowIdx);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverRowIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(fromIdx) && fromIdx !== rowIdx) {
                      reorderRow(fromIdx, rowIdx);
                    }
                    setDraggedRowIdx(null);
                    setDragOverRowIdx(null);
                  }}
                  className={`group/row transition-colors duration-75 ${rowClass} ${
                    isOver ? 'border-t-2 border-blue-500 bg-blue-50/40' : ''
                  } ${isBeingDragged ? 'opacity-35 scale-[0.99] bg-blue-50/20' : ''}`}
                >
                  {/* Left Action Handle: Dedicated drag grip for reordering + instant non-draggable button for actions */}
                  <td className="w-9 min-w-[36px] max-w-[36px] py-0.5 px-0.5 text-center align-middle select-none">
                    <div className="flex items-center justify-center gap-0.5">
                      {/* Dedicated Drag Grip Handle: Has HTML5 draggable with zero click interference */}
                      <div
                        draggable={true}
                        onDragStart={(e) => {
                          setOpenRowMenuIdx(null);
                          e.dataTransfer.setData('text/plain', String(rowIdx));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedRowIdx(rowIdx);
                        }}
                        onDragEnd={() => {
                          setDraggedRowIdx(null);
                          setDragOverRowIdx(null);
                        }}
                        title="Drag up or down to move row"
                        className="w-2.5 h-6 flex items-center justify-center text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-grab active:cursor-grabbing transition-colors"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>

                      {/* Instant Actions Menu Button: Pure clickable button (NO draggable) for 0ms opening */}
                      <DropdownMenu
                        modal={false}
                        open={openRowMenuIdx === rowIdx}
                        onOpenChange={(isOpen) => setOpenRowMenuIdx(isOpen ? rowIdx : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            title="Row Actions (Add, Move, Duplicate, Style, Delete)"
                            className="w-5 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            <Menu className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1 text-xs">
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Row {rowIdx + 1} Actions
                        </div>

                        {/* Row Colour. White is stored as an explicit #FFFFFF rather than by
                            clearing the field, because the storage-read normaliser re-applies
                            the category default to any category row left with no fill. */}
                        <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                          Row Colour
                        </div>
                        {isHeaderLikeRow ? (
                          <div className="px-2 pb-1.5 text-[10px] text-slate-400 leading-snug">
                            Header rows always print white. Change the row style below to fill it.
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1">
                            <button
                              type="button"
                              onClick={() => setRowShading(rowIdx, undefined)}
                              title="Default for this row style"
                              aria-label="Default for this row style"
                              className={`w-5 h-5 rounded border bg-white relative transition-all ${
                                !row.shading
                                  ? 'border-blue-600 ring-2 ring-blue-500/40'
                                  : 'border-slate-300 hover:border-slate-500'
                              }`}
                            >
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                /
                              </span>
                            </button>
                            {([
                              { value: '#FFFFFF', label: 'White' },
                              { value: '#CCECFF', label: 'Blue' },
                              { value: '#DAE9F7', label: 'Light blue' },
                              { value: '#F1F5F9', label: 'Grey' },
                              { value: '#FFF4CE', label: 'Amber' }
                            ] as const).map(({ value, label }) => {
                              const isActive = (row.shading || '').toUpperCase() === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setRowShading(rowIdx, value)}
                                  title={label}
                                  aria-label={label}
                                  style={{ backgroundColor: value }}
                                  className={`w-5 h-5 rounded border transition-all ${
                                    isActive
                                      ? 'border-blue-600 ring-2 ring-blue-500/40'
                                      : 'border-slate-300 hover:border-slate-500'
                                  }`}
                                />
                              );
                            })}
                            <label
                              title="Custom colour"
                              className="w-5 h-5 rounded border border-dashed border-slate-400 hover:border-slate-600 flex items-center justify-center cursor-pointer"
                            >
                              <span className="text-[9px] font-bold text-slate-500">+</span>
                              <input
                                type="color"
                                value={row.shading || '#FFFFFF'}
                                onChange={(e) => setRowShading(rowIdx, e.target.value.toUpperCase())}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        )}

                        <DropdownMenuSeparator />

                        {/* Add Row Above */}
                        <DropdownMenuItem
                          onClick={() => { setOpenRowMenuIdx(null); addRowAt(rowIdx, 'data'); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <div className="flex items-center">
                            <Plus className="w-3.5 h-3.5" />
                            <ArrowUp className="w-3 h-3 -ml-0.5" />
                          </div>
                          <span>Add Row Above</span>
                        </DropdownMenuItem>

                        {/* Add Row Below */}
                        <DropdownMenuItem
                          onClick={() => { setOpenRowMenuIdx(null); addRowAt(rowIdx + 1, 'data'); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <div className="flex items-center">
                            <Plus className="w-3.5 h-3.5" />
                            <ArrowDown className="w-3 h-3 -ml-0.5" />
                          </div>
                          <span>Add Row Below</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Move Row Up */}
                        <DropdownMenuItem
                          disabled={rowIdx === 0}
                          onClick={() => { setOpenRowMenuIdx(null); moveRow(rowIdx, 'up'); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                          <span>Move Row Up</span>
                        </DropdownMenuItem>

                        {/* Move Row Down */}
                        <DropdownMenuItem
                          disabled={rowIdx === block.rows.length - 1}
                          onClick={() => { setOpenRowMenuIdx(null); moveRow(rowIdx, 'down'); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                          <span>Move Row Down</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Duplicate Row */}
                        <DropdownMenuItem
                          onClick={() => { setOpenRowMenuIdx(null); duplicateRow(rowIdx); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Duplicate Row</span>
                        </DropdownMenuItem>

                        {/* Indent Line Item */}
                        <DropdownMenuItem
                          onClick={() => { setOpenRowMenuIdx(null); toggleRowIndent(rowIdx); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer"
                        >
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>Indent Line Item ({row.indent ? `Indent ${row.indent}` : 'No Indent'})</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Row Alignment: overrides the column alignment for this row only,
                            so a period caption row can be centered over right-aligned figures. */}
                        <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                          Row Alignment
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1">
                          {([
                            { value: 'left' as const, label: 'Align row left', Icon: AlignLeft },
                            { value: 'center' as const, label: 'Center row', Icon: AlignCenter },
                            { value: 'right' as const, label: 'Align row right', Icon: AlignRight }
                          ]).map(({ value, label, Icon }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setRowAlignment(rowIdx, row.align === value ? undefined : value)}
                              title={label}
                              className={`flex-1 p-1 rounded text-center transition-colors flex items-center justify-center ${
                                row.align === value
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                        <DropdownMenuItem
                          disabled={!row.align}
                          onClick={() => { setOpenRowMenuIdx(null); setRowAlignment(rowIdx, undefined); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Use column alignment</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Row Format Type */}
                        <div className="px-2 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                          Row Style
                        </div>
                        {[
                          { type: 'data' as const, label: 'Data Line Item' },
                          { type: 'header' as const, label: 'Table Header (White, Centered)' },
                          { type: 'category_header' as const, label: 'Category Header (Blue Shaded)' },
                          { type: 'subtotal' as const, label: 'Subtotal (Bordered)' },
                          { type: 'total' as const, label: 'Total Net (Double Underline)' },
                          { type: 'blank' as const, label: 'Blank Spacer' }
                        ].map((styleOpt) => (
                          <DropdownMenuItem
                            key={styleOpt.type}
                            onClick={() => { setOpenRowMenuIdx(null); setRowType(rowIdx, styleOpt.type); }}
                            className={`flex items-center justify-between text-xs py-1 cursor-pointer ${
                              (row.type === styleOpt.type || (styleOpt.type === 'category_header' && row.type === 'section_title')) ? 'font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50' : ''
                            }`}
                          >
                            <span>{styleOpt.label}</span>
                          </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />

                        {/* Delete Row */}
                        <DropdownMenuItem
                          onClick={() => { setOpenRowMenuIdx(null); deleteRow(rowIdx); }}
                          className="flex items-center gap-2 py-1.5 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          <span>Delete Row</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </td>

                  {row.cells.map((cellValue, colIdx) => {
                    const cMeta = meta.cellMeta[colIdx] || {
                      isFirst: colIdx === 0,
                      align: block.columnAlignments[colIdx] || 'left',
                      indentPadding: 'pl-1.5'
                    };
                    const { isFirst, align, indentPadding } = cMeta;

                    const cellDiff = cellDiffMap.get(`${rowIdx}_${colIdx}`);
                    const isCellChanged = !!cellDiff;
                    const cellTitle = cellDiff?.status === 'cell_modified'
                      ? `Modified in proposal (Main value: "${cellDiff.oldValue || '(empty)'}")`
                      : isRowAdded
                      ? 'New row added in proposal'
                      : undefined;

                    let cellBorderStyle = '';
                    if (isTotal) {
                      cellBorderStyle =
                        'border-t border-slate-900 border-b-[3px] border-b-double border-b-slate-900';
                    } else if (isSubtotal) {
                      cellBorderStyle = 'border-t border-slate-500 border-b border-slate-500';
                    }

                    return (
                      <td
                        key={colIdx}
                        className={`py-0.5 pr-1.5 ${indentPadding} ${cellBorderStyle} ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} ${
                          isFirst ? 'min-w-[220px]' : 'min-w-[55px]'
                        }`}
                      >
                        <TableCellInput
                          initialValue={cellValue}
                          title={cellTitle}
                          onCommit={(val) => handleCellChange(rowIdx, colIdx, val)}
                          onFocus={() => {
                            setActiveColIdx(colIdx);
                            setActiveCell({ rowIdx, colIdx });
                          }}
                          attachedSpreadsheet={attachedSpreadsheet}
                          onOpenCellPicker={onOpenCellPicker}
                          onOpenSpreadsheet={onOpenSpreadsheet}
                          rowIdx={rowIdx}
                          colIdx={colIdx}
                          tableName={block.title}
                          searchQuery={searchQuery}
                          // No placeholder: a dash here read as real content in empty cells.
                          style={{ textAlign: align }}
                          className={`w-full bg-transparent hover:bg-white/80 dark:hover:bg-zinc-800/80 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} ${
                            isTotal || row.bold || isHeaderLikeRow
                              ? 'font-bold text-slate-900 dark:text-zinc-100'
                              : 'text-slate-900 dark:text-zinc-200'
                          } ${row.italic ? 'italic text-slate-700 dark:text-zinc-300' : ''} ${
                            isCellChanged ? 'ring-2 ring-amber-400 bg-amber-50/80 dark:bg-amber-950/50 font-semibold' : ''
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footnotes */}
      {block.footnotes && block.footnotes.length > 0 && (
        <div className="text-[11px] italic text-slate-600 pt-1">
          {block.footnotes.map((fn, idx) => (
            <div key={idx}>{fn}</div>
          ))}
        </div>
      )}

      {/* Modal for saving / updating table templates */}
      <TableTemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        block={block}
        initialMode={templateModalMode}
        initialTemplateId={templateModalInitialId}
      />
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 4. CALLOUT / AUDITOR NOTICE BLOCK EDITOR                                  */
/* ------------------------------------------------------------------------- */
const CalloutBlockEditor: React.FC<{
  block: SecCalloutBlock;
  onUpdate: (u: Partial<SecCalloutBlock>) => void;
  attachedSpreadsheet?: AttachedSpreadsheet;
  onOpenSpreadsheet?: () => void;
  onOpenCellPicker?: (onPick: (cellRef: string, displayVal: string) => void, blockTitle?: string) => void;
  searchQuery?: string;
}> = ({ block, onUpdate, attachedSpreadsheet, onOpenSpreadsheet, onOpenCellPicker, searchQuery }) => {
  const isUnaudited = block.variant === 'unaudited' || block.variant === 'warning';
  const borderColor = isUnaudited ? 'border-l-amber-500' : 'border-l-blue-600';
  const iconColor = isUnaudited ? 'text-amber-600' : 'text-blue-600';
  const hasVariables = hasDocumentVariables((block.title || '') + (block.content || ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContentFocused, setIsContentFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleInsertSpreadsheetCell = () => {
    if (!onOpenCellPicker) {
      onOpenSpreadsheet?.();
      return;
    }
    const el = textareaRef.current;
    const start = el ? el.selectionStart : (block.content || '').length;
    const end = el ? el.selectionEnd : (block.content || '').length;

    onOpenCellPicker((cellRef, displayVal) => {
      const token = cellRef.startsWith('@')
        ? cellRef
        : `@${cellRef}${displayVal ? `{${displayVal}}` : ''}`;
      const curContent = block.content || '';
      const before = curContent.substring(0, start);
      const after = curContent.substring(end);
      const nextContent = `${before}${token}${after}`;
      onUpdate({ content: nextContent });

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const nextPos = start + token.length;
          textareaRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 50);
    }, block.title || 'Callout Notice');
  };

  return (
    <div className={`my-3 p-3.5 rounded border border-slate-300 dark:border-zinc-700 border-l-4 ${borderColor} bg-slate-50/90 dark:bg-zinc-900/60 space-y-1.5 relative group/callout`}>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertCircle className={`w-4 h-4 ${iconColor} shrink-0`} />
          <input
            type="text"
            value={block.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Notice / Disclosure Title..."
            className="font-bold text-xs text-slate-900 dark:text-zinc-100 bg-transparent border-none focus:outline-none w-full"
          />
        </div>

        {/* Link Cell Action button */}
        <button
          type="button"
          onClick={handleInsertSpreadsheetCell}
          title="Right-click in content or click here to link a cell from attached spreadsheet"
          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 rounded border border-emerald-300/80 shadow-2xs transition-all opacity-0 group-hover/callout:opacity-100"
        >
          <Table2 className="w-3 h-3 text-emerald-600" />
          <span>Link Cell</span>
        </button>
      </div>

      <div className="relative">
        {(hasVariables || (searchQuery && searchQuery.trim())) && !isContentFocused ? (
          <div
            onClick={() => {
              setIsContentFocused(true);
              setTimeout(() => {
                textareaRef.current?.focus();
              }, 20);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            className="w-full text-xs min-h-[36px] cursor-text italic text-slate-800 dark:text-zinc-300 leading-relaxed hover:bg-slate-100/50 dark:hover:bg-zinc-800/40 rounded p-1 transition-colors"
            title="Click to edit callout text"
          >
            <DocumentVariableRenderer
              text={block.content}
              spreadsheet={attachedSpreadsheet}
              highlightQuery={searchQuery}
              onInspectCell={onOpenSpreadsheet}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={block.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onFocus={() => setIsContentFocused(true)}
            onBlur={() => setIsContentFocused(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            rows={2}
            placeholder="Enter auditor notice or disclosure details... (Right-click or use toolbar to link cell)"
            className="w-full text-xs bg-transparent border-none focus:outline-none resize-none italic text-slate-800 dark:text-zinc-300 leading-relaxed"
          />
        )}

        {/* Right-click Floating Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 px-1 min-w-[210px] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                handleInsertSpreadsheetCell();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/50 text-left font-medium text-slate-800 dark:text-zinc-200 transition-colors"
            >
              <Table2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Link Cell from Spreadsheet...</span>
            </button>
            {onOpenSpreadsheet && (
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  onOpenSpreadsheet();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-slate-600 dark:text-zinc-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Open Spreadsheet Editor</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 5. SIGNATURE BLOCK EDITOR                                                 */
/* ------------------------------------------------------------------------- */
const SignatureBlockEditor: React.FC<{
  block: SecSignatureBlock;
  onUpdate?: (u: Partial<SecSignatureBlock>) => void;
}> = ({ block, onUpdate }) => {
  const [mobileSignOfficerIdx, setMobileSignOfficerIdx] = useState<number | null>(null);

  const addOfficer = () => {
    if (!onUpdate) return;
    const newOfficer = {
      id: `off-${Date.now()}`,
      name: '',
      title: 'Chief Financial Officer',
      signatureText: '',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      signed: false
    };
    onUpdate({ officers: [...block.officers, newOfficer] });
  };

  const updateOfficer = (idx: number, updates: Partial<typeof block.officers[0]>) => {
    if (!onUpdate) return;
    const next = [...block.officers];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ officers: next });
  };

  const removeOfficer = (idx: number) => {
    if (!onUpdate) return;
    const next = block.officers.filter((_, i) => i !== idx);
    onUpdate({ officers: next });
  };

  return (
    <div
      className="my-6 pt-4 border-t border-slate-300 dark:border-zinc-800 space-y-3"
      style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
    >
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={block.title || 'SIGNATURES'}
          onChange={(e) => onUpdate && onUpdate({ title: e.target.value })}
          className="font-bold text-sm text-[#0E2841] dark:text-zinc-100 bg-transparent border-none focus:outline-none uppercase tracking-wide"
        />
        {onUpdate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addOfficer}
            className="h-5 text-[10px] gap-1 px-1.5 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
            <span>Add Signer</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {block.officers.map((officer, idx) => (
          <div key={officer.id || idx} className="space-y-1 text-xs group/sig relative p-2.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 transition-colors">
            {/* Signature Area */}
            <div className="space-y-1">
              {officer.signed ? (
                <div className="border-b border-slate-400 dark:border-zinc-600 pb-1.5 flex items-end justify-between min-h-[58px]">
                  <div className="flex items-center gap-2">
                    {officer.signatureImageUrl ? (
                      <img
                        src={officer.signatureImageUrl}
                        alt="Drawn Electronic Signature"
                        className="h-14 sm:h-16 w-auto max-w-[280px] object-contain filter dark:invert my-0.5"
                      />
                    ) : (
                      <span className="font-serif italic font-bold text-base text-blue-900 dark:text-blue-300 tracking-wide">
                        {officer.signatureText || `/s/ ${officer.name}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileSignOfficerIdx(idx)}
                      title="View verification certificate"
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50"
                    >
                      E-Sign Details
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateOfficer(idx, {
                          signed: false,
                          signatureText: '',
                          signatureImageUrl: undefined
                        })
                      }
                      title="Clear Signature"
                      className="text-[10px] text-red-500 hover:text-red-700 hover:underline px-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={officer.signatureText || ''}
                    placeholder="/s/ ____________________ (Signature spot)"
                    onChange={(e) =>
                      updateOfficer(idx, {
                        signatureText: e.target.value,
                        signed: Boolean(e.target.value.trim())
                      })
                    }
                    className="w-full font-mono font-medium text-sm text-slate-900 dark:text-zinc-100 border-b border-slate-400 pb-0.5 bg-transparent focus:outline-none focus:border-blue-500 placeholder:text-slate-400/60 placeholder:italic"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileSignOfficerIdx(idx)}
                    title="Send signing prompt to phone via DocuSign / Dropbox Sign SMS"
                    className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 transition-colors shadow-2xs"
                  >
                    <Smartphone className="w-3 h-3 text-blue-600" />
                    <span>📱 Sign via Phone</span>
                  </button>
                </div>
              )}
            </div>

            {/* Officer Name & Title */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={officer.name}
                onChange={(e) => updateOfficer(idx, { name: e.target.value })}
                placeholder="Officer Name"
                className="font-semibold text-slate-900 dark:text-zinc-200 bg-transparent border-none focus:outline-none flex-1"
              />
              <span className="text-slate-400">—</span>
              <input
                type="text"
                value={officer.title}
                onChange={(e) => updateOfficer(idx, { title: e.target.value })}
                placeholder="Title"
                className="text-slate-700 dark:text-zinc-300 bg-transparent border-none focus:outline-none flex-1"
              />
            </div>

            {/* Date and Status Details */}
            <div className="flex items-center justify-between text-slate-500 italic">
              <input
                type="text"
                value={officer.date}
                onChange={(e) => updateOfficer(idx, { date: e.target.value })}
                className="text-xs italic text-slate-500 bg-transparent border-none focus:outline-none w-3/4"
              />
              {block.officers.length > 1 && onUpdate && (
                <button
                  type="button"
                  onClick={() => removeOfficer(idx)}
                  className="opacity-0 group-hover/sig:opacity-100 text-red-500 hover:text-red-700 p-0.5"
                  title="Remove Signer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Signed Verification Pill */}
            {officer.signed && (
              <div
                onClick={() => setMobileSignOfficerIdx(idx)}
                className="cursor-pointer inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              >
                <span>✓ {officer.signedVia || 'Rule 302(b) Mobile Verified'}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile Signing Modal */}
      {mobileSignOfficerIdx !== null && (
        <MobileSigningModal
          open={mobileSignOfficerIdx !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setMobileSignOfficerIdx(null);
          }}
          documentTitle="SEC Filing Document"
          documentId="sec-active-doc"
          block={block}
          officerIndex={mobileSignOfficerIdx}
          onSignatureCompleted={(updatedOfficer) => {
            updateOfficer(mobileSignOfficerIdx, updatedOfficer);
          }}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 6. DIVIDER & PAGE BREAK EDITOR                                            */
/* ------------------------------------------------------------------------- */
const DividerBlockEditor: React.FC<{
  block: SecDividerBlock;
  onUpdate?: (u: Partial<SecDividerBlock>) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="my-6 py-2 flex items-center justify-between gap-3 text-xs text-slate-400 select-none">
      <div className="h-px bg-dashed border-t border-slate-300 dark:border-zinc-700 flex-1" />
      <input
        type="text"
        value={block.label || 'Page Break / Next Section'}
        onChange={(e) => onUpdate && onUpdate({ label: e.target.value })}
        className="text-[10px] font-mono uppercase tracking-widest text-slate-600 bg-slate-200/80 dark:bg-zinc-800 px-3 py-1 rounded shadow-xs text-center border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="h-px bg-dashed border-t border-slate-300 dark:border-zinc-700 flex-1" />
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 7. SEC FILING METADATA BLOCK EDITOR                                       */
/* ------------------------------------------------------------------------- */
const MetadataBlockEditor: React.FC<{
  block: SecMetadataBlock;
  onUpdate: (u: Partial<SecMetadataBlock>) => void;
  isWordMode?: boolean;
}> = ({ block, onUpdate, isWordMode }) => {
  if (isWordMode) {
    return (
      <div
        className="text-center space-y-1 mb-8"
        style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
      >
        <input
          type="text"
          value={block.companyName}
          onChange={(e) => onUpdate({ companyName: e.target.value })}
          className="text-2xl font-bold text-[#0E2841] text-center bg-transparent border-none focus:outline-none w-full"
        />
        <input
          type="text"
          value={block.documentTitle}
          onChange={(e) => onUpdate({ documentTitle: e.target.value })}
          className="text-lg font-bold text-[#0E2841] text-center bg-transparent border-none focus:outline-none w-full"
        />
        <input
          type="text"
          value={`For the Period Ended ${block.periodEnded}`}
          onChange={(e) =>
            onUpdate({ periodEnded: e.target.value.replace('For the Period Ended ', '') })
          }
          className="text-sm font-semibold text-slate-700 dark:text-zinc-300 text-center bg-transparent border-none focus:outline-none w-full"
        />
        <div className="text-xs italic text-slate-500">
          Expressed in {block.currency} — Unaudited
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-blue-600" />
        <span className="font-bold text-xs text-slate-700 dark:text-zinc-300">
          SEC Filing Cover Header
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Input
          value={block.companyName}
          onChange={(e) => onUpdate({ companyName: e.target.value })}
          placeholder="Company Name"
          className="h-7 text-xs"
        />
        <Input
          value={block.documentTitle}
          onChange={(e) => onUpdate({ documentTitle: e.target.value })}
          placeholder="Document Title"
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* 8. PICTURE / CORPORATE IMAGE BLOCK EDITOR                                 */
/* ------------------------------------------------------------------------- */
const ImageBlockEditor: React.FC<{
  block: SecImageBlock;
  onUpdate: (u: Partial<SecImageBlock>) => void;
}> = ({ block, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMediaBucketOpen, setIsMediaBucketOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Save directly to the company media bucket so other documents/companies can reuse it
      const asset = await mediaBucketService.uploadAsset(file);
      onUpdate({
        url: asset.url,
        alt: asset.name
      });
    } catch {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          onUpdate({
            url: uploadEvent.target.result as string,
            alt: file.name
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const align = block.alignment || 'center';
  const alignClass =
    align === 'left'
      ? 'justify-start text-left'
      : align === 'right'
      ? 'justify-end text-right'
      : 'justify-center text-center';

  const widthPx = block.width || 260;

  return (
    <div className={`w-full flex flex-col ${alignClass} py-1 my-1 select-none group/img`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Media Bucket Manager Modal */}
      {isMediaBucketOpen && (
        <MediaBucketModal
          isOpen={isMediaBucketOpen}
          onClose={() => setIsMediaBucketOpen(false)}
          selectedImageUrl={block.url}
          onSelectImage={(asset) => {
            onUpdate({
              url: asset.url,
              alt: asset.name
            });
            setIsMediaBucketOpen(false);
          }}
        />
      )}

      <div
        className={`inline-flex flex-col relative items-center max-w-full ${
          align === 'left' ? 'self-start' : align === 'right' ? 'self-end' : 'self-center'
        }`}
        style={{ width: `${widthPx}px` }}
      >
        <div className="relative group/pic w-full rounded-md overflow-hidden border border-transparent hover:border-blue-400/50 hover:shadow-md transition-all">
          <img
            src={block.url || ZENATECH_LOGO_DATA_URL}
            alt={block.alt || 'SEC Document Image'}
            className="w-full h-auto object-contain rounded-sm"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== ZENATECH_LOGO_DATA_URL) {
                target.src = ZENATECH_LOGO_DATA_URL;
              }
            }}
          />

          {/* Quick Change Overlay Buttons on Hover */}
          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMediaBucketOpen(true);
              }}
              className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded shadow flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
              title="Open Company Media Bucket (Select or delete images)"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Media Bucket</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="bg-white/95 text-slate-800 dark:bg-zinc-900/95 dark:text-zinc-100 text-xs font-semibold px-2.5 py-1 rounded shadow flex items-center gap-1.5 hover:bg-white hover:text-blue-600 transition-colors"
              title="Upload directly from computer to bucket"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Upload New</span>
            </button>
          </div>
        </div>

        {/* Editable Caption */}
        <input
          type="text"
          value={block.caption || ''}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="Add optional image caption..."
          className="w-full mt-1.5 text-xs text-center text-slate-500 dark:text-zinc-400 italic bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-blue-500 focus:outline-none transition-colors"
        />
      </div>
    </div>
  );
};
