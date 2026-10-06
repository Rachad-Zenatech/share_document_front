// Collaborator type definition
export interface Collaborator {
  id: string; // UUID or generated string
  name: string;
  email: string;
  canEditDocument: boolean; // permission to edit the SEC filing document
  canEditSpreadsheet: boolean; // permission to edit the attached spreadsheet
  invitedAt: string; // ISO timestamp
  acceptedAt?: string; // ISO timestamp when they accept (optional for demo)
}

export type ContributorPermissions = Pick<Collaborator, 'canEditDocument' | 'canEditSpreadsheet'>;
