import { FileText, Layers, Clapperboard } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type { DocumentType } from '../../../types/documentType';

export type DocumentTypeTab = 'all' | DocumentType;

interface DocumentTypeTabsProps {
  value: DocumentTypeTab;
  onChange: (next: DocumentTypeTab) => void;
  counts: Record<DocumentTypeTab, number>;
}

const TABS: { id: DocumentTypeTab; label: string; icon: typeof Layers }[] = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'sec-filing', label: 'SEC Filings', icon: FileText },
  { id: 'script', label: 'Scripts', icon: Clapperboard },
];

/** Tabs separating SEC filings and scripts in the Document Hub's recent documents section. */
export function DocumentTypeTabs({ value, onChange, counts }: DocumentTypeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as DocumentTypeTab)} className="mb-4">
      <TabsList className="h-9 bg-slate-200/70 dark:bg-slate-800/80 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="text-xs px-3 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {counts[id]}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
