import React, { useMemo, useRef, useState } from 'react';
import {
  ListChecks,
  Plus,
  Upload,
  Pencil,
  Trash2,
  FileText,
  Search,
  X,
  Link2,
  GripVertical,
  Download,
  FileDown,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { secFilingService } from '../../services/secFilingService';
import { buildWorkflowWorkbook, downloadBlob, parseWorkflowFile } from '../../services/secWorkflowService';
import {
  useCreateSecWorkflow,
  useDeleteSecWorkflow,
  useSecWorkflows,
  useSetSecWorkflowDocuments,
  useUpdateSecWorkflow
} from '../../hooks/useSecWorkflows';
import type { SecDocumentSummary } from '../../types/secFiling';
import type { SecWorkflow, SecWorkflowStep } from '../../types/secWorkflow';

interface WorkflowDraft {
  id?: string;
  name: string;
  description: string;
  steps: SecWorkflowStep[];
  documentIds: string[];
}

const BLANK_DRAFT: WorkflowDraft = {
  name: '',
  description: '',
  steps: [{ step: 1, description: '', assignedTo: '' }],
  documentIds: []
};

export const WorkflowAssignmentsPage: React.FC = () => {
  const { data, isLoading, isError } = useSecWorkflows();
  const workflows = data?.workflows ?? [];
  const [documents] = useState<SecDocumentSummary[]>(() => secFilingService.getAllDocuments());

  const createMutation = useCreateSecWorkflow();
  const updateMutation = useUpdateSecWorkflow();
  const deleteMutation = useDeleteSecWorkflow();
  const setDocumentsMutation = useSetSecWorkflowDocuments();

  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // documentId -> workflow, so the editor can show when a document will move workflows.
  const workflowByDocId = useMemo(() => {
    const map = new Map<string, SecWorkflow>();
    for (const wf of workflows) {
      for (const docId of wf.documentIds) map.set(docId, wf);
    }
    return map;
  }, [workflows]);

  const docTitleById = useMemo(() => new Map(documents.map((d) => [d.id, d.title])), [documents]);
  const docTitle = (docId: string) => docTitleById.get(docId) || docId;

  const filteredWorkflows = useMemo(() => {
    const titleOf = (docId: string) => docTitleById.get(docId) || docId;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (wf) =>
        wf.name.toLowerCase().includes(q) ||
        (wf.description || '').toLowerCase().includes(q) ||
        wf.steps.some(
          (s) => s.description.toLowerCase().includes(q) || (s.assignedTo || '').toLowerCase().includes(q)
        ) ||
        wf.documentIds.some((id) => titleOf(id).toLowerCase().includes(q))
    );
  }, [workflows, searchQuery, docTitleById]);

  const filteredPickerDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.title.toLowerCase().includes(q) || (d.formType || '').toLowerCase().includes(q)
    );
  }, [documents, docSearch]);

  const unassignedDocsCount = documents.filter((d) => !workflowByDocId.has(d.id)).length;

  const openEditor = (wf?: SecWorkflow) => {
    setDraft(
      wf
        ? {
            id: wf.id,
            name: wf.name,
            description: wf.description || '',
            steps: wf.steps.map((s) => ({ ...s, assignedTo: s.assignedTo || '' })),
            documentIds: [...wf.documentIds]
          }
        : { ...BLANK_DRAFT, steps: [...BLANK_DRAFT.steps] }
    );
  };

  const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Workflow';

  const handleDownloadTemplate = async () => {
    try {
      downloadBlob(await buildWorkflowWorkbook(), 'Workflow Assignment Template.xlsx');
    } catch {
      toast.error('Failed to build the workflow template.');
    }
  };

  const handleExport = async (wf: SecWorkflow) => {
    try {
      downloadBlob(await buildWorkflowWorkbook(wf), `${safeFileName(wf.name)}.xlsx`);
      toast.success(`Exported "${wf.name}"`);
    } catch {
      toast.error('Failed to export workflow.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseWorkflowFile(file);
      setDraft({
        name: parsed.name,
        description: parsed.description || '',
        steps: parsed.steps.map((s) => ({ ...s, assignedTo: s.assignedTo || '' })),
        documentIds: []
      });
      toast.success(`Read ${parsed.steps.length} steps from "${file.name}". Assign it to a document and save.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read the workflow file.');
    }
  };

  const updateStep = (index: number, patch: Partial<SecWorkflowStep>) => {
    setDraft((prev) =>
      prev ? { ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : prev
    );
  };

  const addStep = () => {
    setDraft((prev) =>
      prev
        ? { ...prev, steps: [...prev.steps, { step: prev.steps.length + 1, description: '', assignedTo: '' }] }
        : prev
    );
  };

  const removeStep = (index: number) => {
    setDraft((prev) =>
      prev
        ? { ...prev, steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 })) }
        : prev
    );
  };

  const toggleDraftDoc = (docId: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            documentIds: prev.documentIds.includes(docId)
              ? prev.documentIds.filter((id) => id !== docId)
              : [...prev.documentIds, docId]
          }
        : prev
    );
  };

  const handleSave = async () => {
    if (!draft) return;
    const steps = draft.steps
      .filter((s) => s.description.trim())
      .map((s, i) => ({ step: i + 1, description: s.description.trim(), assignedTo: s.assignedTo?.trim() || null }));

    if (!draft.name.trim()) {
      toast.error('Please enter a workflow name.');
      return;
    }
    if (steps.length === 0) {
      toast.error('Add at least one workflow step.');
      return;
    }
    if (draft.documentIds.length === 0) {
      toast.error('Assign this workflow to at least one document.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = { name: draft.name.trim(), description: draft.description.trim() || null, steps };
      const saved = draft.id
        ? await updateMutation.mutateAsync({ id: draft.id, payload })
        : await createMutation.mutateAsync(payload);
      await setDocumentsMutation.mutateAsync({ id: saved.id, documentIds: draft.documentIds });
      toast.success(`Saved workflow "${saved.name}" (${draft.documentIds.length} document${draft.documentIds.length === 1 ? '' : 's'}).`);
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save workflow.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (wf: SecWorkflow) => {
    if (!confirm(`Delete workflow "${wf.name}"? It will be unassigned from ${wf.documentIds.length} document(s).`)) return;
    try {
      await deleteMutation.mutateAsync(wf.id);
      toast.info(`Deleted "${wf.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workflow.');
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-[#0E2841] text-white flex items-center justify-center shadow-md">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  Workflow Assignments
                </h1>
                <Badge className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 font-mono text-xs">
                  {workflows.length} Workflows
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                Reporting workflow steps per document. Contributor invites pick their task title from these steps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              title="Blank standard sheet starting at A1: Step / Description / Assigned To. The file name becomes the workflow name."
              className="h-9 gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Download Template</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Import Workflow</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => openEditor()}
              className="h-9 gap-1.5 bg-[#0E2841] hover:bg-[#153a5e] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Workflow</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 sm:px-8 flex flex-col gap-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by workflow, step, assignee, or document..."
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
          {unassignedDocsCount > 0 && (
            <Badge variant="outline" className="self-start sm:self-auto text-[11px] text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
              {unassignedDocsCount} document{unassignedDocsCount === 1 ? '' : 's'} without a workflow
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading workflows...</div>
        ) : isError ? (
          <div className="p-12 text-center text-xs text-red-600">Failed to load workflows.</div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
              <ListChecks className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">No Workflows Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {searchQuery
                ? `No workflows match "${searchQuery}".`
                : 'Download the template, fill in the steps, and import it, or create a workflow by hand. Then assign it to a document.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 truncate" title={wf.name}>
                      {wf.name}
                    </h3>
                    {wf.description && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{wf.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleExport(wf)}
                      title="Export to .xlsx (standard layout)"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(wf)}
                      title="Edit workflow & assignments"
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(wf)}
                      title="Delete workflow"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <ol className="space-y-1.5">
                  {wf.steps.map((s) => (
                    <li key={s.step} className="flex gap-2.5 text-xs">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center">
                        {s.step}
                      </span>
                      <div className="min-w-0">
                        <div className="text-slate-800 dark:text-zinc-200">{s.description}</div>
                        {s.assignedTo && <div className="text-[11px] text-slate-400">{s.assignedTo}</div>}
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Assigned Documents
                  </div>
                  {wf.documentIds.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => openEditor(wf)}
                      className="text-[11px] text-amber-700 hover:underline cursor-pointer"
                    >
                      Not assigned to a document yet. Assign one.
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {wf.documentIds.map((docId) => (
                        <Badge key={docId} variant="outline" className="text-[10px] gap-1 font-normal">
                          <FileText className="w-3 h-3 text-blue-600" />
                          {docTitle(docId)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Workflow */}
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="w-full max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
            <DialogDescription>
              Each step becomes an option in the contributor invite's Task / Proposed Branch Title dropdown for the
              assigned documents.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Workflow Name *</label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. FS Notes V2"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Description</label>
                  <Input
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="e.g. Workflow for writing the SEC financial statements"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">Steps *</div>
                {draft.steps.map((s, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex items-center gap-1 pt-1.5 text-slate-400 shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                      <span className="w-5 text-center font-bold text-slate-600 dark:text-zinc-300">{index + 1}</span>
                    </div>
                    <Input
                      value={s.description}
                      onChange={(e) => updateStep(index, { description: e.target.value })}
                      placeholder="Step description"
                      className="h-8 text-xs flex-[3]"
                    />
                    <Input
                      value={s.assignedTo || ''}
                      onChange={(e) => updateStep(index, { assignedTo: e.target.value })}
                      placeholder="Assigned to"
                      className="h-8 text-xs flex-[2]"
                    />
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      disabled={draft.steps.length === 1}
                      title="Remove step"
                      className="p-1.5 mt-0.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addStep} className="h-7 text-[11px] gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                  Assigned Documents * <span className="font-normal text-slate-400">(a document follows one workflow)</span>
                </div>
                {documents.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 border border-dashed rounded-lg">
                    No documents found. Create a document in the Document Hub first.
                  </div>
                ) : (
                  <Popover
                    open={isDocPickerOpen}
                    onOpenChange={(open) => {
                      setIsDocPickerOpen(open);
                      if (!open) setDocSearch('');
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full min-h-9 px-2 py-1.5 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center gap-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <div className="flex-1 min-w-0 flex flex-wrap gap-1">
                          {draft.documentIds.length === 0 ? (
                            <span className="text-slate-400 py-0.5">Select documents...</span>
                          ) : (
                            draft.documentIds.map((docId) => {
                              const current = workflowByDocId.get(docId);
                              const moves = current && current.id !== draft.id;
                              return (
                                <Badge
                                  key={docId}
                                  variant="outline"
                                  title={moves ? `Moves from ${current.name}` : undefined}
                                  className={`text-[10px] gap-1 font-normal max-w-full ${moves ? 'border-amber-300 text-amber-800 dark:text-amber-300' : ''}`}
                                >
                                  <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span className="truncate">{docTitle(docId)}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Remove ${docTitle(docId)}`}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDraftDoc(docId);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleDraftDoc(docId);
                                      }
                                    }}
                                    className="shrink-0 text-slate-400 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </span>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2 gap-2 text-xs">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                        <Input
                          autoFocus
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          placeholder="Search documents by title or form type..."
                          className="h-7 text-[11px] pl-8"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {filteredPickerDocs.length === 0 ? (
                          <div className="py-4 text-center text-slate-400">No documents match "{docSearch}"</div>
                        ) : (
                          filteredPickerDocs.map((doc) => {
                            const current = workflowByDocId.get(doc.id);
                            const isSelected = draft.documentIds.includes(doc.id);
                            const onOther = current && current.id !== draft.id;
                            return (
                              <label
                                key={doc.id}
                                className={`flex items-start gap-2 p-1.5 rounded-md cursor-pointer ${
                                  isSelected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                                }`}
                              >
                                <Checkbox checked={isSelected} onCheckedChange={() => toggleDraftDoc(doc.id)} className="mt-0.5" />
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate font-medium text-slate-800 dark:text-zinc-200">{doc.title}</span>
                                  <span className="block text-[10px] text-slate-400 truncate">{doc.formType}</span>
                                </span>
                                {onOther && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] shrink-0 ${isSelected ? 'text-amber-700 border-amber-300' : 'text-slate-500'}`}
                                  >
                                    {isSelected ? `Moves from ${current.name}` : `On ${current.name}`}
                                  </Badge>
                                )}
                              </label>
                            );
                          })
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-[10px] text-slate-500">
                        <span>
                          {draft.documentIds.length} of {documents.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsDocPickerOpen(false)}
                          className="font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="text-xs bg-[#0E2841] hover:bg-[#153a5e] text-white"
            >
              {isSaving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowAssignmentsPage;
