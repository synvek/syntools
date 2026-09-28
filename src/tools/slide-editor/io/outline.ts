import { createId } from '../model/factory';
import type { Paragraph, Slide, SlideDoc, SlideElement, TextBody } from '../model/types';

/**
 * Markdown 大纲 → 幻灯片。
 *
 * 复用仓库里已有的「手写正则解析」思路（见 `mindmap-editor/io/markdown.ts`），
 * 不引入 marked：这条链路只需要标题与列表层级，不需要富文本渲染。
 *
 * 映射约定：
 * - 最靠前的标题层级（如整篇都是 `##`）作为**分页**依据 → 每个该级标题起一页；
 * - 更深层级的标题与列表项进入当前页的要点；
 * - 普通段落也作为要点（保留了「随手写几行就成稿」的用法）。
 */

export interface OutlineSlide {
  title: string;
  bullets: string[];
}

const FENCE_RE = /^\s*(?:```|~~~)/;
const ATX_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^\s*[-*+]\s+(.*\S)\s*$/;
const ORDERED_RE = /^\s*\d+[.)]\s+(.*\S)\s*$/;

/** 预扫描：确定用于分页的标题层级（取全篇最浅的一级） */
function splitLevel(lines: string[]): number {
  let level = 0;
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = ATX_RE.exec(line);
    if (!match) continue;
    const current = match[1].length;
    if (level === 0 || current < level) level = current;
  }
  return level || 1;
}

export function parseOutline(markdown: string): OutlineSlide[] {
  const lines = markdown.split(/\r?\n/);
  const level = splitLevel(lines);
  const slides: OutlineSlide[] = [];
  let current: OutlineSlide | null = null;
  let inFence = false;

  const ensureSlide = (): OutlineSlide => {
    if (!current) {
      current = { title: '', bullets: [] };
      slides.push(current);
    }
    return current;
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    // 代码块内容不进入大纲（否则会把示例代码当成要点）
    if (inFence) continue;
    if (!line.trim()) continue;

    const heading = ATX_RE.exec(line);
    if (heading) {
      const text = heading[2].trim();
      if (heading[1].length <= level) {
        current = { title: text, bullets: [] };
        slides.push(current);
      } else {
        // 更深层级标题：作为当前页的要点出现
        ensureSlide().bullets.push(text);
      }
      continue;
    }

    const list = LIST_RE.exec(line) ?? ORDERED_RE.exec(line);
    if (list) {
      ensureSlide().bullets.push(list[1].trim());
      continue;
    }

    const paragraph = line.trim();
    const slide = ensureSlide();
    // 首行普通文本在没有标题时充当标题，避免整页没有标题
    if (!slide.title && slide.bullets.length === 0) slide.title = paragraph;
    else slide.bullets.push(paragraph);
  }

  return slides.filter((slide) => slide.title || slide.bullets.length > 0);
}

/** 大纲 → 元素（标题框 + 要点框），几何按页面尺寸自适应 */
export function buildOutlineElements(doc: SlideDoc, outline: OutlineSlide): SlideElement[] {
  const margin = Math.round(doc.width * 0.06);
  const width = doc.width - margin * 2;
  const titleHeight = Math.round(doc.height * 0.14);
  const elements: SlideElement[] = [];

  if (outline.title) {
    elements.push({
      id: createId('el'),
      type: 'text',
      x: margin,
      y: Math.round(doc.height * 0.08),
      width,
      height: titleHeight,
      body: textBody([outline.title], 34, doc.theme.colors.dk1 ?? '#000000', true),
    });
  }

  if (outline.bullets.length > 0) {
    const top = Math.round(doc.height * 0.08) + titleHeight;
    elements.push({
      id: createId('el'),
      type: 'text',
      x: margin,
      y: top,
      width,
      height: Math.max(80, doc.height - top - Math.round(doc.height * 0.1)),
      body: textBody(outline.bullets, 20, doc.theme.colors.dk2 ?? '#333333', false),
    });
  }

  return elements;
}

function textBody(lines: string[], size: number, color: string, bold: boolean): TextBody {
  const paragraphs: Paragraph[] = lines.map((text) => ({
    runs: [{ text, style: { size, color, bold } }],
    align: 'left',
    ...(bold ? {} : { bullet: true }),
  }));
  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ runs: [{ text: '' }] }],
    anchor: 'top',
    wrap: true,
    autoFit: 'none',
    margins: { left: 8, top: 6, right: 8, bottom: 6 },
  };
}

/** 大纲 → 整套幻灯片（保留传入的 layoutId） */
export function buildDeck(doc: SlideDoc, slides: OutlineSlide[], layoutId?: string): Slide[] {
  return slides.map((outline) => ({
    id: createId('slide'),
    layoutId,
    elements: buildOutlineElements(doc, outline),
  }));
}
