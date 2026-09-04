/** 浏览器下载工具 */

export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/pdf') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** 将多份 PDF 字节打包为 ZIP 并下载（懒加载 jszip） */
export async function downloadPdfZip(
  entries: { name: string; bytes: Uint8Array }[],
  zipName: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}
