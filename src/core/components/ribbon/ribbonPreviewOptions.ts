import type { RibbonSelectOption } from './types';

/**
 * Turn a plain font list into preview rows.
 *
 * This is the whole reason the ribbon does not use a native `<select>`: Office shows each family *in
 * that family* so the user can recognise it without knowing the name. `value` doubles as the CSS font
 * stack (slides pass "Arial", the word processor passes `Arial, Helvetica, sans-serif`), and an empty
 * value means "document default" — that row simply inherits the UI font.
 */
export function fontPreviewOptions(
  entries: readonly { value: string; label: string }[],
): RibbonSelectOption[] {
  return entries.map((entry) => ({
    ...entry,
    preview: {
      fontFamily: entry.value || undefined,
      fontSize: '13px',
      // Latin + CJK + digits: shows the shape of the face, not just its name
      hint: 'AaBb 字',
    },
  }));
}
