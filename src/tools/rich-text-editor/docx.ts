import type { ToolResult } from '@/core/types';
import type { FidelityIssue } from '@/core/fidelity';
import {
  CELL_VALIGN_ATTR,
  CONTENT_WIDTH_PX,
  checkExportSize,
  checkImportFile,
  normalizeCellVAlign,
  normalizeImportedDocHtml,
  sanitizeDocHtml,
  type CellVerticalAlign,
} from './core';
import {
  COLUMN_GAP_MM,
  DEFAULT_PAGE_SETUP,
  MM_TO_PX,
  mmToTwip,
  normalizePageSetup,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';
import { normalizeBookmarkName } from './bookmarks';
import { XREF_ATTR, XREF_MODE_ATTR, normalizeXrefMode } from './xrefs';
import { parseDocxSections, splitSectionNodes } from './sections';
import { applyDocumentReview, parseDocumentReview, parseImportedComments } from './docxReview';
import { renderWatermarkImage, type WatermarkImage } from './watermarkImage';
import { firstFontFamily, pxToHalfPoints } from './typography';
import {
  isFloatingImageLayer,
  isWrappedImageLayer,
  normalizeImageLayer,
  pxToEmu,
} from './imageLayer';
import { ENDNOTE_ATTR } from './endnotes';
import { FOOTNOTE_ATTR } from './footnotes';
import { latexToOmml } from './mathOmml';
import { renderLatexImages, type MathImage, type MathImageRequest } from './mathImage';
import { readShapeSpec } from './shapeNode';
import { extractDocxShapes, placeShapesInHtml } from './docxShapeImport';
import { importLossIssues } from './fidelity';
import { defaultStyleName, resolveStyle, type NamedStyle } from './namedStyles';
import {
  applyStyleClasses,
  docxStyleMapEntries,
  parseDocxStylesXml,
  toDocxStyleId,
} from './namedStyleDocx';
import { applyParagraphControls, parseDocxParagraphControls } from './docxParagraphControls';
import { parseTabStops, TAB_ATTR, TAB_STOPS_ATTR, tabsToTabNodes } from './tabStops';
import type { OoxmlIr, OoxmlParts } from './ooxmlIr';
import { isOoxmlIrEnabled } from './ooxmlIrFlag';
import {
  injectShapeDrawings,
  shapePlaceholderParagraphText,
  type ShapeExportEntry,
} from './docxShapeExport';
import type { DocComment, TrackedChange } from './docs';

/**
 * Word bidirectional adapter layer (mammoth / docx are both dynamically imported
 * to keep them out of the initial bundle and preserve core-layer purity).
 */

/** docx module namespace type: describes the structure without statically importing the dependency */
type DocxNs = typeof import('docx');
type ParagraphOptions = import('docx').IParagraphOptions;

const DATA_URL_RE = /^data:(image\/(png|jpe?g|gif|webp|bmp));base64,(.+)$/i;

/** Read pixel dimensions of PNG / JPEG / GIF / BMP (docx ImageRun requires an explicit transformation) */
function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0;
  const u16be = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
  const u16le = (offset: number) => (bytes[offset + 1] << 8) | bytes[offset];
  // PNG: width/height live in IHDR at offsets 16/20
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: u32(16), height: u32(20) };
  }
  // JPEG: scan segments for the SOF marker
  if (bytes.length > 8 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      const length = u16be(offset + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) return { height: u16be(offset + 5), width: u16be(offset + 7) };
      offset += 2 + length;
    }
  }
  // GIF: logical screen descriptor width/height (little-endian, offsets 6/8)
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: u16le(6), height: u16le(8) };
  }
  // BMP: BITMAPINFOHEADER width/height (little-endian, offsets 18/22)
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { width: u32(18), height: Math.abs(u32(22) | 0) };
  }
  return null;
}

const MAX_IMAGE_WIDTH = 480;

