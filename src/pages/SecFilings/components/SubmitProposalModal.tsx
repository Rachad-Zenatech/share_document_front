import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  CheckCircle2,
  MessageSquare,
  Table,
  FileSpreadsheet,
  FileUp,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import type { SecChangeProposal, SecBlockDiff, AttachedSpreadsheet, SecBlock } from '../../../types/secFiling';
import type { WorkbookReuploadDiff } from '../../../types/spreadsheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { parseExcelFileToSpreadsheet } from '../../../utils/documentVariables';
import { applyReuploadWithBlocks, computeWorkbookReuploadDiff } from '../../../utils/spreadsheetReuploadDiff';
import { SpreadsheetReuploadPreviewModal } from './SpreadsheetReuploadPreviewModal';

const DEFAULT_SUBMISSION_NOTES =
  'Completed draft revisions. All figures reconciled and ready for final controller approval.';

interface SubmitProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: SecChangeProposal | null;
  diffs: SecBlockDiff[];
  onSubmit: (notes?: string) => void;
  /** Main version's workbook (what the branch will be merged into). */
  mainSpreadsheet?: AttachedSpreadsheet | null;
  /** Workbook currently on the branch (falls back to Main's when the branch has not changed it). */
  branchSpreadsheet?: AttachedSpreadsheet | null;
  /** Branch blocks, so cell variables can be re-bound when rows/columns move. */
  blocks?: SecBlock[];
  /** Saves a workbook onto the branch. Enables "Upload updated Excel". */
  onUpdateSpreadsheet?: (sheet: AttachedSpreadsheet, shiftedBlocks?: SecBlock[]) => void;
}

