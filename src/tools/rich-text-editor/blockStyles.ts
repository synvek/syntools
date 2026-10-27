import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { Extension } from '@tiptap/core';
import { CONTENT_WIDTH_PX } from './core';
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
 * - Tables: border toggle and zebra stripes
 * Everything goes through node attributes rather than mutating the DOM, staying within ProseMirror's rules.
 */

/** Read a numeric value from an inline style (px) */
function readPx(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  width?: number | null;
  align?: string | null;
  /** Image layer: inline / front (in front of text) / behind (behind text) */
  layer?: string | null;
  /** Offset of a floating image from the content area's top-left corner (px) */
  offsetX?: number | null;
  offsetY?: number | null;
  bordered?: boolean;
  zebra?: boolean;
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
            renderHTML: (attrs: StyleAttrs) =>
              attrs.textIndent ? { style: `text-indent: ${attrs.textIndent}px` } : {},
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

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphStyle: {
      /** Increase/decrease the first-line indent (step 24px, roughly 2 characters) */
      indentParagraph: (delta: number) => ReturnType;
      /** Set space before/after (px; 0 restores the default) */
      setParagraphSpacing: (before: number, after: number) => ReturnType;
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
    };
  },
});

export { ParagraphStyle, ImageStyle, TableStyle };
export { styleObject };
