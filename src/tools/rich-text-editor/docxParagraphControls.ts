/**
 * Paragraph level `.docx` → editor attributes (plan P1-4 and the import fidelity pass).
 *
 * `keepNext` / `keepLines` / `widowControl` / line spacing / tab stops live in `w:pPr`, and mammoth —
 * the converter behind the import — throws `w:pPr` away (it only keeps the style name). So the export
 * writes them and the import re-reads them here, straight from `word/document.xml`, and stamps them
 * back as the same attributes the editor already renders.
 *
 * Alignment and indentation ride along, because Word puts them in the same block and they are the
 * most visible difference on import: a centred cover image or a centred Title/Subtitle coming from
 * `w:jc` (directly, or through the paragraph's `w:pStyle` definition) turns left-aligned otherwise.
 *
 * Ordering is the whole risk: `w:p` elements can be matched reliably (they never nest), but the HTML
 * mammoth produces is not one-to-one when lists come into play (`<li>` replaces the paragraph
 * wrapper). Blocks are therefore paired by **text**, walking both sides in document order and
 * skipping the pairs that don't line up, instead of demanding equal block counts.
 */

import { alignBlocks } from './docxBlockAlign';
import { formatTabStops, normalizeTabStops, TAB_STOPS_ATTR, type TabStop } from './tabStops';

export type ParagraphAlign = 'left' | 'center' | 'right' | 'justify';

export interface DocxParagraphControl {
  /** Visible text of the paragraph (drawings / deleted runs excluded): the pairing key */
  text?: string;
  keepNext: boolean;
  keepLines: boolean;
  /** `false` = widow control explicitly switched off; `null` = default (on) */
  widowControl: boolean | null;
  /**
   * Line spacing as a multiple of the font size (`w:spacing/@w:line` with `lineRule="auto"`, where
   * 240 = single). `null` when the paragraph has none, or when the rule is `exact` / `atLeast` —
   * those are absolute lengths in twips and cannot be expressed as a multiple.
   */
  lineHeight: number | null;
  /** P1-4 制表位 (`w:tabs`), converted from twips to CSS px */
  tabStops: TabStop[];
  /** `w:jc`, or the value inherited from `w:pStyle`; `null` when neither says anything */
  align: ParagraphAlign | null;
  /** `w:ind/@w:left` (aka `start`) in CSS px */
  indentLeft: number | null;
  /** `w:ind/@w:right` (aka `end`) in CSS px */
  indentRight: number | null;
  /** `w:ind/@w:firstLine` (positive) or `@w:hanging` (negative) in CSS px */
  firstLine: number | null;
  /** `w:pBdr` edges the paragraph draws (a cover subtitle's rule, a boxed note) */
  borders: ParagraphBorder[];
}

export interface ParagraphBorder {
  side: 'top' | 'bottom' | 'left' | 'right';
  /** `w:val`: single / double / dashed / dotted / thick … */
  style: string;
  /** `w:sz` in eighths of a point, converted to CSS px */
  width: number;
  /** `w:color` as `#rrggbb`, or `currentColor` for `auto` */
  color: string;
}

/** Twips → CSS px (1px = 15twip), matching the tab-stop conversion */
const twipsToPx = (twips: number): number => Math.round(twips / 15);

/** Every `w:p` in document order, including the ones inside table cells */
const PARAGRAPH_RE = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
/** Only the property block matters; `w:val="0"` is an explicit off switch for any toggle */
const PROPERTIES_RE = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/;
const SPACING_RE = /<w:spacing\b([^>]*)\/?>/;
const TABS_BLOCK_RE = /<w:tabs\b[^>]*>([\s\S]*?)<\/w:tabs>/;
const TAB_STOP_RE = /<w:tab\b([^>]*?)\/?>/g;
const JUSTIFY_RE = /<w:jc\b([^>]*?)\/?>/;
const INDENT_RE = /<w:ind\b([^>]*?)\/?>/;
const STYLE_RE = /<w:pStyle\b([^>]*?)\/?>/;
const BORDERS_RE = /<w:pBdr\b[^>]*>([\s\S]*?)<\/w:pBdr>/;