/** Bitmap types supported by docx ImageRun (webp is unsupported and surfaces in the loss report) */
type DecodedImage = { bytes: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' };

/** data URL -> binary bytes (base64 images only) */
function decodeDataUrl(src: string): DecodedImage | null {
  const match = DATA_URL_RE.exec(src);
  if (!match) return null;
  const [, mime, , payload] = match;
  const lower = mime.toLowerCase();
  if (lower.includes('webp')) return null; // docx doesn't support webp
  const raw = atob(payload);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  const type: DecodedImage['type'] = lower.includes('jp')
    ? 'jpg'
    : lower.includes('png')
      ? 'png'
      : lower.includes('gif')
        ? 'gif'
        : 'bmp';
  return { bytes, type };
}

/** docx highlights only support a fixed set of color names, so pick the nearest one from a hex color */
type DocxHighlight = NonNullable<import('docx').IRunStylePropertiesOptions['highlight']>;

const HIGHLIGHT_PALETTE: Record<string, DocxHighlight> = {
  ffffff: 'white',
  '000000': 'black',
  ff0000: 'red',
  '00ff00': 'green',
  '0000ff': 'blue',
  ffff00: 'yellow',
  '00ffff': 'cyan',
  ff00ff: 'magenta',
  '808080': 'darkGray',
  c0c0c0: 'lightGray',
  '008000': 'darkGreen',
  '000080': 'darkBlue',
  '800000': 'darkRed',
  '800080': 'darkMagenta',
  '008080': 'darkCyan',
  '808000': 'darkYellow',
};

interface Mark {
  bold?: boolean;
  italics?: boolean;
  underline?: Record<string, never> | true;
  strike?: boolean;
  color?: string;
  highlight?: DocxHighlight;
  font?: string;
  /** Font size (half-points, Word's w:sz) */
  size?: number;
  /** Superscript / subscript (Word's w:vertAlign, mutually exclusive) */
  superscript?: boolean;
  subscript?: boolean;
  /** Letter spacing in twips (Word's w:spacing; 1px = 15 twips) */
  characterSpacing?: number;
  /** uppercase -> w:caps */
  allCaps?: boolean;
  /** 小型大写 -> w:smallCaps */
  smallCaps?: boolean;
  /** lowercase / capitalize have no Word run equivalent and are baked into the text */
  textTransform?: 'lowercase' | 'capitalize';
}

/** Hex color -> nearest docx highlight color name */
function nearestHighlight(hex: string): DocxHighlight {
  const target = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let best: DocxHighlight = 'yellow';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [value, name] of Object.entries(HIGHLIGHT_PALETTE)) {
    const candidate = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
    const distance =
      (target[0] - candidate[0]) ** 2 +
      (target[1] - candidate[1]) ** 2 +
      (target[2] - candidate[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

const HEADING_LEVEL: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const hex = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return hex[1].toUpperCase();
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

/** Inline style -> run properties: merge font color / highlight / bold etc. */
function mergeMark(parent: Mark, el: Element): Mark {
  const next: Mark = { ...parent };
  const style = (el as HTMLElement).style;
  const tag = el.tagName;
  if (tag === 'STRONG' || tag === 'B') next.bold = true;
  if (tag === 'EM' || tag === 'I') next.italics = true;
  if (tag === 'U') next.underline = true;
  if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') next.strike = true;
  if (tag === 'CODE') next.font = 'Consolas';
  if (tag === 'MARK') next.highlight = 'yellow';
  // Character-level formatting: <sup>/<sub> come from the super/subscript marks (and mammoth imports)
  if (tag === 'SUP') next.superscript = true;
  if (tag === 'SUB') next.subscript = true;
  const spacingPx = Number.parseFloat(style?.letterSpacing ?? '');
  if (Number.isFinite(spacingPx) && spacingPx !== 0) {
    // Word measures letter spacing in twips (1/20 pt); 1px = 0.75pt = 15 twips
    next.characterSpacing = Math.round(spacingPx * 15);
  }
  // 小型大写：CSS 走 font-variant，Word 走独立的 w:smallCaps，与 allCaps 互不覆盖
  if (style?.fontVariant?.includes('small-caps')) next.smallCaps = true;
  const transform = style?.textTransform;
  if (transform === 'uppercase') next.allCaps = true;
  else if (transform === 'lowercase' || transform === 'capitalize') next.textTransform = transform;
  // Explicitly set font/size must be written into Word run properties, otherwise the choice is lost after export
  const family = firstFontFamily(style?.fontFamily);
  if (family) next.font = family;
  const sizePx = Number.parseFloat(style?.fontSize ?? '');
  const halfPoints = pxToHalfPoints(sizePx);
  if (halfPoints !== null) next.size = halfPoints;
  const color = normalizeColor(style?.color);
  if (color) next.color = color;
  const background = style?.backgroundColor ? normalizeColor(style.backgroundColor) : undefined;
  if (background) next.highlight = nearestHighlight(background);
  return next;
}

/**
 * Single <img> -> docx ImageRun (the image node itself, no child nodes involved).
 * Layer (in front of / behind text) -> Word floating image; inline stays in the text flow.
 */
function imageRun(D: DocxNs, el: Element): InstanceType<DocxNs['ImageRun']> | null {
  const decoded = decodeDataUrl(el.getAttribute('src') ?? '');
  if (!decoded) return null;
  const size = readImageSize(decoded.bytes);
  const ratio = size ? size.height / Math.max(1, size.width) : 0.62;
  // Prefer the width explicitly set in the editor (style width / width attribute, px)
  const styleWidth = (el as HTMLElement).style.width;
  const rawWidth = styleWidth || el.getAttribute('width') || '';
  const parsedWidth = Number.parseFloat(rawWidth);
  const specified = Number.isFinite(parsedWidth)
    ? // Legacy data: percentage widths are converted to pixels (Word needs absolute sizes)
      styleWidth.includes('%')
      ? (parsedWidth / 100) * CONTENT_WIDTH_PX
      : parsedWidth
    : undefined;
  const width = specified
    ? Math.min(MAX_IMAGE_WIDTH * 1.3, Math.max(16, specified))
    : size
      ? Math.min(MAX_IMAGE_WIDTH, size.width)
      : MAX_IMAGE_WIDTH;
  /*
   * Wrap mode -> Word floating image options (one-to-one with the editor's CSS implementation):
   * - in front of / behind text: absolute offset + no wrap, overlap allowed
   * - wrap-left / wrap-right: aligned left / right + square wrapping
   * - top-bottom: centered + top-and-bottom wrapping only
   * Inline images get no floating option and stay in the text flow.
   */
  const layer = normalizeImageLayer(el.getAttribute('data-layer'));
  const offsetX = Number.parseFloat((el as HTMLElement).style.left ?? '');
  const offsetY = Number.parseFloat((el as HTMLElement).style.top ?? '');
  const floating = isFloatingImageLayer(layer)
    ? {
        horizontalPosition: {
          relative: D.HorizontalPositionRelativeFrom.COLUMN,
          offset: pxToEmu(Number.isFinite(offsetX) ? offsetX : 0),
        },
        verticalPosition: {
          relative: D.VerticalPositionRelativeFrom.PARAGRAPH,
          offset: pxToEmu(Number.isFinite(offsetY) ? offsetY : 0),
        },
        wrap: { type: D.TextWrappingType.NONE },
        behindDocument: layer === 'behind',
        allowOverlap: true,
      }
    : isWrappedImageLayer(layer)
      ? {
          horizontalPosition: {
            relative: D.HorizontalPositionRelativeFrom.COLUMN,
            align:
              layer === 'wrap-left'
                ? D.HorizontalPositionAlign.LEFT
                : D.HorizontalPositionAlign.RIGHT,
          },
          // docx requires either align or offset for both horizontal and vertical position, otherwise export throws
          verticalPosition: { relative: D.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
          wrap: { type: D.TextWrappingType.SQUARE, side: D.TextWrappingSide.BOTH_SIDES },
        }
      : layer === 'top-bottom'
        ? {
            horizontalPosition: {
              relative: D.HorizontalPositionRelativeFrom.COLUMN,
              align: D.HorizontalPositionAlign.CENTER,
            },
            verticalPosition: { relative: D.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
            wrap: { type: D.TextWrappingType.TOP_AND_BOTTOM },
          }
        : undefined;
  return new D.ImageRun({
    data: decoded.bytes,
    type: decoded.type,
    transformation: { width, height: Math.round(width * ratio) },
    floating,
  });
}

/** Inline content nodes: text/images plus hyperlinks, tracked changes and comment marks */
type RunChild = InstanceType<
  | DocxNs['TextRun']
  | DocxNs['ImageRun']
  | DocxNs['ExternalHyperlink']
  | DocxNs['InsertedTextRun']
  | DocxNs['DeletedTextRun']
  | DocxNs['Bookmark']
  | DocxNs['SimpleField']
  | DocxNs['InternalHyperlink']
  | DocxNs['EndnoteReferenceRun']
>;
type ParagraphChild = import('docx').ParagraphChild;

/**
 * Inline content plus the set of comments covering it.
 * Comment ranges must "merge consecutive runs sharing a comment", so ids are recorded while collecting
 * and wrapped in pairs at render time.
 */
interface InlineRun {
  node: RunChild;
  /** Comment ids covering this run (document order) */
  commentIds: string[];
}

/** Tracked-change state: text nodes inside <ins>/<del> produce Word revision runs directly */
type TrackedKind = 'insert' | 'delete' | null;

/** Export context: carries the docx namespace plus the global state needed for comments / revisions / footnotes */
interface ExportContext {
  D: DocxNs;
  /** Editor comment id -> Word numeric comment id (only comments that have metadata) */
  commentIds: Map<string, number>;
  /** Author for revisions and comments */
  author: string;
  /** Revision timestamp (single export-time value, avoiding a new Date per item) */
  date: string;
  /** Revision id counter: Word requires document-wide uniqueness */
  revisionId: { value: number };
  /** Footnote bodies collected in body order (number = index + 1) */
  footnoteNotes: string[];
  /** Endnote bodies collected in body order (independent numbering, `endnotes.xml`) */
  endnoteNotes: string[];
  /** Formulas OMML can't express -> pre-rendered images (indexed by mathKey) */
  mathImages: Map<string, MathImage>;
  /** Shapes met during the traversal, in document order (injected into document.xml afterwards) */
  shapes: ShapeExportEntry[];
  /** Named styles of the document: blocks with `data-rte-style` become `w:pStyle`, the set becomes `w:styles` */
  namedStyles: readonly NamedStyle[];
}

/** Default hyperlink styling: docx has no built-in Hyperlink character style, so add blue underline explicitly */
function hyperlinkMark(mark: Mark): Mark {
  return { ...mark, color: mark.color ?? '0563C1', underline: mark.underline ?? true };
}

/**
 * `w:ind` 的子属性。首行缩进与悬挂缩进在 OOXML 里互斥（firstLine / hanging），
 * 这里只写真正用到的项：全 0 时返回 undefined，避免每段都生成一串 0 值属性。
 */
function paragraphIndent(
  firstLine: number,
  left: number,
  right: number,
  hanging: number,
): { firstLine?: number; left?: number; right?: number; hanging?: number } | undefined {
  const indent: { firstLine?: number; left?: number; right?: number; hanging?: number } = {};
  if (firstLine > 0) indent.firstLine = firstLine;
  if (left > 0) indent.left = left;
  if (right > 0) indent.right = right;
  if (hanging > 0) indent.hanging = hanging;
  return Object.keys(indent).length > 0 ? indent : undefined;
}

/**
 * Word has no run property for lowercase / capitalize, so the text itself is transformed.
 * `capitalize` follows CSS semantics: the first letter of each whitespace-separated word.
 */
function applyTextTransform(text: string, transform: Mark['textTransform']): string {
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize')
    return text.replace(
      /(^|\s)(\p{L})/gu,
      (_, lead: string, ch: string) => lead + ch.toUpperCase(),
    );
  return text;
}

/**
 * Tab stops of a paragraph: `data-tab-stops` (`96:left,192:right`) -> Word's `w:tabs`.
 * Positions are CSS px from the text edge; Word counts twips from the same edge, so the conversion is
 * the usual ×15 — no separate indent arithmetic, which keeps the two sides symmetric with the import.
 */
function paragraphTabStops(
  raw: string | null | undefined,
): import('docx').TabStopDefinition[] | undefined {
  const stops = parseTabStops(raw);
  if (stops.length === 0) return undefined;
  // `TabStopType` values are the same words we store ('left' / 'center' / 'right' / 'decimal')
  return stops.map((stop) => ({ type: stop.align, position: Math.round(stop.pos * PX_TO_TWIP) }));
}

/**
 * Run children for text containing tabs. Word only advances to a tab stop on `<w:tab/>`; a raw `\t`
 * inside `w:t` is not a tab at all (the docx writer copies it verbatim, and Word shows nothing).
 */
function runChildren(text: string, D: DocxNs): IRunOptionsChildren | null {
  if (!text.includes('\t')) return null;
  const children: (string | import('docx').Tab)[] = [];
  text.split('\t').forEach((part, index) => {
    if (index > 0) children.push(new D.Tab());
    if (part) children.push(part);
  });
  return children as IRunOptionsChildren;
}

type IRunOptionsChildren = NonNullable<import('docx').IRunOptions['children']>;

/** Create one text run (automatically wrapped as a revision when tracking) */
function createTextRun(
  ctx: ExportContext,
  mark: Mark,
  tracked: TrackedKind,
  text: string,
): RunChild {
  const { D } = ctx;
  const content = applyTextTransform(text, mark.textTransform);
  const children = runChildren(content, D);
  const options = {
    ...(children ? { children } : { text: content }),
    bold: mark.bold,
    italics: mark.italics,
    strike: mark.strike,
    underline: mark.underline ? {} : undefined,
    color: mark.color,
    highlight: mark.highlight,
    font: mark.font,
    size: mark.size,
    superScript: mark.superscript,
    subScript: mark.subscript,
    characterSpacing: mark.characterSpacing,
    allCaps: mark.allCaps,
    smallCaps: mark.smallCaps,
  };
  if (!tracked) return new D.TextRun(options);
  const revision = {
    id: (ctx.revisionId.value += 1),
    author: ctx.author,
    date: ctx.date,
    ...options,
  };
  return tracked === 'insert' ? new D.InsertedTextRun(revision) : new D.DeletedTextRun(revision);
}

/**
 * Inline node -> docx run.
 * Covers: text / line break / image / hyperlink (ExternalHyperlink) /
 * revisions (ins -> InsertedTextRun, del -> DeletedTextRun) / comment ranges (commentId propagated down).
 */
function collectInlineRuns(
  ctx: ExportContext,
  parent: Element,
  mark: Mark,
  commentIds: string[],
  tracked: TrackedKind,
): InlineRun[] {
  const { D } = ctx;
  const runs: InlineRun[] = [];
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? '';
      if (!text) return;
      runs.push({ node: createTextRun(ctx, mark, tracked, text), commentIds });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;

    // P1-4 制表位: the tab atom becomes `<w:tab/>`, which is the only thing Word advances on
    if (el.hasAttribute(TAB_ATTR)) {
      runs.push({ node: new D.TextRun({ children: [new D.Tab()] }), commentIds });
      return;
    }

    // Tracked revisions: inner text produces native Word revision runs
    if (el.tagName === 'INS' && el.getAttribute('data-track') === 'insert') {
      runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), commentIds, 'insert'));
      return;
    }
    if (el.tagName === 'DEL' && el.getAttribute('data-track') === 'delete') {
      runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), commentIds, 'delete'));
      return;
    }

    // Bookmark (RTE-03): a zero-width anchor becomes a native bookmarkStart/End pair.
    // Handled before the hyperlink branch because both are `<a>` and only this one has no href.
    const bookmarkName = normalizeBookmarkName(el.getAttribute('data-bookmark') ?? '');
    if (bookmarkName) {
      runs.push({ node: new D.Bookmark({ id: bookmarkName, children: [] }), commentIds });
      return;
    }

    // Cross-reference (RTE-03): the page mode becomes a REF field Word recomputes on open;
    // the text mode becomes an internal hyperlink carrying already-resolved words, because a
    // zero-width bookmark has no text for `REF` to return in Word.
    const xrefTarget = normalizeBookmarkName(el.getAttribute(XREF_ATTR) ?? '');
    if (xrefTarget) {
      const cached = (el.textContent ?? '').trim();
      const mode = normalizeXrefMode(el.getAttribute(XREF_MODE_ATTR));
      runs.push({
        node:
          mode === 'page'
            ? new D.SimpleField(` REF ${xrefTarget} \\p \\h `, cached || '1')
            : new D.InternalHyperlink({
                anchor: xrefTarget,
                children: [new D.TextRun({ text: cached || xrefTarget })],
              }),
        commentIds,
      });
      return;
    }

    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') ?? '').trim();
      const inner = collectInlineRuns(ctx, el, hyperlinkMark(mark), commentIds, tracked);
      // Anchors without an href degrade to plain text, avoiding empty links
      if (!href || inner.length === 0) {
        runs.push(...inner);
        return;
      }
      runs.push({
        node: new D.ExternalHyperlink({
          link: href,
          children: inner.map((run) => run.node) as ParagraphChild[],
        }),
        commentIds,
      });
      return;
    }

    if (el.tagName === 'BR') {
      runs.push({
        node: tracked
          ? createTextRun(ctx, mark, tracked, '')
          : new D.TextRun({ text: '', break: 1 }),
        commentIds,
      });
      return;
    }

    // Inline formula -> native equation (OMML) or a fallback image
    if (el.hasAttribute('data-math') && el.getAttribute('data-display') !== 'true') {
      runs.push({ node: buildMathRun(ctx, el), commentIds });
      return;
    }

    // Footnote reference -> Word footnote: number follows body order (traversal order is authoritative, not the HTML number)
    if (el.tagName === 'SUP' && el.hasAttribute(FOOTNOTE_ATTR)) {
      ctx.footnoteNotes.push((el.getAttribute('data-note') ?? '').trim());
      runs.push({
        node: new D.FootnoteReferenceRun(ctx.footnoteNotes.length),
        commentIds,
      });
      return;
    }

    // Endnote reference -> Word endnote (its own counter, written to endnotes.xml)
    if (el.tagName === 'SUP' && el.hasAttribute(ENDNOTE_ATTR)) {
      ctx.endnoteNotes.push((el.getAttribute('data-note') ?? '').trim());
      runs.push({
        node: new D.EndnoteReferenceRun(ctx.endnoteNotes.length),
        commentIds,
      });
      return;
    }

    if (el.tagName === 'IMG') {
      const run = imageRun(D, el);
      if (run) runs.push({ node: run, commentIds });
      return;
    }

    // Comment mark: stack the id onto subsequent content, wrapped in pairs at render time
    const commentId = el.getAttribute('data-comment-id');
    const nested =
      commentId && ctx.commentIds.has(commentId) ? [...commentIds, commentId] : commentIds;
    runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), nested, tracked));
  });
  return runs;
}

