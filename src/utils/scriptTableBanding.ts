import type { SecTableRow } from '../types/secFiling';

/** The fill of every second row in a script's beats table (see data/socialMediaScriptTemplate.ts). */
const BAND_FILL = '#F1F5F9';

/**
 * Keeps a banded table banded. A script's beats table shades every second row, but the shading is stored on each row, so a row
 * that is added, copied, moved or removed would otherwise break the pattern. When the table is banded (any row has the band fill),
 * its plain data rows are shaded again by their position; rows with a colour of their own are left alone.
 */
export function reband(rows: SecTableRow[]): SecTableRow[] {
  if (!rows.some((r) => r.shading === BAND_FILL)) return rows;
  return rows.map((r, i) => {
    if (r.type !== 'data' || (r.shading && r.shading !== BAND_FILL)) return r;
    const shading = i % 2 ? BAND_FILL : undefined;
    if (r.shading === shading) return r;
    const next = { ...r };
    if (shading) next.shading = shading;
    else delete next.shading;
    return next;
  });
}