function toggleOn(properties: string, name: string): boolean {
  const match = new RegExp(`<w:${name}\\b([^>]*)/?>`).exec(properties);
  if (!match) return false;
  const value = /w:val="([^"]*)"/.exec(match[1] ?? '')?.[1];
  return value === undefined || (value !== '0' && value !== 'false');
}

function toggleOff(properties: string, name: string): boolean {
  const match = new RegExp(`<w:${name}\\b([^>]*)/?>`).exec(properties);
  if (!match) return false;
  return /w:val="(0|false)"/.test(match[1] ?? '');
}

/** Line spacing multiple of a paragraph, or null when absent / not a multiple (`exact`, `atLeast`) */
function lineHeightOf(properties: string): number | null {
  const attrs = SPACING_RE.exec(properties)?.[1];
  if (!attrs) return null;
  const rule = /w:lineRule="([^"]*)"/.exec(attrs)?.[1];
  // `auto` is also the default when the attribute is missing, so only other values disqualify
  if (rule && rule !== 'auto') return null;
  const line = Number.parseInt(/w:line="(\d+)"/.exec(attrs)?.[1] ?? '', 10);
  if (!Number.isFinite(line) || line <= 0) return null;
  return Math.round((line / 240) * 100) / 100;
}

/** `w:tabs` -> stops in CSS px (Word counts twips from the same text edge, 1px = 15twip) */
function tabStopsOf(properties: string): TabStop[] {
  const block = TABS_BLOCK_RE.exec(properties)?.[1];
  if (!block) return [];
  const stops: TabStop[] = [];
  for (const match of block.matchAll(TAB_STOP_RE)) {
    const attrs = match[1] ?? '';
    const pos = Number.parseInt(/w:pos="(-?\d+)"/.exec(attrs)?.[1] ?? '', 10);
    if (!Number.isFinite(pos) || pos < 0) continue;
    const value = /w:val="([^"]*)"/.exec(attrs)?.[1] ?? 'left';
    // `clear` removes an inherited stop and `bar` draws a vertical rule: neither is a stop we render
    if (value === 'clear' || value === 'bar') continue;
    const leader = /w:leader="([^"]*)"/.exec(attrs)?.[1];
    stops.push({
      pos: Math.round(pos / 15),
      align: value as TabStop['align'],
      ...(leader ? { leader: leader as TabStop['leader'] } : {}),
    });
  }
  return normalizeTabStops(stops);
}

/** `w:jc` → CSS alignment (`both` / `distribute` are Word's justified variants) */
function alignOfValue(value: string | undefined): ParagraphAlign | null {
  switch (value) {
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'distribute':
    case 'thaiDistribute':
      return 'justify';
    case 'left':
    case 'start':
      return 'left';
    default:
      return null;
  }
}

const BORDER_SIDES = ['top', 'bottom', 'left', 'right'] as const;

/**
 * `w:pBdr` -> the edges drawn around the paragraph. `w:sz` counts eighths of a point (12 = 1.5pt), and
 * `w:color` is `auto` when the theme decides, so it becomes `currentColor`.
 */
function bordersOf(properties: string): ParagraphBorder[] {
  const block = BORDERS_RE.exec(properties)?.[1];
  if (!block) return [];
  const borders: ParagraphBorder[] = [];
  for (const side of BORDER_SIDES) {
    const attrs = new RegExp(`<w:${side}\\b([^>]*?)/?>`).exec(block)?.[1];
    if (!attrs) continue;
    const style = /w:val="([^"]*)"/.exec(attrs)?.[1] ?? 'single';
    if (style === 'none' || style === 'nil') continue;
    const size = Number.parseInt(/w:sz="(\d+)"/.exec(attrs)?.[1] ?? '', 10);
    const color = /w:color="([^"]*)"/.exec(attrs)?.[1] ?? 'auto';
    borders.push({
      side,
      style,
      // 1/8 pt -> px: sz / 8 * 96/72 = sz / 6
      width: Number.isFinite(size) && size > 0 ? Math.max(1, Math.round(size / 6)) : 1,
      color: /^[0-9a-f]{6}$/i.test(color) ? `#${color.toLowerCase()}` : 'currentColor',
    });
  }
  return borders;
}

