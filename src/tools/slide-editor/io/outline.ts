import { createId } from '../model/factory';
import type { Paragraph, Slide, SlideDoc, SlideElement, TextBody } from '../model/types';

/**
 * Markdown 大纲 → 幻灯片。
 *
 * 为什么不用 marked：这条链路只需要**标题层级 + 列表层级 + 引用**三种结构，
 * 不需要富文本渲染；引入完整的 Markdown 解析器会把几十 KB 拉进编辑器主 chunk，
 * 与「轻量」定位冲突。因此沿用仓库里已有的手写解析思路，但把需要的能力补齐：
 * 标题层级、嵌套列表缩进、`>` 引用转演讲者备注。
 *
 * 映射约定：
 * - 最靠前的标题层级（如整篇都是 `##`）作为**分页**依据 → 每个该级标题起一页；
 * - 更深层级的标题与列表项进入当前页的要点，嵌套列表带缩进；
 * - `>` 引用行进入该页的**演讲者备注**（不会出现在正文里）；
 * - 普通段落也作为要点（保留「随手写几行就成稿」的用法）。
 */

export interface OutlineSlide {
  title: string;
  bullets: string[];
  /** 要点缩进级别（与 bullets 一一对应，0 为顶层；缺省视为全 0） */
  indent?: number[];
  /** 来自 `>` 引用的演讲者备注（缺省为空） */
  notes?: string[];
  /** 标题层级（1=H1），无标题时为 0；缺省视为 0 */
  level?: number;
}

export interface OutlineParseResult {
  slides: OutlineSlide[];
  /** 用于分页的标题层级 */
  pageLevel: number;
}

const FENCE_RE = /^\s*(?:```|~~~)/;
const ATX_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^(\s*)[-*+]\s+(.*\S)\s*$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*\S)\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_RE = /^\s*\|.*\|\s*$/;

/** 列表缩进 → 层级（2 空格或 1 个 Tab 记一级，最多 4 级） */
function indentLevel(prefix: string): number {
  const width = prefix.replace(/\t/g, '  ').length;
  return Math.min(4, Math.floor(width / 2));
}

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

/**
 * 解析期间的内部形态：可选字段在这里都是必填，
 * 这样循环体里就不需要到处判空。对外仍以 `OutlineSlide` 暴露。
 */
type ParsedSlide = OutlineSlide & {
  bullets: string[];
  indent: number[];
  notes: string[];
  level: number;
};

export function parseOutline(markdown: string): OutlineSlide[] {
  return parseOutlineDetailed(markdown).slides;
}

/** 带元信息的解析结果（分页层级可传给 buildDeck 决定版式） */
export function parseOutlineDetailed(markdown: string): OutlineParseResult {
  const lines = markdown.split(/\r?\n/);
  const pageLevel = splitLevel(lines);
  const slides: ParsedSlide[] = [];
  let current: ParsedSlide | null = null;
  let inFence = false;
  let inTable = false;

  const newSlide = (title: string, level: number): ParsedSlide => {
    const slide: ParsedSlide = { title, bullets: [], indent: [], notes: [], level };
    slides.push(slide);
    return slide;
  };

  const ensureSlide = (): ParsedSlide => {
    if (!current) current = newSlide('', 0);
    return current;
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    // 代码块内容不进入大纲（否则会把示例代码当成要点）
    if (inFence) continue;
    if (!line.trim()) {
      inTable = false;
      continue;
    }
    // 表格整体跳过：单元格文本拆成要点没有意义
    if (TABLE_RE.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable) continue;

    // `>` 引用 → 演讲者备注（支持多行续写）
    const quote = QUOTE_RE.exec(line);
    if (quote) {
      const slide = ensureSlide();
      const text = quote[1].trim();
      if (text) slide.notes.push(text);
      continue;
    }

    const heading = ATX_RE.exec(line);
    if (heading) {
      const text = heading[2].trim();
      const level = heading[1].length;
      if (level <= pageLevel) current = newSlide(text, level);
      // 更深层级标题：作为当前页的要点出现
      else {
        const slide = ensureSlide();
        slide.bullets.push(text);
        slide.indent.push(Math.max(1, level - pageLevel));
      }
      continue;
    }

    const list = LIST_RE.exec(line) ?? ORDERED_RE.exec(line);
    if (list) {
      const slide = ensureSlide();
      slide.bullets.push(list[2].trim());
      slide.indent.push(indentLevel(list[1]));
      continue;
    }

    const paragraph = line.trim();
    const slide = ensureSlide();
    // 首行普通文本在没有标题时充当标题，避免整页没有标题
    if (!slide.title && slide.bullets.length === 0) slide.title = paragraph;
    else {
      slide.bullets.push(paragraph);
      slide.indent.push(0);
    }
  }

  return {
    pageLevel,
    slides: slides.filter((slide) => slide.title || slide.bullets.length > 0),
  };
}

/* --------------------------- 大纲 → 幻灯片 --------------------------- */

/** 按版式名挑选：不同的大纲结构配不同的版式，避免整篇都是同一张脸 */
function pickLayoutId(doc: SlideDoc, kind: 'cover' | 'section' | 'content'): string | undefined {
  const patterns: Record<typeof kind, RegExp> = {
    cover: /title\s*slide|标题页|封面/i,
    section: /section|章节/i,
    content: /title and content|title\s*&\s*content|标题和内容|标题\+内容/i,
  };
  const found = doc.layouts.find((layout) => patterns[kind].test(layout.name ?? ''));
  return found?.id ?? doc.layouts[0]?.id;
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
      body: textBody(
        outline.bullets,
        20,
        doc.theme.colors.dk2 ?? '#333333',
        false,
        outline.indent ?? [],
      ),
    });
  }

  return elements;
}

function textBody(
  lines: string[],
  size: number,
  color: string,
  bold: boolean,
  indents: number[] = [],
): TextBody {
  const paragraphs: Paragraph[] = lines.map((text, index) => {
    const level = indents[index] ?? 0;
    return {
      runs: [{ text, style: { size, color, bold } }],
      align: 'left',
      ...(bold ? {} : { bullet: true }),
      // 缩进按层级递进（每级 24px），与 PowerPoint 的项目符号层级观感一致
      ...(level > 0 ? { indent: level * 24 } : {}),
    };
  });
  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ runs: [{ text: '' }] }],
    anchor: 'top',
    wrap: true,
    autoFit: 'none',
    margins: { left: 8, top: 6, right: 8, bottom: 6 },
  };
}

/** 大纲 → 整套幻灯片：首页用封面版式、纯标题页用章节版式、其余用标题+内容版式 */
export function buildDeck(doc: SlideDoc, slides: OutlineSlide[], layoutId?: string): Slide[] {
  const cover = pickLayoutId(doc, 'cover');
  const section = pickLayoutId(doc, 'section');
  const content = pickLayoutId(doc, 'content');
  return slides.map((outline, index) => {
    let picked = layoutId ?? content;
    if (!layoutId) {
      if (outline.bullets.length === 0 && index === 0) picked = cover;
      else if (outline.bullets.length === 0) picked = section;
    }
    return {
      id: createId('slide'),
      layoutId: picked,
      elements: buildOutlineElements(doc, outline),
      notes: (outline.notes ?? []).length > 0 ? (outline.notes ?? []).join('\n') : undefined,
    };
  });
}
