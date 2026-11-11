import { XMLParser } from 'fast-xml-parser';
import {
  MAX_STYLES,
  importStyleId,
  type NamedStyle,
  type StyleFont,
  type StyleParagraph,
} from './namedStyles';

/**
 * Named styles ↔ `.docx` (plan P1-1, second slice).
 *
 * Export side: the style set becomes `w:styles` (one paragraph style per `NamedStyle`) and every block
 * written with a `data-rte-style` gets `w:pStyle` pointing at it, so Word sees a real named style and
 * the round trip can find it again.
 *
 * Import side: `word/styles.xml` is the only place a .docx keeps style definitions, and mammoth ignores
 * it beyond mapping names to HTML. We read it ourselves, rebuild the style objects, and map each name
 * to a `p.rte-style-<id>` class (mammoth's style map syntax); `applyStyleClasses` then turns those
 * classes into `data-rte-style` after sanitizing, so the HTML never carries a class the app would have
 * to interpret.
 */

/**
 * Our exported `w:styleId` carries this prefix. Word's own built-ins (`Title`, `Heading1`, …) also slug
 * down to `title` / `heading1`, so an unprefixed id would be shadowed by the built-in the docx library
 * always writes — the import would then read Word's Title instead of the style the user actually set.
 */
export const DOCX_STYLE_PREFIX = 'rte-';

/** App style id → `w:styleId` */
export function toDocxStyleId(id: string): string {
  return `${DOCX_STYLE_PREFIX}${id}`;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
  const value = (node as Record<string, unknown>)[`@_${name}`];
  return typeof value === 'string' ? value : undefined;
}

/** `w:val` of a child element, or the element's own text */
function valueOf(node: unknown): string | undefined {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  return attr(node, 'val');
}

/** OOXML toggles: `<w:b/>` is on, `<w:b w:val="0"/>` is off */
function toggleOn(node: unknown): boolean {
  if (node === undefined || node === null) return false;
  const value = valueOf(node);
  return value === undefined ? true : value !== '0' && value !== 'false';
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function readFont(rPr: unknown): StyleFont | undefined {
  if (!rPr || typeof rPr !== 'object') return undefined;
  const font: StyleFont = {};
  const halfPoints = Number(valueOf((rPr as Record<string, unknown>).sz));
  if (Number.isFinite(halfPoints) && halfPoints >= 8 && halfPoints <= 192) {
    font.size = halfPoints / 2;
  }
  const color = valueOf((rPr as Record<string, unknown>).color);
  if (color && /^[0-9a-fA-F]{6}$/.test(color)) font.color = `#${color.toLowerCase()}`;
  const fonts = (rPr as Record<string, unknown>).rFonts;
  const family = attr(fonts, 'ascii') ?? attr(fonts, 'eastAsia') ?? attr(fonts, 'hAnsi');
  if (family) font.family = family;
  if (toggleOn((rPr as Record<string, unknown>).b)) font.bold = true;
  if (toggleOn((rPr as Record<string, unknown>).i)) font.italic = true;
  return Object.keys(font).length > 0 ? font : undefined;
}

const JUSTIFY: Readonly<Record<string, StyleParagraph['align']>> = {
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  justify: 'justify',
};

/** Paragraph properties plus the outline level, which is a docx detail and becomes `headingLevel` */
function readParagraph(pPr: unknown): { paragraph?: StyleParagraph; outlineLevel?: number } {
  if (!pPr || typeof pPr !== 'object') return {};
  const paragraph: StyleParagraph = {};
  const outline = Number(valueOf((pPr as Record<string, unknown>).outlineLvl));
  const align = JUSTIFY[valueOf((pPr as Record<string, unknown>).jc) ?? ''];
  if (align) paragraph.align = align;
  return {
    paragraph: Object.keys(paragraph).length > 0 ? paragraph : undefined,
    outlineLevel: Number.isInteger(outline) && outline >= 0 && outline <= 5 ? outline : undefined,
  };
}

/** Word's built-in heading ids map onto the app's heading styles (`Heading1` → `title`, level 1) */
function canonicalHeadingId(id: string): { id: string; level: number } | null {
  const match = /^heading([1-6])$/.exec(id);
  if (!match) return null;
  const level = Number(match[1]);
  return { id: level === 1 ? 'title' : `heading${level}`, level };
}

/**
 * Parse `word/styles.xml` into style objects.
 * Paragraph styles only — character / table styles are not selectable from the style gallery, and a
 * malformed part degrades to "no styles" instead of failing the whole import.
 */
export function parseDocxStylesXml(xml: string): NamedStyle[] {
  if (!xml.trim()) return [];
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }
  const root = (parsed as Record<string, unknown> | undefined)?.styles;
  if (!root || typeof root !== 'object') return [];
  // Our own definitions first: Word's built-ins (Title, Heading1 …) sit at the top of every styles.xml,
  // and if they were read first they would shadow the ids the document actually uses
  const list = asArray((root as Record<string, unknown>).style)
    .map((node) => ({
      node,
      prefixed: (attr(node, 'styleId') ?? '').startsWith(DOCX_STYLE_PREFIX),
    }))
    .sort((left, right) => Number(right.prefixed) - Number(left.prefixed))
    .map((entry) => entry.node);
  const result: NamedStyle[] = [];
  const seen = new Set<string>();
  for (const [index, node] of list.entries()) {
    const type = attr(node, 'type');
    if (type && type !== 'paragraph') continue;
    const rawId = attr(node, 'styleId') ?? '';
    if (!rawId) continue;
    // Ours round trip through the prefix; Word's built-ins keep their own id and are mapped below
    let id = importStyleId(
      rawId.startsWith(DOCX_STYLE_PREFIX) ? rawId.slice(DOCX_STYLE_PREFIX.length) : rawId,
      `style-${index + 1}`,
    );
    let level: number | undefined;
    const canonical = canonicalHeadingId(id);
    if (canonical) {
      id = canonical.id;
      level = canonical.level;
    }
    if (seen.has(id) || result.length >= MAX_STYLES) continue;
    seen.add(id);

    const style: NamedStyle = { id };
    if (rawId.startsWith(DOCX_STYLE_PREFIX)) style.owned = true;
    const name = valueOf((node as Record<string, unknown>).name)?.trim();
    if (name && name !== rawId && name.toLowerCase() !== id) style.name = name.slice(0, 64);
    const basedOnRaw = attr((node as Record<string, unknown>).basedOn, 'val');
    if (basedOnRaw) {
      const canonicalBased = canonicalHeadingId(importStyleId(basedOnRaw, ''));
      style.basedOn = canonicalBased ? canonicalBased.id : importStyleId(basedOnRaw, 'body');
    }

    const { paragraph, outlineLevel } = readParagraph((node as Record<string, unknown>).pPr);
    const resolvedLevel = level ?? (outlineLevel === undefined ? undefined : outlineLevel + 1);
    if (resolvedLevel !== undefined && resolvedLevel >= 1 && resolvedLevel <= 6) {
      style.headingLevel = resolvedLevel;
    }
    if (paragraph) style.paragraph = paragraph;

    const font = readFont((node as Record<string, unknown>).rPr);
    if (font) style.font = font;
    result.push(style);
  }
  return result;
}