/**
 * Paragraph indentation: `w:left` / `w:start` and `w:right` / `w:end` are synonyms, and a hanging
 * indent is `w:hanging` (its value is positive but pushes the first line back).
 */
function indentOf(properties: string): {
  indentLeft: number | null;
  indentRight: number | null;
  firstLine: number | null;
} {
  const attrs = INDENT_RE.exec(properties)?.[1];
  if (!attrs) return { indentLeft: null, indentRight: null, firstLine: null };
  const num = (names: string[]): number | null => {
    for (const name of names) {
      const raw = new RegExp(`w:${name}="(-?\\d+)"`).exec(attrs)?.[1];
      const value = Number.parseInt(raw ?? '', 10);
      if (Number.isFinite(value)) return twipsToPx(value);
    }
    return null;
  };
  const firstLine = num(['firstLine']);
  const hanging = num(['hanging']);
  return {
    indentLeft: num(['left', 'start']),
    indentRight: num(['right', 'end']),
    // A hanging indent is a negative first-line indent in CSS terms
    firstLine: firstLine !== null ? firstLine : hanging !== null ? -hanging : null,
  };
}

/**
 * Plain text of a paragraph, as mammoth renders it: `w:t` runs plus `w:tab` → tab and `w:br` → line
 * break, deleted text excluded. The tab matters: a table-of-contents entry is `title ⇥ page`, and
 * mammoth hands that over as a real tab, so a paragraph without one would never pair.
 */
function paragraphText(body: string): string {
  // Property blocks carry their own `<w:tab>` stop definitions: strip them before scanning runs
  const runs = body.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/g, '');
  let text = '';
  for (const match of runs.matchAll(
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/g,
  )) {
    if (match[1] !== undefined) text += match[1];
    else text += match[0].startsWith('<w:tab') ? '\t' : '\n';
  }
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `styleId -> alignment` from `word/styles.xml`, following `w:basedOn` once (the chains Word writes
 * are shallow: `Title → Normal`, `Subtitle → Normal`), so a paragraph without its own `w:jc` still
 * gets the alignment its style carries.
 */
export function parseDocxStyleAlignments(stylesXml: string): Map<string, ParagraphAlign> {
  const result = new Map<string, ParagraphAlign>();
  if (!stylesXml) return result;
  const direct = new Map<string, ParagraphAlign>();
  const basedOn = new Map<string, string>();
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = /w:styleId="([^"]*)"/.exec(match[1] ?? '')?.[1];
    if (!id) continue;
    const body = match[2] ?? '';
    const properties = PROPERTIES_RE.exec(body)?.[1] ?? '';
    const align = alignOfValue(/w:val="([^"]*)"/.exec(JUSTIFY_RE.exec(properties)?.[1] ?? '')?.[1]);
    if (align) direct.set(id, align);
    const parent = /w:val="([^"]*)"/.exec(/<w:basedOn\b([^>]*?)\/?>/.exec(body)?.[1] ?? '')?.[1];
    if (parent) basedOn.set(id, parent);
  }
  for (const [id, align] of direct) result.set(id, align);
  for (const [id, parent] of basedOn) {
    if (result.has(id)) continue;
    const inherited = direct.get(parent);
    if (inherited) result.set(id, inherited);
  }
  return result;
}

/**
 * `w:tabs` declared by a paragraph *style* — the table of contents gets its right-aligned, dot-leader
 * tab from `TOC1` / `TOC2`, not from the paragraph itself, so reading only `w:pPr` left every page
 * number glued to the entry text.
 */