/**
 * Render inline content as paragraph children, inserting paired
 * CommentRangeStart / CommentRangeEnd / CommentReference for consecutive commented content
 * (the three markers Word comments require).
 * When the comment set changes, close everything and reopen, so ranges stay strictly nested
 * (Word rejects crossing ranges).
 */
function runsToChildren(ctx: ExportContext, runs: readonly InlineRun[]): ParagraphChild[] {
  const { D } = ctx;
  const children: ParagraphChild[] = [];
  let open: string[] = [];
  const sameSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

  runs.forEach((run) => {
    if (!sameSet(open, run.commentIds)) {
      [...open].reverse().forEach((id) => {
        const numeric = ctx.commentIds.get(id);
        if (numeric === undefined) return;
        children.push(new D.CommentRangeEnd(numeric), new D.CommentReference(numeric));
      });
      run.commentIds.forEach((id) => {
        const numeric = ctx.commentIds.get(id);
        if (numeric !== undefined) children.push(new D.CommentRangeStart(numeric));
      });
      open = [...run.commentIds];
    }
    children.push(run.node as ParagraphChild);
  });

  [...open].reverse().forEach((id) => {
    const numeric = ctx.commentIds.get(id);
    if (numeric === undefined) return;
    children.push(new D.CommentRangeEnd(numeric), new D.CommentReference(numeric));
  });

  return children;
}

/** One-stop conversion at cell/paragraph level */
function blockChildren(ctx: ExportContext, parent: Element): ParagraphChild[] {
  return runsToChildren(ctx, collectInlineRuns(ctx, parent, {}, [], null));
}

/** A4 content width (170mm) in twips (1mm ≈ 56.7 twip), used to convert percentage column widths */
const CONTENT_WIDTH_DXA = 9640;

/** Read percentage/pixel column widths from TipTap's table colgroup (dxa) */
function readColumnWidthsDxa(table: Element, columnCount: number): number[] {
  const cols = Array.from(table.querySelectorAll('colgroup > col'));
  if (cols.length === 0) {
    const widthPct = Math.floor(100 / columnCount);
    return Array.from({ length: columnCount }, () =>
      Math.round((widthPct / 100) * CONTENT_WIDTH_DXA),
    );
  }
  const pcts = cols.map((col) => {
    const style = (col as HTMLElement).style;
    const pct = Number.parseFloat(style.width);
    return Number.isFinite(pct) ? pct : 100 / Math.max(1, cols.length);
  });
  const total = pcts.reduce((sum, pct) => sum + pct, 0) || 100;
  return pcts.map((pct) => Math.round((pct / total) * CONTENT_WIDTH_DXA));
}

/** px -> twips (1px = 1/96in, 1twip = 1/1440in) */
const PX_TO_TWIP = 15;

/**
 * Cell vertical alignment -> OOXML `w:vAlign`.
 * Accepts both the data attribute written by the editor and an inline style from pasted HTML.
 */
function readCellVAlign(cell: Element): CellVerticalAlign | undefined {
  return (
    normalizeCellVAlign(
      cell.getAttribute(CELL_VALIGN_ATTR) ?? (cell as HTMLElement).style?.verticalAlign,
    ) ?? undefined
  );
}

/** Our `middle` is OOXML's `center` */
const CELL_VALIGN_KEYS = { top: 'TOP', middle: 'CENTER', bottom: 'BOTTOM' } as const;

