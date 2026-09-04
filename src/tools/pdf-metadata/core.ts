import type { ToolResult } from '@/core/types';
import { loadPdfFromFile, setPdfMetadata, isPdfFile, PDF_MAX_BYTES } from '@/core/pdf';
import type { PDFDocument } from '@cantoo/pdf-lib';

export { isPdfFile, PDF_MAX_BYTES };

export type PdfMetaFields = {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
};

export function readMeta(doc: PDFDocument): PdfMetaFields {
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: String(doc.getKeywords() ?? ''),
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
  };
}

export async function loadMeta(file: File, password?: string): Promise<ToolResult<{ doc: PDFDocument; meta: PdfMetaFields; pageCount: number }>> {
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    value: {
      doc: loaded.value,
      meta: readMeta(loaded.value),
      pageCount: loaded.value.getPageCount(),
    },
  };
}

export async function saveMeta(doc: PDFDocument, meta: PdfMetaFields): Promise<ToolResult<Uint8Array>> {
  return setPdfMetadata(doc, {
    title: meta.title,
    author: meta.author,
    subject: meta.subject,
    keywords: meta.keywords
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    creator: meta.creator,
    producer: meta.producer,
  });
}
