import type { ToolResult } from '@/core/types';
import { fileToBytes, isPdfFile, loadPdfFromBytes, PDF_MAX_BYTES } from '@/core/pdf';

export interface DecryptResult {
  bytes: Uint8Array;
  pages: number;
  originalEncrypted: boolean;
}

/** 校验输入并返回文件字节（封装体积与类型检查，便于单测） */
export async function readPdfBytes(file: File): Promise<ToolResult<Uint8Array>> {
  if (!isPdfFile(file)) return { ok: false, error: 'NOT_PDF' };
  if (file.size > PDF_MAX_BYTES) return { ok: false, error: 'TOO_LARGE' };
  return { ok: true, value: await fileToBytes(file) };
}

/**
 * 移除 PDF 密码：用密码加载后原样保存（不重新加密）即得到无保护文件。
 * 等价于 qpdf --decrypt。
 */
export async function decryptPdf(file: File, password: string): Promise<ToolResult<DecryptResult>> {
  const bytesResult = await readPdfBytes(file);
  if (!bytesResult.ok) return bytesResult;

  const loaded = await loadPdfFromBytes(bytesResult.value, { password });
  if (!loaded.ok) return loaded;

  try {
    const bytes = await loaded.value.save();
    return {
      ok: true,
      value: { bytes, pages: loaded.value.getPageCount(), originalEncrypted: true },
    };
  } catch {
    return { ok: false, error: 'PROCESS_FAILED' };
  }
}
