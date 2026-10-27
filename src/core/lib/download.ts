/** Trigger a browser download of binary or text content. */
export function downloadBlob(
  content: BlobPart,
  filename: string,
  mime = 'application/octet-stream',
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Download plain text (UTF-8). */
export function downloadText(text: string, filename: string): void {
  downloadBlob(text, filename, 'text/plain;charset=utf-8');
}
