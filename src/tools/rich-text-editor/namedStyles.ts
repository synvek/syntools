import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';

/**
 * Named styles (plan P1-1, first slice).
 *
 * The nine gallery presets used to be composed commands: picking 标题 1 set a `heading` node and the
 * look came from the stylesheet, so "make every 标题 1 bigger" was impossible without touching every
 * paragraph. This module turns them into a style *object* set:
 *
 * - a block carries only `data-rte-style="<id>"` (a ProseMirror attribute), nothing else;
 * - the look is derived from the style definitions, so editing 标题 1 changes every paragraph that
 *   points at it — the document is never rewritten (§6.1 acceptance: "修改标题 1 后全文同步");
 * - the same definitions are expanded to inline CSS on export, and (next slice) to `w:styles`.
 *
 * Deliberately plain data: a style is JSON with no functions, so the draft can store it as-is and
 * `migrate.ts` can validate it field by field.
 */

/** Character properties of a style */
export interface StyleFont {
  /** CSS font-family list (`Consolas, monospace`) */
  family?: string;
  /** Point size, like Word's size box */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  /** `#rrggbb` */
  color?: string;
}

/** Paragraph properties (`w:pPr` slice of the style; the page-detail attributes arrive with P1-4) */
export interface StyleParagraph {
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Line height as a multiple of the font size */
  lineHeight?: number;
}

export interface NamedStyle {
  /** Stable id: also the value stored on the block and (next slice) the `w:styleId` */
  id: string;
  /** i18n key of the built-in name; ignored once `name` is set */
  label?: string;
  /** Name the user typed (renaming a built-in style only overrides the label) */
  name?: string;
  /** Inherit every unset property from this style */
  basedOn?: string;
  /** 1–6 = a heading level (drives `.docx` `Heading n` and the TOC); unset = body text */
  headingLevel?: number;
  font?: StyleFont;
  paragraph?: StyleParagraph;
  /** One of the nine shipped styles: can be edited and reset, but not deleted */
  builtin?: boolean;
  /**
   * Set by the .docx reader for styles this app wrote (the `rte-` prefixed ids). Transient: it only
   * decides which styles get a mammoth style-map entry, and `sanitizeStyles` drops it before storing.
   */
  owned?: boolean;
}

/** Body text is the fallback for every block without a style */
export const BODY_STYLE_ID = 'body';
/** Style ids double as DOM attribute values and later `w:styleId`, so they stay slug-shaped */
const STYLE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
/** A document library entry with more styles than this is malformed, not designed */
export const MAX_STYLES = 40;
/** Guard against `basedOn` cycles in hand-edited drafts */
const MAX_BASED_ON_DEPTH = 8;

/** The nine gallery presets, now with real values (Word's defaults for a Chinese document) */
export function createDefaultStyles(): NamedStyle[] {
  return [
    { id: BODY_STYLE_ID, label: 'tools.richText.styleBody', builtin: true, font: { size: 11 } },
    {
      id: 'title',
      label: 'tools.richText.styleTitle',
      builtin: true,
      headingLevel: 1,
      font: { size: 22, bold: true },
    },
    {
      id: 'heading2',
      label: 'tools.richText.styleHeading2',
      builtin: true,
      headingLevel: 2,
      basedOn: BODY_STYLE_ID,
      font: { size: 16, bold: true },
    },
    {
      id: 'heading3',
      label: 'tools.richText.styleHeading3',
      builtin: true,
      headingLevel: 3,
      basedOn: BODY_STYLE_ID,
      font: { size: 14, bold: true },
    },
    {
      id: 'heading4',
      label: 'tools.richText.styleHeading4',
      builtin: true,
      headingLevel: 4,
      basedOn: BODY_STYLE_ID,
      font: { size: 12, bold: true },
    },
    {
      id: 'heading5',
      label: 'tools.richText.styleHeading5',
      builtin: true,
      headingLevel: 5,
      basedOn: BODY_STYLE_ID,
      font: { size: 11, bold: true },
    },
    {
      id: 'heading6',
      label: 'tools.richText.styleHeading6',
      builtin: true,
      headingLevel: 6,
      basedOn: BODY_STYLE_ID,
      font: { size: 10, bold: true },
    },
    {
      id: 'quote',
      label: 'tools.richText.styleQuote',
      builtin: true,
      basedOn: BODY_STYLE_ID,
      font: { italic: true, color: '#6b7280' },
    },
    {
      id: 'code',
      label: 'tools.richText.styleCode',
      builtin: true,
      font: { family: 'Consolas, Monaco, monospace', size: 10 },
    },
  ];
}