export const SubmitProposalModal: React.FC<SubmitProposalModalProps> = ({
  open,
  onOpenChange,
  proposal,
  diffs,
  onSubmit,
  mainSpreadsheet,
  branchSpreadsheet,
  blocks = [],
  onUpdateSpreadsheet
}) => {
  const [submissionNotes, setSubmissionNotes] = useState(DEFAULT_SUBMISSION_NOTES);

  // Linked workbook: upload an updated Excel onto the branch, previewing against the branch copy first
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ uploaded: AttachedSpreadsheet; fileName: string } | null>(null);
  const [isComparingToMain, setIsComparingToMain] = useState(false);
  const currentBranchSheet = branchSpreadsheet || mainSpreadsheet || null;

  const workbookVsMain = useMemo(
    () =>
      open && mainSpreadsheet && currentBranchSheet
        ? computeWorkbookReuploadDiff(mainSpreadsheet, currentBranchSheet)
        : null,
    [open, mainSpreadsheet, currentBranchSheet]
  );
  const workbookTotals = useMemo(() => {
    if (!workbookVsMain) return null;
    const sum = (pick: (t: WorkbookReuploadDiff['tabs'][number]) => number) =>
      workbookVsMain.tabs.reduce((acc, t) => acc + pick(t), 0);
    return {
      addedRows: sum((t) => t.addedRows),
      deletedRows: sum((t) => t.deletedRows),
      addedCols: sum((t) => t.addedCols),
      deletedCols: sum((t) => t.deletedCols),
      changedCells: sum((t) => t.addedCells + t.deletedCells + t.modifiedCells),
      tabChanges: workbookVsMain.tabs.filter((t) => t.status !== 'matched').length
    };
  }, [workbookVsMain]);

  const handleExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !onUpdateSpreadsheet) return;
    setIsParsing(true);
    try {
      const uploaded = await parseExcelFileToSpreadsheet(file);
      if (currentBranchSheet) {
        setUploadPreview({ uploaded, fileName: file.name });
      } else {
        onUpdateSpreadsheet(uploaded);
        toast.success(`Attached "${file.name}" to your change branch`);
      }
    } catch {
      toast.error('Failed to parse Excel workbook. Please verify the file format.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyUploadToBranch = (diff: WorkbookReuploadDiff) => {
    if (!uploadPreview || !currentBranchSheet || !onUpdateSpreadsheet) return;
    const { merged, shiftedBlocks, shiftedCount } = applyReuploadWithBlocks(
      currentBranchSheet,
      uploadPreview.uploaded,
      diff,
      blocks
    );
    onUpdateSpreadsheet(merged, shiftedBlocks);
    toast.success(
      `Applied "${uploadPreview.fileName}" to your change branch${
        shiftedCount ? ` (re-bound ${shiftedCount} document reference${shiftedCount === 1 ? '' : 's'})` : ''
      }. Main is unchanged until the Lead Controller merges.`
    );
    setUploadPreview(null);
  };

  // Re-seed the message each time the dialog is opened so re-submitting or editing
  // notes shows what was actually sent last time.
  useEffect(() => {
    if (open) {
      setSubmissionNotes(proposal?.submissionNotes || DEFAULT_SUBMISSION_NOTES);
    }
  }, [open, proposal?.id, proposal?.submissionNotes]);

  const addedDiffs = diffs.filter((d) => d.status === 'added');
  const modifiedDiffs = diffs.filter((d) => d.status === 'modified');
  const deletedDiffs = diffs.filter((d) => d.status === 'deleted');
  const totalChanges = addedDiffs.length + modifiedDiffs.length + deletedDiffs.length;
  const totalTableCellDiffs = diffs.reduce((acc, d) => acc + (d.tableCellDiffs?.length || 0), 0);

  const handleSubmit = () => {
    onSubmit(submissionNotes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg sm:max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-purple-200 backdrop-blur-md">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Submit Final Changes for Review
              </DialogTitle>
              <DialogDescription className="text-xs text-purple-200/80 mt-0.5">
                Send your proposed edits to the Lead Controller for confirmation & merging.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Proposal Summary Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">
                {proposal?.title || 'Contributor Draft Revisions'}
              </span>
              {proposal && (
                <Badge className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-none font-mono text-[10px]">
                  {proposal.author.name} ({proposal.author.role})
                </Badge>
              )}
            </div>

            {/* Diff Counters */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-zinc-700">
              <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-none text-[11px] font-mono">
                +{addedDiffs.length} Added
              </Badge>
              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-none text-[11px] font-mono">
                ~{modifiedDiffs.length} Modified
              </Badge>
              <Badge className="bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-none text-[11px] font-mono">
                -{deletedDiffs.length} Deleted
              </Badge>
              <span className="ml-auto text-slate-400 font-medium">
                {totalChanges} total block change{totalChanges === 1 ? '' : 's'}
              </span>
            </div>

            {totalTableCellDiffs > 0 && (
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                <Table className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Includes <strong>{totalTableCellDiffs} table cell / row {totalTableCellDiffs === 1 ? 'change' : 'changes'}</strong> across financial tables
                </span>
              </div>
            )}

            {(proposal?.spreadsheetDiffs?.length ?? 0) > 0 && !workbookVsMain && (
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                <Table className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>
                  Includes <strong>{proposal!.spreadsheetDiffs!.length} spreadsheet cell {proposal!.spreadsheetDiffs!.length === 1 ? 'change' : 'changes'}</strong> in linked workbook
                </span>
              </div>
            )}
          </div>

          {/* Linked Workbook: upload updated Excel onto the branch */}
          {(currentBranchSheet || onUpdateSpreadsheet) && (
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{currentBranchSheet?.fileName || 'Linked workbook'}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {workbookVsMain?.hasChanges && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsComparingToMain(true)}
                      className="h-7 text-[11px] gap-1 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview vs Main</span>
                    </Button>
                  )}
                  {onUpdateSpreadsheet && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelSelected}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isParsing}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-[11px] gap-1 font-semibold border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-900 cursor-pointer"
                      >
                        <FileUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isParsing ? 'Parsing...' : 'Upload updated Excel'}</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {workbookTotals && workbookVsMain?.hasChanges ? (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-500 dark:text-zinc-400">Changes vs Main:</span>
                  {workbookTotals.addedRows > 0 && (
                    <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-0 font-mono">
                      +{workbookTotals.addedRows} rows
                    </Badge>
                  )}
                  {workbookTotals.deletedRows > 0 && (
                    <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-0 font-mono">
                      −{workbookTotals.deletedRows} rows
                    </Badge>
                  )}
                  {workbookTotals.addedCols > 0 && (
                    <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-0 font-mono">
                      +{workbookTotals.addedCols} cols
                    </Badge>
                  )}
                  {workbookTotals.deletedCols > 0 && (
                    <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-0 font-mono">
                      −{workbookTotals.deletedCols} cols
                    </Badge>
                  )}
                  {workbookTotals.changedCells > 0 && (
                    <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-0 font-mono">
                      {workbookTotals.changedCells} cells changed
                    </Badge>
                  )}
                  {workbookTotals.tabChanges > 0 && (
                    <Badge className="bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 font-mono">
                      {workbookTotals.tabChanges} tab change{workbookTotals.tabChanges === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {currentBranchSheet
                    ? 'No workbook changes vs Main yet. Edited the file in Excel? Upload it here to include it in this submission.'
                    : 'No workbook linked. Upload an Excel file to include it in this submission.'}
                </div>
              )}
            </div>
          )}

          {/* Submission Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              <span>Final Submission Message for Lead Controller</span>
            </label>
            <Textarea
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Summarize the changes you made, sources checked, and any items requiring special review..."
              rows={3}
              className="text-xs bg-white dark:bg-zinc-800"
            />
          </div>

          {/* Info notice */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 flex items-start gap-2 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Once submitted, this proposal transitions to <strong>Pending Review</strong>. The Lead Controller will inspect side-by-side differences and confirm which changes to merge into the Main version.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Final Review</span>
          </Button>
        </div>

        {/* Upload preview: uploaded Excel vs the branch's current workbook */}
        {uploadPreview && currentBranchSheet && (
          <SpreadsheetReuploadPreviewModal
            open={uploadPreview !== null}
            onOpenChange={(isOpen) => !isOpen && setUploadPreview(null)}
            currentSpreadsheet={currentBranchSheet}
            uploadedSpreadsheet={uploadPreview.uploaded}
            uploadedFileName={uploadPreview.fileName}
            title="Upload Excel Changes to Your Branch"
            description={
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="font-mono">{uploadPreview.fileName}</span>
                <span>vs. the workbook on your change branch. Main is not changed until the Lead Controller merges.</span>
              </>
            }
            currentLabel="Branch"
            applyLabel="Apply to My Branch"
            onApply={handleApplyUploadToBranch}
          />
        )}

        {/* Read-only: branch workbook vs Main */}
        {isComparingToMain && mainSpreadsheet && currentBranchSheet && (
          <SpreadsheetReuploadPreviewModal
            open={isComparingToMain}
            onOpenChange={setIsComparingToMain}
            currentSpreadsheet={mainSpreadsheet}
            uploadedSpreadsheet={currentBranchSheet}
            uploadedFileName={currentBranchSheet.fileName}
            title="Workbook Changes in This Submission"
            description={<span>What the Lead Controller will see when reviewing this branch against Main.</span>}
            currentLabel="Main"
            uploadedLabel="Branch"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
