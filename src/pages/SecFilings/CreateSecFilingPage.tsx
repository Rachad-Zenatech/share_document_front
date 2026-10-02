import { paginateBlocks } from '../../utils/secFilingPagination';
import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MoreVertical,
  FolderOpen,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  Users,
  Copy,
  Pencil,
  Trash2,
  Download,
  Upload,
  Layers,
  Sparkles,
  Building2,
  ArrowRight,
  X,
  Lock,
  Unlock,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { secFilingService } from '../../services/secFilingService';
import { DOCUMENT_TEMPLATES } from '../../data/secDocumentTemplates';
import type { DocumentTemplateDefinition } from '../../data/secDocumentTemplates';
import type { SecDocumentSummary, SecFilingDocument, SecBlock } from '../../types/secFiling';
import { exportSecFilingToDocx, downloadBlob } from '../../utils/secFilingExport';
import { parseDocumentFile } from '../../utils/secFilingImporter';
import { FINANCIAL_TABLE_TEMPLATES } from '../../data/financialTableTemplates';
import { ZENATECH_LOGO_DATA_URL } from '../../data/zenatechLogoAsset';
import { SpreadsheetSelectorModal } from './components/SpreadsheetSelectorModal';


interface PublicCompanyEntity {
  id: string;
  name: string;
  ticker: string;
  cik: string;
  exchange: string;
  role: 'primary' | 'subsidiary' | 'affiliate';
  ownershipPercent?: number;
  jurisdiction: string;
}

const DEFAULT_COMPANIES: PublicCompanyEntity[] = [
  {
    id: 'comp-1',
    name: 'ZenaTech, Inc.',
    ticker: 'ZENA',
    cik: '0001987654',
    exchange: 'NASDAQ',
    role: 'primary',
    ownershipPercent: 100,
    jurisdiction: 'Delaware, USA',
  },
  {
    id: 'comp-2',
    name: 'Zenadrone Technologies Corp.',
    ticker: 'ZENA-DRONE',
    cik: '0001987655',
    exchange: 'TSX / OTC',
    role: 'subsidiary',
    ownershipPercent: 100,
    jurisdiction: 'Ontario, Canada',
  },
  {
    id: 'comp-3',
    name: 'ZenaFlight Autonomous Systems Ltd.',
    ticker: 'ZENA-FLIGHT',
    cik: '0001987656',
    exchange: 'Private Subsidiary',
    role: 'subsidiary',
    ownershipPercent: 85,
    jurisdiction: 'United Kingdom',
  },
  {
    id: 'comp-4',
    name: 'ZenaAI Solutions Inc.',
    ticker: 'ZENA-AI',
    cik: '0001987657',
    exchange: 'Private Subsidiary',
    role: 'subsidiary',
    ownershipPercent: 100,
    jurisdiction: 'Delaware, USA',
  },
];

function DocumentThumbnailPreview({ doc }: { doc: SecDocumentSummary }) {
  const fullDoc = useMemo(() => {
    return secFilingService.getDocumentContent(doc.id);
  }, [doc.id]);

  const page1Blocks = useMemo(() => {
    if (!fullDoc || !fullDoc.blocks || fullDoc.blocks.length === 0) return [];
    try {
      const pages = paginateBlocks(fullDoc.blocks);
      return pages.length > 0 && pages[0].blocks.length > 0 ? pages[0].blocks : fullDoc.blocks.slice(0, 6);
    } catch {
      return fullDoc.blocks.slice(0, 6);
    }
  }, [fullDoc]);

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 p-2 text-[5.5px] leading-[7.5px] flex flex-col justify-between overflow-hidden select-none pointer-events-none font-sans">
      <div className="space-y-1 overflow-hidden">
        {page1Blocks.map((block, idx) => {
          if (block.type === 'heading') {
            const alignClass = block.alignment === 'center' ? 'text-center' : block.alignment === 'right' ? 'text-right' : 'text-left';
            if (block.level === 1) {
              return (
                <div key={block.id || idx} className={`font-bold text-[7px] text-[#0E2841] dark:text-blue-300 leading-tight ${alignClass}`}>
                  {block.text}
                </div>
              );
            }
            if (block.level === 2) {
              return (
                <div key={block.id || idx} className={`font-semibold text-[6px] text-slate-700 dark:text-zinc-300 leading-tight ${alignClass}`}>
                  {block.text}
                </div>
              );
            }
            return (
              <div key={block.id || idx} className={`font-medium text-[5.2px] text-slate-600 dark:text-zinc-400 ${alignClass}`}>
                {block.text}
              </div>
            );
          }
          if (block.type === 'image') {
            return (
              <div key={block.id || idx} className="flex justify-center my-0.5">
                <img src={block.url || ZENATECH_LOGO_DATA_URL} alt="" className="h-4 max-w-[80px] object-contain" />
              </div>
            );
          }
          if (block.type === 'paragraph') {
            const alignClass = block.alignment === 'center' ? 'text-center' : block.alignment === 'right' ? 'text-right' : 'text-left';
            return (
              <p key={block.id || idx} className={`text-[4.8px] leading-[6.5px] text-slate-600 dark:text-zinc-400 line-clamp-2 ${alignClass} ${block.italic ? 'italic' : ''} ${block.bold ? 'font-bold' : ''}`}>
                {block.text}
              </p>
            );
          }
          if (block.type === 'callout') {
            return (
              <div key={block.id || idx} className="p-1 rounded-2xs border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 my-0.5">
                {block.title && <div className="font-bold text-[5px] text-blue-900 dark:text-blue-200">{block.title}</div>}
                <div className="text-[4.5px] text-slate-600 dark:text-zinc-400 line-clamp-2">{block.content}</div>
              </div>
            );
          }
          if (block.type === 'metadata') {
            return (
              <div key={block.id || idx} className="p-1 rounded-2xs border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30 my-0.5 space-y-0.2">
                <div className="font-bold text-[5px] text-slate-900 dark:text-zinc-100">{block.companyName} • {block.formType}</div>
                <div className="text-[4.2px] text-slate-500 dark:text-zinc-400">CIK: {block.cik} | Symbol: {block.symbol}</div>
              </div>
            );
          }
          if (block.type === 'financial_table') {
            return (
              <div key={block.id || idx} className="my-0.5 border border-slate-200 dark:border-zinc-700 rounded-2xs overflow-hidden">
                {block.title && <div className="text-[4.8px] font-bold text-center bg-slate-50 dark:bg-zinc-800 py-0.2 truncate">{block.title}</div>}
                <div className="grid grid-cols-3 bg-slate-100 dark:bg-zinc-800 text-[3.8px] font-semibold border-b border-slate-200 dark:border-zinc-700 py-0.2 px-0.5">
                  {block.headers.slice(0, 3).map((h, i) => <div key={i} className="truncate">{h}</div>)}
                </div>
                {block.rows.slice(0, 3).map((r, ri) => (
                  <div key={ri} className="grid grid-cols-3 text-[3.5px] py-0.2 px-0.5 border-b border-slate-100 dark:border-zinc-800/40">
                    {r.cells.slice(0, 3).map((c, ci) => <div key={ci} className="truncate">{c}</div>)}
                  </div>
                ))}
              </div>
            );
          }
          if (block.type === 'signature') {
            return (
              <div key={block.id || idx} className="my-0.5 border-t border-slate-300 dark:border-zinc-700 pt-0.5 space-y-0.5">
                {block.officers.slice(0, 2).map((off, oi) => (
                  <div key={oi} className="flex justify-between text-[4.5px]">
                    <span className="font-mono text-blue-800 dark:text-blue-300">{off.signatureText || `/s/ ${off.name}`}</span>
                    <span className="text-slate-400">{off.title}</span>
                  </div>
                ))}
              </div>
            );
          }
          if (block.type === 'divider') {
            return <div key={block.id || idx} className="h-px bg-slate-200 dark:bg-zinc-700 my-0.5" />;
          }
          return null;
        })}
      </div>

      <div className="border-t border-slate-200 dark:border-zinc-800 pt-0.5 flex items-center justify-between text-[4.2px] text-slate-400 dark:text-zinc-500 font-mono select-none">
        <span className="truncate max-w-[80px]">{fullDoc?.symbol || 'ZENA'} • {doc.formType || 'SEC Report'}</span>
        <span>Page 1</span>
      </div>
    </div>
  );
}

