import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  FileSpreadsheet,
  Check,
  Upload,
  Plus,
  Unlink,
  ExternalLink,
  Layers,
  Table,
  Hash,
  Search,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { secFilingService } from '../../../services/secFilingService';
import type { AttachedSpreadsheet, SecDocumentSummary } from '../../../types/secFiling';
import {
  createBlankSpreadsheet,
  parseExcelFileToSpreadsheet,
  ensureSpreadsheetTabs
} from '../../../utils/documentVariables';

export interface SpreadsheetSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
  currentSpreadsheetId?: string | null;
  onSpreadsheetAssigned?: (sheetId: string | null) => void;
}

export const SpreadsheetSelectorModal: React.FC<SpreadsheetSelectorModalProps> = ({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  currentSpreadsheetId,
  onSpreadsheetAssigned
}) => {
  const navigate = useNavigate();
  const [spreadsheets, setSpreadsheets] = useState<AttachedSpreadsheet[]>([]);
  const [documents, setDocuments] = useState<SecDocumentSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blank creation state
  const [showCreateBlank, setShowCreateBlank] = useState(false);
  const [newWorkbookName, setNewWorkbookName] = useState('New_Financial_Model.xlsx');
  const [newTabName, setNewTabName] = useState('Summary');
  const [newRows, setNewRows] = useState(30);
  const [newCols, setNewCols] = useState(10);

  const loadData = () => {
    const sheets = secFilingService.getAllSpreadsheets();
    const docs = secFilingService.getAllDocuments();
    setSpreadsheets(sheets);
    setDocuments(docs);
  };

  useEffect(() => {
    if (open) {
      loadData();
      setShowCreateBlank(false);
      setSearchQuery('');
    }
  }, [open]);

  const activeSheetId = currentSpreadsheetId || null;

  const filteredSheets = spreadsheets.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = s.fileName.toLowerCase().includes(q) || (s.sheetName || '').toLowerCase().includes(q);
    const descMatch = (s.description || '').toLowerCase().includes(q);
    return nameMatch || descMatch;
  });

  const getDocTitle = (id: string) => {
    const doc = documents.find((d) => d.id === id);
    return doc ? doc.title : id;
  };

  const handleSelectSheet = (sheetId: string) => {
    secFilingService.assignSpreadsheetToDocument(documentId, sheetId);
    toast.success(`Assigned workbook to "${documentTitle}"`);
    onSpreadsheetAssigned?.(sheetId);
    onOpenChange(false);
  };

  const handleUnassignCurrent = () => {
    secFilingService.assignSpreadsheetToDocument(documentId, null);
    toast.info(`Unlinked workbook from "${documentTitle}"`);
    onSpreadsheetAssigned?.(null);
    onOpenChange(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.info(`Parsing ${file.name}...`);
      const parsedSheet = await parseExcelFileToSpreadsheet(file);
      parsedSheet.assignedDocIds = [documentId];
      parsedSheet.description = `Imported from ${file.name} for ${documentTitle}`;

      secFilingService.saveSpreadsheet(parsedSheet);
      secFilingService.assignSpreadsheetToDocument(documentId, parsedSheet.id);

      toast.success(`Uploaded and linked "${parsedSheet.fileName}"!`);
      loadData();
      onSpreadsheetAssigned?.(parsedSheet.id);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to import workbook', {
        description: err.message || 'Please upload a valid .xlsx or .xls file.'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateBlankSheet = () => {
    const name = newWorkbookName.trim() || 'Custom_Workbook.xlsx';
    const tab = newTabName.trim() || 'Sheet1';
    const rows = Math.max(5, Math.min(200, Number(newRows) || 30));
    const cols = Math.max(3, Math.min(26, Number(newCols) || 10));

    const sheet = createBlankSpreadsheet(name, tab, rows, cols);
    sheet.assignedDocIds = [documentId];
    sheet.description = `Created custom workbook for ${documentTitle}`;

    secFilingService.saveSpreadsheet(sheet);
    secFilingService.assignSpreadsheetToDocument(documentId, sheet.id);

    toast.success(`Created & linked "${sheet.fileName}"!`);
    loadData();
    onSpreadsheetAssigned?.(sheet.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-emerald-50/50 via-teal-50/20 to-transparent dark:from-emerald-950/20 dark:via-zinc-900 dark:to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Link Workbook to Document
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select a spreadsheet from the central Hub or upload a new one for{' '}
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    "{documentTitle}"
                  </span>
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate('/sec-filings/spreadsheets');
              }}
              className="text-xs gap-1.5 h-8 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <span>Go to Spreadsheet Hub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Search & Actions Bar */}
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search workbooks in Hub..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white dark:bg-zinc-900"
              />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Upload (.xlsx)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateBlank(!showCreateBlank)}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Create Blank</span>
            </Button>
          </div>
        </div>

        {/* Blank Creation Drawer */}
        {showCreateBlank && (
          <div className="p-4 border-b bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Create New Workbook
              </span>
              <button
                type="button"
                onClick={() => setShowCreateBlank(false)}
                className="text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-muted-foreground block mb-1 font-medium">Workbook File Name</label>
                <Input
                  value={newWorkbookName}
                  onChange={(e) => setNewWorkbookName(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-zinc-900"
                  placeholder="e.g. Q2_Trial_Balance.xlsx"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1 font-medium">First Tab Name</label>
                <Input
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-zinc-900"
                  placeholder="e.g. Financials"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1 font-medium">Rows × Cols</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={5}
                    max={200}
                    value={newRows}
                    onChange={(e) => setNewRows(Number(e.target.value))}
                    className="h-8 text-xs bg-white dark:bg-zinc-900 w-1/2 px-1"
                  />
                  <span className="text-slate-400 text-xs">×</span>
                  <Input
                    type="number"
                    min={3}
                    max={26}
                    value={newCols}
                    onChange={(e) => setNewCols(Number(e.target.value))}
                    className="h-8 text-xs bg-white dark:bg-zinc-900 w-1/2 px-1"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={handleCreateBlankSheet}
                  className="h-8 w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  Create & Link
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Workbooks List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredSheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <div className="p-3 rounded-full bg-slate-100 dark:bg-zinc-800 w-12 h-12 mx-auto flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm">No spreadsheets match your search in the Hub.</p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upload .xlsx</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateBlank(true)}
                  className="text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Create Blank</span>
                </Button>
              </div>
            </div>
          ) : (
            filteredSheets.map((sheet) => {
              const safe = ensureSpreadsheetTabs(sheet);
              const isCurrentlyAssigned = activeSheetId === sheet.id || sheet.assignedDocIds?.includes(documentId);
              const assignedDocs = sheet.assignedDocIds || [];
              const otherAssignedDocs = assignedDocs.filter((id) => id !== documentId);
              const cellCount = Object.keys(sheet.cells || {}).length;
              const tabCount = safe.tabs?.length || 1;

              return (
                <div
                  key={sheet.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrentlyAssigned
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          isCurrentlyAssigned
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800 dark:text-zinc-100 truncate">
                            {sheet.fileName}
                          </span>
                          {isCurrentlyAssigned && (
                            <Badge className="bg-emerald-600 text-white text-[10px] gap-1 px-1.5 py-0">
                              <Check className="w-3 h-3" />
                              Currently Linked
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {sheet.id}
                          </span>
                        </div>

                        {sheet.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {sheet.description}
                          </p>
                        )}

                        {/* Metadata Pills */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {tabCount} tab{tabCount === 1 ? '' : 's'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Table className="w-3 h-3 text-slate-400" />
                            {sheet.rowCount} rows × {sheet.colCount} cols
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Hash className="w-3 h-3 text-slate-400" />
                            {cellCount} cells
                          </span>
                        </div>

                        {/* Cross-Document Sharing notice (Many-to-one) */}
                        {otherAssignedDocs.length > 0 && (
                          <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Also shared with:
                            </span>
                            {otherAssignedDocs.map((docId) => (
                              <Badge
                                key={docId}
                                variant="outline"
                                className="text-[9px] py-0 px-1.5 bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 font-normal border-slate-200"
                              >
                                {getDocTitle(docId)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isCurrentlyAssigned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnassignCurrent}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900 gap-1.5"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Unlink</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleSelectSheet(sheet.id)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Link to This Document</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between text-xs text-muted-foreground px-5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              {spreadsheets.length}
            </span>{' '}
            workbook{spreadsheets.length === 1 ? '' : 's'} available in Hub
          </div>

          <div className="flex items-center gap-2">
            {activeSheetId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnassignCurrent}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 p-1"
              >
                Unlink current sheet
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
