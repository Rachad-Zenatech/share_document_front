export type TemplateCategory = 'all' | 'sec' | 'operations' | 'executive' | 'script';

// The template gallery's tabs. "Scripts" is its own kind of document, with its own tables (see types/documentType.ts).
const TABS: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'sec', label: 'SEC Filings' },
  { id: 'operations', label: 'Checklists & Ops' },
  { id: 'executive', label: 'Proposals & Memos' },
  { id: 'script', label: 'Scripts' },
];

export default function TemplateCategoryTabs({ value, onChange }: { value: TemplateCategory; onChange: (next: TemplateCategory) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 rounded-full font-medium ${value === tab.id ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
