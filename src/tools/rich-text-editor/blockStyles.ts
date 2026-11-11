import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import { Extension } from '@tiptap/core';
import { CELL_VALIGN_ATTR, CONTENT_WIDTH_PX, normalizeCellVAlign } from './core';
import {
  findSelectedImage,
  hasImageLayerAttr,
  isFloatingImageLayer,
  keepImageSelected,
  normalizeImageLayer,
} from './imageLayer';

/**
 * Typography details extension (modeled on Word):
 * - Paragraphs: first-line indent, space before/after (stored as attributes -> inline style, mappable to OOXML on export)
 * - Images: width percentage and alignment
 * - Tables: border toggle, zebra stripes, cell vertical alignment and row height
 * Everything goes through node attributes rather than mutating the DOM, staying within ProseMirror's rules.
 */

/** Read a numeric value from an inline style (px) */
function readPx(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Line spacing of a paragraph: unitless multiples only (1.5, 2 …). `px` / `%` values are absolute and
 * cannot be carried as a Word multiple (`w:line` with `lineRule="auto"`), so they are treated as unset.
 */
function readLineHeight(el: HTMLElement): number | null {
  const raw = el.style.lineHeight?.trim();
  if (!raw || !/^\d*\.?\d+$/.test(raw)) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0.8 || parsed > 4) return null;
  return Math.round(parsed * 100) / 100;
}

function styleObject(styles: Record<string, string | undefined>): string {
  return Object.entries(styles)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

interface StyleAttrs {
  textIndent?: number | null;
  spacingBefore?: number | null;
  spacingAfter?: number | null;
  /** 左缩进（px）：Word 的 `w:ind/@w:left` */
  indentLeft?: number | null;
  /** 右缩进（px）：Word 的 `w:ind/@w:right` */
  indentRight?: number | null;
  /** 悬挂缩进（px）：显示为负 text-indent，配合左缩进即 Word 的 hanging */
  hangingIndent?: number | null;
  /** P1-4: keep this paragraph on the same page as the next one (Word's 段中不分页) */
  keepNext?: boolean | null;
  /** P1-4: never split this paragraph across pages (Word's 段内不拆页) */
  keepLines?: boolean | null;
  /** P1-4: `false` switches widow/orphan control off; `null` = the default (on) */
  widowControl?: boolean | null;
  /** P1-4: line spacing as a multiple of the font size (Word's `w:line` + `w:lineRule="auto"`) */
  lineHeight?: number | null;
  width?: number | null;
  align?: string | null;
  /** Image layer: inline / front (in front of text) / behind (behind text) */
  layer?: string | null;
  /** Offset of a floating image from the content area's top-left corner (px) */
  offsetX?: number | null;
  offsetY?: number | null;
  bordered?: boolean;
  zebra?: boolean;
  /** Table cell vertical alignment (null = default, top) */
  verticalAlign?: string | null;
  /** Table row height in px (null = auto) */
  height?: number | null;
}

/**
 * Paragraph typography: textIndent / spacingBefore / spacingAfter (px).
 * StarterKit's paragraph node can't be imported from its own package, so global attributes are injected here.
 */
const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.textIndent),
            // 悬挂缩进也用 text-indent 表达（负值），两者不能同时写，否则后者会覆盖前者
            renderHTML: (attrs: StyleAttrs) =>
              attrs.textIndent && !attrs.hangingIndent
                ? { style: `text-indent: ${attrs.textIndent}px` }
                : {},
          },
          indentLeft: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginLeft),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.indentLeft ? { style: `margin-left: ${attrs.indentLeft}px` } : {},
          },
          indentRight: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginRight),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.indentRight ? { style: `margin-right: ${attrs.indentRight}px` } : {},
          },
          hangingIndent: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const parsed = readPx(el.style.textIndent);
              return typeof parsed === 'number' && parsed < 0 ? Math.abs(parsed) : null;
            },
            renderHTML: (attrs: StyleAttrs) =>
              attrs.hangingIndent ? { style: `text-indent: -${attrs.hangingIndent}px` } : {},
          },
          spacingBefore: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginTop),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.spacingBefore ? { style: `margin-top: ${attrs.spacingBefore}px` } : {},
          },
          spacingAfter: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginBottom),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.spacingAfter ? { style: `margin-bottom: ${attrs.spacingAfter}px` } : {},
          },
          // Pagination control is metadata, not appearance: it stays on data-* so the CSS (print and
          // page view) can decide how to honour it, and the .docx writer can read it back verbatim
          keepNext: {
            default: null,
            parseHTML: (el: HTMLElement) => (el.hasAttribute('data-keep-next') ? true : null),
            renderHTML: (attrs: StyleAttrs) => (attrs.keepNext ? { 'data-keep-next': 'true' } : {}),
          },
          keepLines: {
            default: null,
            parseHTML: (el: HTMLElement) => (el.hasAttribute('data-keep-lines') ? true : null),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.keepLines ? { 'data-keep-lines': 'true' } : {},
          },
          widowControl: {
            default: null,
            // Only the *off* state is stored: words documents have widow control on by default
            parseHTML: (el: HTMLElement) =>
              el.getAttribute('data-widow-control') === 'off' ? false : null,
            renderHTML: (attrs: StyleAttrs) =>
              attrs.widowControl === false ? { 'data-widow-control': 'off' } : {},
          },
          // Line spacing belongs to the paragraph, not to the run: Word's `w:spacing/@w:line` is a
          // paragraph property, and a run-level mark made "1.5 lines" split at every span boundary.
          // Written as an inline `line-height` (a CSS-expressible value, unlike the pagination flags)
          // so page view, print and the snapshot PDF all read it from the same markup.
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => readLineHeight(el),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
          },
        },
      },
    ];
  },
});