export function parseDocxStyleTabStops(stylesXml: string): Map<string, TabStop[]> {
  const result = new Map<string, TabStop[]>();
  if (!stylesXml || !stylesXml.includes('<w:tabs')) return result;
  const direct = new Map<string, TabStop[]>();
  const basedOn = new Map<string, string>();
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = /w:styleId="([^"]*)"/.exec(match[1] ?? '')?.[1];
    if (!id) continue;
    const body = match[2] ?? '';
    const properties = PROPERTIES_RE.exec(body)?.[1] ?? '';
    const stops = tabStopsOf(properties);
    if (stops.length > 0) direct.set(id, stops);
    const parent = /w:val="([^"]*)"/.exec(/<w:basedOn\b([^>]*?)\/?>/.exec(body)?.[1] ?? '')?.[1];
    if (parent) basedOn.set(id, parent);
  }
  for (const [id, stops] of direct) result.set(id, stops);
  for (const [id, parent] of basedOn) {
    if (result.has(id)) continue;
    const inherited = direct.get(parent);
    if (inherited) result.set(id, inherited);
  }
  return result;
}

export function parseDocxParagraphControls(
  xml: string,
  styleAlign?: ReadonlyMap<string, ParagraphAlign>,
  styleTabs?: ReadonlyMap<string, TabStop[]>,
): DocxParagraphControl[] {
  if (!xml.includes('<w:p')) return [];
  const controls: DocxParagraphControl[] = [];
  for (const match of xml.matchAll(PARAGRAPH_RE)) {
    const body = match[1] ?? '';
    const properties = PROPERTIES_RE.exec(body)?.[1] ?? '';
    const directAlign = alignOfValue(
      /w:val="([^"]*)"/.exec(JUSTIFY_RE.exec(properties)?.[1] ?? '')?.[1],
    );
    const styleId = /w:val="([^"]*)"/.exec(STYLE_RE.exec(properties)?.[1] ?? '')?.[1];
    const inherited = styleId ? (styleAlign?.get(styleId) ?? null) : null;
    const indent = indentOf(properties);
    const directTabs = tabStopsOf(properties);
    controls.push({
      text: paragraphText(body),
      keepNext: toggleOn(properties, 'keepNext'),
      keepLines: toggleOn(properties, 'keepLines'),
      widowControl: toggleOff(properties, 'widowControl') ? false : null,
      lineHeight: lineHeightOf(properties),
      tabStops: directTabs.length > 0 ? directTabs : styleId ? (styleTabs?.get(styleId) ?? []) : [],
      align: directAlign ?? inherited,
      indentLeft: indent.indentLeft,
      indentRight: indent.indentRight,
      firstLine: indent.firstLine,
      borders: bordersOf(properties),
    });
  }
  return controls;
}

/** Blocks mammoth emits in document order, one per Word paragraph (lists being the exception) */
const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

/** Merge declarations into an element's inline style, keeping whatever is already there */
function mergeStyle(element: Element, declarations: string[]): void {
  if (declarations.length === 0) return;
  const existing = element.getAttribute('style');
  const body = declarations.join('; ');
  element.setAttribute('style', `${existing ? `${existing.replace(/;\s*$/, '')}; ` : ''}${body}`);
}