/** Table -> docx Table (preserving column widths / merged cells / cell shading / alignment / row height) */
function buildTable(ctx: ExportContext, table: Element): InstanceType<DocxNs['Table']> {
  const D = ctx.D;
  const colCount =
    table.querySelectorAll('colgroup > col').length ||
    Math.max(
      1,
      ...Array.from(table.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.children).reduce(
          (sum, cell) => sum + Math.max(1, Number(cell.getAttribute('colspan')) || 1),
          0,
        ),
      ),
    );
  // Table style: border toggle and zebra stripes (data attributes written by the TableStyle extension)
  const bordered = table.getAttribute('data-bordered') !== 'false';
  const zebra = table.getAttribute('data-zebra') === 'true';
  const rows: InstanceType<DocxNs['TableRow']>[] = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr, rowIndex) => {
    const zebraFill = zebra && rowIndex % 2 === 1 ? 'F9FAFB' : undefined;
    const cells = Array.from(tr.children).map((child) => {
      const isHeader = child.tagName === 'TH';
      const background =
        normalizeColor((child as HTMLElement).style.backgroundColor) ??
        zebraFill ??
        (isHeader ? 'F3F4F6' : undefined);
      const colspan = Math.max(1, Number(child.getAttribute('colspan')) || 1);
      const rowspan = Math.max(1, Number(child.getAttribute('rowspan')) || 1);
      const vAlign = readCellVAlign(child);
      const paragraph = new D.Paragraph({
        children: blockChildren(ctx, child),
      });
      return new D.TableCell({
        children: [paragraph],
        shading: background ? { fill: background } : undefined,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        verticalAlign: vAlign ? D.VerticalAlignTable[CELL_VALIGN_KEYS[vAlign]] : undefined,
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
      });
    });
    if (cells.length === 0) return;
    // Browser row heights behave as a minimum, so "at least" is the faithful Word rule
    const rawHeight = (tr as HTMLElement).style?.height || tr.getAttribute('height') || '';
    const rowHeight = Number.parseFloat(rawHeight);
    rows.push(
      new D.TableRow({
        children: cells,
        tableHeader: tr.children[0]?.tagName === 'TH',
        height:
          Number.isFinite(rowHeight) && rowHeight > 0
            ? { value: Math.round(rowHeight * PX_TO_TWIP), rule: D.HeightRule.ATLEAST }
            : undefined,
      }),
    );
  });
  return new D.Table({
    rows,
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    columnWidths: readColumnWidthsDxa(table, colCount),
    borders: bordered
      ? undefined
      : {
          top: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
  });
}

/** docx numbering supports at most 9 levels (0-8); deeper levels are flattened onto the last one */
const MAX_LIST_LEVEL = 8;

/** Build level definitions 0-8: bullets cycle through dot glyphs, numbered lists use multi-level decimals (%1.%2.…) */
function buildNumberingLevels(D: DocxNs, bullet: boolean) {
  const bulletGlyphs = ['\u2022', '\u25E6', '\u25AA'];
  return Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => {
    const text = bullet
      ? bulletGlyphs[level % bulletGlyphs.length]
      : `${Array.from({ length: level + 1 }, (_, i) => `%${i + 1}`).join('.')}.`;
    return {
      level,
      format: bullet ? D.LevelFormat.BULLET : D.LevelFormat.DECIMAL,
      text,
      alignment: D.AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    };
  });
}

/** List (ordered/unordered/task list) -> docx paragraphs, preserving nesting depth */
function buildList(
  ctx: ExportContext,
  list: Element,
  ordered: boolean,
  depth = 0,
): InstanceType<DocxNs['Paragraph']>[] {
  const D = ctx.D;
  const reference = ordered ? 'rte-number' : 'rte-bullet';
  const level = Math.min(depth, MAX_LIST_LEVEL);
  const isTaskList = list.getAttribute('data-type') === 'taskList';
  const out: InstanceType<DocxNs['Paragraph']>[] = [];
  Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .forEach((li) => {
      const inline = Array.from(li.children).filter(
        (c) => c.tagName !== 'UL' && c.tagName !== 'OL',
      );
      const host = inline.length > 0 ? inline : [li];
      const children = host.flatMap((piece) => blockChildren(ctx, piece));
      // Task list: convert checkbox state into a leading symbol
      if (isTaskList) {
        const checked = li.getAttribute('data-checked') === 'true';
        children.unshift(new D.TextRun({ text: checked ? '\u2611 ' : '\u2610 ' }));
      }
      out.push(
        new D.Paragraph({
          children,
          bullet: ordered ? undefined : { level },
          numbering: ordered ? { reference, level } : undefined,
        }),
      );
      // Recursively export nested sub-lists
      Array.from(li.children)
        .filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
        .forEach((nested) => {
          out.push(...buildList(ctx, nested, nested.tagName === 'OL', depth + 1));
        });
    });
  return out;
}

/** Heading level -> docx HeadingLevel (avoids imprecise types from indexed access) */
function headingLevel(D: DocxNs, level: number) {
  switch (level) {
    case 1:
      return D.HeadingLevel.HEADING_1;
    case 2:
      return D.HeadingLevel.HEADING_2;
    case 3:
      return D.HeadingLevel.HEADING_3;
    case 4:
      return D.HeadingLevel.HEADING_4;
    case 5:
      return D.HeadingLevel.HEADING_5;
    default:
      return D.HeadingLevel.HEADING_6;
  }
}

/**
 * Format revision -> `w:pPrChange` payload.
 *
 * Word records the **previous** paragraph properties inside the change element, which is exactly what our
 * `trackedFormat` mark keeps in `data-track-format`: `paragraph` / `heading:2` / `blockquote` / `codeBlock`.
 * The document library writes the element natively (`ParagraphOptions.revision`), so no zip surgery is
 * needed — but only the fields `IParagraphPropertiesOptionsBase` can express survive, which is why the
 * target key has to carry the heading level.
 */
function paragraphChangeProperties(
  D: DocxNs,
  target: string,
): { heading?: ReturnType<typeof headingLevel>; style?: string } {
  const [type, rawLevel] = target.split(':');
  if (type === 'heading') return { heading: headingLevel(D, Number.parseInt(rawLevel, 10) || 1) };
  if (type === 'blockquote') return { style: 'Quote' };
  if (type === 'codeBlock') return { style: 'Code' };
  return {};
}

/** text-align -> docx AlignmentType */
function alignmentType(D: DocxNs, align: string | undefined) {
  if (align === 'center') return D.AlignmentType.CENTER;
  if (align === 'right') return D.AlignmentType.RIGHT;
  if (align === 'justify') return D.AlignmentType.JUSTIFIED;
  return undefined;
}

function blockAlignment(el: Element): string | undefined {
  return (el.getAttribute('style') ?? '').match(/text-align:\s*(\w+)/)?.[1];
}

/** Block-level children: paragraphs / tables / TOC field */
type BlockChild = InstanceType<DocxNs['Paragraph'] | DocxNs['Table'] | DocxNs['TableOfContents']>;

/**
 * TOC node -> Word TOC field.
 * Entry text comes from the already rendered `li[data-level]` in the export HTML and is fed as
 * cachedEntries so the document shows a TOC as soon as it opens; page numbers are recomputed when
 * Word updates the field, so the editor-side numbers are only a "preview before opening".
 */