/**
 * Image: width (px), alignment, layer (inline / in front of text / behind text) and floating offsets.
 *
 * Whether the node is inline or block is decided by the `inline` option (see configure in extensions.ts):
 * TipTap's `group()` / `inline()` both read `this.options.inline`, so it can **only** be enabled via
 * configure. Writing the spec field `inline: true` here would put the node in the block group and carry
 * inline semantics at once, and the schema build fails with `Mixing inline and block content`.
 */
const ImageStyle = Image.extend({
  addAttributes() {
    return {
      // Important: the parent's attributes must be merged in, otherwise src / alt / title are replaced
      // wholesale and the image renders as an empty <img> with no src (nothing visible).
      ...this.parent?.(),
      // Image widths are always stored in pixels: drag-resize and toolbar presets both write pixels,
      // rendered as `width: Npx` (height auto preserves the ratio, like Word's proportional scaling)
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const raw = el.style.width || el.getAttribute('width') || '';
          const parsed = Number.parseFloat(raw);
          if (!Number.isFinite(parsed)) return null;
          // Legacy data: older versions stored percentages, converted to pixels via the A4 content width
          return raw.includes('%')
            ? Math.round((parsed / 100) * CONTENT_WIDTH_PX)
            : Math.round(parsed);
        },
        renderHTML: (attrs: StyleAttrs) =>
          attrs.width
            ? {
                width: Math.round(attrs.width),
                style: `width: ${Math.round(attrs.width)}px; height: auto`,
              }
            : {},
      },
      align: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align'),
        renderHTML: (attrs: StyleAttrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
      layer: {
        default: 'inline',
        parseHTML: (el: HTMLElement) => normalizeImageLayer(el.getAttribute('data-layer')),
        // Inline is the default style: only other wrap modes write data-layer
        renderHTML: (attrs: StyleAttrs) =>
          hasImageLayerAttr(attrs.layer) ? { 'data-layer': attrs.layer } : {},
      },
      offsetX: {
        default: null,
        parseHTML: (el: HTMLElement) => readPx(el.style.left),
        renderHTML: (attrs: StyleAttrs) =>
          isFloatingImageLayer(attrs.layer)
            ? { style: `left: ${Math.round(attrs.offsetX ?? 0)}px` }
            : {},
      },
      offsetY: {
        default: null,
        parseHTML: (el: HTMLElement) => readPx(el.style.top),
        renderHTML: (attrs: StyleAttrs) =>
          isFloatingImageLayer(attrs.layer)
            ? { style: `top: ${Math.round(attrs.offsetY ?? 0)}px` }
            : {},
      },
    };
  },
});

