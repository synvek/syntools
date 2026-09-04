import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { PDF_MAX_BYTES, isPdfFile } from './types';

export async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function loadPdfFromFile(file: File): Promise<ToolResult<PDFDocument>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  try {
    const bytes = await fileToBytes(file);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (doc.getPageCount() === 0) return { ok: false, error: 'NO_PAGES' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'LOAD_FAILED' };
  }
}

export async function loadPdfFromBytes(bytes: Uint8Array): Promise<ToolResult<PDFDocument>> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (doc.getPageCount() === 0) return { ok: false, error: 'NO_PAGES' };
    return { ok: true, value: doc };
  } catch {
    return { ok: false, error: 'LOAD_FAILED' };
  }
}

/** 解析 "1,3-5,8" 为 0-based 页索引（去重排序） */
export function parsePageSelection(input: string, pageCount: number): ToolResult<number[]> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'EMPTY' };
  const set = new Set<number>();
  for (const part of raw.split(/[,，\s]+/).filter(Boolean)) {
    const range = part.split(/[-–—]/);
    if (range.length === 1) {
      const n = Number(range[0]);
      if (!Number.isInteger(n) || n < 1 || n > pageCount) return { ok: false, error: 'INVALID_RANGE' };
      set.add(n - 1);
    } else if (range.length === 2) {
      const a = Number(range[0]);
      const b = Number(range[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > pageCount || b > pageCount) {
        return { ok: false, error: 'INVALID_RANGE' };
      }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) set.add(i - 1);
    } else {
      return { ok: false, error: 'INVALID_RANGE' };
    }
  }
  if (set.size === 0) return { ok: false, error: 'EMPTY' };
  return { ok: true, value: [...set].sort((x, y) => x - y) };
}
