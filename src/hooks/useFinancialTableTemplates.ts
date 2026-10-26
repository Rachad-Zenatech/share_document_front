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

export function useFinancialTableTemplates() {
  return useQuery<SecFinancialTableTemplateList>({
    queryKey: queryKeys.secFilingTableTemplates(),
    queryFn: getFinancialTableTemplates,
    // Guest contributors have no login; the bundled templates are used instead.
    enabled: !isGuestSession()
  });
}

export function useCreateFinancialTableTemplate() {
  const qc = useQueryClient();
  return useMutation<SecFinancialTableTemplate, Error, SecFinancialTableTemplateCreate>({
    mutationFn: createFinancialTableTemplate,
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
    mutationFn: ({ id, payload }) => updateFinancialTableTemplate(id, payload),
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
