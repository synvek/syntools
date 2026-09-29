import type { SlideDoc, SlideElement, TextBody } from './types';

/**
 * 跨页查找替换（纯函数）。
 *
 * 覆盖所有带文本的模型位置：文本框 / 形状内文字 / 表格单元格 / 备注。
 * 图表类别与系列名不参与替换（改动会破坏数据语义）。
 */

export interface TextHit {
  slideIndex: number;
  elementId: string;
  /** 命中位置描述：text = 元素正文，table = 单元格，notes = 备注 */
  scope: 'text' | 'table' | 'notes';
  /** 表格命中的行列（scope === 'table'） */
  cell?: { row: number; col: number };
  /** 该处命中的次数 */
  count: number;
}

export interface FindOptions {
  matchCase?: boolean;
  /** 是否搜索演讲者备注 */
  includeNotes?: boolean;
}

function haystack(hay: string, query: string, matchCase: boolean): number {
  const source = matchCase ? hay : hay.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let cursor = source.indexOf(needle);
  while (cursor !== -1) {
    count += 1;
    cursor = source.indexOf(needle, cursor + needle.length);
  }
  return count;
}

function bodyText(body: TextBody | undefined): string {
  if (!body) return '';
  return body.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n');
}

/** 元素里的可搜索文本（不含图表数据） */
export function elementText(element: SlideElement): string {
  if (element.type === 'text') return bodyText(element.body);
  if (element.type === 'shape') return bodyText(element.body);
  if (element.type === 'table') {
    return element.rows
      .flatMap((row) => row.map((cell) => cell.text ?? ''))
      .filter(Boolean)
      .join('\n');
  }
  if (element.type === 'formula') return element.latex;
  return '';
}

/** 全文档统计命中次数（供查找面板显示「N 处」） */
export function countMatches(doc: SlideDoc, query: string, options: FindOptions = {}): number {
  if (!query.trim()) return 0;
  const matchCase = options.matchCase ?? false;
  let total = 0;
  for (const slide of doc.slides) {
    for (const element of slide.elements) {
      total += haystack(elementText(element), query, matchCase);
    }
    if (options.includeNotes) total += haystack(slide.notes ?? '', query, matchCase);
  }
  return total;
}

/** 逐处列出命中（供导航到「下一个」） */
export function findInDoc(doc: SlideDoc, query: string, options: FindOptions = {}): TextHit[] {
  if (!query.trim()) return [];
  const matchCase = options.matchCase ?? false;
  const hits: TextHit[] = [];
  doc.slides.forEach((slide, slideIndex) => {
    for (const element of slide.elements) {
      if (element.type === 'table') {
        element.rows.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            const count = haystack(cell.text ?? '', query, matchCase);
            if (count > 0) {
              hits.push({
                slideIndex,
                elementId: element.id,
                scope: 'table',
                cell: { row: rowIndex, col: colIndex },
                count,
              });
            }
          });
        });
        continue;
      }
      const count = haystack(elementText(element), query, matchCase);
      if (count > 0) hits.push({ slideIndex, elementId: element.id, scope: 'text', count });
    }
    if (options.includeNotes) {
      const count = haystack(slide.notes ?? '', query, matchCase);
      if (count > 0) hits.push({ slideIndex, elementId: '', scope: 'notes', count });
    }
  });
  return hits;
}

/** 替换一段文本中的全部匹配（按字面量替换，不做正则解释） */
export function replaceAllInText(
  source: string,
  query: string,
  replacement: string,
  matchCase: boolean,
): string {
  if (!query) return source;
  if (matchCase) return source.split(query).join(replacement);
  // 大小写不敏感：用正则匹配但转义元字符，避免用户输入被当成模式
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(escaped, 'gi'), replacement);
}

/** 替换 body 内的文本；无命中时返回**原引用**，让调用方可以据此判断「有没有变」 */
function replaceInBody(
  body: TextBody,
  query: string,
  replacement: string,
  matchCase: boolean,
): TextBody {
  let touched = false;
  const paragraphs = body.paragraphs.map((paragraph) => {
    let paragraphTouched = false;
    const runs = paragraph.runs.map((run) => {
      const next = replaceAllInText(run.text, query, replacement, matchCase);
      if (next === run.text) return run;
      paragraphTouched = true;
      return { ...run, text: next };
    });
    if (!paragraphTouched) return paragraph;
    touched = true;
    return { ...paragraph, runs };
  });
  return touched ? { ...body, paragraphs } : body;
}

/** 替换整个文档中的全部匹配，返回**新文档**（不改原对象）；无命中时返回原引用 */
export function replaceInDoc(
  doc: SlideDoc,
  query: string,
  replacement: string,
  options: FindOptions = {},
): SlideDoc {
  if (!query.trim()) return doc;
  const matchCase = options.matchCase ?? false;
  let changed = false;

  const slides = doc.slides.map((slide) => {
    let slideChanged = false;
    const elements = slide.elements.map((element) => {
      if (element.type === 'text' || element.type === 'shape') {
        if (!element.body) return element;
        const body = replaceInBody(element.body, query, replacement, matchCase);
        if (body === element.body) return element;
        slideChanged = true;
        return { ...element, body };
      }
      if (element.type === 'table') {
        let cellTouched = false;
        const rows = element.rows.map((row) =>
          row.map((cell) => {
            const next = replaceAllInText(cell.text ?? '', query, replacement, matchCase);
            if (next === cell.text) return cell;
            cellTouched = true;
            return { ...cell, text: next };
          }),
        );
        if (!cellTouched) return element;
        slideChanged = true;
        return { ...element, rows };
      }
      return element;
    });

    let notes = slide.notes;
    if (options.includeNotes && notes) {
      const next = replaceAllInText(notes, query, replacement, matchCase);
      if (next !== notes) {
        notes = next;
        slideChanged = true;
      }
    }
    if (!slideChanged) return slide;
    changed = true;
    return { ...slide, elements, notes };
  });

  if (!changed) return doc;
  return { ...doc, slides, version: doc.version + 1 };
}
