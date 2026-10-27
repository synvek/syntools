/** Shared PDF tool types and limits */

export type PdfError =
  | 'EMPTY'
  | 'NOT_PDF'
  | 'LOAD_FAILED'
  | 'NO_PAGES'
  | 'INVALID_RANGE'
  | 'TOO_LARGE'
  | 'ENCRYPT_FAILED'
  | 'PROCESS_FAILED'
  | 'NEED_PASSWORD'
  | 'WRONG_PASSWORD';

/** Recommended 50MB limit per file */
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

/** Scale used when rendering thumbnails */
export const PDF_THUMB_SCALE = 0.25;

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isPdfPasswordError(error: string): boolean {
  return error === 'NEED_PASSWORD' || error === 'WRONG_PASSWORD';
}