/** Apply one paragraph's properties to a block */
function applyControl(block: Element, control: DocxParagraphControl): void {
  if (control.keepNext) block.setAttribute('data-keep-next', 'true');
  if (control.keepLines) block.setAttribute('data-keep-lines', 'true');
  if (control.widowControl === false) block.setAttribute('data-widow-control', 'off');
  if (control.tabStops.length > 0) {
    block.setAttribute(TAB_STOPS_ATTR, formatTabStops(control.tabStops));
  }
  applyBorderAttributes(block, control.borders);
  mergeStyle(
    block,
    [
      // Line spacing *is* the CSS: the paragraph attribute parses it back
      control.lineHeight ? `line-height: ${control.lineHeight}` : '',
      control.align ? `text-align: ${control.align}` : '',
      control.indentLeft !== null && control.indentLeft > 0
        ? `margin-left: ${control.indentLeft}px`
        : '',
      control.indentRight !== null && control.indentRight > 0
        ? `margin-right: ${control.indentRight}px`
        : '',
      control.firstLine !== null && control.firstLine !== 0
        ? `text-indent: ${control.firstLine}px`
        : '',
      ...control.borders.map((border) => borderDeclarations(border)),
    ].filter(Boolean),
  );
}

/** `w:pBdr` on one element: data attributes for the `.docx` writer, inline declarations for rendering */
function applyBorderAttributes(element: Element, borders: readonly ParagraphBorder[]): void {
  if (borders.length === 0) return;
  for (const border of borders) {
    element.setAttribute(`data-border-${border.side}`, border.style);
    element.setAttribute(`data-border-${border.side}-width`, String(border.width));
    element.setAttribute(`data-border-${border.side}-color`, border.color);
  }
  mergeStyle(
    element,
    borders.map((border) => borderDeclarations(border)),
  );
}

/** One `w:pBdr` edge as a CSS declaration */
function borderDeclarations(border: ParagraphBorder): string {
  const line =
    border.style === 'dashed' ? 'dashed' : border.style === 'dotted' ? 'dotted' : 'solid';
  const extra = border.style === 'double' ? ' double' : '';
  return `border-${border.side}: ${border.width}px${extra} ${line} ${border.color}`;
}

const normalizeText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Stamp the parsed properties onto the imported HTML.
 *
 * Both sides are walked in document order and paired by text — empty paragraphs included, because a
 * paragraph that only holds a picture has no text and still carries the centring (`w:jc`). When the
 * text cannot be lined up, the *pair* is skipped (mammoth dropped that paragraph, or a list reshaped
 * it) and the walk continues, so one reshaped block no longer costs the whole document its
 * properties. A paragraph is never written onto a block that did not prove it is the right one.
 */
export function applyParagraphControls(
  html: string,
  controls: readonly DocxParagraphControl[],
): string {
  if (controls.length === 0) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR)).map((element) => ({
    element,
    text: normalizeText(element.textContent ?? ''),
  }));

  // Callers that only hand over flags (unit tests, older integrations) keep the positional mapping
  const hasText = controls.some((control) => (control.text ?? '').length > 0);
  if (!hasText) {
    if (blocks.length !== controls.length) return html;
    blocks.forEach((block, index) => {
      const control = controls[index];
      if (control) applyControl(block.element, control);
    });
    return doc.body.innerHTML;
  }

  const pairs = alignBlocks(
    controls.map((control) => normalizeText(control.text ?? '')),
    blocks.map((block) => block.text),
  );
  let applied = 0;
  /** Last block that received a control, in document order: where an unpaired empty paragraph lands */
  let lastApplied: Element | null = null;
  for (let index = 0; index < controls.length; index += 1) {
    const control = controls[index];
    if (!control) continue;
    const blockIndex = pairs.get(index);
    if (blockIndex === undefined) {
      // An empty paragraph that only exists to draw a rule (`w:pBdr` under a subtitle) has no text to
      // align on. Word paints the rule right below it, which is the bottom edge of the block before it.
      if (control.borders.length > 0 && !normalizeText(control.text ?? '') && lastApplied) {
        applyBorderAttributes(lastApplied, control.borders);
      }
      continue;
    }
    const block = blocks[blockIndex];
    if (!block) continue;
    applyControl(block.element, control);
    lastApplied = block.element;
    applied += 1;
  }

  // Nothing matched at all: the HTML is not the document we read the properties from, so leave it alone
  if (applied === 0) return html;
  return doc.body.innerHTML;
}
