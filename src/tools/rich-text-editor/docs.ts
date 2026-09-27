import type { ToolResult } from '@/core/types';

/**
 * 文档级能力的纯逻辑层（不依赖 DOM）：
 * - 目录生成（基于标题树 + 页码）
 * - HTML → Markdown（导出用）
 * 便于单测，View 层只负责渲染与命令。
 */

export interface TocEntry {
  level: number;
  text: string;
  /** 页码（1 起）；未知时为 0 */
  page: number;
}

export interface TocResult {
  entries: TocEntry[];
  /** 目录文本（每行 "层级\t标题\t页码"） */
  text: string;
}

/** 从标题树生成目录：pageOf(level, index) 由调用方按分页结果给出页码 */
export function buildTableOfContents(
  headings: { level: number; text: string }[],
  pageOf: (index: number) => number,
): ToolResult<TocResult> {
  if (headings.length === 0) return { ok: false, error: 'EMPTY' };
  const entries: TocEntry[] = headings.map((heading, index) => ({
    level: Math.min(Math.max(heading.level, 1), 6),
    text: heading.text.trim(),
    page: Math.max(0, pageOf(index)),
  }));
  const text = entries
    .map((entry) => `${'\t'.repeat(entry.level - 1)}${entry.text}\t${entry.page}`)
    .join('\n');
  return { ok: true, value: { entries, text } };
}

/** HTML → Markdown（覆盖标题/强调/列表/引用/代码/表格/分割线/链接/图片） */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];

  const inline = (node: Node): string => {
    // 递归入口可能是文本节点本身（map 直接传入子节点），必须先返回其内容
    if (node.nodeType === 3) return node.textContent ?? '';
    let text = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        text += child.textContent ?? '';
        return;
      }
      if (child.nodeType !== 1) return;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      const inner = Array.from(el.childNodes).map(inline).join('');
      switch (tag) {
        case 'strong':
        case 'b':
          text += `**${inner}**`;
          break;
        case 'em':
        case 'i':
          text += `*${inner}*`;
          break;
        case 's':
        case 'del':
        case 'strike':
          text += `~~${inner}~~`;
          break;
        case 'code':
          text += `\`${el.textContent ?? ''}\``;
          break;
        case 'a':
          text += `[${inner}](${el.getAttribute('href') ?? ''})`;
          break;
        case 'img':
          text += `![${el.getAttribute('alt') ?? ''}](${el.getAttribute('src') ?? ''})`;
          break;
        case 'br':
          text += '\n';
          break;
        default:
          text += inner;
      }
    });
    return text;
  };

  Array.from(doc.body.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5' ||
      tag === 'h6'
    ) {
      const level = Number(tag.slice(1));
      out.push(`${'#'.repeat(level)} ${inline(el)}`);
      return;
    }
    if (tag === 'p') {
      out.push(inline(el));
      return;
    }
    if (tag === 'blockquote') {
      out.push(
        inline(el)
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n'),
      );
      return;
    }
    if (tag === 'pre') {
      out.push(`\`\`\`\n${el.textContent ?? ''}\n\`\`\``);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      Array.from(el.children).forEach((li, index) => {
        const prefix = tag === 'ul' ? '- ' : `${index + 1}. `;
        const checked = li.getAttribute('data-checked');
        const marker =
          el.getAttribute('data-type') === 'taskList'
            ? checked === 'true'
              ? '- [x] '
              : '- [ ] '
            : prefix;
        out.push(`${marker}${inline(li)}`);
      });
      return;
    }
    if (tag === 'hr') {
      out.push('---');
      return;
    }
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length > 0) {
        const cells = (row: Element) =>
          Array.from(row.children).map((cell) => inline(cell).replace(/\|/g, '\\|'));
        const header = cells(rows[0]);
        out.push(`| ${header.join(' | ')} |`);
        out.push(`| ${header.map(() => '---').join(' | ')} |`);
        rows.slice(1).forEach((row) => {
          out.push(`| ${cells(row).join(' | ')} |`);
        });
      }
      return;
    }
    out.push(inline(el));
  });

  return out
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 批注与修订的本地存储结构（纯数据，UI 负责渲染） */
export interface DocComment {
  id: string;
  /** 批注覆盖的原文片段（用于重新定位） */
  quote: string;
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
}

export interface TrackedChange {
  id: string;
  kind: 'insert' | 'delete';
  /** 变更文本 */
  text: string;
  author: string;
  createdAt: number;
}
