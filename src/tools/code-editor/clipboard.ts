/**
 * 剪贴板扩展（阶段 7）：复制富文本与图片。
 *
 * 站内 `CopyButton` 只覆盖 `writeText`（纯文本），而 `ClipboardItem`（text/html、image/png）
 * 的支持度参差 —— 这里统一封装并显式降级：
 * - 富文本：`ClipboardItem` 不可用或写入失败时回落为纯文本；
 * - 图片：不可用或写入失败时返回 false，由调用方降级为「下载 PNG」。
 * 所有失败都不静默：调用方以 `role="status"` / 下载路径给出明确反馈。
 */

export type RichTextCopyResult = 'rich' | 'plain';

/** 复制富文本（HTML + 纯文本兜底）；剪贴板不可用时抛出，由调用方提示 */
export async function copyRichText(html: string, text: string): Promise<RichTextCopyResult> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return 'rich';
    } catch {
      // 部分浏览器对 text/html 有限制，回落纯文本
    }
  }
  await navigator.clipboard.writeText(text);
  return 'plain';
}

/** 复制 PNG 图片；返回是否成功（失败时调用方应降级为下载） */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}
