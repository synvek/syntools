import { mergeAttributes, Node } from '@tiptap/core';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import type { DOMOutputSpec, Node as PmNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { ShapeGeometry } from '../../core/drawing/geometry';
import { resolvePresetGeometry, shapeAdjustments } from '../../core/drawing/shapeDefs';
import { normalizeImageLayer, type ImageLayer } from './imageLayer';
import { shapePathD } from './shapeSvg';

/**
 * Rich-text shape node (P3-1.1): a block atom carrying a DrawingML preset shape.
 *
 * The node stores exactly what `wps:wsp` needs — `prst` + `adj`, box, rotation, fill, outline and
 * anchor mode — so the docx writer is a mechanical translation (`docxShapeExport.ts`) and nothing
 * is re-derived from pixels. Geometry itself is never stored: `core/drawing` resolves `prst`+`adj`
 * into a `ShapeGeometry` on every render, which is what keeps resize cheap and `avLst` lossless.
 *
 * Rendering is a plain DOM spec (SVG path in pixel space) rather than a NodeView: drafts, print,
 * PDF snapshots and `getHTML()` then all carry the same markup, and interaction lives in the React
 * overlay (`ShapeOverlay.tsx`) like the existing image resize handles.
 */

export type ShapeDash = 'solid' | 'dash' | 'dot';

export interface DocShapeAttrs {
  /** Stable id used by the docx placeholder token (`⟦SHAPE:id⟧`) */
  shapeId: string;
  prst: string;
  adj: Record<string, number> | null;
  width: number;
  height: number;
  /** Degrees, clockwise */
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: ShapeDash | null;
  layer: ImageLayer;
  offsetX: number | null;
  offsetY: number | null;
  /** Plain text inside the shape (P3-1.4: single style per shape, edited from the panel) */
  text: string;
  /** Text style: one run style per shape, the deliberate simplification of a full text box */
  textSize: number;
  textColor: string;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  textAlign: 'left' | 'center' | 'right';
  name: string | null;
}

export const DEFAULT_SHAPE_SIZE = { width: 170, height: 100 } as const;
export const DEFAULT_SHAPE_FILL = '#4472C4';
export const DEFAULT_SHAPE_STROKE = '#2F5597';

/** Palette offered in the insert panel: 24 presets across four groups (acceptance: ≥ 20) */
export const SHAPE_PRESETS: { group: 'basic' | 'arrow' | 'star' | 'flowchart'; prst: string }[] = [
  { group: 'basic', prst: 'rect' },
  { group: 'basic', prst: 'roundRect' },
  { group: 'basic', prst: 'ellipse' },
  { group: 'basic', prst: 'triangle' },
  { group: 'basic', prst: 'rtTriangle' },
  { group: 'basic', prst: 'diamond' },
  { group: 'basic', prst: 'trapezoid' },
  { group: 'basic', prst: 'pentagon' },
  { group: 'basic', prst: 'hexagon' },
  { group: 'basic', prst: 'octagon' },
  { group: 'basic', prst: 'parallelogram' },
  { group: 'basic', prst: 'cross' },
  { group: 'arrow', prst: 'rightArrow' },
  { group: 'arrow', prst: 'leftArrow' },
  { group: 'arrow', prst: 'upArrow' },
  { group: 'arrow', prst: 'downArrow' },
  { group: 'arrow', prst: 'leftRightArrow' },
  { group: 'arrow', prst: 'chevron' },
  { group: 'star', prst: 'star' },
  { group: 'star', prst: 'star4' },
  { group: 'star', prst: 'star6' },
  { group: 'star', prst: 'star8' },
  { group: 'flowchart', prst: 'flowChartProcess' },
  { group: 'flowchart', prst: 'flowChartDecision' },
];

let shapeCounter = 0;

const shapeDragKey = new PluginKey('docShapeDrag');

/** Fresh id for a new shape; unique per session, so export tokens never collide */
export function createShapeId(): string {
  shapeCounter += 1;
  return `shp${Date.now().toString(36)}${shapeCounter}`;
}

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value: unknown, fallback: number): number {
  return Math.max(8, Math.round(num(value, fallback)));
}

function parseAdj(raw: string | null | undefined): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    // A corrupt fragment must not swallow the shape itself
    return null;
  }
}

function normalizeDash(raw: string | null | undefined): ShapeDash | null {
  return raw === 'dash' || raw === 'dot' || raw === 'solid' ? raw : null;
}

