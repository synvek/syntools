/**
 * Status-bar number formatting.
 *
 * Separated from `StatusBar.tsx` so the component file only exports components (fast refresh) and
 * the formatting rules can be unit tested without mounting React.
 */

const PT_TO_MM = 25.4 / 72;

/** `1.2 MB` / `840 KB` — enough precision for a status bar */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Page size in pt with the mm equivalent (A4: `595 × 842 pt · 210 × 297 mm`) */
export function formatPageSize(widthPt: number, heightPt: number): string {
  const pt = (value: number) => Math.round(value);
  const mm = (value: number) => Math.round(value * PT_TO_MM);
  return `${pt(widthPt)} × ${pt(heightPt)} pt · ${mm(widthPt)} × ${mm(heightPt)} mm`;
}
