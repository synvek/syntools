import { PDFDocument } from '@cantoo/pdf-lib';
import type { ToolResult } from '@/core/types';

export type PdfPermissionFlags = {
  printing?: boolean;
  modifying?: boolean;
  copying?: boolean;
  annotating?: boolean;
  fillingForms?: boolean;
  contentAccessibility?: boolean;
  documentAssembly?: boolean;
};

/**
 * 使用 @cantoo/pdf-lib 加密。兼容性取决于阅读器对标准 PDF 加密的支持。
 */
export async function encryptPdf(
  bytes: Uint8Array,
  opts: {
    userPassword: string;
    ownerPassword?: string;
    permissions?: PdfPermissionFlags;
  },
): Promise<ToolResult<Uint8Array>> {
  if (!opts.userPassword.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    doc.encrypt({
      userPassword: opts.userPassword,
      ownerPassword: opts.ownerPassword || opts.userPassword,
      permissions: {
        printing: opts.permissions?.printing ?? 'highResolution',
        modifying: opts.permissions?.modifying ?? false,
        copying: opts.permissions?.copying ?? false,
        annotating: opts.permissions?.annotating ?? false,
        fillingForms: opts.permissions?.fillingForms ?? false,
        contentAccessibility: opts.permissions?.contentAccessibility ?? true,
        documentAssembly: opts.permissions?.documentAssembly ?? false,
      },
    });
    return { ok: true, value: await doc.save() };
  } catch {
    return { ok: false, error: 'ENCRYPT_FAILED' };
  }
}
