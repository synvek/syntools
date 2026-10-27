import { escapeHtml } from './prism';

/**
 * Split Prism's highlighted HTML into per-line HTML (phase 6).
 *
 * Why: export cards need line numbers and per-line highlighting, which requires rendering one
 * DOM row per line, yet Prism emits **multi-line tokens** for block comments / multi-line strings,
 * so splitting the string on `\n` would break tags. This parses into a temporary container and
 * rebuilds by line: at each newline every open `<span>` is closed, then reopened with the same
 * class on the next line, so highlighting stays continuous.
 */

/** Max line length guard: over-long input is returned escaped to avoid the parse cost */
const MAX_PARSE_LENGTH = 200_000;

interface OpenTag {
  className: string;
}

/** Parse highlighted HTML in a temporary container and rebuild per line (falls back to \n split without DOM) */
export function splitHighlightedLines(html: string): string[] {
  if (!html) return [''];
  if (html.length > MAX_PARSE_LENGTH || typeof document === 'undefined') {
    return html.split('\n');
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const lines: string[] = [];
  const stack: OpenTag[] = [];
  let current = '';

  const reopen = () => stack.map((tag) => `<span class="${tag.className}">`).join('');
  const closeAll = () => '</span>'.repeat(stack.length);

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = (node.textContent ?? '').split('\n');
      parts.forEach((part, index) => {
        if (index > 0) {
          current += closeAll();
          lines.push(current);
          current = reopen();
        }
        current += escapeHtml(part);
      });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const className = element.getAttribute('class') ?? '';
    if (element.childNodes.length === 0) {
      // Keep void elements (e.g. <br>) as they are
      current += element.outerHTML;
      return;
    }
    current += className ? `<span class="${className}">` : '<span>';
    stack.push({ className });
    element.childNodes.forEach(walk);
    stack.pop();
    current += '</span>';
  };

  template.content.childNodes.forEach(walk);
  lines.push(current);
  return lines;
}