function buildTocField(D: DocxNs, el: Element): InstanceType<DocxNs['TableOfContents']> {
  const caption = el.querySelector('.rte-toc-title')?.textContent?.trim() ?? '';
  const cachedEntries = Array.from(el.querySelectorAll('li[data-level]')).map((item) => {
    const text = item.querySelector('.rte-toc-text')?.textContent?.trim() ?? '';
    const page = Number.parseInt(item.querySelector('.rte-toc-page')?.textContent ?? '', 10);
    return {
      title: text,
      level: Math.max(1, Number(item.getAttribute('data-level')) || 1),
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  });
  return new D.TableOfContents(caption || undefined, {
    hyperlink: true,
    headingStyleRange: '1-6',
    cachedEntries,
    beginDirty: true,
  });
}

/** Body HTML -> docx document content array */
function htmlToDocxChildren(ctx: ExportContext, root: Element): BlockChild[] {
  const D = ctx.D;
  const out: BlockChild[] = [];
  Array.from(root.children).forEach((el) => {
    // A block carrying a named style keeps that style: also writing `Heading n` would give the same
    // paragraph two competing style ids, and the round trip would come back with the wrong one
    const styleId = el.getAttribute('data-rte-style');
    const styledId =
      styleId && ctx.namedStyles.some((style) => style.id === styleId) ? styleId : null;
    const heading = styledId ? undefined : HEADING_LEVEL[el.tagName];
    if (el.hasAttribute('data-toc')) {
      out.push(buildTocField(D, el));
      return;
    }
    // Shape (P3-1.3): the docx library cannot emit `wps:wsp`, so write a token paragraph now and
    // swap in the real drawing element after packing (see docxShapeExport.ts)
    if (el.hasAttribute('data-doc-shape')) {
      const spec = readShapeSpec(el);
      if (!spec) return;
      const index = ctx.shapes.length + 1;
      const id = `s${index}`;
      ctx.shapes.push({
        id,
        index,
        attrs: spec,
        offsetX: spec.offsetX ?? 0,
        offsetY: spec.offsetY ?? 0,
      });
      out.push(
        new D.Paragraph({ children: [new D.TextRun({ text: shapePlaceholderParagraphText(id) })] }),
      );
      return;
    }
    // Block formula: takes a whole line, becoming a standalone formula paragraph in Word
    if (el.hasAttribute('data-math')) {
      out.push(new D.Paragraph({ children: [buildMathRun(ctx, el) as ParagraphChild] }));
      return;
    }
    if (el.hasAttribute('data-page-break')) {
      // Page break: empty paragraph + pageBreakBefore
      out.push(new D.Paragraph({ children: [], pageBreakBefore: true }));
      return;
    }
    // Images are block nodes in the editor (a whole line): they must be wrapped in a paragraph,
    // otherwise the entire image is dropped on export. Note we handle the <img> element itself
    // (it has no child nodes), so collectInlineRuns' child traversal can't be reused here.
    if (el.tagName === 'IMG') {
      const run = imageRun(D, el);
      out.push(
        new D.Paragraph({
          children: run ? [run] : [],
          alignment: alignmentType(D, blockAlignment(el)),
        }),
      );
      return;
    }
    if (el.tagName === 'TABLE') {
      out.push(buildTable(ctx, el));
      return;
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      out.push(...buildList(ctx, el, el.tagName === 'OL'));
      return;
    }
    if (el.tagName === 'HR') {
      out.push(
        new D.Paragraph({
          text: '',
          border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'D1D5DB' } },
        }),
      );
      return;
    }
    if (el.tagName === 'PRE') {
      const text = el.textContent ?? '';
      out.push(
        new D.Paragraph({
          // The named style is what makes the block survive a round trip: mammoth only emits <pre>
          // when it sees a `p[style-name='Code']` entry in the style map (indent + shading alone is
          // read back as a plain paragraph).
          style: 'Code',
          children: [new D.TextRun({ text, font: 'Consolas' })],
          shading: { fill: 'F3F4F6' },
        }),
      );
      return;
    }
    // Paragraph layout: first-line indent and space before/after (inline styles are px, converted to twip)
    const style = (el as HTMLElement).style;
    // 负的 text-indent 是悬挂缩进（浏览器与 Word 一致），要拆成 ind.hanging 而不是 firstLine
    const rawTextIndent = style?.textIndent
      ? Math.round(Number.parseFloat(style.textIndent) * PX_TO_TWIP)
      : 0;
    const hangingIndent = rawTextIndent < 0 ? Math.abs(rawTextIndent) : 0;
    const textIndent = rawTextIndent > 0 ? rawTextIndent : 0;
    const indentLeft = style?.marginLeft
      ? Math.max(0, Math.round(Number.parseFloat(style.marginLeft) * PX_TO_TWIP))
      : 0;
    const indentRight = style?.marginRight
      ? Math.max(0, Math.round(Number.parseFloat(style.marginRight) * PX_TO_TWIP))
      : 0;
    // Keep the existing default spacing (120 twip) when no inline style is set
    const spaceBefore = style?.marginTop
      ? Math.round(Number.parseFloat(style.marginTop) * PX_TO_TWIP)
      : 120;
    const spaceAfter = style?.marginBottom
      ? Math.round(Number.parseFloat(style.marginBottom) * PX_TO_TWIP)
      : 120;
    // P1-4: paragraph line spacing → `w:spacing/@w:line` (240 twips = one line, `lineRule="auto"`)
    const lineHeightRaw = style?.lineHeight ? Number.parseFloat(style.lineHeight) : Number.NaN;
    const lineHeight = Number.isFinite(lineHeightRaw) && lineHeightRaw > 0 ? lineHeightRaw : null;

    const paragraphOptions: ParagraphOptions = {
      children: blockChildren(ctx, el),
      alignment: alignmentType(D, blockAlignment(el)),
      heading: heading ? headingLevel(D, heading) : undefined,
      // P1-1: the paragraph points at a named style, so Word (and our own import) can find it again.
      // The `rte-` prefix keeps the id clear of Word's own Title / Heading1 built-ins
      style: styledId ? toDocxStyleId(styledId) : undefined,
      // 左右缩进与悬挂缩进都是 Word 的 `w:ind`；只写实际用到的子属性，
      // 否则 docx 库会给每段都生成一堆 0 值属性
      indent: paragraphIndent(textIndent, indentLeft, indentRight, hangingIndent),
      spacing: {
        before: Math.max(0, spaceBefore),
        after: Math.max(0, spaceAfter),
        // 300 = the editor's default 1.25 line spacing; a paragraph that carries its own multiple wins
        line: lineHeight ? Math.round(lineHeight * 240) : 300,
      },
      // P1-4: pagination control is a `w:pPr` toggle; only the states the user actually chose are
      // written, so Word keeps its own defaults for everything else
      keepNext: el.hasAttribute('data-keep-next') || undefined,
      keepLines: el.hasAttribute('data-keep-lines') || undefined,
      widowControl: el.getAttribute('data-widow-control') === 'off' ? false : undefined,
      // P1-4 制表位: `w:tabs`; the tab characters themselves become `<w:tab/>` runs (see runChildren)
      tabStops: paragraphTabStops(el.getAttribute(TAB_STOPS_ATTR)),
      // A format revision marks the whole block: the mark's own span tells us the previous kind
      revision: (() => {
        const target = el.querySelector('[data-track-format]')?.getAttribute('data-track-format');
        if (!target) return undefined;
        return {
          id: (ctx.revisionId.value += 1),
          author: ctx.author,
          date: ctx.date,
          ...paragraphChangeProperties(D, target),
        };
      })(),
    };
    out.push(
      el.tagName === 'BLOCKQUOTE'
        ? new D.Paragraph({
            ...paragraphOptions,
            style: 'Quote',
            indent: { left: 720 },
            shading: { fill: 'F9FAFB' },
          })
        : new D.Paragraph(paragraphOptions),
    );
  });
  return out;
}

/** mammoth style map: translate Word built-in and Chinese style names into semantic HTML (headings 1-6 are mapped by default) */
const MAMMOTH_STYLE_MAP = [
  // mammoth maps bold/italic/strike on its own but ignores underline unless told to keep it
  'u => u',
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='标题'] => h1:fresh",
  "p[style-name='副标题'] => h2:fresh",
  "p[style-name='引用'] => blockquote:fresh",
  "p[style-name='明显引用'] => blockquote:fresh",
  "p[style-name='代码'] => pre:fresh",
  // Our own exported styles (docx.ts writes style: 'Quote' / 'Code')
  "p[style-name='Code'] => pre:fresh",
];

export interface DocxImportOptions {
  /**
   * Called with the first section's page setup and the total section count.
   * mammoth drops `w:sectPr` completely, so the layout has to be read from the zip directly.
   */
  onLayout?: (info: { pageSetup: Partial<PageSetupConfig>; sectionCount: number }) => void;
  /** Tracked changes read back from `word/document.xml` (mammoth drops them entirely) */
  onReview?: (info: ImportedReview) => void;
  /** Shapes restored from `wps:wsp`, and how many were dropped because the text did not match */
  onShapes?: (info: { shapes: number; skipped: number }) => void;
  /**
   * Structured IR side channel (P0-2.6). Defaults to `VITE_USE_OOXML_IR`; the flag stays explicit so
   * tests can exercise both paths without touching the build environment. The HTML result never changes.
   */
  useOoxmlIr?: boolean;
  /** Called after the HTML is final when the flag is on and the package could be parsed into IR. */
  onIr?: (info: ImportedIr) => void;
  /**
   * Named styles read from `word/styles.xml` that the imported body actually uses (P1-1). Called only
   * when at least one block points at a style, so a plain document never touches the caller's set.
   */
  onStyles?: (styles: NamedStyle[]) => void;
}

/** Structured-import side channel: the IR plus the user-facing fidelity warnings derived from it. */
export interface ImportedIr {
  ir: OoxmlIr;
  issues: FidelityIssue[];
}

/** Result of reading the review layer (revisions + comments) of an imported package */
export interface ImportedReview {
  changes: TrackedChange[];
  comments: DocComment[];
  /**
   * The package had revisions but they could not be mapped onto mammoth's HTML (the text streams did not
   * line up). The import keeps the plain text and the caller reports the loss instead of guessing.
   */
  degraded: boolean;
  /** Comments whose range crossed blocks: imported as text without a mark, and reported */
  skippedComments: number;
}

