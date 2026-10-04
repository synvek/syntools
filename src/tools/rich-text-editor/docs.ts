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

/**
 * span 内联样式中可在 Markdown 里保留的属性白名单。
 * Markdown 本身无字符级样式，这里以 GFM 允许的内联 HTML 承载，
 * 保证「可表达的信息不丢」，纯排版信息（缩进/间距/页面设置）由损耗清单提示。
 */
const MARKDOWN_INLINE_STYLE_PROPS = [
  'color',
  'background-color',
  'font-size',
  'font-family',
  'line-height',
] as const;

function inlineStyleAttr(el: Element): string {
  const style = (el as HTMLElement).style;
  if (!style) return '';
  return MARKDOWN_INLINE_STYLE_PROPS.map((prop) => {
    const value = style.getPropertyValue(prop).trim();
    return value ? `${prop}: ${value}` : '';
  })
    .filter(Boolean)
    .join('; ');
}

/** HTML → Markdown：覆盖标题/强调/删除线/下划线/高亮/行内样式/列表/引用/代码/表格/分割线/链接/图片/分页符 */
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
        // 下划线 / 高亮 / 修订插入在 Markdown 中无原生语法，用 GFM 允许的内联 HTML 承载
        case 'u':
          text += `<u>${inner}</u>`;
          break;
        case 'mark':
          text += `<mark>${inner}</mark>`;
          break;
        case 'ins':
          text += `<ins>${inner}</ins>`;
          break;
        case 'sub':
          text += `<sub>${inner}</sub>`;
          break;
        case 'sup':
          // 脚注引用：Markdown 无上标语法，直接输出编号（与文末汇总区一一对应）
          text += el.hasAttribute('data-footnote') ? inner : `<sup>${inner}</sup>`;
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
        case 'span':
        case 'div': {
          // 行内公式：保留 LaTeX 源码（Markdown 生态通用写法 $...$）
          if (el.hasAttribute('data-math')) {
            text += `$${el.getAttribute('data-latex') ?? ''}$`;
            break;
          }
          // 批注标记（data-comment-id）无 Markdown 对应语法：保留文本，标记由损耗清单提示
          const style = inlineStyleAttr(el);
          text += style ? `<span style="${style}">${inner}</span>` : inner;
          break;
        }
        default:
          text += inner;
      }
    });
    return text;
  };

  Array.from(doc.body.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    // 分页符：Markdown 无分页语义，留一个可直接还原的 HTML 注释
    if (el.hasAttribute('data-page-break')) {
      out.push('<!-- page-break -->');
      return;
    }
    // 块级公式：独占一行，输出 $$...$$
    if (el.hasAttribute('data-math')) {
      out.push(`$$${el.getAttribute('data-latex') ?? ''}$$`);
      return;
    }
    // 脚注汇总区：展开为有序列表（编号由注入阶段写入，与正文上标一致）
    if (el.hasAttribute('data-footnote-list')) {
      const items = Array.from(el.querySelectorAll('li'));
      if (items.length === 0) return;
      const caption = el.querySelector('.rte-footnote-list-title')?.textContent?.trim();
      if (caption) out.push(`**${caption}**`);
      items.forEach((item, index) => {
        out.push(`${index + 1}. ${inline(item).trim()}`);
      });
      return;
    }
    // 目录：展开为嵌套列表（页码附在条目末尾），保持层级可读
    if (el.hasAttribute('data-toc')) {
      const items = Array.from(el.querySelectorAll('li[data-level]'));
      if (items.length === 0) return;
      const caption = el.querySelector('.rte-toc-title')?.textContent?.trim();
      if (caption) out.push(`**${caption}**`);
      items.forEach((item) => {
        const text = item.querySelector('.rte-toc-text')?.textContent?.trim() ?? '';
        if (!text) return;
        const level = Math.max(1, Number(item.getAttribute('data-level')) || 1);
        const page = item.querySelector('.rte-toc-page')?.textContent?.trim();
        out.push(`${'  '.repeat(level - 1)}- ${text}${page ? ` … ${page}` : ''}`);
      });
      return;
    }
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
