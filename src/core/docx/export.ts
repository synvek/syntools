import { buildDocxBlob } from './build';
import { htmlToDocxBlocks } from './html';
import type { DocxExportOptions } from './types';

/**
 * Public entry point for tools: HTML in, .docx blob out.
 *
 * The HTML is expected to use just headings, paragraphs, lists, tables, images and `<hr>` page
 * breaks. Anything richer is ignored by design; see `html.ts`.
 */
export async function exportHtmlToDocx(
  html: string,
  options: DocxExportOptions = {},
): Promise<Blob> {
  const blocks = htmlToDocxBlocks(html);
  return buildDocxBlob(blocks, options);
}
