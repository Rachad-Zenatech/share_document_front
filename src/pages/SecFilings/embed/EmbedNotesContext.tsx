import { createContext, useContext } from 'react';
import type { EmbedNote } from '../../../types/scriptReview';

export interface EmbedNotesContextValue {
  readOnly: boolean;
  notes: EmbedNote[];
  activeNoteId: string | null;
}

export const EmbedNotesContext = createContext<EmbedNotesContextValue>({
  readOnly: false,
  notes: [],
  activeNoteId: null,
});

export const useEmbedNotes = () => useContext(EmbedNotesContext);