/** Built-in style ids, in gallery order */
export const BUILTIN_STYLE_IDS = createDefaultStyles().map((style) => style.id);

/**
 * Word style names of the shipped styles, used as `w:name` when exporting and as the fallback label
 * when a .docx carries an id but no readable name.
 */
const BUILTIN_NAMES: Readonly<Record<string, string>> = {
  body: '正文',
  title: '标题',
  heading2: '标题 2',
  heading3: '标题 3',
  heading4: '标题 4',
  heading5: '标题 5',
  heading6: '标题 6',
  quote: '引用',
  code: '代码',
};

/** Display name used outside the i18n surfaces (docx `w:name`, import fallbacks) */
export function defaultStyleName(style: NamedStyle): string {
  const renamed = style.name?.trim();
  if (renamed) return renamed;
  return BUILTIN_NAMES[style.id] ?? style.label ?? style.id;
}

/**
 * Turn an incoming `w:styleId` into a legal id for this app (`Heading1` → `heading1`).
 * A non-Latin id (Word documents do use Chinese style ids) has no Latin form, so the caller's
 * fallback is used instead of inventing one.
 */
export function importStyleId(raw: string, fallback: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 31);
  return STYLE_ID_RE.test(slug) ? slug : fallback;
}

/**
 * Merge an imported style set into the current one: imported definitions win for the ids they bring
 * (that is what makes a .docx round trip keep its look), everything else stays as it is.
 */
export function mergeStyles(
  current: readonly NamedStyle[],
  incoming: readonly NamedStyle[],
): NamedStyle[] {
  const byId = new Map(current.map((style) => [style.id, style]));
  for (const style of incoming) {
    const existing = byId.get(style.id);
    byId.set(style.id, {
      ...existing,
      ...style,
      // Built-in status is a property of the app, not of the incoming file
      builtin: existing?.builtin ?? style.builtin,
    });
  }
  return sanitizeStyles([...byId.values()]);
}

/* ------------------------------------------------------------------ *
 * Inheritance
 * ------------------------------------------------------------------ */

/**
 * Resolve a style against its `basedOn` chain (root first, so the child wins).
 * Cycles and unknown parents stop the walk instead of throwing: a corrupted draft must not break
 * rendering, it just loses the inheritance.
 */
export function resolveStyle(styles: readonly NamedStyle[], id: string): NamedStyle | undefined {
  const byId = new Map(styles.map((style) => [style.id, style]));
  const chain: NamedStyle[] = [];
  const seen = new Set<string>();
  let current: NamedStyle | undefined = byId.get(id);
  while (current && !seen.has(current.id) && chain.length < MAX_BASED_ON_DEPTH) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.basedOn ? byId.get(current.basedOn) : undefined;
  }
  if (chain.length === 0) return undefined;
  return chain.reduce<NamedStyle>(
    (merged, style) => ({
      ...merged,
      ...style,
      font: { ...merged.font, ...style.font },
      paragraph: { ...merged.paragraph, ...style.paragraph },
    }),
    { id },
  );
}

/* ------------------------------------------------------------------ *
 * CSS
 * ------------------------------------------------------------------ */

/** CSS declarations of one fully resolved style */
export function styleDeclarations(style: NamedStyle): string {
  const declarations: string[] = [];
  const font = style.font ?? {};
  if (font.family) declarations.push(`font-family: ${font.family}`);
  if (font.size) declarations.push(`font-size: ${font.size}pt`);
  if (font.bold) declarations.push('font-weight: 700');
  if (font.italic) declarations.push('font-style: italic');
  if (font.color) declarations.push(`color: ${font.color}`);
  const paragraph = style.paragraph ?? {};
  if (paragraph.align) declarations.push(`text-align: ${paragraph.align}`);
  if (paragraph.lineHeight) declarations.push(`line-height: ${paragraph.lineHeight}`);
  return declarations.join('; ');
}

/**
 * Stylesheet for the editor. Scoped under `.tiptap`, with a second selector prefixed by `.rte-surface`
 * so a style outranks the surface's own tag defaults (`.rte-surface .tiptap h1` is 0,2,1 — a plain
 * `.tiptap [data-rte-style]` rule at 0,2,0 would lose). Both selectors carry the same declarations, so
 * hosts without the surface wrapper still get the style instead of silently losing it.
 */
