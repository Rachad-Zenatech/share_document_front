// Mirrors the backend models in `models/sec_filing_model.py`; keep the two in step.

/** A platform user (`userId` set) or an external person known only by name. */
export interface SecWorkflowAssignee {
  userId?: string | null;
  name: string;
  email?: string | null;
}

export interface SecWorkflowStep {
  step: number;
  description: string;
  /** Display text built from `assignees`; the only field set for steps imported from sheets. */
  assignedTo?: string | null;
  assignees?: SecWorkflowAssignee[] | null;
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