/**
 * Read the raw `word/document.xml`. Best-effort: an import must never fail because the archive was opened
 * a second time, so any error degrades to "no layout / no revisions".
 */
async function readPartXml(buffer: ArrayBuffer, path: string): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file(path);
    return entry ? await entry.async('string') : '';
  } catch (error) {
    console.warn(`[richText] docx ${path} read failed:`, error);
    return '';
  }
}

const readDocumentXml = (buffer: ArrayBuffer) => readPartXml(buffer, 'word/document.xml');
const readCommentsXml = (buffer: ArrayBuffer) => readPartXml(buffer, 'word/comments.xml');

/** Parts the IR stage consumes; media entries only contribute their path (pixels are never decoded). */
const IR_PART_PATTERN =
  /^word\/(?:document\.xml|_rels\/document\.xml\.rels|(?:footnotes|endnotes|comments|styles|numbering|people)\.xml|(?:header|footer)\d+\.xml|media\/.+)$/;

/**
 * Read the parts the structured IR needs (P0-2.6). `document.xml` is handed in because the caller
 * already read it; media entries become empty strings so `collectPartFacts` can count them.
 */
async function readOoxmlParts(buffer: ArrayBuffer, documentXml: string): Promise<OoxmlParts> {
  const parts: OoxmlParts = {};
  if (documentXml.trim()) parts['word/document.xml'] = documentXml;
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && IR_PART_PATTERN.test(name),
  );
  await Promise.all(
    names.map(async (name) => {
      parts[name] = /^word\/media\//.test(name)
        ? ''
        : ((await zip.file(name)?.async('string')) ?? '');
    }),
  );
  return parts;
}

/**
 * Best-effort IR side channel (P0-2.6). Any failure degrades to "no report": a package mammoth
 * already imported must never fail because the optional IR could not read it.
 */
async function readOoxmlIr(buffer: ArrayBuffer, documentXml: string): Promise<ImportedIr | null> {
  try {
    // Loaded on demand: with the flag off the IR module is never fetched or parsed
    const { parseOoxmlParts } = await import('./ooxmlIr');
    const parsed = parseOoxmlParts(await readOoxmlParts(buffer, documentXml));
    if (!parsed.ok) {
      console.warn('[richText] OOXML IR skipped:', parsed.error);
      return null;
    }
    return { ir: parsed.value, issues: importLossIssues(parsed.value) };
  } catch (error) {
    console.warn('[richText] OOXML IR read failed:', error);
    return null;
  }
}

/** Header / footer of the imported document, read straight from the package parts */
export interface ImportedHeaderFooter {
  header?: string;
  footer?: string;
  /** Even-page header (only meaningful together with `differentOddEven`) */
  evenHeader?: string;
  /** Even-page footer */
  evenFooter?: string;
  /** `w:evenAndOddHeaders` was set in settings.xml (Word's 奇偶页不同) */
  differentOddEven?: boolean;
  /** Whether the footer carries a PAGE field (Word's page number) */
  showPageNumber: boolean;
}

/** `word/_rels/document.xml.rels`: rId -> part name, relative to `word/` */
function relationshipTargets(relsXml: string): Map<string, string> {
  const targets = new Map<string, string>();
  if (!relsXml.trim()) return targets;
  const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return targets;
  Array.from(doc.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) targets.set(id, target);
  });
  return targets;
}

/**
 * `r:id` of a section's header / footer reference of one type: `default` (odd pages), `first`
 * (`w:titlePg`) or `even` (`w:evenAndOddHeaders`).
 */
function referenceId(sectPr: Element, tag: string, type = 'default'): string | null {
  const refs = Array.from(sectPr.getElementsByTagName(tag));
  const chosen = refs.find((ref) => (ref.getAttribute('w:type') ?? 'default') === type);
  return chosen?.getAttribute('r:id') ?? null;
}

/**
 * Visible text of a header / footer part. The page setup model keeps a single line per part,
 * so multi-paragraph headers are joined with a space instead of silently dropping lines.
 */
function partText(xml: string): string {
  if (!xml.trim()) return '';
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return '';
  return Array.from(doc.getElementsByTagName('w:p'))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName('w:t'))
        .map((run) => run.textContent ?? '')
        .join(''),
    )
    .map((text) => text.trim())
    .filter(Boolean)
    .join(' ');
}

/** A PAGE field instruction (simple field or fldChar sequence); NUMPAGES must not count */
function hasPageField(xml: string): boolean {
  if (!xml.trim()) return false;
  return /<w:instrText[^>]*>\s*PAGE\b/i.test(xml) || /\bw:instr\s*=\s*"\s*PAGE\b/i.test(xml);
}

/**
 * Read the first section's default header / footer. mammoth returns body HTML only, so without this
 * step Word's header and footer text would be dropped on import (the layout alone used to survive).
 * Best-effort: a broken package degrades to "no header / footer" instead of failing the import.
 */
async function readHeaderFooter(
  buffer: ArrayBuffer,
  documentXml: string,
): Promise<ImportedHeaderFooter | null> {
  if (!documentXml.trim()) return null;
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  const sectPr = doc.getElementsByTagName('w:sectPr')[0];
  if (!sectPr) return null;
  const headerId = referenceId(sectPr, 'w:headerReference');
  const footerId = referenceId(sectPr, 'w:footerReference');
  const evenHeaderId = referenceId(sectPr, 'w:headerReference', 'even');
  const evenFooterId = referenceId(sectPr, 'w:footerReference', 'even');
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const targets = relationshipTargets(
      (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '',
    );
    const readPart = async (id: string | null): Promise<string> => {
      const target = id ? targets.get(id) : undefined;
      if (!target) return '';
      // Targets are relative to `word/`, but some producers write them package-absolute
      const path = target.startsWith('/') ? target.slice(1) : `word/${target}`;
      return (await zip.file(path)?.async('string')) ?? '';
    };
    const headerXml = await readPart(headerId);
    const footerXml = await readPart(footerId);
    const info: ImportedHeaderFooter = { showPageNumber: hasPageField(footerXml) };
    if (headerId) info.header = partText(headerXml);
    if (footerId) info.footer = partText(footerXml);
    if (evenHeaderId) info.evenHeader = partText(await readPart(evenHeaderId));
    if (evenFooterId) info.evenFooter = partText(await readPart(evenFooterId));
    // The switch itself lives in settings.xml; without it Word ignores the even parts entirely
    const settingsXml = (await zip.file('word/settings.xml')?.async('string')) ?? '';
    if (/<w:evenAndOddHeaders\b/.test(settingsXml)) info.differentOddEven = true;
    return info;
  } catch (error) {
    console.warn('[richText] docx header/footer read failed:', error);
    return null;
  }
}