export function buildStyleCss(styles: readonly NamedStyle[]): string {
  return styles
    .map((style) => {
      const resolved = resolveStyle(styles, style.id);
      const declarations = resolved ? styleDeclarations(resolved) : '';
      if (!declarations) return '';
      return `.rte-surface .tiptap [data-rte-style="${style.id}"], .tiptap [data-rte-style="${style.id}"] { ${declarations} }`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Expand `data-rte-style` into inline CSS for HTML that leaves the editor (export, print, PDF, the
 * fidelity preview): those surfaces get the markup without our stylesheet.
 * Existing inline declarations win — an explicit per-run colour must not be overridden by the style.
 */
export function inlineNamedStyles(html: string, styles: readonly NamedStyle[]): string {
  if (!html || styles.length === 0) return html;
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = doc.querySelectorAll('[data-rte-style]');
  if (blocks.length === 0) return html;
  for (const block of Array.from(blocks)) {
    const id = block.getAttribute('data-rte-style');
    if (!id) continue;
    const resolved = resolveStyle(styles, id);
    if (!resolved) continue;
    const declarations = styleDeclarations(resolved);
    if (!declarations) continue;
    const existing = block.getAttribute('style');
    block.setAttribute('style', existing ? `${declarations}; ${existing}` : declarations);
  }
  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ *
 * Editing the set
 * ------------------------------------------------------------------ */

/** Replace or append one style (keeping document order) */
export function upsertStyle(styles: readonly NamedStyle[], next: NamedStyle): NamedStyle[] {
  const index = styles.findIndex((style) => style.id === next.id);
  if (index === -1) {
    if (styles.length >= MAX_STYLES) return [...styles];
    return [...styles, next];
  }
  return styles.map((style, position) => (position === index ? next : style));
}

/**
 * Remove a style: built-ins are refused, and styles based on the removed one fall back to body text
 * instead of dangling (a dangling `basedOn` silently loses every inherited property).
 */
export function removeStyle(styles: readonly NamedStyle[], id: string): NamedStyle[] {
  const target = styles.find((style) => style.id === id);
  if (!target || target.builtin) return [...styles];
  return styles
    .filter((style) => style.id !== id)
    .map((style) => (style.basedOn === id ? { ...style, basedOn: BODY_STYLE_ID } : style));
}

/** Next free `custom-N` id (ids are permanent: they are referenced by blocks already in the document) */
export function nextCustomStyleId(styles: readonly NamedStyle[]): string {
  const used = new Set(styles.map((style) => style.id));
  for (let index = 1; index <= MAX_STYLES * 4; index += 1) {
    const id = `custom-${index}`;
    if (!used.has(id)) return id;
  }
  return `custom-${Date.now().toString(36)}`;
}

/** Reset one built-in style to its shipped values, keeping the user's name */
export function resetStyle(styles: readonly NamedStyle[], id: string): NamedStyle[] {
  const defaults = createDefaultStyles().find((style) => style.id === id);
  if (!defaults) return [...styles];
  const current = styles.find((style) => style.id === id);
  const next: NamedStyle = current?.name ? { ...defaults, name: current.name } : defaults;
  return upsertStyle(styles, next);
}

/* ------------------------------------------------------------------ *
 * Validation (draft v3)
 * ------------------------------------------------------------------ */

function readText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, max) : undefined;
}

function readColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

function readFont(value: unknown): StyleFont | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const font: StyleFont = {};
  const family = readText(source.family, 64);
  if (family) font.family = family;
  if (
    typeof source.size === 'number' &&
    Number.isFinite(source.size) &&
    source.size >= 4 &&
    source.size <= 96
  ) {
    font.size = Math.round(source.size * 2) / 2;
  }
  if (source.bold === true) font.bold = true;
  if (source.italic === true) font.italic = true;
  const color = readColor(source.color);
  if (color) font.color = color;
  return Object.keys(font).length > 0 ? font : undefined;
}

const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

function readParagraph(value: unknown): StyleParagraph | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const paragraph: StyleParagraph = {};
  if (typeof source.align === 'string' && ALIGNMENTS.has(source.align)) {
    paragraph.align = source.align as StyleParagraph['align'];
  }
  if (
    typeof source.lineHeight === 'number' &&
    Number.isFinite(source.lineHeight) &&
    source.lineHeight >= 0.8 &&
    source.lineHeight <= 4
  ) {
    paragraph.lineHeight = Math.round(source.lineHeight * 10) / 10;
  }
  return Object.keys(paragraph).length > 0 ? paragraph : undefined;
}

/**
 * Read a style set from untrusted JSON (draft / document library).
 * Anything malformed is dropped field by field; a set without body text falls back to the shipped
 * defaults so the editor can never end up with unstyled paragraphs.
 */
