import type { ToolResult } from '@/core/types';
import { fileToBytes, isPdfFile, openPdfjsDoc, PDF_MAX_BYTES } from '@/core/pdf';

export interface ExtractedText {
  text: string;
  pages: number;
}

/** 将一页的 pdfjs 文本项拼接为纯文本（保留行间合并） */
export function joinTextItems(items: Array<{ str?: string }>): string {
  return items
    .map((it) => it.str ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractPdfText(
  file: File,
  password?: string,
): Promise<ToolResult<ExtractedText>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };

  const doc = await openPdfjsDoc(await fileToBytes(file), { password });
  if (!doc.ok) return doc;

  try {
    const parts: string[] = [];
    for (let i = 1; i <= doc.value.numPages; i += 1) {
      const page = await doc.value.getPage(i);
      const content = await page.getTextContent();
      const text = joinTextItems(content.items as Array<{ str?: string }>);
      parts.push(`—— 第 ${i} 页 ——\n${text}`);
    }
    await doc.value.cleanup();
    const text = parts.join('\n\n').trim();
    return { ok: true, value: { text, pages: doc.value.numPages } };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
