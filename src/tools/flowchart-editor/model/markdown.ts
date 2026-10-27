/**
 * Lightweight Markdown label rendering: inline syntax only (bold / italic / inline code / links / line breaks).
 * Emits escaped HTML, rendered in node labels via dangerouslySetInnerHTML;
 * no block-level parsing, to avoid heavy dependencies.
 */

/** Allowed link protocols (everything else is ignored, preventing injections such as javascript:) */
const SAFE_URL = /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Validate link safety; returns null when invalid (callers keep the text as-is) */
export function safeMarkdownHref(url: string): string | null {
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

/** Inline Markdown → safe HTML */
export function renderInlineMarkdown(text: string): string {
  let out = escapeHtml(text);

  // Inline code: substitute a private-use-area placeholder first so other rules cannot rewrite its contents
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