/** Drop non-finite adjustment values: they cannot be written to `a:gd` and break round-trips */
function sanitizeAdj(
  adj: Record<string, number> | null | undefined,
): Record<string, number> | null {
  if (!adj) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(adj)) {
    if (Number.isFinite(value)) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Normalize any attribute bag (node attrs, DOM dataset, deserialized draft) into a full spec */
export function shapeSpec(attrs: Partial<DocShapeAttrs>): DocShapeAttrs {
  return {
    // Never generated here: renderHTML must be deterministic. The insert command assigns the id,
    // and the docx writer mints its own token id per export.
    shapeId: typeof attrs.shapeId === 'string' ? attrs.shapeId : '',
    prst: typeof attrs.prst === 'string' && attrs.prst ? attrs.prst : 'roundRect',
    adj: sanitizeAdj(attrs.adj),
    width: positive(attrs.width, DEFAULT_SHAPE_SIZE.width),
    height: positive(attrs.height, DEFAULT_SHAPE_SIZE.height),
    rotation: Math.round(num(attrs.rotation, 0) * 10) / 10,
    fill: typeof attrs.fill === 'string' && attrs.fill ? attrs.fill : DEFAULT_SHAPE_FILL,
    stroke: typeof attrs.stroke === 'string' ? attrs.stroke : DEFAULT_SHAPE_STROKE,
    strokeWidth: Math.max(0, Math.min(24, num(attrs.strokeWidth, 1))),
    dash: attrs.dash ?? null,
    layer: normalizeImageLayer(attrs.layer ?? 'inline'),
    offsetX:
      attrs.offsetX === null || attrs.offsetX === undefined
        ? null
        : Math.round(num(attrs.offsetX, 0)),
    offsetY:
      attrs.offsetY === null || attrs.offsetY === undefined
        ? null
        : Math.round(num(attrs.offsetY, 0)),
    text: typeof attrs.text === 'string' ? attrs.text : '',
    textSize: Math.max(6, Math.min(96, Math.round(num(attrs.textSize, 14)))),
    textColor: typeof attrs.textColor === 'string' && attrs.textColor ? attrs.textColor : '#FFFFFF',
    textBold: attrs.textBold === true,
    textItalic: attrs.textItalic === true,
    textUnderline: attrs.textUnderline === true,
    textAlign:
      attrs.textAlign === 'left' || attrs.textAlign === 'right' ? attrs.textAlign : 'center',
    name: typeof attrs.name === 'string' ? attrs.name : null,
  };
}

/** Geometries of a spec, resolved through the kernel (single source of truth with pptx/xlsx) */
export function shapeGeometryOf(spec: DocShapeAttrs): ShapeGeometry {
  return resolvePresetGeometry(spec.prst, spec.adj ?? undefined);
}

export function shapePathOf(spec: DocShapeAttrs): string {
  return shapePathD(shapeGeometryOf(spec), spec.width, spec.height);
}

const DASH_ARRAY: Record<ShapeDash, string | null> = {
  solid: null,
  dash: '6 4',
  dot: '2 3',
};

/** Inline frame style: size + rotation are always explicit, anchors come from the layer CSS */
export function shapeFrameStyle(spec: DocShapeAttrs): string {
  const parts = [`width: ${spec.width}px`, `height: ${spec.height}px`];
  if (spec.rotation !== 0) parts.push(`transform: rotate(${spec.rotation}deg)`);
  if (spec.layer === 'front' || spec.layer === 'behind') {
    parts.push(
      `left: ${Math.round(spec.offsetX ?? 0)}px`,
      `top: ${Math.round(spec.offsetY ?? 0)}px`,
    );
  }
  return parts.join('; ');
}

/** Read a shape spec back out of its DOM element (drafts, docx import hand-off, tests) */
export function readShapeSpec(el: Element): DocShapeAttrs | null {
  if (!el.hasAttribute('data-doc-shape')) return null;
  return shapeSpec({
    shapeId: el.getAttribute('data-shape-id') ?? undefined,
    prst: el.getAttribute('data-shape-prst') ?? undefined,
    adj: parseAdj(el.getAttribute('data-shape-adj')),
    width: num(el.getAttribute('data-shape-w'), DEFAULT_SHAPE_SIZE.width),
    height: num(el.getAttribute('data-shape-h'), DEFAULT_SHAPE_SIZE.height),
    rotation: num(el.getAttribute('data-shape-rot'), 0),
    fill: el.getAttribute('data-shape-fill') ?? undefined,
    stroke: el.getAttribute('data-shape-stroke') ?? undefined,
    strokeWidth: num(el.getAttribute('data-shape-stroke-width'), 1),
    dash: normalizeDash(el.getAttribute('data-shape-dash')),
    layer: normalizeImageLayer(el.getAttribute('data-layer')),
    offsetX: el.getAttribute('data-shape-x') ? num(el.getAttribute('data-shape-x'), 0) : null,
    offsetY: el.getAttribute('data-shape-y') ? num(el.getAttribute('data-shape-y'), 0) : null,
    text: el.getAttribute('data-shape-text') ?? '',
    textSize: num(el.getAttribute('data-shape-text-size'), 14),
    textColor: el.getAttribute('data-shape-text-color') ?? undefined,
    textBold: el.getAttribute('data-shape-text-bold') === '1',
    textItalic: el.getAttribute('data-shape-text-italic') === '1',
    textUnderline: el.getAttribute('data-shape-text-underline') === '1',
    textAlign:
      (el.getAttribute('data-shape-text-align') as DocShapeAttrs['textAlign']) ?? undefined,
    name: el.getAttribute('data-shape-name'),
  });
}

/**
 * DOM attributes for one shape. Single source of truth for `renderHTML` and for the docx importer
 * (`docxShapeImport.ts` builds its elements with the same map), so a restored shape always parses
 * back to exactly the spec it was created from.
 */
export function shapeDomAttributes(spec: DocShapeAttrs): Record<string, string> {
  const attributes: Record<string, string> = {
    'data-doc-shape': spec.prst,
    'data-shape-prst': spec.prst,
    'data-shape-w': String(spec.width),
    'data-shape-h': String(spec.height),
    'data-shape-rot': String(spec.rotation),
    'data-shape-fill': spec.fill,
    'data-shape-stroke': spec.stroke,
    'data-shape-stroke-width': String(spec.strokeWidth),
    class: 'rte-shape-node',
    style: shapeFrameStyle(spec),
  };
  if (spec.shapeId) attributes['data-shape-id'] = spec.shapeId;
  if (spec.adj) attributes['data-shape-adj'] = JSON.stringify(spec.adj);
  if (spec.dash) attributes['data-shape-dash'] = spec.dash;
  if (spec.text) attributes['data-shape-text'] = spec.text;
  attributes['data-shape-text-size'] = String(spec.textSize);
  attributes['data-shape-text-color'] = spec.textColor;
  attributes['data-shape-text-align'] = spec.textAlign;
  if (spec.textBold) attributes['data-shape-text-bold'] = '1';
  if (spec.textItalic) attributes['data-shape-text-italic'] = '1';
  if (spec.textUnderline) attributes['data-shape-text-underline'] = '1';
  if (spec.name) attributes['data-shape-name'] = spec.name;
  if (spec.layer !== 'inline') attributes['data-layer'] = spec.layer;
  if (spec.offsetX !== null) attributes['data-shape-x'] = String(spec.offsetX);
  if (spec.offsetY !== null) attributes['data-shape-y'] = String(spec.offsetY);
  return attributes;
}

/** Select an existing shape node (NodeSelection is the only selection an atom supports) */
export function keepShapeSelected(tr: Transaction, pos: number): void {
  const node = tr.doc.nodeAt(pos);
  if (!node || node.type.name !== 'docShape') return;
  tr.setSelection(NodeSelection.create(tr.doc, pos));
}

/** The currently selected shape, if any */
export function findSelectedShape(state: EditorState): { pos: number; node: PmNode } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === 'docShape') {
    return { pos: selection.from, node: selection.node };
  }
  return null;
}

