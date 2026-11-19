/**
 * Reading a foreign PDF for "insert pages from file" (M2-7).
 *
 * The editor keeps each imported file as a `PdfSource` in `doc.attachments`, so the bytes have to be
 * parsed once here (page count, encryption) and then never touched again until save.
 */

import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import type { PdfSource } from '../model/types';

/** Same ceiling as the open pipeline: anything bigger is almost certainly a mis-pick */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Stable identity for drafts: name + size + lastModified, like the open pipeline's fallback */
export function sourceFingerprint(
  name: string,
  size: number,
  lastModified: number | undefined,
): string {
  return `${name}:${size}:${lastModified ?? 0}`;
}

/**
 * Parse "1-3,5" into 0-based page indices.
 *
 * Empty input means "every page". Order is normalized (sorted, de-duplicated) because the caller
 * inserts pages in document order; a reversed range like `5-3` is treated as invalid rather than
 * silently swapped, so a typo cannot reorder a document.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (pageCount <= 0) return [];
  if (!trimmed) return Array.from({ length: pageCount }, (_, index) => index);

  const indices = new Set<number>();
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (!token) return [];

    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (!Number.isInteger(from) || !Number.isInteger(to)) return [];
      if (from < 1 || to > pageCount || from > to) return [];
      for (let page = from; page <= to; page += 1) indices.add(page - 1);
      continue;
    }

    const single = token.match(/^\d+$/);
    if (!single) return [];
    const page = Number(token);
    if (page < 1 || page > pageCount) return [];
    indices.add(page - 1);
  }

  return [...indices].sort((left, right) => left - right);
}

/** Bytes → `PdfSource`, rejecting encrypted files: the editor has no second password prompt */
export async function readPdfSource(input: {
  name: string;
  size: number;
  lastModified?: number;
  bytes: Uint8Array;
}): Promise<ToolResult<PdfSource>> {
  if (input.size > MAX_IMPORT_BYTES) return { ok: false, error: 'TOO_LARGE' };

  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(input.bytes, { updateMetadata: false });
    if (pdf.isEncrypted) return { ok: false, error: 'NEED_PASSWORD' };
    pageCount = pdf.getPageCount();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/encrypt/i.test(message)) return { ok: false, error: 'NEED_PASSWORD' };
    return { ok: false, error: 'LOAD_FAILED' };
  }

  if (pageCount <= 0) return { ok: false, error: 'NO_PAGES' };

  return {
    ok: true,
    value: {
      key: '',
      bytes: input.bytes,
      pageCount,
      encrypted: false,
      fingerprint: sourceFingerprint(input.name, input.size, input.lastModified),
    },
  };
}

/** Browser entry point: File → `PdfSource` */
export async function readPdfFile(file: File): Promise<ToolResult<PdfSource>> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    return { ok: false, error: 'NOT_PDF' };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await readPdfSource({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      bytes,
    });
  } catch {
    return { ok: false, error: 'LOAD_FAILED' };
  }
}
