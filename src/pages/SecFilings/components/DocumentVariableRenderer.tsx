import React from 'react';
import type { AttachedSpreadsheet } from '../../../types/secFiling';
import {
  CELL_VARIABLE_REGEX,
  formatCellValue,
  getCellValue,
  hasDocumentVariables
} from '../../../utils/documentVariables';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';

interface DocumentVariableRendererProps {
  text: string;
  spreadsheet?: AttachedSpreadsheet | null;
  interactive?: boolean;
  highlightQuery?: string;
  onCellClick?: (cellRef: string, tabName?: string) => void;
  onInspectCell?: (cellRef?: string, tabName?: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Splits plain text and wraps instances of query in a glowing <mark> highlight.
 */
function renderHighlightedText(content: string, query?: string): React.ReactNode {
  if (!query || !query.trim() || !content) return content;
  const cleanQ = query.trim();
  const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = content.split(regex);
  if (parts.length <= 1) return content;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-amber-300 dark:bg-amber-500/80 text-slate-950 dark:text-amber-50 font-bold px-0.5 rounded shadow-2xs"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export const DocumentVariableRenderer: React.FC<DocumentVariableRendererProps> = ({
  text,
  spreadsheet,
  interactive = true,
  highlightQuery,
  onCellClick,
  onInspectCell,
  className = '',
  style,
}) => {
  if (!text || typeof text !== 'string') return null;

  // Quick check if text contains any @ cell variable
  if (!hasDocumentVariables(text)) {
    return (
      <span className={className} style={style}>
        {renderHighlightedText(text, highlightQuery)}
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(CELL_VARIABLE_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const fullMatch = match[0];
    const qTab = match[1];
    const uTab = match[2];
    const tabName = qTab || uTab;
    const cellRef = match[3].toUpperCase();
    const fallback = match[4];

    // Push text before this match (with highlight)
    if (matchIndex > lastIndex) {
      parts.push(renderHighlightedText(text.slice(lastIndex, matchIndex), highlightQuery));
    }

    const liveVal = getCellValue(cellRef, spreadsheet, tabName);
    const displayVal =
      liveVal !== undefined && liveVal !== null
        ? formatCellValue(liveVal)
        : fallback !== undefined && fallback !== ''
        ? fallback
        : `@${cellRef}`;

    const fullRefLabel = tabName ? `${tabName}!${cellRef}` : cellRef;

    if (!interactive) {
      parts.push(renderHighlightedText(displayVal, highlightQuery));
    } else {
      parts.push(
        <Tooltip key={`${fullRefLabel}-${matchIndex}`} delayDuration={100}>
          <TooltipTrigger asChild>
            <span
              onClick={(e) => {
                if (onInspectCell || onCellClick) {
                  e.stopPropagation();
                  onInspectCell?.(cellRef, tabName);
                  onCellClick?.(cellRef, tabName);
                }
              }}
              className="inline-flex items-baseline px-1 py-0.2 mx-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold border-b-2 border-emerald-500 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/80 transition-colors cursor-pointer select-text group/var"
              title={`Linked Cell: @${fullRefLabel} (${displayVal})`}
            >
              <span>{renderHighlightedText(displayVal, highlightQuery)}</span>
              <span className="ml-0.5 text-[9px] font-mono text-emerald-600 dark:text-emerald-400 opacity-60 group-hover/var:opacity-100 select-none">
                ↗
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs p-2.5 bg-slate-900 text-white border-slate-700 space-y-1 rounded-lg shadow-xl">
            <div className="font-bold flex items-center justify-between gap-3 text-emerald-300">
              <span>{tabName ? `Tab: ${tabName}` : 'Spreadsheet Cell'}</span>
              <span className="font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded text-[10px]">
                @{fullRefLabel}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Live Value: <span className="font-mono font-bold text-white text-xs">{displayVal}</span>
            </div>
            <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1">
              Click to view or edit in background spreadsheet
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(renderHighlightedText(text.slice(lastIndex), highlightQuery));
  }

  return (
    <span className={className} style={style}>
      {parts}
    </span>
  );
};