/** Path a floating shape drag: no history per move, one undoable step on release */
function dragShapeOffset(view: EditorView, event: MouseEvent, pos: number, dom: HTMLElement): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const baseX = Number(node.attrs.offsetX ?? 0);
  const baseY = Number(node.attrs.offsetY ?? 0);
  const zoomEl = dom.closest('[data-rte-zoom]');
  const zoom = Number(zoomEl?.getAttribute('data-rte-zoom') ?? 1) || 1;

  const apply = (x: number, y: number, history: boolean): void => {
    const current = view.state.doc.nodeAt(pos);
    if (!current) return;
    const tr = view.state.tr.setNodeMarkup(pos, undefined, {
      ...current.attrs,
      offsetX: Math.max(0, Math.round(x)),
      offsetY: Math.max(0, Math.round(y)),
    });
    if (!history) tr.setMeta('addToHistory', false);
    view.dispatch(tr);
  };

  const onMove = (moveEvent: MouseEvent): void => {
    apply(
      baseX + (moveEvent.clientX - startX) / zoom,
      baseY + (moveEvent.clientY - startY) / zoom,
      false,
    );
  };
  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const current = view.state.doc.nodeAt(pos);
    if (!current) return;
    const finalX = Number(current.attrs.offsetX ?? 0);
    const finalY = Number(current.attrs.offsetY ?? 0);
    if (finalX === baseX && finalY === baseY) return;
    apply(baseX, baseY, false);
    apply(finalX, finalY, true);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

