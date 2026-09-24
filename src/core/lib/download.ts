/** 触发浏览器下载二进制/文本内容。 */
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

/** 下载纯文本（UTF-8）。 */
export function downloadText(text: string, filename: string): void {
  downloadBlob(text, filename, 'text/plain;charset=utf-8');
}
