/**
 * Pre-flight container diagnosis for imports (plan P0-2).
 *
 * `IMPORT_FAILED` used to be the only answer the editor could give, no matter what was wrong:
 * a password-protected workbook, a `.xls` renamed to `.xlsx`, a truncated download and a genuinely
 * unsupported producer all looked identical. Every one of them needs a different user action, so the
 * failure has to be classified before exceljs ever sees the bytes.
 *
 * Two checks, cheapest first:
 * 1. **Container magic** — OOXML is a ZIP; an OLE2 header means legacy binary or an encrypted
 *    package (`EncryptedPackage` stream), both of which the browser cannot open;
 * 2. **Required parts** — a ZIP without `xl/workbook.xml` is not a workbook.
 *
 * Everything is a pure function over bytes / part names so it can be tested without a real file.
 */

const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

/** The one part every workbook must have */
export const WORKBOOK_PART = 'xl/workbook.xml';

export type XlsxContainer = 'zip' | 'ole2' | 'unknown';

/** Container family from the first bytes: ZIP (OOXML), OLE2 (legacy .xls / encrypted), or neither */
export function sniffContainer(bytes: Uint8Array): XlsxContainer {
  if (
    bytes.length >= OLE2_MAGIC.length &&
    OLE2_MAGIC.every((byte, index) => bytes[index] === byte)
  ) {
    return 'ole2';
  }
  // PK\x03\x04 regular / PK\x05\x06 empty archive / PK\x07\x08 spanned archive
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08));
  return isZip ? 'zip' : 'unknown';
}

export type XlsxDiagnosis =
  | { ok: true; parts: string[] }
  | { ok: false; error: 'FILE_ENCRYPTED' | 'NOT_ZIP' | 'MISSING_WORKBOOK_PART' };

/**
 * Part-name check, separated from the ZIP reader so the rule is unit-testable.
 * `parts` are the archive entry names (`xl/workbook.xml`, `xl/worksheets/sheet1.xml`, …).
 */
export function diagnoseParts(parts: readonly string[]): XlsxDiagnosis {
  if (!parts.includes(WORKBOOK_PART)) return { ok: false, error: 'MISSING_WORKBOOK_PART' };
  return { ok: true, parts: [...parts] };
}

/**
 * Read the archive and classify it. The returned `parts` are reused by the import fidelity report,
 * so the ZIP is only opened once for both purposes.
 */
export async function diagnoseXlsxArchive(buffer: ArrayBuffer): Promise<XlsxDiagnosis> {
  const container = sniffContainer(new Uint8Array(buffer));
  if (container === 'ole2') return { ok: false, error: 'FILE_ENCRYPTED' };
  if (container !== 'zip') return { ok: false, error: 'NOT_ZIP' };
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    return diagnoseParts(Object.keys(zip.files));
  } catch {
    // A ZIP header that cannot be read is a truncated / corrupted download, not a format problem
    return { ok: false, error: 'NOT_ZIP' };
  }
}
