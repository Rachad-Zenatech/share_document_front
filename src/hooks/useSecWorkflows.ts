import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkflow,
  deleteWorkflow,
  getDocumentWorkflow,
  getWorkflows,
  setWorkflowDocuments,
  updateWorkflow
} from '../services/secWorkflowService';
import type {
  SecDocumentWorkflowResponse,
  SecWorkflow,
  SecWorkflowCreate,
  SecWorkflowList,
  SecWorkflowUpdate
} from '../types/secWorkflow';
import { queryKeys } from '../services/queryKeys';

export function useSecWorkflows() {
  return useQuery<SecWorkflowList>({
    queryKey: queryKeys.secWorkflows(),
    queryFn: getWorkflows
  });
}

export function useDocumentWorkflow(documentId: string | undefined) {
  return useQuery<SecDocumentWorkflowResponse>({
    queryKey: queryKeys.secDocumentWorkflow(documentId || ''),
    queryFn: () => getDocumentWorkflow(documentId!),
    enabled: !!documentId
  });
}

// Any workflow change can alter which steps a document's invite modal offers.
function useInvalidateWorkflows() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.secWorkflows() });
    qc.invalidateQueries({ queryKey: ['sec-document-workflow'] });
  };
}

export function useCreateSecWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation<SecWorkflow, Error, SecWorkflowCreate>({
    mutationFn: createWorkflow,
    onSuccess: invalidate
  });
}

export function useUpdateSecWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation<SecWorkflow, Error, { id: string; payload: SecWorkflowUpdate }>({
    mutationFn: ({ id, payload }) => updateWorkflow(id, payload),
    onSuccess: invalidate
  });
}

export function useDeleteSecWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: invalidate
  });
}

export function useSetSecWorkflowDocuments() {
  const invalidate = useInvalidateWorkflows();
  return useMutation<SecWorkflow, Error, { id: string; documentIds: string[] }>({
    mutationFn: ({ id, documentIds }) => setWorkflowDocuments(id, documentIds),
    onSuccess: invalidate
  });
}