/** Tables: borders and zebra stripes (data attributes drive CSS; export maps them to OOXML) */
const TableStyle = Table.extend({
  addAttributes() {
    return {
      bordered: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-bordered') !== 'false',
        renderHTML: (attrs: StyleAttrs) => ({ 'data-bordered': attrs.bordered ? 'true' : 'false' }),
      },
      zebra: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-zebra') === 'true',
        renderHTML: (attrs: StyleAttrs) => ({ 'data-zebra': attrs.zebra ? 'true' : 'false' }),
      },
    };
  },
});

/**
 * Cell vertical alignment. Stored as a data attribute (not inline style) so it survives the HTML
 * round trip of drafts / imports, drives editor.css, and is read back by the docx exporter.
 * Pasted HTML often carries `style="vertical-align: middle"` instead: both forms are accepted.
 */
const cellVerticalAlignAttribute = {
  default: null,
  parseHTML: (el: HTMLElement) =>
    normalizeCellVAlign(el.getAttribute(CELL_VALIGN_ATTR) ?? el.style.verticalAlign),
  renderHTML: (attrs: StyleAttrs) =>
    attrs.verticalAlign ? { [CELL_VALIGN_ATTR]: attrs.verticalAlign } : {},
};

const TableCellStyle = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), verticalAlign: cellVerticalAlignAttribute };
  },
});

const TableHeaderStyle = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), verticalAlign: cellVerticalAlignAttribute };
  },
});

/**
 * Row height as an inline `height` on the row: browsers treat it as a minimum height, which is
 * exactly Word's "at least" row rule, and the docx exporter reads it back unchanged.
 */
const TableRowStyle = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          readPx(el.style.height) ?? readPx(el.getAttribute('height') ?? undefined),
        renderHTML: (attrs: StyleAttrs) =>
          attrs.height ? { style: `height: ${Math.round(attrs.height)}px` } : {},
      },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphStyle: {
      /** Increase/decrease the first-line indent (step 24px, roughly 2 characters) */
      indentParagraph: (delta: number) => ReturnType;
      /** Set space before/after (px; 0 restores the default) */
      setParagraphSpacing: (before: number, after: number) => ReturnType;
      /**
       * 左/右/悬挂缩进（px，null 清除）。只更新传入的字段，
       * 这样"加悬挂"不会把用户手调过的左缩进清掉。
       */
      setParagraphIndent: (patch: {
        left?: number | null;
        right?: number | null;
        hanging?: number | null;
      }) => ReturnType;
      /**
       * P1-4 pagination control. Only the fields present in `patch` are written, so toggling
       * 段中不分页 does not clear 段内不拆页.
       */
      setParagraphPagination: (patch: {
        keepNext?: boolean | null;
        keepLines?: boolean | null;
        widowControl?: boolean | null;
      }) => ReturnType;
      /**
       * P1-4 行距段落化：整段行距（倍数，null 恢复默认）。挂在段落上而不是 `textStyle` mark 上 ——
       * 行距是段落属性，mark 会在每个 span 边界断开，导出到 `.docx` 也只能落到 `w:spacing`。
       */
      setParagraphLineHeight: (value: number | null) => ReturnType;
    };
    imageStyle: {
      /** Set image width (px; null = natural size) and alignment */
      setImageStyle: (width: number | null, align: string | null) => ReturnType;
      /** Set only the image width (px): used by the drag handle / toolbar presets */
      setImageWidth: (width: number | null) => ReturnType;
    };
    tableStyle: {
      /** Toggle table borders / zebra stripes */
      toggleTableBorders: () => ReturnType;
      toggleTableZebra: () => ReturnType;
      /** Set the vertical alignment of every selected cell (null restores the default, top) */
      setCellVerticalAlign: (align: 'top' | 'middle' | 'bottom' | null) => ReturnType;
      /** Set the height of the row holding the caret (px; null restores auto) */
      setRowHeight: (height: number | null) => ReturnType;
    };
  }
}