export default function CreateSecFilingPage() {
  const navigate = useNavigate();

  // Documents list state
  const [documents, setDocuments] = useState<SecDocumentSummary[]>(() =>
    secFilingService.getDocumentsList()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'anyone' | 'me' | 'not_me'>('anyone');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'last_modified' | 'title' | 'last_opened'>('last_modified');
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<'all' | 'sec' | 'operations' | 'executive'>('all');

  // Modal states
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [selectorDoc, setSelectorDoc] = useState<SecDocumentSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSpreadsheets = useMemo(() => secFilingService.getAllSpreadsheets(), [documents]);
  const getAssignedSpreadsheet = (docId: string) => allSpreadsheets.find((s) => s.assignedDocIds?.includes(docId));

  // Import Document Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importFormType, setImportFormType] = useState('Form 10-Q');
  const [importPeriod, setImportPeriod] = useState('Q2 2026');
  const [importConvertTables, setImportConvertTables] = useState(true);
  const [importLockBaseline, setImportLockBaseline] = useState(true);
  const [importLockedByRole, setImportLockedByRole] = useState('Lead Controller');
  const [importIncludeLogo, setImportIncludeLogo] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Wizard state (for advanced multi-company entity setup)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formType, setFormType] = useState('10-Q');
  const [period, setPeriod] = useState('Q2 2026');
  const [periodEnded, setPeriodEnded] = useState('June 30, 2026');
  const [fiscalYear] = useState('2026');
  const [filingTitle] = useState(
    'QUARTERLY REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934'
  );
  const [companies] = useState<PublicCompanyEntity[]>(DEFAULT_COMPANIES);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(['comp-1', 'comp-2']);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([
    'balance_sheet',
    'income_statement',
    'cash_flows',
  ]);
  const [includeExecutiveSignature] = useState(true);

  // Refresh document list
  const refreshDocuments = () => {
    setDocuments(secFilingService.getDocumentsList());
  };

  // Filtered & Sorted Documents
  const filteredDocuments = useMemo(() => {
    let list = [...documents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.formType?.toLowerCase().includes(q) ||
          d.owner?.toLowerCase().includes(q)
      );
    }

    if (ownershipFilter === 'me') {
      list = list.filter((d) => d.owner === 'me');
    } else if (ownershipFilter === 'not_me') {
      list = list.filter((d) => d.owner !== 'me');
    }

    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return list;
  }, [documents, searchQuery, ownershipFilter, sortBy]);

  // Handlers
  const handleOpenDoc = (id: string) => {
    secFilingService.openDocument(id);
    navigate('/sec-filings/editor');
  };

  const handleCreateFromTemplate = (template: DocumentTemplateDefinition) => {
    const doc = secFilingService.createDocumentFromTemplate(template.id);
    toast.success(`Created "${doc.title}"`);
    navigate('/sec-filings/editor');
  };

  const handleStartBlank = () => {
    secFilingService.createDocumentFromTemplate('blank', 'Untitled Document');
    toast.success('Created blank document');
    navigate('/sec-filings/editor');
  };

  const handleDuplicate = (id: string) => {
    const copy = secFilingService.duplicateDocument(id);
    if (copy) {
      toast.success(`Created copy: ${copy.title}`);
      refreshDocuments();
    }
  };

  const handleOpenRename = (doc: SecDocumentSummary) => {
    setRenameDocId(doc.id);
    setNewTitle(doc.title);
  };

  const handleSaveRename = () => {
    if (!renameDocId || !newTitle.trim()) return;
    secFilingService.renameDocument(renameDocId, newTitle.trim());
    toast.success('Document renamed');
    setRenameDocId(null);
    refreshDocuments();
  };

  const handleConfirmDelete = () => {
    if (!deleteDocId) return;
    secFilingService.deleteDocument(deleteDocId);
    toast.success('Document removed');
    setDeleteDocId(null);
    refreshDocuments();
  };

  const handleExportDoc = async (id: string) => {
    const doc = secFilingService.openDocument(id);
    try {
      const blob = await exportSecFilingToDocx(doc);
      downloadBlob(blob, `${doc.title.replace(/[^a-z0-9]/gi, '_')}.docx`);
      toast.success('Downloaded Word document');
    } catch (e) {
      toast.error('Failed to export document');
    }
  };

  const handleFilePicked = (file: File) => {
    setImportFile(file);
    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    setImportTitle(cleanTitle);

    // Auto-detect form type from file name if possible
    if (/10-?k/i.test(file.name)) setImportFormType('Form 10-K');
    else if (/8-?k/i.test(file.name)) setImportFormType('Form 8-K');
    else if (/6-?k/i.test(file.name)) setImportFormType('Form 6-K');
    else if (/s-?1/i.test(file.name)) setImportFormType('Form S-1');
    else if (/14a|proxy/i.test(file.name)) setImportFormType('DEF 14A');
    else setImportFormType('Form 10-Q');

    setShowImportModal(true);
  };

  const handleImportFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFilePicked(file);
    }
    // reset input value so re-selecting same file works
    e.target.value = '';
  };

  const handleExecuteImportAndLock = async () => {
    if (!importFile) {
      toast.error('Please select a document file to import');
      return;
    }

    try {
      setIsImporting(true);
      const parsedDoc = await parseDocumentFile(importFile, {
        title: importTitle.trim() || importFile.name.replace(/\.[^/.]+$/, ''),
        formType: importFormType,
        period: importPeriod,
        convertTables: importConvertTables,
        lockDocument: importLockBaseline,
        lockedBy: importLockedByRole,
        includeLogo: importIncludeLogo,
      });

      // Save document contents into local storage & service
      localStorage.setItem(`sec_doc_content_${parsedDoc.id}`, JSON.stringify(parsedDoc));
      localStorage.setItem('sec_filing_main_doc_v4_compact', JSON.stringify(parsedDoc));
      localStorage.setItem('sec_filing_active_doc_id', parsedDoc.id);

      const list = secFilingService.getDocumentsList();
      list.unshift({
        id: parsedDoc.id,
        title: parsedDoc.title,
        formType: parsedDoc.formType || importFormType,
        period: parsedDoc.period,
        updatedAt: parsedDoc.updatedAt,
        createdAt: parsedDoc.createdAt,
        owner: 'me',
        isShared: true,
        version: parsedDoc.version || 'v1.0.0 (Locked Baseline)',
        blocksCount: parsedDoc.blocks.length,
        templateType: importFormType.toLowerCase().includes('10-k') ? '10-k' : '10-q',
      });
      secFilingService.saveDocumentsList(list);

      const tableCount = parsedDoc.blocks.filter((b) => b.type === 'financial_table').length;
      toast.success(
        `Imported "${parsedDoc.title}" with ${tableCount} converted table${tableCount === 1 ? '' : 's'}${
          importLockBaseline ? ' and locked baseline' : ''
        }`
      );

      setShowImportModal(false);
      navigate('/sec-filings/editor');
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(err.message || 'Failed to import document file');
    } finally {
      setIsImporting(false);
    }
  };

  const formatDateLabel = (isoDate: string) => {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };


  // Step 4 of custom multi-company wizard
  const handleCreateCustomFilingWizard = () => {
    const selectedCompanies = companies.filter((c) => selectedCompanyIds.includes(c.id));
    const primaryCompany = selectedCompanies.find((c) => c.role === 'primary') || selectedCompanies[0];
    const now = new Date().toISOString();
    const blocks: SecBlock[] = [];

    // Header & Logo
    blocks.push({
      id: `block-${Date.now()}-0`,
      type: 'image',
      section: 'HEADER',
      url: ZENATECH_LOGO_DATA_URL,
      alt: 'ZenaTech Logo',
      alignment: 'center',
      width: 220,
      spacing: 'compact',
    });

    // Metadata Block
    blocks.push({
      id: `block-${Date.now()}-1`,
      type: 'metadata',
      section: 'METADATA',
      companyName: primaryCompany.name,
      symbol: primaryCompany.ticker,
      cik: primaryCompany.cik,
      formType: formType,
      periodEnded: periodEnded,
      currency: 'USD',
      fiscalYear: fiscalYear,
      filingDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      documentTitle: filingTitle,
      jurisdiction: primaryCompany.jurisdiction,
      spacing: 'normal',
    });

    // Document Title
    blocks.push({
      id: `block-${Date.now()}-2`,
      type: 'heading',
      section: 'COVER',
      level: 1,
      text: `UNITED STATES SECURITIES AND EXCHANGE COMMISSION`,
      alignment: 'center',
      bold: true,
      spacing: 'compact',
    });

    blocks.push({
      id: `block-${Date.now()}-3`,
      type: 'heading',
      section: 'COVER',
      level: 2,
      text: `FORM ${formType}`,
      alignment: 'center',
      bold: true,
      spacing: 'normal',
    });

    // Insert selected financial table templates
    selectedTemplates.forEach((tId, idx) => {
      const tmpl = FINANCIAL_TABLE_TEMPLATES.find((t) => t.id === tId);
      if (tmpl && tmpl.block) {
        blocks.push({
          id: `block-table-${Date.now()}-${idx}`,
          type: 'financial_table',
          section: 'FINANCIALS',
          title: tmpl.block.title || tmpl.name,
          headers: tmpl.block.headers || ['', '', '2026', '2025'],
          columnAlignments: tmpl.block.columnAlignments || ['left', 'right', 'right', 'right'],
          rows: (tmpl.block.rows || []).map((r, rIdx) => ({ ...r, id: `r-${Date.now()}-${idx}-${rIdx}` })),
          spacing: 'normal',
        });
      }
    });

    if (includeExecutiveSignature) {
      blocks.push({
        id: `block-${Date.now()}-sig`,
        type: 'signature',
        section: 'SIGNATURES',
        title: 'Signatures',
        officers: [
          {
            id: 'sig-1',
            name: 'Shaun Passley, Ph.D.',
            title: 'Chief Executive Officer',
            date: new Date().toLocaleDateString(),
            signed: false,
            signatureText: '',
          },
        ],
      });
    }

    const newDoc: SecFilingDocument = {
      id: `sec-doc-custom-${Date.now()}`,
      title: `${primaryCompany.name} Form ${formType} — ${period}`,
      symbol: primaryCompany.ticker,
      formType: `Form ${formType}`,
      period,
      currency: 'USD',
      status: 'draft',
      version: 'v1.0.0',
      versionNumber: 1,
      blocks,
      createdAt: now,
      updatedAt: now,
      lastModifiedBy: 'Current User',
    };

    localStorage.setItem(`sec_doc_content_${newDoc.id}`, JSON.stringify(newDoc));
    localStorage.setItem('sec_filing_main_doc_v4_compact', JSON.stringify(newDoc));
    localStorage.setItem('sec_filing_active_doc_id', newDoc.id);

    const list = secFilingService.getDocumentsList();
    list.unshift({
      id: newDoc.id,
      title: newDoc.title,
      formType: newDoc.formType,
      period: newDoc.period,
      updatedAt: newDoc.updatedAt,
      createdAt: newDoc.createdAt,
      owner: 'me',
      isShared: true,
      version: newDoc.version,
      blocksCount: newDoc.blocks.length,
      templateType: '10-q',
    });
    secFilingService.saveDocumentsList(list);

    toast.success('Custom filing instantiated');
    setShowWizardModal(false);
    navigate('/sec-filings/editor');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. GOOGLE DOCS STYLE TOP SEARCH BAR                           */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xs border-b border-border/60 px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Left: ZenaTech SEC Docs Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 px-2 bg-white dark:bg-slate-900 border border-border/80 rounded-md flex items-center justify-center shadow-2xs">
            <img
              src={ZENATECH_LOGO_DATA_URL}
              alt="ZenaTech"
              className="h-5 max-w-[105px] object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">SEC Docs</span>
            <span className="text-xs text-muted-foreground ml-2">ZenaTech Portal</span>
          </div>
        </div>

        {/* Center: Search pill */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, forms, reports..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-background dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:focus:bg-slate-900 rounded-full text-sm text-foreground placeholder:text-muted-foreground transition-all outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 border border-transparent shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Action: Import & Folder */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFileInputChange}
            accept=".docx,.json,.txt,.csv"
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (importFile) {
                setShowImportModal(true);
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full px-3"
            title="Open file picker / Import"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import File</span>
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. "START A NEW DOCUMENT" TEMPLATE GALLERY                    */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-slate-100/70 dark:bg-slate-900/50 border-b border-border/50 py-5 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-sm font-normal text-slate-700 dark:text-slate-300">
              Start a new document
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplateGallery(!showTemplateGallery)}
                className="text-xs gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-normal hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                Template gallery
                <ChevronsUpDown className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 rounded-full hover:bg-slate-200/60">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => setShowWizardModal(true)}>
                    <Layers className="w-3.5 h-3.5 mr-2" /> Custom SEC Multi-Company Wizard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTemplateGallery(true)}>
                    <Sparkles className="w-3.5 h-3.5 mr-2" /> View All Templates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Horizontal Templates Strip */}
          <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto pb-2 scrollbar-thin">
            {/* 1. Blank Document */}
            <div
              onClick={handleStartBlank}
              className="flex flex-col items-start cursor-pointer group shrink-0"
            >
              <div className="w-[124px] h-[162px] sm:w-[136px] sm:h-[178px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xs shadow-2xs group-hover:border-blue-500 group-hover:shadow-md transition-all flex items-center justify-center relative overflow-hidden">
                {/* Google Colored Plus Sign */}
                <svg className="w-10 h-10 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none">
                  {/* Top: Red */}
                  <rect x="10.5" y="3" width="3" height="7.5" rx="1.5" fill="#EA4335" />
                  {/* Bottom: Green */}
                  <rect x="10.5" y="13.5" width="3" height="7.5" rx="1.5" fill="#34A853" />
                  {/* Left: Yellow */}
                  <rect x="3" y="10.5" width="7.5" height="3" rx="1.5" fill="#FBBC05" />
                  {/* Right: Blue */}
                  <rect x="13.5" y="10.5" width="7.5" height="3" rx="1.5" fill="#4285F4" />
                </svg>
              </div>
              <div className="mt-2 text-xs">
                <p className="font-medium text-slate-800 dark:text-slate-200">Blank document</p>
              </div>
            </div>

            {/* Predefined Templates */}
            {DOCUMENT_TEMPLATES.filter((t) => t.id !== 'blank').map((tmpl) => (
              <div
                key={tmpl.id}
                onClick={() => handleCreateFromTemplate(tmpl)}
                className="flex flex-col items-start cursor-pointer group shrink-0"
              >
                {/* Visual Document Preview Sheet */}
                <div className="w-[124px] h-[162px] sm:w-[136px] sm:h-[178px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xs shadow-2xs group-hover:border-blue-500 group-hover:shadow-md transition-all p-2.5 overflow-hidden flex flex-col justify-start relative">
                  {/* Miniature Document Design for SEC Templates */}
                  {tmpl.id === '10-q' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-[#0E2841] rounded-xs" />
                      <div className="text-[6px] font-bold text-[#0E2841] text-center pt-0.5">FORM 10-Q</div>
                      <div className="h-0.5 w-12 mx-auto bg-slate-300 rounded-xs" />
                      <div className="pt-1 space-y-0.5">
                        <div className="h-1.5 w-full bg-[#CCECFF]/60 rounded-2xs" />
                        <div className="flex justify-between text-[4px] text-slate-500">
                          <span>Cash</span>
                          <span>$12.2M</span>
                        </div>
                        <div className="flex justify-between text-[4px] text-slate-500">
                          <span>Securities</span>
                          <span>$22.3M</span>
                        </div>
                        <div className="flex justify-between text-[4px] font-bold text-slate-800 border-t border-slate-200 pt-0.5">
                          <span>Total Assets</span>
                          <span>$149M</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {tmpl.id === '10-k' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-rose-700 rounded-xs" />
                      <div className="text-[6px] font-bold text-rose-900 text-center pt-0.5">FORM 10-K</div>
                      <div className="text-[4.5px] text-slate-500 text-center">Audited Annual Report</div>
                      <div className="pt-1 space-y-0.5">
                        <div className="h-1 w-full bg-slate-200 rounded-2xs" />
                        <div className="h-1 w-4/5 bg-slate-200 rounded-2xs" />
                        <div className="h-1.5 w-full bg-[#CCECFF]/60 rounded-2xs mt-1" />
                        <div className="flex justify-between text-[4px] font-bold text-slate-800">
                          <span>Consolidated</span>
                          <span>FY 2025</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {tmpl.id === '8-k' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-emerald-600 rounded-xs" />
                      <div className="text-[6px] font-bold text-emerald-900 text-center pt-0.5">FORM 8-K</div>
                      <div className="text-[4.5px] text-slate-500 text-center">Current Report</div>
                      <div className="p-1 mt-1 rounded-2xs bg-emerald-50 border border-emerald-200 text-[4px] text-emerald-800 space-y-0.5">
                        <span className="font-bold">Item 1.01</span>
                        <div className="h-0.5 w-full bg-emerald-300 rounded-2xs" />
                        <div className="h-0.5 w-3/4 bg-emerald-300 rounded-2xs" />
                      </div>
                    </div>
                  )}

                  {tmpl.id === '6-k' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-sky-600 rounded-xs" />
                      <div className="text-[6px] font-bold text-sky-900 text-center pt-0.5">FORM 6-K</div>
                      <div className="text-[4.5px] text-slate-500 text-center">Foreign Private Issuer</div>
                      <div className="pt-1 space-y-0.5">
                        <div className="h-1.5 w-full bg-[#CCECFF]/60 rounded-2xs" />
                        <div className="flex justify-between text-[4px] text-slate-500">
                          <span>Interim Q2</span>
                          <span>CAD</span>
                        </div>
                        <div className="h-0.5 w-full bg-slate-200 rounded-2xs" />
                      </div>
                    </div>
                  )}

                  {tmpl.id === 's-1' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-amber-600 rounded-xs" />
                      <div className="text-[6px] font-bold text-amber-900 text-center pt-0.5">FORM S-1</div>
                      <div className="text-[4.5px] text-slate-500 text-center">Registration Statement</div>
                      <div className="pt-1 space-y-0.5">
                        <div className="h-1 w-full bg-slate-200 rounded-2xs" />
                        <div className="h-1 w-5/6 bg-slate-200 rounded-2xs" />
                        <div className="h-1 w-4/6 bg-slate-200 rounded-2xs" />
                      </div>
                    </div>
                  )}

                  {tmpl.id === 'def-14a' && (
                    <div className="space-y-1 opacity-90 pointer-events-none">
                      <div className="h-1.5 w-full bg-purple-600 rounded-xs" />
                      <div className="text-[6px] font-bold text-purple-900 text-center pt-0.5">DEF 14A</div>
                      <div className="text-[4.5px] text-slate-500 text-center">Proxy Statement</div>
                      <div className="pt-1 space-y-0.5">
                        <div className="h-1 w-full bg-slate-200 rounded-2xs" />
                        <div className="h-1 w-4/5 bg-slate-200 rounded-2xs" />
                        <div className="p-0.5 bg-purple-50 border border-purple-200 rounded-2xs text-[4px] text-purple-800">
                          Voting Proposals
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-xs">
                  <p className="font-medium text-slate-800 dark:text-slate-200 leading-tight">{tmpl.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{tmpl.subtitle}</p>
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. "RECENT DOCUMENTS" SECTION                                 */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6">
        {/* Active Filing Quick-Resume Banner */}
        {(() => {
          const activeDoc = secFilingService.getMainDocument();
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
                onClick={() => handleOpenDoc(activeDoc.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shrink-0 self-end sm:self-auto"
              >
                <span>Resume in Editor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })()}

        {/* Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-100">
              Recent documents
            </h2>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {filteredDocuments.length} document{filteredDocuments.length === 1 ? '' : 's'}
            </Badge>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
            {/* Ownership Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-medium transition-colors">
                  <span>
                    {ownershipFilter === 'anyone'
                      ? 'Owned by anyone'
                      : ownershipFilter === 'me'
                      ? 'Owned by me'
                      : 'Not owned by me'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => setOwnershipFilter('anyone')}>
                  Owned by anyone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOwnershipFilter('me')}>
                  Owned by me
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOwnershipFilter('not_me')}>
                  Not owned by me
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Switcher */}
            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xs bg-white dark:bg-slate-900 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xs ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-xs ${
                  viewMode === 'list'
                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 p-1.5 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  title="Sort options"
                >
                  <span className="font-semibold text-xs tracking-tight">AZ</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => setSortBy('last_modified')}>
                  Last modified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title')}>Title</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Spreadsheet Hub Shortcut Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/sec-filings/spreadsheets')}
              className="h-8 text-xs gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60"
              title="Open Spreadsheet Hub - Central workbook repository and document assignments"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Spreadsheet Hub</span>
            </Button>

            {/* Folder Picker Icon */}
            <button
              onClick={() => {
                if (importFile) {
                  setShowImportModal(true);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="p-1.5 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              title="Open file picker / Import"
            >
              <FolderOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* DOCUMENTS GRID VIEW (Google Docs Exact Style)               */}
        {/* ----------------------------------------------------------- */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredDocuments.map((doc) => {
              const isActiveFiling = doc.id === secFilingService.getActiveDocumentId() || doc.id === 'sec-doc-zenatech-2026-q2';
              return (
                <div
                  key={doc.id}
                  className={`flex flex-col bg-white dark:bg-slate-900 border rounded-sm shadow-2xs hover:border-blue-500 hover:shadow-md transition-all group overflow-hidden ${
                    isActiveFiling
                      ? 'border-blue-500/80 dark:border-blue-600/80 ring-1 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Document Thumbnail Preview (Paper Sheet) */}
                  <div
                    onClick={() => handleOpenDoc(doc.id)}
                    className="aspect-[1/1.22] bg-white dark:bg-slate-900/90 p-3 cursor-pointer border-b border-slate-100 dark:border-slate-800/80 overflow-hidden relative select-none"
                  >
                    {isActiveFiling && (
                      <div className="absolute top-2 right-2 z-10">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-600/90 text-white text-[9px] font-medium shadow-xs backdrop-blur-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active Filing
                        </span>
                      </div>
                    )}
                    <DocumentThumbnailPreview doc={doc} />
                  </div>

                  {/* Document Card Footer */}
                  <div className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
                    <div
                      onClick={() => handleOpenDoc(doc.id)}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {doc.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                        {/* ZenaTech Mini Logo Asset */}
                        <div className="w-4 h-4 rounded-xs flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-0.5 overflow-hidden">
                          <img src={ZENATECH_LOGO_DATA_URL} alt="ZenaTech" className="w-full h-full object-contain" />
                        </div>
                        {doc.isShared && <Users className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span className="truncate">{formatDateLabel(doc.updatedAt)}</span>
                      </div>
                      {/* Linked Spreadsheet Pill */}
                      {(() => {
                        const assignedSheet = getAssignedSpreadsheet(doc.id);
                        if (!assignedSheet) return null;
                        return (
                          <div className="mt-1.5 flex items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectorDoc(doc);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors truncate max-w-full"
                              title={`Linked Workbook: ${assignedSheet.fileName} (Click to change)`}
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{assignedSheet.fileName}</span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                  {/* Actions Three Dots */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={() => handleOpenDoc(doc.id)}>
                        <FileText className="w-3.5 h-3.5 mr-2" /> Open in editor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectorDoc(doc)}>
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                        {getAssignedSpreadsheet(doc.id) ? 'Change Linked Workbook...' : 'Link Spreadsheet Workbook...'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenRename(doc)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(doc.id)}>
                        <Copy className="w-3.5 h-3.5 mr-2" /> Make a copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportDoc(doc.id)}>
                        <Download className="w-3.5 h-3.5 mr-2" /> Download Word (.docx)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteDocId(doc.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

        {/* ----------------------------------------------------------- */}
        {/* DOCUMENTS LIST VIEW                                         */}
        {/* ----------------------------------------------------------- */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden shadow-2xs">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-muted-foreground font-medium">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Owner</th>
                  <th className="text-left px-4 py-3">Last modified</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDocuments.map((doc) => {
                  const isActiveFiling = doc.id === secFilingService.getActiveDocumentId() || doc.id === 'sec-doc-zenatech-2026-q2';
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleOpenDoc(doc.id)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                        isActiveFiling ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 flex items-center gap-2.5 font-medium text-slate-800 dark:text-slate-200">
                        <div className="w-5 h-5 rounded-xs flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-0.5 overflow-hidden">
                          <img src={ZENATECH_LOGO_DATA_URL} alt="ZenaTech" className="w-full h-full object-contain" />
                        </div>
                        <span className="truncate max-w-md">{doc.title}</span>
                        {(() => {
                          const assignedSheet = getAssignedSpreadsheet(doc.id);
                          if (!assignedSheet) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectorDoc(doc);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 shrink-0"
                              title={`Linked Workbook: ${assignedSheet.fileName} (Click to change)`}
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[130px]">{assignedSheet.fileName}</span>
                            </button>
                          );
                        })()}
                        {isActiveFiling && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 text-[10px] py-0 px-1.5 shrink-0">
                            Active Filing
                          </Badge>
                        )}
                        {doc.isShared && <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.owner}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateLabel(doc.updatedAt)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => handleOpenDoc(doc.id)}>
                              <FileText className="w-3.5 h-3.5 mr-2" /> Open in editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectorDoc(doc)}>
                              <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                              {getAssignedSpreadsheet(doc.id) ? 'Change Linked Workbook...' : 'Link Spreadsheet Workbook...'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenRename(doc)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(doc.id)}>
                              <Copy className="w-3.5 h-3.5 mr-2" /> Make a copy
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportDoc(doc.id)}>
                              <Download className="w-3.5 h-3.5 mr-2" /> Download Word (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteDocId(doc.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredDocuments.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No documents found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? `No files matching "${searchQuery}"` : 'Create your first document using the templates above.'}
            </p>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 4. EXPANDED TEMPLATE GALLERY MODAL                            */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showTemplateGallery} onOpenChange={setShowTemplateGallery}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-blue-600" /> Template Gallery
            </DialogTitle>
            <DialogDescription>
              Choose from pre-built SEC filings, financial disclosures, and operational checklists.
            </DialogDescription>
          </DialogHeader>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
            <button
              onClick={() => setTemplateCategory('all')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                templateCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              All Templates
            </button>
            <button
              onClick={() => setTemplateCategory('sec')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                templateCategory === 'sec'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              SEC Filings
            </button>
            <button
              onClick={() => setTemplateCategory('operations')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                templateCategory === 'operations'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Checklists & Ops
            </button>
            <button
              onClick={() => setTemplateCategory('executive')}
              className={`px-3 py-1.5 rounded-full font-medium ${
                templateCategory === 'executive'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Proposals & Memos
            </button>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-3">
            {DOCUMENT_TEMPLATES.filter(
              (t) => templateCategory === 'all' || t.category === templateCategory
            ).map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setShowTemplateGallery(false);
                  handleCreateFromTemplate(t);
                }}
                className="border border-border/80 rounded-md p-3 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-card flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-foreground">{t.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.description}</p>
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs mt-3 h-7">
                  Use template
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowTemplateGallery(false);
                setShowWizardModal(true);
              }}
              className="text-xs gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" /> Multi-Company Wizard
            </Button>
            <Button size="sm" onClick={() => setShowTemplateGallery(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* 5. RENAME DOCUMENT DIALOG                                     */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!renameDocId} onOpenChange={(open) => !open && setRenameDocId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Rename Document</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rename-input" className="text-xs">
              Document title
            </Label>
            <Input
              id="rename-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1.5 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenameDocId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* 6. DELETE CONFIRMATION DIALOG                                 */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Remove Document?
            </DialogTitle>
            <DialogDescription className="text-xs">
              This document will be removed from your recent documents list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDocId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. CUSTOM SEC MULTI-COMPANY WIZARD MODAL                      */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showWizardModal} onOpenChange={setShowWizardModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-blue-600" /> Multi-Company SEC Filing Wizard
            </DialogTitle>
            <DialogDescription>
              Step-by-step creation for consolidated public reporting entities (Step {step} of 4)
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label>Form Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10-Q">Form 10-Q (Quarterly Report)</SelectItem>
                    <SelectItem value="10-K">Form 10-K (Annual Audited Report)</SelectItem>
                    <SelectItem value="8-K">Form 8-K (Current Report)</SelectItem>
                    <SelectItem value="6-K">Form 6-K (Foreign Private Issuer)</SelectItem>
                    <SelectItem value="S-1">Form S-1 (Registration Statement)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Reporting Period</Label>
                  <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label>Period Ended Date</Label>
                  <Input value={periodEnded} onChange={(e) => setPeriodEnded(e.target.value)} className="text-xs" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2 text-xs">
              <Label>Select Consolidated Companies</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                {companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedCompanyIds.includes(c.id)}
                        onCheckedChange={() =>
                          setSelectedCompanyIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                      />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {c.ticker} ({c.exchange})
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 py-2 text-xs">
              <Label>Financial Statements & Disclosures</Label>
              <div className="grid grid-cols-2 gap-2">
                {FINANCIAL_TABLE_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    onClick={() =>
                      setSelectedTemplates((prev) =>
                        prev.includes(tmpl.id) ? prev.filter((id) => id !== tmpl.id) : [...prev, tmpl.id]
                      )
                    }
                    className={`p-2.5 rounded-sm border cursor-pointer flex items-center gap-2 ${
                      selectedTemplates.includes(tmpl.id) ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40' : 'border-border'
                    }`}
                  >
                    <Checkbox checked={selectedTemplates.includes(tmpl.id)} />
                    <span className="font-medium text-xs truncate">{tmpl.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-md space-y-1">
                <p className="font-semibold text-foreground">Review & Instantiate</p>
                <p className="text-muted-foreground">Form {formType} for {period} with {selectedCompanyIds.length} entities and {selectedTemplates.length} financial statement tables.</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between border-t pt-3">
            {step > 1 ? (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => (s - 1) as any)}>
                Back
              </Button>
            ) : <div />}
            {step < 4 ? (
              <Button size="sm" onClick={() => setStep((s) => (s + 1) as any)}>
                Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreateCustomFilingWizard} className="bg-blue-600 hover:bg-blue-700">
                Create & Open Document
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* 8. IMPORT DOCUMENT & CONVERT TABLES MODAL                     */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UploadCloud className="w-5 h-5 text-blue-600" /> Import Document & Convert Baseline
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload Word (.docx), JSON, or formatted document files. Convert embedded tables into interactive SEC financial tables and lock the baseline version for audit governance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 1. File Upload / Dropzone */}
            {!importFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFilePicked(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <UploadCloud className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <p className="font-semibold text-sm text-foreground">Click to browse or drop document here</p>
                <p className="text-muted-foreground mt-1">Supports Word (.docx), SEC JSON, CSV, and Text files</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-md border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-sm bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{importFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(importFile.size / 1024).toFixed(1)} KB &bull;{' '}
                      {importFile.name.endsWith('.docx')
                        ? 'Microsoft Word Document'
                        : importFile.name.endsWith('.json')
                        ? 'JSON Structured Document'
                        : 'Text / Table File'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      fileInputRef.current?.click();
                    }}
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}

            {/* 2. Document Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="import-doc-title" className="text-xs font-medium">Document Title</Label>
                <Input
                  id="import-doc-title"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="e.g., ZenaTech Form 10-Q Q2 2026"
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Filing / Form Type</Label>
                <Select value={importFormType} onValueChange={setImportFormType}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Form 10-Q">Form 10-Q (Quarterly Report)</SelectItem>
                    <SelectItem value="Form 10-K">Form 10-K (Annual Audited Report)</SelectItem>
                    <SelectItem value="Form 8-K">Form 8-K (Current Report)</SelectItem>
                    <SelectItem value="Form 6-K">Form 6-K (Foreign Private Issuer)</SelectItem>
                    <SelectItem value="Form S-1">Form S-1 (Registration Statement)</SelectItem>
                    <SelectItem value="DEF 14A">DEF 14A (Proxy Statement)</SelectItem>
                    <SelectItem value="General Report">General Corporate Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="import-doc-period" className="text-xs font-medium">Reporting Period</Label>
                <Input
                  id="import-doc-period"
                  value={importPeriod}
                  onChange={(e) => setImportPeriod(e.target.value)}
                  placeholder="e.g., Q2 2026, June 30, 2026"
                  className="text-xs h-8"
                />
              </div>
            </div>

            {/* 3. Table Conversion Options */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-md space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="convert-tables-checkbox"
                  checked={importConvertTables}
                  onCheckedChange={(c) => setImportConvertTables(!!c)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="convert-tables-checkbox" className="font-semibold text-xs text-foreground cursor-pointer flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> Convert Tables to SEC Financial Tables
                    </Label>
                    <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0">Recommended</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Auto-detects Word tables (&lt;w:tbl&gt;), parses column headers, right-aligns currency numbers, and cleans ghost columns for financial statement editing.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Baseline Locking & Audit Protection */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-border rounded-md space-y-3">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="lock-baseline-checkbox"
                  checked={importLockBaseline}
                  onCheckedChange={(c) => setImportLockBaseline(!!c)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="lock-baseline-checkbox" className="font-semibold text-xs text-foreground cursor-pointer flex items-center gap-1.5">
                      {importLockBaseline ? (
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      Lock Document Baseline (Audit Governance)
                    </Label>
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-[9px] px-1.5 py-0">
                      Compliance
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Locks document baseline in <span className="font-medium text-foreground">Under Review</span> status. Team members will propose change requests with diffs rather than directly overwriting audited figures.
                  </p>
                </div>
              </div>

              {importLockBaseline && (
                <div className="pt-2 border-t border-border/60 pl-6 space-y-1.5">
                  <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Authorized Locking Authority
                  </Label>
                  <Select value={importLockedByRole} onValueChange={setImportLockedByRole}>
                    <SelectTrigger className="text-xs h-7 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lead Controller">Lead Controller (Finance Team)</SelectItem>
                      <SelectItem value="Chief Accounting Officer (CAO)">Chief Accounting Officer (CAO)</SelectItem>
                      <SelectItem value="Chief Financial Officer (CFO)">Chief Financial Officer (CFO)</SelectItem>
                      <SelectItem value="Shaun Passley, CEO">Shaun Passley, Ph.D. (CEO)</SelectItem>
                      <SelectItem value="External Auditor (PwC)">External Audit Team (PwC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* 5. Additional Branding Option */}
            <div className="flex items-center gap-2 pl-1">
              <Checkbox
                id="include-logo-checkbox"
                checked={importIncludeLogo}
                onCheckedChange={(c) => setImportIncludeLogo(!!c)}
              />
              <Label htmlFor="include-logo-checkbox" className="text-xs text-muted-foreground cursor-pointer">
                Include official ZenaTech header banner &amp; cover logo block
              </Label>
            </div>
          </div>

          <DialogFooter className="flex justify-between border-t pt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              disabled={isImporting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteImportAndLock}
              disabled={!importFile || isImporting}
              className="bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Converting &amp; Locking...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Convert Tables, Lock &amp; Open Document</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spreadsheet Selector Modal */}
      {selectorDoc && (
        <SpreadsheetSelectorModal
          open={!!selectorDoc}
          onOpenChange={(open) => {
            if (!open) setSelectorDoc(null);
          }}
          documentId={selectorDoc.id}
          documentTitle={selectorDoc.title}
          currentSpreadsheetId={getAssignedSpreadsheet(selectorDoc.id)?.id || null}
          onSpreadsheetAssigned={() => {
            refreshDocuments();
          }}
        />
      )}
    </div>
  );
}
