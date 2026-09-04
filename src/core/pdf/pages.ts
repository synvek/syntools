import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';

export async function mergePdfs(docs: PDFDocument[]): Promise<ToolResult<Uint8Array>> {
  if (docs.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const out = await PDFDocument.create();
    for (const doc of docs) {
      const indices = doc.getPageIndices();
      const pages = await out.copyPages(doc, indices);
      pages.forEach((p) => out.addPage(p));
    }
    if (out.getPageCount() === 0) return { ok: false, error: 'NO_PAGES' };
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/** 每页拆成独立 PDF */
export async function splitPdfToPages(doc: PDFDocument): Promise<ToolResult<Uint8Array[]>> {
  const count = doc.getPageCount();
  if (count === 0) return { ok: false, error: 'NO_PAGES' };
  try {
    const parts: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(doc, [i]);
      out.addPage(page);
      parts.push(await out.save());
    }
    return { ok: true, value: parts };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function deletePages(
  doc: PDFDocument,
  indicesToDelete: number[],
): Promise<ToolResult<Uint8Array>> {
  const count = doc.getPageCount();
  if (count === 0) return { ok: false, error: 'NO_PAGES' };
  const remove = new Set(indicesToDelete.filter((i) => i >= 0 && i < count));
  if (remove.size === 0) return { ok: false, error: 'EMPTY' };
  if (remove.size >= count) return { ok: false, error: 'NO_PAGES' };
  try {
    const keep = doc.getPageIndices().filter((i) => !remove.has(i));
    const out = await PDFDocument.create();
    const pages = await out.copyPages(doc, keep);
    pages.forEach((p) => out.addPage(p));
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export async function extractPages(
  doc: PDFDocument,
  indices: number[],
): Promise<ToolResult<Uint8Array>> {
  const count = doc.getPageCount();
  const valid = indices.filter((i) => i >= 0 && i < count);
  if (valid.length === 0) return { ok: false, error: 'EMPTY' };
  try {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(doc, valid);
    pages.forEach((p) => out.addPage(p));
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

/** order: 新顺序的 0-based 页索引（必须覆盖全部页且不重复） */
export async function reorderPages(
  doc: PDFDocument,
  order: number[],
): Promise<ToolResult<Uint8Array>> {
  const count = doc.getPageCount();
  if (order.length !== count) return { ok: false, error: 'INVALID_RANGE' };
  const set = new Set(order);
  if (set.size !== count) return { ok: false, error: 'INVALID_RANGE' };
  for (const i of order) {
    if (i < 0 || i >= count) return { ok: false, error: 'INVALID_RANGE' };
  }
  try {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(doc, order);
    pages.forEach((p) => out.addPage(p));
    return { ok: true, value: await out.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}

export type RotateAngle = 90 | 180 | 270;

export async function rotatePages(
  doc: PDFDocument,
  indices: number[],
  angle: RotateAngle,
): Promise<ToolResult<Uint8Array>> {
  const count = doc.getPageCount();
  const targets = indices.length > 0 ? indices : doc.getPageIndices();
  try {
    for (const i of targets) {
      if (i < 0 || i >= count) continue;
      const page = doc.getPage(i);
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
