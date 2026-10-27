import { createId } from '../model/factory';
import type { Paragraph, Slide, SlideDoc, SlideElement, TextBody } from '../model/types';

/**
 * Markdown outline → slides.
 *
 * Why not marked: this path only needs **heading levels + list nesting + quotes**, not rich-text
 * rendering; a full Markdown parser would pull tens of KB into the editor's main chunk, at odds with
 * the "lightweight" positioning. So the hand-written parsing approach already in the repo is kept, with
 * the needed features filled in: heading levels, nested list indentation, and `>` quotes as speaker notes.
 *
 * Mapping rules:
 * - the shallowest heading level (e.g. `##` throughout) drives **pagination** → each heading at that level starts a slide;
 * - deeper headings and list items become bullets on the current slide, with nested lists indented;
 * - `>` quote lines become that slide's **speaker notes** (they never appear in the body);
 * - plain paragraphs also become bullets (keeping the "jot a few lines and you have a deck" workflow).
 */

export interface OutlineSlide {
  title: string;
  bullets: string[];
  /** Bullet indent level (one-to-one with bullets, 0 = top level; missing means all 0) */
  indent?: number[];
  /** Speaker notes from `>` quotes (empty by default) */
  notes?: string[];
  /** Heading level (1=H1), 0 when there is no heading; missing means 0 */
  level?: number;
}

export interface OutlineParseResult {
  slides: OutlineSlide[];
  /** Heading level used for pagination */
  pageLevel: number;
}

const FENCE_RE = /^\s*(?:```|~~~)/;
const ATX_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^(\s*)[-*+]\s+(.*\S)\s*$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*\S)\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_RE = /^\s*\|.*\|\s*$/;

/** List indent → level (2 spaces or 1 tab per level, up to 4 levels) */
function indentLevel(prefix: string): number {
  const width = prefix.replace(/\t/g, '  ').length;
  return Math.min(4, Math.floor(width / 2));
}

/** Pre-scan: determine the heading level used for pagination (the shallowest level in the document) */
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
 * Internal shape while parsing: optional fields are required here so the loop body needs no null
 * checks. Callers still see it as `OutlineSlide`.
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

/** Parse result with metadata (the page level goes to buildDeck to choose layouts) */
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
    // Code block content doesn't enter the outline (otherwise sample code becomes bullets)
    if (inFence) continue;
    if (!line.trim()) {
      inTable = false;
      continue;
    }
    // Skip whole tables: splitting cell text into bullets is meaningless
    if (TABLE_RE.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable) continue;

    // `>` quotes → speaker notes (multi-line continuation supported)
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
      // Deeper heading: appears as a bullet on the current slide
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
    // The first plain text line acts as the title when there is none, so a slide never lacks one
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

/* --------------------------- Outline → slides --------------------------- */

/** Pick by layout name: different outline shapes get different layouts, so the deck isn't all the same face */
function pickLayoutId(doc: SlideDoc, kind: 'cover' | 'section' | 'content'): string | undefined {
  const patterns: Record<typeof kind, RegExp> = {
    cover: /title\s*slide|标题页|封面/i,
    section: /section|章节/i,
    content: /title and content|title\s*&\s*content|标题和内容|标题\+内容/i,
  };
  const found = doc.layouts.find((layout) => patterns[kind].test(layout.name ?? ''));
  return found?.id ?? doc.layouts[0]?.id;
}

/** Outline → elements (title box + bullet box), geometry adapted to the page size */
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
      // Indent deepens with level (24px each), matching the look of PowerPoint bullet levels
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

/** Outline → a whole deck: cover layout for the first slide, section for title-only slides, title+content otherwise */
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