/** Mammoth style-map entries: one per named style, mapping its `w:name` to a marker class */
export function docxStyleMapEntries(styles: readonly NamedStyle[]): string[] {
  return (
    styles
      // Only our own exported styles: a generic entry would hijack mammoth's semantics (its
      // "List Paragraph" mapping is what turns list items back into <ul>/<ol>)
      .filter((style) => style.owned === true)
      .map((style) => ({ style, name: style.name?.trim() ?? '' }))
      .filter((entry) => entry.name !== '')
      .slice(0, MAX_STYLES)
      .map(
        ({ style, name }) =>
          `p[style-name='${name.replace(/'/g, '’')}'] => p.rte-style-${style.id}`,
      )
  );
}

/**
 * Turn mammoth's `rte-style-<id>` classes into `data-rte-style` attributes and report which imported
 * styles the document actually uses (the tool only adopts those, so a 50-style template does not
 * flood the gallery).
 */
export function applyStyleClasses(
  html: string,
  styles: readonly NamedStyle[],
): { html: string; used: NamedStyle[] } {
  if (!html.includes('rte-style-') || styles.length === 0) return { html, used: [] };
  if (typeof DOMParser === 'undefined') return { html, used: [] };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const used = new Map<string, NamedStyle>();
  for (const element of Array.from(doc.querySelectorAll('[class*="rte-style-"]'))) {
    const token = Array.from(element.classList).find((name) => name.startsWith('rte-style-'));
    if (!token) continue;
    const style = styles.find((candidate) => candidate.id === token.slice('rte-style-'.length));
    element.classList.remove(token);
    if (element.classList.length === 0) element.removeAttribute('class');
    if (!style) continue;
    used.set(style.id, style);
    // A style that declares a heading level comes back as a heading node: that is what makes the
    // navigation pane, keyboard shortcuts and the TOC behave as they did before the export
    const level = style.headingLevel;
    const tag = level ? `H${level}` : '';
    if (tag && element.tagName !== tag) {
      const heading = doc.createElement(tag.toLowerCase());
      heading.setAttribute('data-rte-style', style.id);
      heading.append(...Array.from(element.childNodes));
      element.replaceWith(heading);
      continue;
    }
    element.setAttribute('data-rte-style', style.id);
  }
  return { html: doc.body.innerHTML, used: [...used.values()] };
}