/** Import .docx: parse with mammoth (including style map) -> sanitize HTML */
export async function importDocx(
  file: File,
  options?: DocxImportOptions,
): Promise<ToolResult<string>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  // checkImportFile also admits .txt/.md/.html for the text-import path; this entry point is docx-only
  if (check.value !== 'docx') return { ok: false, error: 'NOT_DOCX' };
  try {
    const buffer = await file.arrayBuffer();
    const documentXml = await readDocumentXml(buffer);
    const sections = parseDocxSections(documentXml);
    if (sections.length > 0) {
      // The first section is what the document-level page setup corresponds to; later sections cannot be
      // located in mammoth's HTML, so they are merged and reported to the caller instead of silently dropped.
      // Header / footer text lives in separate package parts that mammoth never reads.
      const headerFooter = await readHeaderFooter(buffer, documentXml);
      options?.onLayout?.({
        pageSetup: { ...sections[0].pageSetup, ...(headerFooter ?? {}) },
        sectionCount: sections.length,
      });
    }
    const mammoth = (await import('mammoth')).default;
    // mammoth's browser build expects `arrayBuffer` while the Node build only reads `buffer`
    // (and prefers it); passing both forms hits either environment in one call — no retry needed
    // (a retry would produce unhandled rejections)
    const nodeBuffer =
      typeof Buffer === 'undefined' ? undefined : Buffer.from(new Uint8Array(buffer));
    // Named styles (P1-1): read the definitions before converting, so mammoth can map each style name
    // to a marker class and the paragraphs come back pointing at the same style id
    const importedStyles = parseDocxStylesXml(await readPartXml(buffer, 'word/styles.xml'));
    const parsed = await mammoth.convertToHtml(
      (nodeBuffer ? { arrayBuffer: buffer, buffer: nodeBuffer } : { arrayBuffer: buffer }) as {
        arrayBuffer: ArrayBuffer;
      },
      { styleMap: [...MAMMOTH_STYLE_MAP, ...docxStyleMapEntries(importedStyles)] },
    );
    const clean = sanitizeDocHtml(parsed.value);
    if (!clean.ok) return clean;
    let html = normalizeImportedDocHtml(clean.value);
    // Marker classes become attributes *after* sanitizing: the values are our own ids, and doing it
    // afterwards means the sanitizer never has to whitelist them
    const styled = applyStyleClasses(html, importedStyles);
    html = styled.html;
    if (styled.used.length > 0) options?.onStyles?.(styled.used);
    // P1-4: mammoth drops w:pPr, so pagination flags are re-read from document.xml and mapped by
    // position (guarded: applied only when the block counts agree)
    const controls = parseDocxParagraphControls(await readPartXml(buffer, 'word/document.xml'));
    html = applyParagraphControls(html, controls);
    // Review layer last: mammoth keeps inserted text as plain text, drops deleted text and comment ranges
    // outright, so revisions / format changes / comment marks are re-applied onto the final HTML
    // (see docxReview.ts for the alignment contract)
    const review = parseDocumentReview(documentXml);
    const importedComments = parseImportedComments(await readCommentsXml(buffer));
    if (review.runs.length > 0 || review.formats.length > 0 || review.anchors.length > 0) {
      const applied = applyDocumentReview(html, review, importedComments, Date.now());
      if (applied.ok) {
        html = applied.value.html;
        options?.onReview?.({
          changes: applied.value.changes,
          comments: applied.value.comments,
          degraded: false,
          skippedComments: applied.value.skippedComments,
        });
      } else {
        options?.onReview?.({ changes: [], comments: [], degraded: true, skippedComments: 0 });
      }
    }
    // Shapes last: they anchor on the final block texts, and only go in when those match exactly
    const extracted = extractDocxShapes(documentXml);
    if (extracted.shapes.length > 0 || extracted.unsupported > 0) {
      const placed = placeShapesInHtml(html, extracted);
      html = placed.html;
      options?.onShapes?.({ shapes: placed.placed, skipped: placed.skipped });
    }
    // Structured IR is a side channel (P0-2.6): read once the HTML is final, and never modify it
    if ((options?.useOoxmlIr ?? isOoxmlIrEnabled()) && options?.onIr) {
      const imported = await readOoxmlIr(buffer, documentXml);
      if (imported) options.onIr(imported);
    }
    // P1-4 制表位 last: mammoth hands `<w:tab/>` over as `\t` text, which ProseMirror's parser would
    // collapse into a space on the next `setContent`. Only after every text-matching pass (review,
    // shapes) has run, because the tab atom no longer contributes to `textContent`.
    return { ok: true, value: tabsToTabNodes(html) };
  } catch (error) {
    console.error('[richText] docx import failed:', error);
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/** Review metadata: comment list, tracked-change entries and author */
export interface DocxReviewOptions {
  comments?: DocComment[];
  changes?: TrackedChange[];
  /** Author for comments and revisions */
  author?: string;
}

/** Formula dedup key: the same formula (including display mode) is rendered only once */
function mathKey(latex: string, display: boolean): string {
  return `${display ? 'block' : 'inline'}|${latex}`;
}

/**
 * Formula node -> Word content.
 * Prefer a native equation (OMML, still editable in Word);
 * fall back to a pre-rendered image when the syntax isn't supported, keeping visuals consistent;
 * if even the image is unavailable, emit the LaTeX source as text — never drop content silently.
 */
function buildMathRun(
  ctx: ExportContext,
  el: Element,
): InstanceType<DocxNs['TextRun'] | DocxNs['ImageRun'] | DocxNs['Math']> {
  const { D } = ctx;
  const latex = (el.getAttribute('data-latex') ?? '').trim();
  const display = el.getAttribute('data-display') === 'true';
  const omml = latexToOmml(D, latex);
  if (omml) return omml;

  const image = ctx.mathImages.get(mathKey(latex, display));
  if (image) {
    const decoded = decodeDataUrl(image.dataUrl);
    if (decoded) {
      const width = Math.min(MAX_IMAGE_WIDTH * 1.3, Math.max(16, image.width));
      const ratio = image.height / Math.max(1, image.width);
      return new D.ImageRun({
        data: decoded.bytes,
        type: decoded.type,
        transformation: {
          width: Math.round(width),
          height: Math.max(8, Math.round(width * ratio)),
        },
      });
    }
  }
  // Last resort: output the source as-is so nothing is lost
  return new D.TextRun({ text: display ? `$$${latex}$$` : `$${latex}$` });
}

type CommentsOptions = NonNullable<import('docx').ICommentsOptions>;

/**
 * Build native Word comments: body markers are written by runsToChildren, this only supplies the content.
 *
 * Note: the current docx version only serializes `comments.xml` (comment body / author / date);
 * the `resolved` flag is not persisted. Resolved comments already had their body marks removed in the
 * editor, so they never reach the exported document — matching Word's "hide resolved comments by default".
 */
function buildComments(
  D: DocxNs,
  comments: readonly DocComment[],
  author: string,
): CommentsOptions | undefined {
  if (comments.length === 0) return undefined;
  return {
    // ICommentsOptions takes plain option objects (docx constructs the Comment components internally)
    children: comments.map((comment, index) => {
      const byline = comment.author.trim() || author;
      return {
        id: index,
        author: byline,
        initials: byline.slice(0, 2),
        date: comment.createdAt > 0 ? new Date(comment.createdAt) : new Date(),
        resolved: comment.resolved,
        children: [
          ...(comment.quote.trim()
            ? [
                new D.Paragraph({
                  children: [new D.TextRun({ text: comment.quote.trim(), italics: true })],
                }),
              ]
            : []),
          new D.Paragraph({ children: [new D.TextRun({ text: comment.text })] }),
        ],
      };
    }),
  };
}

/** Export .docx: editor HTML -> Word document Blob (with page setup, header/footer, comments and revisions) */
export async function exportDocxBlob(
  html: string,
  title: string,
  setupInput?: PageSetupConfig | null,
  review?: DocxReviewOptions | null,
  /** The document's named styles (P1-1): written as `w:styles` and referenced by `w:pStyle` */
  namedStyles: readonly NamedStyle[] = [],
): Promise<ToolResult<Blob>> {
  const check = checkExportSize(html);
  if (!check.ok) return check;
  try {
    const setup = normalizePageSetup(setupInput ?? DEFAULT_PAGE_SETUP);
    const metrics = resolvePageMetrics(setup);
    const D = await import('docx');
    const comments = review?.comments ?? [];
    const ctx: ExportContext = {
      D,
      // Only comments actually referenced in the body need numeric ids; the order defines the Word comment pane order
      commentIds: new Map(comments.map((comment, index) => [comment.id, index])),
      author: review?.author?.trim() || 'SynTools',
      date: new Date().toISOString(),
      revisionId: { value: 1000 },
      footnoteNotes: [],
      endnoteNotes: [],
      mathImages: new Map(),
      shapes: [],
      namedStyles,
    };
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // First render off-screen the formulas "OMML can't express" as images (async), then enter the synchronous traversal
    const mathRequests: MathImageRequest[] = [];
    const seenMath = new Set<string>();
    Array.from(doc.querySelectorAll('[data-math]')).forEach((el) => {
      const latex = (el.getAttribute('data-latex') ?? '').trim();
      if (!latex) return;
      const display = el.getAttribute('data-display') === 'true';
      const key = mathKey(latex, display);
      if (seenMath.has(key)) return;
      seenMath.add(key);
      if (latexToOmml(D, latex)) return;
      mathRequests.push({ key, latex, display });
    });
    ctx.mathImages = await renderLatexImages(mathRequests);

    // Sections (P2-2): every `sectionBreak` node starts a new section. A document without any break
    // yields exactly one slice, so the single-section output is byte-for-byte the previous behaviour.
    const slices = splitSectionNodes(Array.from(doc.body.children), setup);
    const sectionBodies = slices.map((slice) => {
      // Move the blocks into a fresh host so the existing traversal can run per section
      const host = doc.createElement('div');
      slice.elements.forEach((element) => host.appendChild(element));
      const children = htmlToDocxChildren(ctx, host);
      if (children.length === 0) children.push(new D.Paragraph({ children: [] }));
      return { slice, children };
    });
    // Watermark: Word run properties can't rotate text, so use a floating transparent image in the header (behind text)
    const watermarkImage = await renderWatermarkImage(
      setup.watermark,
      metrics.contentWidthMm * MM_TO_PX,
      metrics.contentHeightMm * MM_TO_PX,
    );
    const watermarkChild = watermarkImage
      ? (buildWatermarkRun(D, watermarkImage) ?? undefined)
      : undefined;

    const commentOptions = buildComments(D, comments, ctx.author);
    // Footnote bodies are collected while traversing the body; the number is the array index + 1 (matching FootnoteReferenceRun)
    const footnoteOptions =
      ctx.footnoteNotes.length > 0
        ? Object.fromEntries(
            ctx.footnoteNotes.map((note, index) => [
              String(index + 1),
              {
                // docx inserts w:footnoteRef (the reference number) before footnote paragraphs automatically,
                // so only the body is written here to avoid two numbers
                children: [
                  new D.Paragraph({
                    children: [new D.TextRun({ text: note || ' ', size: 18 })],
                  }),
                ],
              },
            ]),
          )
        : undefined;
    // Endnotes mirror footnotes but land in endnotes.xml; Word numbers them independently
    const endnoteOptions =
      ctx.endnoteNotes.length > 0
        ? Object.fromEntries(
            ctx.endnoteNotes.map((note, index) => [
              String(index + 1),
              {
                children: [
                  new D.Paragraph({
                    children: [new D.TextRun({ text: note || ' ', size: 18 })],
                  }),
                ],
              },
            ]),
          )
        : undefined;
    // P1-1: the document's named styles become real Word paragraph styles, so the .docx keeps the
    // style names and a round trip can rebuild the set (see `namedStyleDocx.ts` for the reader).
    // Only properties the style actually sets are written; an empty `w:rPr` would override the
    // document defaults with nothing.
    const namedParagraphStyles = ctx.namedStyles.map((style) => {
      const resolved = resolveStyle(ctx.namedStyles, style.id) ?? style;
      const font = resolved.font ?? {};
      const level = resolved.headingLevel;
      const align = resolved.paragraph?.align;
      return {
        id: toDocxStyleId(style.id),
        name: defaultStyleName(style),
        basedOn: style.basedOn ?? 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          ...(font.family ? { font: firstFontFamily(font.family) ?? font.family } : {}),
          ...(font.size ? { size: Math.round(font.size * 2) } : {}),
          ...(font.bold ? { bold: true } : {}),
          ...(font.italic ? { italics: true } : {}),
          ...(font.color ? { color: font.color.replace('#', '').toUpperCase() } : {}),
        },
        paragraph: {
          // 0-based outline level: Word's navigation pane and TOC both use it
          ...(level ? { outlineLevel: level - 1 } : {}),
          ...(align ? { alignment: alignmentType(D, align) } : {}),
        },
      };
    });

    const document = new D.Document({
      title: title || 'SynTools Document',
      creator: 'SynTools',
      // Quote / Code stay for compatibility: mammoth can only rebuild <blockquote>/<pre> from a named
      // style (see MAMMOTH_STYLE_MAP), not from indentation.
      styles: {
        paragraphStyles: [
          ...namedParagraphStyles,
          {
            id: 'Quote',
            name: 'Quote',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { italics: true, color: '374151' },
            paragraph: { indent: { left: 720 }, spacing: { before: 120, after: 120 } },
          },
          {
            id: 'Code',
            name: 'Code',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { font: 'Consolas' },
            paragraph: { shading: { fill: 'F3F4F6' } },
          },
        ],
      },
      numbering: {
        config: [
          { reference: 'rte-bullet', levels: buildNumberingLevels(D, true) },
          { reference: 'rte-number', levels: buildNumberingLevels(D, false) },
        ],
      },
      // Tracked changes: body ins/del already map to Word revision runs;
      // turn on the switch so Word presents them in "track changes" mode and allows accept/reject
      features: {
        trackRevisions: (review?.changes?.length ?? 0) > 0,
        updateFields: true,
      },
      // 奇偶页不同: writes `<w:evenAndOddHeaders/>` into settings.xml, without which Word ignores the
      // `even` header / footer parts entirely
      evenAndOddHeaderAndFooters: slices.some((slice) => slice.pageSetup.differentOddEven),
      ...(commentOptions ? { comments: commentOptions } : {}),
      ...(footnoteOptions ? { footnotes: footnoteOptions } : {}),
      ...(endnoteOptions ? { endnotes: endnoteOptions } : {}),
      // Page background color (fills the sheet when opened in Word)
      ...(setup.background ? { background: { color: setup.background } } : {}),
      sections: sectionBodies.map(({ slice, children }, index) => {
        const sliceMetrics = resolvePageMetrics(slice.pageSetup);
        const landscape = slice.pageSetup.orientation === 'landscape';
        return {
          properties: {
            page: {
              // Landscape passes the swapped pair; `docx` swaps it back when writing w:pgSz, so the
              // emitted size stays the landscape one and the orient flag carries the intent
              size: {
                width: mmToTwip(landscape ? sliceMetrics.heightMm : sliceMetrics.widthMm),
                height: mmToTwip(landscape ? sliceMetrics.widthMm : sliceMetrics.heightMm),
                orientation: landscape ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT,
              },
              margin: {
                top: mmToTwip(slice.pageSetup.margin.top),
                right: mmToTwip(slice.pageSetup.margin.right),
                bottom: mmToTwip(slice.pageSetup.margin.bottom),
                left: mmToTwip(slice.pageSetup.margin.left),
              },
            },
            // Columns: Word flows the content by column itself (matching the on-screen flow view / print)
            ...(slice.pageSetup.columns > 1
              ? {
                  column: {
                    count: slice.pageSetup.columns,
                    space: mmToTwip(COLUMN_GAP_MM),
                    equalWidth: true,
                    separate: false,
                  },
                }
              : {}),
            // Different first page: when true the first page hides header/footer (matching Word's "different first page")
            ...(slice.pageSetup.differentFirstPage ? { titlePage: true } : {}),
            // The first section has nothing to start after, and Word ignores `w:type` there anyway
            ...(index > 0 && slice.startType === 'continuous'
              ? { type: D.SectionType.CONTINUOUS }
              : {}),
          },
          // "Link to previous": a section without its own headerReference inherits the previous one in
          // Word, so omitting the part is exactly the right encoding (no duplicate header parts)
          headers: slice.headerLinked
            ? undefined
            : buildHeaderFooter(D, slice.pageSetup, 'header', watermarkChild),
          footers: slice.footerLinked ? undefined : buildHeaderFooter(D, slice.pageSetup, 'footer'),
          children,
        };
      }),
    });
    const blob = await D.Packer.toBlob(document);
    // Second pass: swap the shape tokens for real `wps:wsp` drawings (no-op without shapes)
    return { ok: true, value: await injectShapeDrawings(blob, ctx.shapes) };
  } catch (error) {
    console.error('[richText] docx export failed:', error);
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}

/**
 * Watermark -> a floating image in the header anchored to the page (behind text).
 * A Word watermark is essentially a behindDoc shape in the header, so this matches Word's behavior.
 */
function buildWatermarkRun(
  D: DocxNs,
  image: WatermarkImage,
): InstanceType<DocxNs['ImageRun']> | null {
  const decoded = decodeDataUrl(image.dataUrl);
  if (!decoded) return null;
  return new D.ImageRun({
    data: decoded.bytes,
    type: decoded.type,
    transformation: { width: image.width, height: image.height },
    floating: {
      horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
      verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
      wrap: { type: D.TextWrappingType.NONE },
      behindDocument: true,
      allowOverlap: true,
    },
  });
}

/** Build the docx header/footer (returns undefined when empty, avoiding blank headers) */
function buildHeaderFooter(
  D: DocxNs,
  setup: PageSetupConfig,
  kind: 'header' | 'footer',
  extra: InstanceType<DocxNs['ImageRun']> | undefined = undefined,
):
  | {
      default?: InstanceType<DocxNs['Header'] | DocxNs['Footer']>;
      even?: InstanceType<DocxNs['Header'] | DocxNs['Footer']>;
    }
  | undefined {
  const text = (kind === 'header' ? setup.header : setup.footer).trim();
  const evenText = (kind === 'header' ? setup.evenHeader : setup.evenFooter).trim();
  const pageNumber = kind === 'footer' && setup.showPageNumber;

  const build = (value: string) => {
    if (!value && !pageNumber && !extra) return null;
    const children: InstanceType<DocxNs['Paragraph']>[] = [
      new D.Paragraph({
        alignment: pageNumber && !value ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,
        children: [
          ...(value ? [new D.TextRun({ text: value })] : []),
          ...(pageNumber
            ? [
                new D.TextRun({
                  children: [value ? '  ' : '', D.PageNumber.CURRENT],
                }),
              ]
            : []),
          ...(extra ? [extra] : []),
        ],
      }),
    ];
    return kind === 'header' ? new D.Header({ children }) : new D.Footer({ children });
  };

  const parts: {
    default?: InstanceType<DocxNs['Header'] | DocxNs['Footer']>;
    even?: InstanceType<DocxNs['Header'] | DocxNs['Footer']>;
  } = {};
  const main = build(text);
  if (main) parts.default = main;
  if (setup.differentOddEven) {
    // 奇偶页不同: even pages read their own part. Omitting it would leave them without a header at all,
    // and the footer carries the page number, so it has to be repeated there too (watermark included).
    const even = build(evenText);
    if (even) parts.even = even;
  }
  return Object.keys(parts).length ? parts : undefined;
}
