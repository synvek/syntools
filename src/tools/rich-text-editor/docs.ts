import type { ToolResult } from '@/core/types';

/**
 * Pure logic layer for document-level features (DOM-free):
 * - TOC generation (from the heading tree + page numbers)
 * - HTML -> Markdown (for export)
 * Easy to unit test; the view layer only handles rendering and commands.
 */

export interface TocEntry {
  level: number;
  text: string;
  /** Page number (1-based); 0 when unknown */
  page: number;
}

export interface TocResult {
  entries: TocEntry[];
  /** TOC text (one "level\ttitle\tpage" per line) */
  text: string;
}

/** Build a TOC from the heading tree: pageOf(level, index) supplies page numbers from pagination */
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
 * Whitelist of span inline-style properties preserved in Markdown.
 * Markdown has no character-level styling, so these ride on GFM inline HTML to keep "expressible
 * information intact"; purely typographic data (indent/spacing/page setup) is reported in the loss list.
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

/** HTML -> Markdown: covers headings/emphasis/strikethrough/underline/highlight/inline styles/lists/quotes/code/tables/rules/links/images/page breaks */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];

  const inline = (node: Node): string => {
    // The recursion may start on a text node itself (map passes children directly), so return its content first
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
        // Underline / highlight / tracked insert have no Markdown syntax, so GFM inline HTML carries them
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
          // Footnote reference: Markdown has no superscript syntax, so emit the number (matching the end summary)
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
          // Inline formula: keep the LaTeX source ($...$, the usual Markdown-ecosystem notation)
          if (el.hasAttribute('data-math')) {
            text += `$${el.getAttribute('data-latex') ?? ''}$`;
            break;
          }
          // Comment marks (data-comment-id) have no Markdown equivalent: keep the text and report the marks in the loss list
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
    // Page break: Markdown has no pagination, so leave a restorable HTML comment
    if (el.hasAttribute('data-page-break')) {
      out.push('<!-- page-break -->');
      return;
    }
    // Block formula: a line of its own, emitted as $$...$$
    if (el.hasAttribute('data-math')) {
      out.push(`$$${el.getAttribute('data-latex') ?? ''}$$`);
      return;
    }
    // Footnote summary: expanded into an ordered list (numbers written during injection, matching the body)
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
    // TOC: expanded into a nested list (page numbers appended per entry), keeping levels readable
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

/** Local storage shape for comments and tracked changes (plain data; the UI renders it) */
export interface DocComment {
  id: string;
  /** The quoted source text the comment covers (for re-anchoring) */
  quote: string;
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
}

export interface TrackedChange {
  id: string;
  kind: 'insert' | 'delete';
  /** Changed text */
  text: string;
  author: string;
  createdAt: number;
}
