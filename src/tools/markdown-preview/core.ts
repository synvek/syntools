import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';

/**
 * Markdown 预览（Tasks T41）：marked 解析 + DOMPurify 消毒，纯前端无数据外发。
 * 安全：输出 HTML 一律经 sanitize（剥离 script/事件属性/javascript: 链接），
 * UI 层才可 dangerouslySetInnerHTML。错误码与文案解耦（T29 约定）。
 */

export type MarkdownErrorCode = 'EMPTY' | 'PARSE';

export interface MarkdownOptions {
  /** GitHub 风格 Markdown（表格 / 删除线等），默认开启 */
  gfm: boolean;
  /** 换行符转 <br>，默认关闭 */
  breaks: boolean;
}

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = { gfm: true, breaks: false };

/** Markdown → 消毒后的 HTML 字符串 */
export function renderMarkdown(
  text: string,
  options: MarkdownOptions = DEFAULT_MARKDOWN_OPTIONS,
): ToolResult<string> {
  if (!text.trim()) return { ok: false, error: 'EMPTY' };
  try {
    const html = marked.parse(text, {
      async: false,
      gfm: options.gfm,
      breaks: options.breaks,
    });
    return { ok: true, value: DOMPurify.sanitize(html) };
  } catch {
    return { ok: false, error: 'PARSE' };
  }
}
