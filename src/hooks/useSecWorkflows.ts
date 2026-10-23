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
import { apiClient } from '../services/apiClient';
import type { User } from '../lib/AuthContext';

/** Active platform users that can be put on a workflow step. */
export function useAssignableUsers() {
  return useQuery<User[]>({
    queryKey: ['sec-workflow-assignable-users'],
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/api/configuration/users?is_active=true');
      return Array.isArray(res) ? res : [];
    },
    staleTime: 60_000
  });
}

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
