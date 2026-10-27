import { isPdfPasswordError } from './types';

/** Whether the password field should be shown */
export function shouldShowPdfPassword(
  error: string | null | undefined,
  needsPassword: boolean,
): boolean {
  return needsPassword || (!!error && isPdfPasswordError(error));
}

/** Map PDF tool errors to a message (password errors use the shared pdf.errors) */
export function pdfToolErrorMessage(
  t: (key: string) => string,
  toolId: string,
  error: string,
): string {
  if (isPdfPasswordError(error)) return t(`pdf.errors.${error}`);
  return t(`tools.${toolId}.errors.${error}`);
}
