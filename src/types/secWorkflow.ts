// Mirrors the backend models in `models/sec_filing_model.py`; keep the two in step.

export interface SecWorkflowStep {
  step: number;
  description: string;
  assignedTo?: string | null;
}

export interface SecWorkflow {
  id: string;
  name: string;
  description?: string | null;
  steps: SecWorkflowStep[];
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface SecWorkflowList {
  workflows: SecWorkflow[];
  total: number;
}

export interface SecWorkflowCreate {
  name: string;
  description?: string | null;
  steps: SecWorkflowStep[];
}

export type SecWorkflowUpdate = Partial<SecWorkflowCreate>;

export interface SecDocumentWorkflowResponse {
  documentId: string;
  workflow: SecWorkflow | null;
}
