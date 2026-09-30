import { escapeHtml } from './prism';

/**
 * 把 Prism 的高亮 HTML 切分为「逐行 HTML」（阶段 6）。
 *
 * 为什么需要：导出卡片要支持行号与指定行高亮，必须逐行渲染 DOM；
 * 而 Prism 的块注释 / 多行字符串会输出**跨行 token**，直接按 `\n` 切字符串会破坏标签。
 * 这里用临时容器解析后按行重组：换行处先闭合当前打开的所有 `<span>`，
 * 下一行再用同样的 class 重新打开（高亮效果因此保持连续）。
 */

/** 单行的最大长度保护：超长行直接返回转义文本，避免解析开销 */
const MAX_PARSE_LENGTH = 200_000;

interface OpenTag {
  className: string;
}

/** 用临时容器解析高亮 HTML，并按行重组（无 DOM 环境时退化为按 \n 切分） */
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
      // 空元素（如 <br>）原样保留
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
