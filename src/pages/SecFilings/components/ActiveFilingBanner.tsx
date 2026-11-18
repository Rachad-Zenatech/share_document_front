import { ArrowRight } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ZENATECH_LOGO_DATA_URL } from '../../../data/zenatechLogoAsset';
import type { SecFilingDocument } from '../../../types/secFiling';

interface ActiveFilingBannerProps {
  activeDoc: SecFilingDocument | null;
  formatDateLabel: (iso: string) => string;
  onOpen: (id: string) => void;
}

/** Quick-resume banner for the document currently active in the editor. */
export function ActiveFilingBanner({ activeDoc, formatDateLabel, onOpen }: ActiveFilingBannerProps) {
  if (!activeDoc) return null;

  return (
    <div className="mb-6 p-3.5 sm:p-4 rounded-md border border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 flex items-center justify-center p-1 shrink-0 shadow-2xs">
          <img src={ZENATECH_LOGO_DATA_URL} alt="ZenaTech" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-blue-950 dark:text-blue-100 truncate">
              {activeDoc.title}
            </span>
            <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 shrink-0">
              Active in Editor
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {activeDoc.formType} &bull; {activeDoc.period || 'Current'} &bull; {activeDoc.version || 'v1.0'} &bull; Last modified {formatDateLabel(activeDoc.updatedAt)}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onOpen(activeDoc.id)}
        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shrink-0 self-end sm:self-auto"
      >
        <span>Resume in Editor</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
