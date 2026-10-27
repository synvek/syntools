/**
 * Clipboard extensions (phase 7): copy rich text and images.
 *
 * The in-app `CopyButton` only covers `writeText` (plain text), while `ClipboardItem` support
 * (text/html, image/png) varies between browsers. This module wraps both and degrades explicitly:
 * - Rich text: falls back to plain text when `ClipboardItem` is unavailable or the write fails;
 * - Images: returns false when unavailable or the write fails, so the caller can offer "Download PNG".
 * No failure is silent: callers surface it via `role="status"` or the download path.
 */

export type RichTextCopyResult = 'rich' | 'plain';

/** Copy rich text (HTML with a plain-text fallback); throws when the clipboard is unavailable */
export async function copyRichText(html: string, text: string): Promise<RichTextCopyResult> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return 'rich';
    } catch {
      // Some browsers restrict text/html, so fall back to plain text
    }
  }
  await navigator.clipboard.writeText(text);
  return 'plain';
}

/** Copy a PNG image; returns whether it succeeded (callers should fall back to download) */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}