/** Command extension: paragraph indent and spacing, image styles, table styles */
export const BlockStyleCommands = Extension.create({
  name: 'blockStyleCommands',
  addCommands() {
    return {
      indentParagraph:
        (delta: number) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          const current = Number(node.attrs.textIndent ?? 0);
          const next = Math.max(0, Math.min(240, current + delta));
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            textIndent: next || null,
          });
          return true;
        },
      setParagraphSpacing:
        (before: number, after: number) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            spacingBefore: before || null,
            spacingAfter: after || null,
          });
          return true;
        },
      setParagraphIndent:
        (patch) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          // 上限 480px：再大就把正文挤没了，Word 默认页边距也放不下
          const normalize = (value: number | null | undefined): number | null => {
            if (value === null || value === undefined) return null;
            const rounded = Math.max(0, Math.min(480, Math.round(value)));
            return rounded || null;
          };
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            ...('left' in patch ? { indentLeft: normalize(patch.left) } : {}),
            ...('right' in patch ? { indentRight: normalize(patch.right) } : {}),
            ...('hanging' in patch ? { hangingIndent: normalize(patch.hanging) } : {}),
          });
          return true;
        },
      setParagraphPagination:
        (patch) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            ...('keepNext' in patch ? { keepNext: patch.keepNext ?? null } : {}),
            ...('keepLines' in patch ? { keepLines: patch.keepLines ?? null } : {}),
            ...('widowControl' in patch ? { widowControl: patch.widowControl ?? null } : {}),
          });
          return true;
        },
      setParagraphLineHeight:
        (value: number | null) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          // Word's own range is 0.8–4 lines; anything outside is a typo, not a layout decision
          const next =
            value === null || !Number.isFinite(value)
              ? null
              : Math.round(Math.max(0.8, Math.min(4, value)) * 100) / 100;
          tr.setNodeMarkup($from.before(), undefined, { ...node.attrs, lineHeight: next });
          return true;
        },
      setImageStyle:
        (width: number | null, align: string | null) =>
        ({ state, tr }) => {
          // Reuse the shared image lookup: it hits when the image is selected (NodeSelection) or the cursor sits in its paragraph
          const found = findSelectedImage(state);
          if (!found) return false;
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            width: width ? Math.max(16, Math.round(width)) : null,
            align,
          });
          keepImageSelected(tr, found.pos);
          return true;
        },
      setImageWidth:
        (width: number | null) =>
        ({ state, tr }) => {
          const found = findSelectedImage(state);
          if (!found) return false;
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            width: width ? Math.max(16, Math.round(width)) : null,
          });
          keepImageSelected(tr, found.pos);
          return true;
        },
      toggleTableBorders:
        () =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const depth = $from.depth;
          for (let d = depth; d > 0; d -= 1) {
            const node = $from.node(d);
            if (node.type.name !== 'table') continue;
            tr.setNodeMarkup($from.before(d), undefined, {
              ...node.attrs,
              bordered: !node.attrs.bordered,
            });
            return true;
          }
          return false;
        },
      toggleTableZebra:
        () =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const depth = $from.depth;
          for (let d = depth; d > 0; d -= 1) {
            const node = $from.node(d);
            if (node.type.name !== 'table') continue;
            tr.setNodeMarkup($from.before(d), undefined, {
              ...node.attrs,
              zebra: !node.attrs.zebra,
            });
            return true;
          }
          return false;
        },
      setCellVerticalAlign:
        (align) =>
        ({ state, tr }) => {
          const { from, to } = state.selection;
          // A collapsed selection still hits its own cell: nodesBetween only descends into nodes
          // starting before `to`, so cells after the caret are left untouched.
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader') return;
            if ((node.attrs.verticalAlign ?? null) === align) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, verticalAlign: align });
            changed = true;
          });
          return changed;
        },
      setRowHeight:
        (height) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d -= 1) {
            const node = $from.node(d);
            if (node.type.name !== 'tableRow') continue;
            tr.setNodeMarkup($from.before(d), undefined, {
              ...node.attrs,
              height: height && height > 0 ? Math.round(height) : null,
            });
            return true;
          }
          return false;
        },
    };
  },
});

export { ParagraphStyle, ImageStyle, TableStyle, TableCellStyle, TableHeaderStyle, TableRowStyle };
export { styleObject };
