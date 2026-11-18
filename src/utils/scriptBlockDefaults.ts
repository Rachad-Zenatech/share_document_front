import type { SecBlock, SecBlockType } from '../types/secFiling';
import { SCRIPT_FONT_FAMILY } from '../types/documentType';

/** Script insertions start with script content rather than filing examples. */
export function scriptBlockDefaults(type: SecBlockType): Partial<SecBlock> {
  switch (type) {
    case 'heading': return { fontFamily: SCRIPT_FONT_FAMILY };
    case 'paragraph': return { text: '', fontFamily: SCRIPT_FONT_FAMILY };
    case 'image': return { url: '', alt: 'Script reference image', caption: '' };
    case 'callout': return { variant: 'info', title: 'Production note', content: '' };
    case 'divider': return { pageBreak: false, label: 'Scene break' };
    default: return {};
  }
}
