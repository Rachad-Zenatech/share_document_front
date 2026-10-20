import React, { useState, useRef, useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  Check,
  AlertCircle,
  Layers,
  Sparkles,
  PlusCircle,
  RefreshCw,
  FolderPlus,
  Loader2
} from 'lucide-react';
import { parseDocumentBlocks, type ParsedDocumentResult } from '../../../utils/secFilingImporter';
import type { SecBlock } from '../../../types/secFiling';
import { toast } from 'sonner';

export type ImportDestination = 'append' | 'insert_at_selection' | 'replace' | 'new_document';

export interface ImportDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDocTitle: string;
  currentSections?: string[];
  activeSection?: string;
  onInsertBlocks: (blocks: SecBlock[], destination: ImportDestination, newTitle?: string) => void;
}

export const ImportDocumentModal: React.FC<ImportDocumentModalProps> = ({
  open,
  onOpenChange,
  currentDocTitle,
  currentSections = [],
  activeSection,
  onInsertBlocks
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedDocumentResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [destination, setDestination] = useState<ImportDestination>('append');
  const [docTitle, setDocTitle] = useState('');
  const [convertTables, setConvertTables] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [targetSection, setTargetSection] = useState(activeSection || currentSections[0] || 'General');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParsedResult(null);
    setParseError(null);
    setDocTitle('');
    setIsParsing(false);
  };

  const handleProcessFile = async (
    pickedFile: File,
    tablesOpt = convertTables,
    logoOpt = includeLogo,
    sec = targetSection
  ) => {
    setFile(pickedFile);
    setParseError(null);
    setIsParsing(true);
    setParsedResult(null);

    const baseTitle = pickedFile.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setDocTitle(baseTitle);

    try {
      const res = await parseDocumentBlocks(pickedFile, {
        convertTables: tablesOpt,
        includeLogo: logoOpt,
        defaultSection: sec,
      });
      setParsedResult(res);
      toast.success(
        `Parsed ${res.summary.totalBlocks} elements (${res.summary.headings} headings, ${res.summary.paragraphs} paragraphs, ${res.summary.tables} tables)`
      );
    } catch (err: any) {
      console.error('Failed to parse file:', err);
      setParseError(err.message || 'Unable to parse document. Please check the file format.');
      toast.error('Failed to parse document file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      handleProcessFile(picked);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      handleProcessFile(dropped);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.blocks.length === 0) {
      toast.error('No document blocks to insert');
      return;
    }

    // Apply section override if specified
    const finalBlocks = parsedResult.blocks.map((b) => {
      if (destination === 'insert_at_selection' && targetSection) {
        return { ...b, section: targetSection };
      }
      return b;
    });

    onInsertBlocks(finalBlocks, destination, docTitle.trim() || undefined);
    onOpenChange(false);
    resetState();
  };

  const getFormatBadge = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'docx') return <Badge className="bg-blue-600 text-white font-mono text-[10px]">WORD .DOCX</Badge>;
    if (ext === 'xlsx' || ext === 'xls') return <Badge className="bg-emerald-600 text-white font-mono text-[10px]">EXCEL .XLSX</Badge>;
    if (ext === 'md' || ext === 'markdown') return <Badge className="bg-purple-600 text-white font-mono text-[10px]">MARKDOWN .MD</Badge>;
    if (ext === 'html' || ext === 'htm') return <Badge className="bg-orange-600 text-white font-mono text-[10px]">HTML</Badge>;
    if (ext === 'json') return <Badge className="bg-amber-600 text-white font-mono text-[10px]">JSON</Badge>;
    if (ext === 'csv') return <Badge className="bg-teal-600 text-white font-mono text-[10px]">CSV TABLE</Badge>;
    return <Badge className="bg-slate-600 text-white font-mono text-[10px]">TEXT FILE</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Insert / Import Document</span>
                  <Badge variant="outline" className="text-[10px] font-normal border-blue-200 text-blue-700 dark:text-blue-300">
                    Word, Excel, MD, HTML
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                  Import existing documents from Word or elsewhere directly into <strong className="font-medium text-slate-700 dark:text-zinc-200">{currentDocTitle}</strong> without starting over.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* File Upload Zone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20'
                  : 'border-slate-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/40 dark:bg-zinc-900/30 hover:bg-slate-50 dark:hover:bg-zinc-900/50'
              }`}
            >
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".docx,.xlsx,.xls,.md,.markdown,.html,.htm,.txt,.csv,.json"
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-2xs">
                <Upload className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-1">
                Drop your document here, or <span className="text-blue-600 dark:text-blue-400 underline">browse files</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md">
                Supports Microsoft Word (<strong>.docx</strong>), Excel (<strong>.xlsx</strong>), Markdown (<strong>.md</strong>), HTML (<strong>.html</strong>), CSV, and Text.
              </p>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-500" /> Word .docx
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Excel .xlsx
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5 text-purple-500" /> Markdown & HTML
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Card */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{file.name}</span>
                      {getFormatBadge(file.name)}
                    </div>
                    <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetState();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Change File
                </Button>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Converting document structure, headings, and tables...</span>
                </div>
              )}

              {/* Parsing Error */}
              {parseError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="font-semibold">Error Converting Document:</strong>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              {/* Parsed Summary & Options */}
              {parsedResult && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-center">
                      <span className="text-xs text-slate-500 block">Headings</span>
                      <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                        {parsedResult.summary.headings}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-center">
                      <span className="text-xs text-slate-500 block">Paragraphs</span>
                      <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
                        {parsedResult.summary.paragraphs}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-center">
                      <span className="text-xs text-slate-500 block">Tables</span>
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {parsedResult.summary.tables}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-center">
                      <span className="text-xs text-slate-500 block">Callouts</span>
                      <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                        {parsedResult.summary.callouts}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-center">
                      <span className="text-xs text-slate-500 block">Total Blocks</span>
                      <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                        {parsedResult.summary.totalBlocks}
                      </span>
                    </div>
                  </div>

                  {/* Conversion Fine-Tuning */}
                  <div className="flex flex-wrap items-center gap-4 py-2 px-3 bg-slate-50 dark:bg-zinc-900/60 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Conversion Options:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={convertTables}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setConvertTables(val);
                          if (file) handleProcessFile(file, val, includeLogo);
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Format tables as financial blocks</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={includeLogo}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setIncludeLogo(val);
                          if (file) handleProcessFile(file, convertTables, val);
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Extract embedded images & logos</span>
                    </label>
                  </div>

                  {/* Destination Selection */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      How would you like to insert this document?
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option 1: Append to document */}
                      <div
                        onClick={() => setDestination('append')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          destination === 'append'
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-xs text-slate-900 dark:text-zinc-100">
                          <PlusCircle className="w-4 h-4 text-blue-600" />
                          <span>Append to Document (Recommended)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Appends all {parsedResult.summary.totalBlocks} imported blocks to the end of the current filing. Keeps your existing document untouched.
                        </p>
                      </div>

                      {/* Option 2: Insert into active section */}
                      <div
                        onClick={() => setDestination('insert_at_selection')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          destination === 'insert_at_selection'
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-xs text-slate-900 dark:text-zinc-100">
                          <Layers className="w-4 h-4 text-emerald-600" />
                          <span>Insert into Selected Section</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Merges all imported content directly into <strong>{targetSection}</strong>.
                        </p>
                      </div>

                      {/* Option 3: Replace current filing */}
                      <div
                        onClick={() => setDestination('replace')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          destination === 'replace'
                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-xs text-slate-900 dark:text-zinc-100">
                          <RefreshCw className="w-4 h-4 text-amber-600" />
                          <span>Replace Current Document</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Replaces the current document's blocks with the imported Word content.
                        </p>
                      </div>

                      {/* Option 4: Create new document */}
                      <div
                        onClick={() => setDestination('new_document')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          destination === 'new_document'
                            ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-1 ring-purple-500/20'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-xs text-slate-900 dark:text-zinc-100">
                          <FolderPlus className="w-4 h-4 text-purple-600" />
                          <span>Create as New Filing</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Saves the imported file as a brand new draft document in your repository.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section picker if inserting at selection */}
                  {destination === 'insert_at_selection' && currentSections.length > 0 && (
                    <div className="space-y-1 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Target Section:
                      </label>
                      <select
                        value={targetSection}
                        onChange={(e) => setTargetSection(e.target.value)}
                        className="w-full text-xs h-8 px-2.5 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 outline-none"
                      >
                        {currentSections.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Document Title if new filing */}
                  {destination === 'new_document' && (
                    <div className="space-y-1 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        New Document Title:
                      </label>
                      <Input
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="Enter title for new filing..."
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  {/* Quick Block Preview Accordion/Sample */}
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-100/60 dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Preview Converted Blocks (First 4 of {parsedResult.blocks.length})</span>
                      </span>
                    </div>
                    <div className="p-3 space-y-2 max-h-40 overflow-y-auto bg-white dark:bg-zinc-950 text-xs">
                      {parsedResult.blocks.slice(0, 4).map((b, idx) => (
                        <div
                          key={b.id || idx}
                          className="p-2 rounded bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800/80 flex items-start gap-2"
                        >
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {b.type}
                          </Badge>
                          <div className="truncate flex-1">
                            {b.type === 'heading' && (
                              <span className="font-semibold text-slate-900 dark:text-zinc-100">{b.text}</span>
                            )}
                            {b.type === 'paragraph' && (
                              <span className="text-slate-600 dark:text-zinc-300 truncate">{b.text}</span>
                            )}
                            {b.type === 'financial_table' && (
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                Table: {b.title} ({b.rows.length} rows, {b.headers.length} cols)
                              </span>
                            )}
                            {b.type === 'callout' && (
                              <span className="text-blue-600 dark:text-blue-400">Callout: {b.title}</span>
                            )}
                            {b.type === 'image' && (
                              <span className="text-purple-600 dark:text-purple-400">Image: {b.alt}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3.5 px-5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetState();
              onOpenChange(false);
            }}
            className="text-xs text-slate-500 cursor-pointer"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {file && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-xs cursor-pointer"
              >
                Clear
              </Button>
            )}

            <Button
              type="button"
              disabled={!parsedResult || parsedResult.blocks.length === 0 || isParsing}
              onClick={handleConfirmImport}
              className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {destination === 'replace'
                  ? 'Replace with Imported Doc'
                  : destination === 'new_document'
                  ? 'Create New Filing'
                  : `Insert ${parsedResult?.summary.totalBlocks || 0} Blocks`}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
