// Mirrors models/sec_filings/script_review_model.py and the state returned by the script-review routes.
// The same shapes as the Social Media portal's script documents (DocStatus, Capacity, DocAccess).

export type ScriptStatus = 'DRAFT' | 'IN_REVIEW' | 'LEVEL2_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED';
export type ScriptCapacity = 'EDIT' | 'VIEW';
export type ScriptCollaboratorRole = 'MANAGER' | 'REVIEWER' | 'SUGGESTER' | 'VIEWER';
export type ScriptRole = 'CREATOR' | ScriptCollaboratorRole;
export type ScriptVote = 'APPROVE' | 'CHANGES' | 'DONE';

export interface ScriptAccess {
  role: ScriptRole;
  can_edit: boolean;
  can_note: boolean;
  can_submit: boolean;
  can_check_in: boolean;
  can_finalize: boolean;
  can_decide: boolean;
  can_create_post: boolean;
  can_delete: boolean;
}

export interface ScriptCollaborator {
  user_id: string;
  name: string;
  email: string;
  role: ScriptCollaboratorRole;
  capacity: ScriptCapacity;
  vote: ScriptVote | null;
  note: string | null;
}

export interface ScriptReviewState {
  document_id: string;
  title: string;
  status: ScriptStatus;
  round: number;
  creator_id: string;
  /** The signed-in user. */
  you: string;
  page_ids: string[];
  all_checked: boolean;
  decision_note: string | null;
  post_requested: boolean;
  access: ScriptAccess;
  collaborators: ScriptCollaborator[];
}

export interface ScriptInvitee {
  user_id: string;
  role: ScriptCollaboratorRole;
  capacity: ScriptCapacity;
}

export interface ScriptHistoryEvent {
  kind: string;
  round: number;
  name: string | null;
  at: string;
  detail: Record<string, unknown>;
}

export interface EmbedNote {
  id: string;
  kind: 'highlight' | 'comment';
  quote: string;
  start?: number;
  text?: string;
  color: string;
  resolved?: boolean;
}

/** Messages between this embed and the Social Media portal page that hosts it (see lib/embedBridge.ts). */
export type EmbedOutbound =
  | { type: 'script-embed:ready'; documentId: string }
  | { type: 'script-embed:status'; documentId: string; status: ScriptStatus; round: number; access: ScriptAccess }
  | { type: 'script-embed:merge-completed'; documentId: string }
  | { type: 'script-embed:post-requested'; documentId: string }
  | { type: 'script-embed:close'; documentId: string }
  | { type: 'script-embed:auth-required' }
  | { type: 'script-embed:selection'; documentId: string; quote: string; start: number }
  | { type: 'script-embed:select-note'; documentId: string; id: string };

export type EmbedInbound =
  | { type: 'script-embed:close-request' }
  | { type: 'script-embed:refresh' }
  /** A fresh sign-in (the first one is 15 minutes old by the time it expires): the portal sends the next before then. */
  | { type: 'script-embed:token'; token: string }
  | { type: 'script-embed:notes'; notes: EmbedNote[]; activeNoteId: string | null }
  | { type: 'script-embed:go-to-note'; id: string }
  | { type: 'script-embed:set-readonly'; readOnly: boolean };