export const DocShape = Node.create({
  name: 'docShape',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    // Every attribute is serialized by renderHTML itself (as `data-shape-*`), so the default
    // attribute rendering must be suppressed — otherwise the HTML also carries raw
    // `prst="…"` / `adj="[object Object]"` noise that no parser reads.
    const hidden = (defaultValue: unknown) => ({ default: defaultValue, renderHTML: () => ({}) });
    return {
      shapeId: hidden(null),
      prst: hidden('roundRect'),
      adj: hidden(null),
      width: hidden(DEFAULT_SHAPE_SIZE.width),
      height: hidden(DEFAULT_SHAPE_SIZE.height),
      rotation: hidden(0),
      fill: hidden(DEFAULT_SHAPE_FILL),
      stroke: hidden(DEFAULT_SHAPE_STROKE),
      strokeWidth: hidden(1),
      dash: hidden(null),
      layer: hidden('inline'),
      offsetX: hidden(null),
      offsetY: hidden(null),
      text: hidden(''),
      textSize: hidden(14),
      textColor: hidden('#FFFFFF'),
      textBold: hidden(false),
      textItalic: hidden(false),
      textUnderline: hidden(false),
      textAlign: hidden('center'),
      name: hidden(null),
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-doc-shape]',
        getAttrs: (el) => {
          const spec = readShapeSpec(el as Element);
          return spec ? { ...spec } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const spec = shapeSpec(node.attrs as Partial<DocShapeAttrs>);
    const dash = spec.dash ? DASH_ARRAY[spec.dash] : null;
    // The node is an atom with no content: the SVG is the visible body, the data-* attributes are
    // the only thing the draft and the docx writer read back.
    return [
      'div',
      mergeAttributes(HTMLAttributes, shapeDomAttributes(spec)),
      [
        'svg',
        {
          class: 'rte-shape-svg',
          width: String(spec.width),
          height: String(spec.height),
          viewBox: `0 0 ${spec.width} ${spec.height}`,
          'aria-hidden': 'true',
        },
        [
          'path',
          {
            d: shapePathOf(spec),
            fill: spec.fill || 'none',
            stroke: spec.stroke || 'none',
            'stroke-width': String(spec.strokeWidth),
            ...(dash ? { 'stroke-dasharray': dash } : {}),
          },
        ],
      ],
      ...(spec.text
        ? [
            [
              'div',
              {
                class: 'rte-shape-text',
                style: [
                  `font-size: ${spec.textSize}px`,
                  `color: ${spec.textColor}`,
                  spec.textBold ? 'font-weight: 700' : '',
                  spec.textItalic ? 'font-style: italic' : '',
                  spec.textUnderline ? 'text-decoration: underline' : '',
                  `text-align: ${spec.textAlign}`,
                  `justify-content: ${
                    spec.textAlign === 'left'
                      ? 'flex-start'
                      : spec.textAlign === 'right'
                        ? 'flex-end'
                        : 'center'
                  }`,
                ]
                  .filter(Boolean)
                  .join('; '),
              },
              spec.text,
            ] as DOMOutputSpec,
          ]
        : []),
    ];
  },

  addCommands() {
    return {
      insertDocShape:
        (options?: { prst?: string; width?: number; height?: number; text?: string }) =>
        ({ state, dispatch }) => {
          const spec = shapeSpec({
            shapeId: createShapeId(),
            prst: options?.prst ?? 'roundRect',
            width: options?.width ?? DEFAULT_SHAPE_SIZE.width,
            height: options?.height ?? DEFAULT_SHAPE_SIZE.height,
            text: options?.text ?? '',
          });
          const node = state.schema.nodes[this.name].create(spec);
          // After the current block, never mid-paragraph: splitting text around an atom leaves the
          // caret on the wrong side of the shape (same reasoning as page/section breaks)
          const { $from } = state.selection;
          const pos = $from.depth > 0 ? $from.after(1) : $from.pos;
          const tr = state.tr.insert(pos, node);
          if (pos + node.nodeSize >= tr.doc.content.size) {
            tr.insert(pos + node.nodeSize, state.schema.nodes.paragraph.create());
          }
          tr.setSelection(NodeSelection.create(tr.doc, pos));
          dispatch?.(tr.scrollIntoView());
          return true;
        },

      updateDocShape:
        (attrs: Partial<DocShapeAttrs>) =>
        ({ state, tr }) => {
          const found = findSelectedShape(state);
          if (!found) return false;
          const current = nodeSpec(found.node);
          tr.setNodeMarkup(found.pos, undefined, { ...current, ...attrs });
          keepShapeSelected(tr, found.pos);
          return true;
        },

      removeDocShape:
        () =>
        ({ state, tr }) => {
          const found = findSelectedShape(state);
          if (!found) return false;
          tr.delete(found.pos, found.pos + found.node.nodeSize);
          return true;
        },

      setDocShapeLayer:
        (layer: ImageLayer) =>
        ({ state, tr, view }) => {
          const found = findSelectedShape(state);
          if (!found) return false;
          const spec = nodeSpec(found.node);
          const attrs: Partial<DocShapeAttrs> = { layer };
          if (layer === 'front' || layer === 'behind') {
            const dom = view.nodeDOM(found.pos) as HTMLElement | null;
            const viewport = (view.dom as HTMLElement).getBoundingClientRect();
            const rect = dom?.getBoundingClientRect();
            const zoomEl = dom?.closest('[data-rte-zoom]');
            const zoom = Number(zoomEl?.getAttribute('data-rte-zoom') ?? 1) || 1;
            attrs.offsetX =
              spec.offsetX ??
              (rect ? Math.max(0, Math.round((rect.left - viewport.left) / zoom)) : 0);
            attrs.offsetY =
              spec.offsetY ??
              (rect ? Math.max(0, Math.round((rect.top - viewport.top) / zoom)) : 0);
          } else {
            attrs.offsetX = null;
            attrs.offsetY = null;
          }
          tr.setNodeMarkup(found.pos, undefined, { ...spec, ...attrs });
          keepShapeSelected(tr, found.pos);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    // Floating shapes (in front of / behind text) are absolutely positioned, so a click does not
    // reliably hit them via the selection system: select on mousedown, then drag the offset.
    return [
      new Plugin({
        key: shapeDragKey,
        props: {
          handleDOMEvents: {
            mousedown(view, domEvent) {
              const event = domEvent as MouseEvent;
              if (event.button !== 0 || event.defaultPrevented) return false;
              const target = event.target as HTMLElement | null;
              const dom = target?.closest?.('.rte-shape-node[data-layer]') as HTMLElement | null;
              if (!dom) return false;
              const pos = view.posAtDOM(dom, 0);
              const node = view.state.doc.nodeAt(pos);
              if (!node || node.type.name !== 'docShape') return false;
              event.preventDefault();
              const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
              tr.setMeta('addToHistory', false);
              view.dispatch(tr);
              dragShapeOffset(view, event, pos, dom);
              return true;
            },
          },
        },
      }),
    ];
  },
});

function nodeSpec(node: PmNode): DocShapeAttrs {
  return shapeSpec(node.attrs as Partial<DocShapeAttrs>);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docShape: {
      /** Insert a preset shape after the current block */
      insertDocShape: (options?: {
        prst?: string;
        width?: number;
        height?: number;
        text?: string;
      }) => ReturnType;
      /** Update attributes of the selected shape */
      updateDocShape: (attrs: Partial<DocShapeAttrs>) => ReturnType;
      /** Delete the selected shape */
      removeDocShape: () => ReturnType;
      /** Move the selected shape between the six anchor modes */
      setDocShapeLayer: (layer: ImageLayer) => ReturnType;
    };
  }
}

/** Exposed for the overlay: does this preset expose adjustment handles? */
export function hasShapeAdjustments(prst: string): boolean {
  return shapeAdjustments(prst).length > 0;
}
