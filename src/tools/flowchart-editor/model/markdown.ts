/**
 * 轻量 Markdown 标签渲染：仅支持行内语法（加粗 / 斜体 / 行内代码 / 链接 / 换行）。
 * 输出已转义的 HTML，供节点标签以 dangerouslySetInnerHTML 呈现；
 * 不做块级解析，避免引入重型依赖。
 */

/** 允许的链接协议（其余一律忽略，避免 javascript: 等注入） */
const SAFE_URL = /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 校验链接安全性；不合法返回 null（调用方原样保留文本） */
export function safeMarkdownHref(url: string): string | null {
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

/** 行内 Markdown → 安全 HTML */
export function renderInlineMarkdown(text: string): string {
  let out = escapeHtml(text);

  // 行内代码：先用私有区占位符替换，避免其内部被其它规则改写
  const codes: string[] = [];
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\uE000${codes.length - 1}\uE001`;
  });

  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const safe = safeMarkdownHref(href);
    if (!safe) return match;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  out = out.replace(
    /\uE000(\d+)\uE001/g,
    (_m, index: string) => `<code>${codes[Number(index)]}</code>`,
  );
  return out.replace(/\n/g, '<br/>');
}
