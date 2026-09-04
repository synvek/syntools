import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';
import { PDF_MAX_BYTES, isPdfFile, type PdfError } from './types';

export async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export type LoadPdfOptions = {
  /** 打开加密 PDF 时的用户密码 */
  password?: string;
};

function mapLoadError(err: unknown): PdfError {
  const msg = String((err as Error)?.message ?? err);
  if (/password incorrect|incorrect password/i.test(msg)) return 'WRONG_PASSWORD';
  if (/is encrypted|no password|password required|need.?password/i.test(msg)) {
    return 'NEED_PASSWORD';
  }
  return 'LOAD_FAILED';
}

/**
 * 加载 PDF。加密文档需提供 password；不再默认 ignoreEncryption，
 * 避免「能打开但改坏/报错」的半加密状态。
 */
export async function loadPdfFromBytes(
  bytes: Uint8Array,
  opts?: LoadPdfOptions,
): Promise<ToolResult<PDFDocument>> {
  const password = opts?.password?.trim() || undefined;
  try {
    const doc = password
      ? await PDFDocument.load(bytes, { password })
      : await PDFDocument.load(bytes);
    if (doc.getPageCount() === 0) return { ok: false, error: 'NO_PAGES' };
    return { ok: true, value: doc };
  } catch (err) {
    return { ok: false, error: mapLoadError(err) };
  }
}

export async function loadPdfFromFile(
  file: File,
  opts?: LoadPdfOptions,
): Promise<ToolResult<PDFDocument>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return loadPdfFromBytes(await fileToBytes(file), opts);
}

/** 探测是否加密（未提供密码时返回 NEED_PASSWORD） */
export async function probePdfBytes(bytes: Uint8Array): Promise<ToolResult<true>> {
  const loaded = await loadPdfFromBytes(bytes);
  if (loaded.ok) return { ok: true, value: true };
  return loaded;
}

export async function probePdfFile(file: File): Promise<ToolResult<true>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return probePdfBytes(await fileToBytes(file));
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
