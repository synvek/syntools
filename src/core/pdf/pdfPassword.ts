import { isPdfPasswordError } from './types';

/** 是否应显示密码框 */
export function shouldShowPdfPassword(
  error: string | null | undefined,
  needsPassword: boolean,
): boolean {
  return needsPassword || (!!error && isPdfPasswordError(error));
}

/** 统一解析 PDF 工具错误文案（密码类走公共 pdf.errors） */
export function pdfToolErrorMessage(
  t: (key: string) => string,
  toolId: string,
  error: string,
): string {
  if (isPdfPasswordError(error)) return t(`pdf.errors.${error}`);
  return t(`tools.${toolId}.errors.${error}`);
}
