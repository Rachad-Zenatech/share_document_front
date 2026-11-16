import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFinancialTableTemplate,
  deleteFinancialTableTemplate,
  getFinancialTableTemplates,
  updateFinancialTableTemplate
} from '../services/secFilingTemplateService';
import type {
  SecFinancialTableTemplate,
  SecFinancialTableTemplateCreate,
  SecFinancialTableTemplateList,
  SecFinancialTableTemplateUpdate
} from '../types/secFilingTemplate';
import { queryKeys } from '../services/queryKeys';
import { isGuestSession } from '../services/guestInvite';
import { getActiveDocumentId, getDocumentsList } from '../services/secFiling/secFilingCore';
import { SCRIPT_TABLE_TEMPLATES } from '../data/scriptTableTemplates';
import { documentTypeOf, type DocumentType } from '../types/documentType';

/** The kind of the document being edited (its list entry is in memory once the documents have loaded). */
export function activeDocumentType(): DocumentType {
  const id = getActiveDocumentId();
  return documentTypeOf(getDocumentsList().find((d) => d.id === id));
}

/**
 * The templates for one kind of document: the ones saved on the server for it, and for scripts the bundled script
 * templates too (a saved one with the same key replaces the bundled one). SEC filings keep the behaviour they had: the
 * server's list, or the bundled financial statements when there are none (see resolveTableTemplates).
 */
function templatesFor(type: DocumentType, list: SecFinancialTableTemplateList | undefined): SecFinancialTableTemplateList {
  const saved = (list?.templates ?? []).filter((t) => (t.documentType ?? 'sec-filing') === type);
  if (type !== 'script') return { templates: saved, total: saved.length };
  const keys = new Set(saved.map((t) => t.templateKey));
  const merged = [...saved, ...SCRIPT_TABLE_TEMPLATES.filter((t) => !keys.has(t.templateKey))];
  return { templates: merged, total: merged.length };
}

/** The table templates of the document being edited (or of `documentType` when given): scripts get script tables. */
export function useFinancialTableTemplates(documentType?: DocumentType) {
  const type = documentType ?? activeDocumentType();
  const query = useQuery<SecFinancialTableTemplateList>({
    queryKey: queryKeys.secFilingTableTemplates(),
    queryFn: getFinancialTableTemplates,
    // Guest contributors have no login; the bundled templates are used instead.
    enabled: !isGuestSession()
  });
  const data = useMemo(() => templatesFor(type, query.data), [type, query.data]);
  return { ...query, data };
}

export function useCreateFinancialTableTemplate() {
  const qc = useQueryClient();
  return useMutation<SecFinancialTableTemplate, Error, SecFinancialTableTemplateCreate>({
    // A template saved from a table belongs to the kind of document it was made in.
    mutationFn: (payload) => createFinancialTableTemplate({ documentType: activeDocumentType(), ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.secFilingTableTemplates() });
    }
  });
}

export function useUpdateFinancialTableTemplate() {
  const qc = useQueryClient();
  return useMutation<
    SecFinancialTableTemplate,
    Error,
    { id: string; payload: SecFinancialTableTemplateUpdate }
  >({
    mutationFn: ({ id, payload }) => updateFinancialTableTemplate(id, { documentType: activeDocumentType(), ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.secFilingTableTemplates() });
    }
  });
}

export function useDeleteFinancialTableTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFinancialTableTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.secFilingTableTemplates() });
    }
  });
}
