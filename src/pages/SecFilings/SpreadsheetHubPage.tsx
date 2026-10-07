import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  CopyPlus,
  ExternalLink,
  FileText,
  RefreshCw,
  Table,
  X,
  Sparkles,
  Link2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
import { toast } from 'sonner';
import { secFilingService } from '../../services/secFilingService';
import type { AttachedSpreadsheet, SecDocumentSummary } from '../../types/secFiling';
import {
  parseExcelFileToSpreadsheet,
  exportSpreadsheetToExcel,
  createBlankSpreadsheet,
  ensureSpreadsheetTabs
} from '../../utils/documentVariables';
import { AttachedSpreadsheetModal } from './components/AttachedSpreadsheetModal';
import { DEFAULT_TRIAL_BALANCE_SHEET } from '../../data/defaultTrialBalanceSheet';

export const SpreadsheetHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [spreadsheets, setSpreadsheets] = useState<AttachedSpreadsheet[]>(() =>
    secFilingService.getAllSpreadsheets()
  );
  const [documents, setDocuments] = useState<SecDocumentSummary[]>(() =>
    secFilingService.getAllDocuments()
  );

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // New Sheet Modal
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState('Operating Model');
  const [newSheetTab, setNewSheetTab] = useState('Summary');
  const [newSheetRows, setNewSheetRows] = useState('30');
  const [newSheetCols, setNewSheetCols] = useState('10');

  // Manage Assignments Modal
  const [assignmentModalSheet, setAssignmentModalSheet] = useState<AttachedSpreadsheet | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Open Full Grid Editor Modal
  const [editingSheet, setEditingSheet] = useState<AttachedSpreadsheet | null>(null);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Reload spreadsheets from service
  const refreshHub = () => {
    setSpreadsheets(secFilingService.getAllSpreadsheets());
    setDocuments(secFilingService.getAllDocuments());
  };

  useEffect(() => {
    refreshHub();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalSheets = spreadsheets.length;
    const allAssignedIds = new Set<string>();
    let totalCellsCount = 0;

    for (const sheet of spreadsheets) {
      if (sheet.assignedDocIds) {
        sheet.assignedDocIds.forEach((id) => allAssignedIds.add(id));
      }
      totalCellsCount += Object.keys(sheet.cells || {}).length;
      if (sheet.tabs) {
        for (const t of sheet.tabs) {
          totalCellsCount += Object.keys(t.cells || {}).length;
        }
      }
    }

    const assignedSheetsCount = spreadsheets.filter(
      (s) => s.assignedDocIds && s.assignedDocIds.length > 0
    ).length;
    const unassignedSheetsCount = totalSheets - assignedSheetsCount;

    return {
      totalSheets,
      totalAssignedDocs: allAssignedIds.size,
      assignedSheetsCount,
      unassignedSheetsCount,
      totalCellsCount
    };
  }, [spreadsheets]);

  // Filtered spreadsheets
  const filteredSpreadsheets = useMemo(() => {
    return spreadsheets.filter((sheet) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        sheet.fileName.toLowerCase().includes(q) ||
        (sheet.description && sheet.description.toLowerCase().includes(q)) ||
        (sheet.tabs && sheet.tabs.some((t) => t.name.toLowerCase().includes(q))) ||
        (sheet.assignedDocIds &&
          sheet.assignedDocIds.some((docId) => {
            const doc = documents.find((d) => d.id === docId);
            return doc && doc.title.toLowerCase().includes(q);
          }));

      if (!matchesSearch) return false;

      const hasAssignments = sheet.assignedDocIds && sheet.assignedDocIds.length > 0;
      if (filterType === 'assigned') return hasAssignments;
      if (filterType === 'unassigned') return !hasAssignments;
      return true;
    });
  }, [spreadsheets, documents, searchQuery, filterType]);

  // Create Blank Sheet
  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const rows = parseInt(newSheetRows, 10) || 30;
    const cols = parseInt(newSheetCols, 10) || 10;
    const blank = createBlankSpreadsheet(
      newSheetName.trim() || 'New Spreadsheet',
      newSheetTab.trim() || 'Sheet1',
      rows,
      cols
    );
    blank.assignedDocIds = [];
    blank.description = 'Custom financial workbook.';
    secFilingService.saveSpreadsheet(blank);
    refreshHub();
    setIsNewSheetOpen(false);
    toast.success(`Created spreadsheet "${blank.fileName}"!`);
  };

  // Upload .xlsx
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const parsed = await parseExcelFileToSpreadsheet(file);
      parsed.assignedDocIds = [];
      parsed.description = `Imported from ${file.name} on ${new Date().toLocaleDateString()}`;
      secFilingService.saveSpreadsheet(parsed);
      refreshHub();
      toast.success(
        `Imported "${parsed.fileName}" with ${parsed.tabs?.length || 1} tab${
          (parsed.tabs?.length || 1) > 1 ? 's' : ''
        }!`
      );
    } catch {
      toast.error('Failed to parse Excel workbook. Please verify the file format.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Load Starter Trial Balance Sample
  const handleLoadSampleMasterTB = () => {
    const masterTB: AttachedSpreadsheet = {
      ...DEFAULT_TRIAL_BALANCE_SHEET,
      id: `sheet-tb-${Date.now()}`,
      fileName: 'TB_Consolidated_Master_Q2_2026_FINAL.xlsx',
      assignedDocIds: [],
      description: 'Full Trial Balance starter template (272 rows × 49 columns A-AW).'
    };
    secFilingService.saveSpreadsheet(masterTB);
    refreshHub();
    toast.success('Added Consolidated Master Trial Balance to Hub!');
  };

  // Export Sheet
  const handleExport = async (sheet: AttachedSpreadsheet) => {
    try {
      const blob = await exportSpreadsheetToExcel(sheet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sheet.fileName.endsWith('.xlsx') ? sheet.fileName : `${sheet.fileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported "${sheet.fileName}"`);
    } catch {
      toast.error('Failed to export workbook to Excel.');
    }
  };

  // Duplicate Sheet
  const handleDuplicate = (sheet: AttachedSpreadsheet) => {
    const safe = ensureSpreadsheetTabs(sheet);
    const cloned: AttachedSpreadsheet = {
      ...safe,
      id: `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: `${sheet.fileName.replace(/\.xlsx$/i, '')} (Copy).xlsx`,
      assignedDocIds: [],
      updatedAt: new Date().toISOString()
    };
    secFilingService.saveSpreadsheet(cloned);
    refreshHub();
    toast.success(`Duplicated "${sheet.fileName}"`);
  };

  // Delete Sheet
  const handleDelete = (sheet: AttachedSpreadsheet) => {
    if (confirm(`Are you sure you want to delete "${sheet.fileName}"? It will be unlinked from all documents.`)) {
      secFilingService.deleteSpreadsheet(sheet.id);
      refreshHub();
      toast.info(`Deleted "${sheet.fileName}"`);
    }
  };

  // Open Manage Assignments Modal
  const handleOpenAssignments = (sheet: AttachedSpreadsheet) => {
    setAssignmentModalSheet(sheet);
    setSelectedDocIds(sheet.assignedDocIds || []);
  };

  // Save Assignments
  const handleSaveAssignments = () => {
    if (!assignmentModalSheet) return;
    secFilingService.assignSpreadsheetToDocuments(assignmentModalSheet.id, selectedDocIds);
    refreshHub();
    setAssignmentModalSheet(null);
    toast.success(
      `Updated assignments for "${assignmentModalSheet.fileName}" (${selectedDocIds.length} document${
        selectedDocIds.length === 1 ? '' : 's'
      } linked)!`
    );
  };

  // Toggle Document Assignment
  const toggleDocAssignment = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Navigate to Document Editor with Document
  const handleOpenDocumentInEditor = (docId: string) => {
    // openDocument (not just setActiveDocumentId) so the editor's main doc is
    // actually swapped to this document along with its linked workbook.
    secFilingService.openDocument(docId);
    navigate('/sec-filings/editor');
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Top Banner / Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  Spreadsheet Hub
                </h1>
                <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 font-mono text-xs">
                  {stats.totalSheets} Workbooks
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                Centralized financial models, trial balances, and multi-document variable links.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-9 gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>{isUploading ? 'Parsing .xlsx...' : 'Upload Workbook'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadSampleMasterTB}
              className="h-9 gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold cursor-pointer"
              title="Load full 06.30.26 TB Starter Sample"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Sample TB Model</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewSheetOpen(true)}
              className="h-9 gap-1.5 bg-[#0E2841] hover:bg-[#153a5e] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Spreadsheet</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 px-6 py-3.5 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Total Workbooks</div>
              <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">{stats.totalSheets}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Assigned Workbooks</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.assignedSheetsCount}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Linked Documents</div>
              <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {stats.totalAssignedDocs}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Total Populated Cells</div>
              <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                {stats.totalCellsCount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 sm:px-8 flex flex-col gap-6">
        {/* Controls Toolbar: Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by workbook name, tab name, or assigned document..."
              className="pl-9 h-9 text-xs bg-slate-50 dark:bg-zinc-800/60 border-slate-300 dark:border-zinc-700"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              All ({spreadsheets.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('assigned')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filterType === 'assigned'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Assigned ({stats.assignedSheetsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('unassigned')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                filterType === 'unassigned'
                  ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              Unassigned ({stats.unassignedSheetsCount})
            </button>
          </div>
        </div>

        {/* Spreadsheets Grid */}
        {filteredSpreadsheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">No Spreadsheets Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {searchQuery
                ? `No workbooks match "${searchQuery}". Try clearing your search.`
                : 'Get started by creating a new blank spreadsheet or uploading an existing .xlsx file.'}
            </p>
            {searchQuery ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsNewSheetOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Spreadsheet</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSpreadsheets.map((sheet) => {
              const safe = ensureSpreadsheetTabs(sheet);
              const tabsCount = safe.tabs?.length || 1;
              const assignedDocIds = sheet.assignedDocIds || [];
              const assignedDocs = documents.filter((d) => assignedDocIds.includes(d.id));
              const cellCount = Object.keys(sheet.cells || {}).length;

              return (
                <div
                  key={sheet.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between gap-4 group"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3
                            onClick={() => setEditingSheet(sheet)}
                            className="font-bold text-sm text-slate-900 dark:text-zinc-100 truncate cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                            title={sheet.fileName}
                          >
                            {sheet.fileName}
                          </h3>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {tabsCount} {tabsCount === 1 ? 'Tab' : 'Tabs'} • {sheet.rowCount} rows ×{' '}
                            {sheet.colCount} cols • {cellCount} cells
                          </div>
                        </div>
                      </div>

                      {/* Top Action Badges */}
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleExport(sheet)}
                          title="Export to .xlsx"
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(sheet)}
                          title="Duplicate spreadsheet"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <CopyPlus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sheet)}
                          title="Delete spreadsheet"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {sheet.description && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 line-clamp-2">
                        {sheet.description}
                      </p>
                    )}

                    {/* Tabs Pill List */}
                    {safe.tabs && safe.tabs.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-3">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Tabs:</span>
                        {safe.tabs.map((t) => (
                          <Badge
                            key={t.id}
                            variant="secondary"
                            className="text-[10px] font-mono font-normal bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 px-1.5 py-0"
                          >
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assigned Documents Section */}
                  <div className="bg-slate-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-slate-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                        <Link2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Assigned Documents</span>
                        <span className="text-slate-400 font-mono">({assignedDocs.length})</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAssignments(sheet)}
                        className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold cursor-pointer"
                      >
                        Change
                      </Button>
                    </div>

                    {assignedDocs.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {assignedDocs.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => handleOpenDocumentInEditor(doc.id)}
                            className="flex items-center justify-between gap-2 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded text-xs hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer group/doc"
                            title={`Click to open "${doc.title}" in Document Editor`}
                          >
                            <span className="truncate font-medium text-slate-800 dark:text-zinc-200 group-hover/doc:text-emerald-700 dark:group-hover/doc:text-emerald-400">
                              {doc.title}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover/doc:text-emerald-600 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center justify-between">
                        <span>Not assigned to any document yet.</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssignments(sheet)}
                          className="h-5 text-[10px] px-1.5 border-dashed"
                        >
                          + Assign
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                    <span className="text-[10px] text-slate-400">
                      Updated{' '}
                      {sheet.updatedAt
                        ? new Date(sheet.updatedAt).toLocaleDateString()
                        : 'Recently'}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setEditingSheet(sheet)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Open Sheet Editor</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog: Create New Spreadsheet */}
      <Dialog open={isNewSheetOpen} onOpenChange={setIsNewSheetOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
          <form onSubmit={handleCreateSheet}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Create New Spreadsheet in Hub</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Define workbook title and starting grid dimensions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="hub-sheet-name">Workbook Name (.xlsx)</Label>
                <Input
                  id="hub-sheet-name"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="e.g. Operating Model 2026"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hub-tab-name">Primary Worksheet Tab Name</Label>
                <Input
                  id="hub-tab-name"
                  value={newSheetTab}
                  onChange={(e) => setNewSheetTab(e.target.value)}
                  placeholder="e.g. Sheet1 or Summary"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hub-rows">Initial Rows</Label>
                  <Input
                    id="hub-rows"
                    type="number"
                    min="1"
                    max="1000"
                    value={newSheetRows}
                    onChange={(e) => setNewSheetRows(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hub-cols">Initial Columns</Label>
                  <Input
                    id="hub-cols"
                    type="number"
                    min="1"
                    max="52"
                    value={newSheetCols}
                    onChange={(e) => setNewSheetCols(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewSheetOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Create Spreadsheet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manage Document Assignments */}
      <Dialog
        open={assignmentModalSheet !== null}
        onOpenChange={(open) => !open && setAssignmentModalSheet(null)}
      >
        <DialogContent className="max-w-xl bg-white dark:bg-zinc-900 flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              <span>Assign "{assignmentModalSheet?.fileName}" to Documents</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Multiple documents can share this spreadsheet. Check all documents that should link to this workbook.
            </DialogDescription>
          </DialogHeader>

          {/* Explanatory Info Card */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cross-Document Dynamic Linking:</span> Any changes made to
              cell values in this spreadsheet will instantly reflect across all selected documents.
            </div>
          </div>

          {/* Documents Selection List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 max-h-[360px] pr-1">
            {documents.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No documents found in portal.
              </div>
            ) : (
              documents.map((doc) => {
                const isChecked = selectedDocIds.includes(doc.id);

                return (
                  <div
                    key={doc.id}
                    onClick={() => toggleDocAssignment(doc.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 text-blue-950 dark:text-blue-100'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleDocAssignment(doc.id)}
                        className="cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{doc.formType}</span>
                          <span>•</span>
                          <span>{doc.period}</span>
                        </div>
                      </div>
                    </div>

                    {isChecked && (
                      <Badge className="bg-blue-600 text-white text-[10px] font-mono shrink-0">
                        Linked
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Selected: <strong className="text-blue-600">{selectedDocIds.length}</strong> of{' '}
              {documents.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAssignmentModalSheet(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAssignments}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Save Assignments
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full 2D-Virtual Grid Editor Modal */}
      {editingSheet && (
        <AttachedSpreadsheetModal
          open={editingSheet !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSheet(null);
              refreshHub();
            }
          }}
          spreadsheet={editingSheet}
          onUpdateSpreadsheet={(updated) => {
            secFilingService.saveSpreadsheet(updated);
            setEditingSheet(updated);
          }}
          onUpdateCell={(cellRef, val, updatedSheet) => {
            const updated = updatedSheet || {
              ...editingSheet,
              cells: {
                ...editingSheet.cells,
                [cellRef]: val
              }
            };
            secFilingService.saveSpreadsheet(updated);
            setEditingSheet(updated);
            return 1;
          }}
          blocks={[]}
          mode="manage"
        />
      )}
    </div>
  );
};