export function sanitizeStyles(raw: unknown): NamedStyle[] {
  const defaults = createDefaultStyles();
  if (!Array.isArray(raw)) return defaults;
  const result: NamedStyle[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_STYLES)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    const id = readText(source.id, 32)?.toLowerCase();
    if (!id || !STYLE_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    const style: NamedStyle = { id };
    const label = readText(source.label, 64);
    if (label) style.label = label;
    const name = readText(source.name, 64);
    if (name) style.name = name;
    const basedOn = readText(source.basedOn, 32)?.toLowerCase();
    if (basedOn && basedOn !== id) style.basedOn = basedOn;
    if (
      typeof source.headingLevel === 'number' &&
      Number.isInteger(source.headingLevel) &&
      source.headingLevel >= 1 &&
      source.headingLevel <= 6
    ) {
      style.headingLevel = source.headingLevel;
    }
    const font = readFont(source.font);
    if (font) style.font = font;
    const paragraph = readParagraph(source.paragraph);
    if (paragraph) style.paragraph = paragraph;
    if (source.builtin === true) style.builtin = true;
    result.push(style);
  }
  if (!result.some((style) => style.id === BODY_STYLE_ID)) {
    result.unshift(defaults[0] as NamedStyle);
  }
  return result.length > 0 ? result : defaults;
}

/* ------------------------------------------------------------------ *
 * Editor integration
 * ------------------------------------------------------------------ */

/** Reads the style id stored on a block (`null` when it has none) */
export function blockStyleId(node: PMNode): string | null {
  const value = (node.attrs as { styleId?: unknown }).styleId;
  return typeof value === 'string' && value ? value : null;
}

/**
 * The style the caret is in: the explicit attribute first, then the block kind (blockquote / code
 * block still map to their preset, seeing as they carry no attribute of their own).
 */
export function currentStyleId(editor: Editor): string {
  const { $from } = editor.state.selection;
  const id = blockStyleId($from.parent);
  if (id) return id;
  const name = $from.parent.type.name;
  if (name === 'blockquote') return 'quote';
  if (name === 'codeBlock') return 'code';
  if (name === 'heading') {
    const level = Number($from.parent.attrs.level ?? 1);
    return level <= 1 ? 'title' : `heading${level}`;
  }
  return BODY_STYLE_ID;
}

/** Heading level a block borrows from its named style (null when it has none) — used by the TOC */
export function styleHeadingLevel(styles: readonly NamedStyle[], node: PMNode): number | null {
  const id = blockStyleId(node);
  if (!id) return null;
  const level = resolveStyle(styles, id)?.headingLevel;
  return typeof level === 'number' ? level : null;
}

function normalizeHeadingLevel(value: number | undefined): number | null {
  return typeof value === 'number' && value >= 1 && value <= 6 ? value : null;
}

/**
 * Apply a style to every block in the selection: heading styles become `heading` nodes, everything
 * else becomes a paragraph, and each block then points at the style by id.
 * Quote / code keep their historical behaviour (blockquote / code block) — they have no `w:pStyle`
 * of their own, and turning 引用 into a plain paragraph would lose an existing capability.
 */
export function applyNamedStyle(editor: Editor, style: NamedStyle): void {
  if (style.id === 'quote') {
    editor.chain().focus().toggleBlockquote().run();
    return;
  }
  if (style.id === 'code') {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }
  const level = normalizeHeadingLevel(style.headingLevel);
  const { state, view } = editor;
  const schema = state.schema;
  const target = level ? schema.nodes.heading : schema.nodes.paragraph;
  if (!target) return;
  const { from, to, empty } = state.selection;
  const blocks: { pos: number; node: PMNode }[] = [];
  state.doc.nodesBetween(from, empty ? from : to, (node, pos) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return true;
    blocks.push({ pos, node });
    return false;
  });
  const tr = state.tr;
  // Bottom-up: replacing a block keeps its size, but walking backwards keeps the logic obvious
  for (const block of [...blocks].reverse()) {
    const attrs = { ...block.node.attrs, styleId: style.id };
    tr.setNodeMarkup(block.pos, target, level ? { ...attrs, level } : attrs);
  }
  if (blocks.length === 0 && empty) {
    // Empty document / selection outside a text block: still record the style on the caret paragraph
    editor
      .chain()
      .focus()
      .setParagraph()
      .updateAttributes('paragraph', { styleId: style.id })
      .run();
    return;
  }
  if (tr.docChanged) view.dispatch(tr);
  view.focus();
}

/**
 * ProseMirror attribute carrying the style id on paragraphs and headings.
 * Rendered as `data-rte-style` (not a class) so user-created ids never collide with utility classes.
 */
export const NamedStyleAttribute = Extension.create({
  name: 'namedStyleAttribute',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          styleId: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-rte-style'),
            renderHTML: (attributes: { styleId?: string | null }) =>
              attributes.styleId ? { 'data-rte-style': attributes.styleId } : {},
          },
        },
      },
    ];
  },
});
