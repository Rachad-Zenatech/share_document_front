import React from 'react';
import { activeDocumentType } from '../../../hooks/useFinancialTableTemplates';
import { MergeReviewModal } from './MergeReviewModal';
import { ScriptMergeReviewModal } from './ScriptMergeReviewModal';

/** The merge review that fits the open document: the script's own for a script, the filing's for everything else. */
export const DocumentMergeReview: React.FC<React.ComponentProps<typeof MergeReviewModal>> = (props) => {
  if (activeDocumentType() === 'script') {
    const { mainDoc: _mainDoc, ...scriptProps } = props;
    return <ScriptMergeReviewModal {...scriptProps} />;
  }
  return <MergeReviewModal {...props} />;
};
