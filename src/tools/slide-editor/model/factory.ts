import { pxToEmu } from '../core';
import type {
  ChartElement,
  ChartType,
  Fill,
  FormulaElement,
  IconElement,
  MediaAsset,
  Paragraph,
  ShapeGeometry,
  Slide,
  SlideDoc,
  SlideElement,
  SlideLayout,
  SlideMaster,
  SlideTheme,
  Stroke,
  TableCell,
  TableElement,
  TextBody,
  TextRun,
} from './types';

/** Element / document factories: every new object comes from here so defaults stay consistent */

let seq = 0;
export function createId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;

/** Document schema version: kept in sync with `CURRENT_SCHEMA_VERSION` in `model/migrate.ts` */
export const SCHEMA_VERSION = 3;

/** Page size preset id */
export type PageSizeId = '16:9' | '16:10' | '4:3' | 'a4' | 'custom';

export interface PageSizePreset {
  id: PageSizeId;
  width: number;
  height: number;
}

/** Page size preset table (px @96dpi) */
export const PAGE_SIZES: Record<PageSizeId, PageSizePreset> = {
  '16:9': { id: '16:9', width: 1280, height: 720 },
  '16:10': { id: '16:10', width: 1280, height: 800 },
  '4:3': { id: '4:3', width: 960, height: 720 },
  a4: { id: 'a4', width: 794, height: 1123 },
  custom: { id: 'custom', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
};

/** Look up the preset id from width/height; non-standard sizes return custom */
export function resolvePageSizeId(width: number, height: number): PageSizeId {
  for (const preset of Object.values(PAGE_SIZES)) {
    if (preset.id === 'custom') continue;
    if (preset.width === width && preset.height === height) return preset.id;
  }
  return 'custom';
}

/** Default theme (approximation of the Office palette: blue/gray) */
export function createDefaultTheme(): SlideTheme {
  return {
    name: 'Office',
    colors: {
      dk1: '#000000',
      lt1: '#FFFFFF',
      dk2: '#44546A',
      lt2: '#E7E6E6',
      accent1: '#4472C4',
      accent2: '#ED7D31',
      accent3: '#A5A5A5',
      accent4: '#FFC000',
      accent5: '#5B9BD5',
      accent6: '#70AD47',
      hlink: '#0563C1',
      folHlink: '#954F72',
      phClr: '#000000',
    },
    majorFont: { latin: '+mj-lt', ea: '+mj-ea', cs: '+mj-cs' },
    minorFont: { latin: '+mn-lt', ea: '+mn-ea', cs: '+mn-cs' },
  };
}

export function createParagraph(text = '', style?: TextRun['style']): Paragraph {
  return { runs: [{ text, style }] };
}

export function createTextBody(text = '', size = 18): TextBody {
  return {
    paragraphs: [createParagraph(text, { size })],
    anchor: 'top',
    wrap: true,
    autoFit: 'none',
    margins: { left: 9, top: 5, right: 9, bottom: 5 },
  };
}

export function createStroke(overrides: Partial<Stroke> = {}): Stroke {
  return { color: '#000000', width: 1, ...overrides };
}

export function createSolidFill(color: string, alpha?: number): Fill {
  return alpha === undefined ? { type: 'solid', color } : { type: 'solid', color, alpha };
}

export function rectGeometry(): ShapeGeometry {
  return { kind: 'rect', prst: 'rect' };
}

/** Shape presets shared by the toolbar dropdown and the Insert menu so the two cannot drift apart */
export const SHAPE_PRESETS: { key: string; geom: ShapeGeometry }[] = [
  { key: 'shapeRect', geom: { kind: 'rect', prst: 'rect' } },
  { key: 'shapeRoundRect', geom: { kind: 'rect', radius: 0.167, prst: 'roundRect' } },
  { key: 'shapeEllipse', geom: { kind: 'ellipse', prst: 'ellipse' } },
  {
    key: 'shapeTriangle',
    geom: { kind: 'polygon', points: [0.5, 0, 1, 1, 0, 1], prst: 'triangle' },
  },
  { key: 'shapeStar', geom: { kind: 'star', innerRatio: 0.382, prst: 'star' } },
  {
    key: 'shapeArrow',
    geom: {
      kind: 'polygon',
      points: [0, 0.25, 0.6, 0.25, 0.6, 0, 1, 0.5, 0.6, 1, 0.6, 0.75, 0, 0.75],
      prst: 'rightArrow',
    },
  },
];

export function createLayout(name = 'Blank'): SlideLayout {
  return {
    id: createId('layout'),
    masterId: '',
    name,
    elements: [],
  };
}

export function createMaster(): SlideMaster {
  return {
    id: createId('master'),
    name: 'Office Theme',
    elements: [],
  };
}

export function createSlide(layoutId?: string): Slide {
  return { id: createId('slide'), layoutId, elements: [] };
}

export function createDoc(name = 'presentation', sizeId: PageSizeId = '16:9'): SlideDoc {
  const master = createMaster();
  const layout = createLayout();
  layout.masterId = master.id;
  const preset = PAGE_SIZES[sizeId] ?? PAGE_SIZES['16:9'];
  return {
    id: createId('doc'),
    name,
    width: preset.width,
    height: preset.height,
    theme: createDefaultTheme(),
    masters: [master],
    layouts: [layout],
    slides: [createSlide(layout.id)],
    media: {},
    comments: [],
    version: 1,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Default placeholder size for a new element (centered on the page) */
function centerRect(doc: SlideDoc, width: number, height: number) {
  return {
    x: Math.round((doc.width - width) / 2),
    y: Math.round((doc.height - height) / 2),
    width,
    height,
  };
}

export function createTextElement(doc: SlideDoc, text = ''): SlideElement {
  return {
    id: createId('el'),
    type: 'text',
    ...centerRect(doc, 480, 96),
    body: createTextBody(text || '', 24),
  };
}

export function createShapeElement(doc: SlideDoc, geom: ShapeGeometry): SlideElement {
  return {
    id: createId('el'),
    type: 'shape',
    ...centerRect(doc, 240, 160),
    geom,
    fill: createSolidFill('#4472C4'),
    stroke: createStroke({ color: '#2F5597', width: 2 }),
  };
}

export function createImageElement(doc: SlideDoc, media: MediaAsset): SlideElement {
  const maxWidth = doc.width * 0.7;
  const maxHeight = doc.height * 0.7;
  const ratio = Math.min(maxWidth / media.width, maxHeight / media.height, 1);
  const width = Math.round(media.width * ratio) || 240;
  const height = Math.round(media.height * ratio) || 160;
  return {
    id: createId('el'),
    type: 'image',
    ...centerRect(doc, width, height),
    mediaId: media.id,
  };
}

export function createLineElement(doc: SlideDoc): SlideElement {
  return {
    id: createId('el'),
    type: 'line',
    x: Math.round(doc.width * 0.2),
    y: Math.round(doc.height * 0.5),
    width: 320,
    height: 0,
    points: [0, 0, 320, 0],
    stroke: createStroke({ color: '#000000', width: 2 }),
  };
}

function emptyCell(): TableCell {
  return { text: '', align: 'left', valign: 'middle' };
}

export function createTableElement(doc: SlideDoc, rows = 3, cols = 3): TableElement {
  const width = Math.min(720, Math.round(doc.width * 0.6));
  const height = Math.min(360, Math.round(doc.height * 0.5));
  return {
    id: createId('el'),
    type: 'table',
    ...centerRect(doc, width, height),
    rows: Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell)),
    colWidths: Array.from({ length: cols }, () => Math.round(width / cols)),
    rowHeights: Array.from({ length: rows }, () => Math.round(height / rows)),
    headerRow: true,
    borderColor: '#BFBFBF',
  };
}

/** New chart element: a 3-category × 2-series bar chart by default */
export function createChartElement(
  doc: SlideDoc,
  chartType: ChartType = 'bar',
  palette?: string[],
): ChartElement {
  return {
    id: createId('el'),
    type: 'chart',
    ...centerRect(doc, Math.round(doc.width * 0.56), Math.round(doc.height * 0.5)),
    chartType,
    categories: ['A', 'B', 'C'],
    series: [
      { name: 'Series 1', values: [32, 45, 28] },
      { name: 'Series 2', values: [21, 38, 52] },
    ],
    options: { legend: true, dataLabels: false, gridLines: true, palette },
    title: '',
    revision: 1,
  };
}

/** New formula element: renders a sample formula by default so users can edit it right away */
export function createFormulaElement(doc: SlideDoc, latex = 'E = mc^2'): FormulaElement {
  const height = 80;
  const width = Math.round(doc.width * 0.35);
  return {
    id: createId('el'),
    type: 'formula',
    ...centerRect(doc, width, height),
    latex,
    fontSize: 32,
    color: '#111827',
  };
}

/** New icon element: an icon from the built-in library */
export function createIconElement(doc: SlideDoc, iconId: string): IconElement {
  const size = Math.round(Math.min(doc.width, doc.height) * 0.12);
  return {
    id: createId('el'),
    type: 'icon',
    ...centerRect(doc, size, size),
    iconId,
  };
}

/** Page size (px) → DrawingML sldSz EMU */
export function slideSizeToEmu(doc: SlideDoc): { cx: number; cy: number } {
  return { cx: pxToEmu(doc.width), cy: pxToEmu(doc.height) };
}

/**
 * Deep clone, used for history snapshots.
 * Elements are plain JSON data, so a JSON copy is the safest route (structuredClone isn't guaranteed in jsdom);
 * media bytes are shared by reference so the history stack doesn't double memory use.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneDoc(doc: SlideDoc): SlideDoc {
  return {
    ...doc,
    theme: { ...doc.theme, colors: { ...doc.theme.colors } },
    masters: doc.masters.map((m) => ({ ...m, elements: deepClone(m.elements) })),
    layouts: doc.layouts.map((l) => ({ ...l, elements: deepClone(l.elements) })),
    slides: doc.slides.map((s) => ({ ...s, elements: deepClone(s.elements) })),
    media: Object.fromEntries(
      Object.entries(doc.media).map(([id, asset]) => [id, { ...asset, bytes: asset.bytes }]),
    ),
  };
}

/**
 * Deep-clone a single element (used by copy/paste and history replay).
 *
 * When `newId` is true, **recursively** give every descendant of a group a new id — otherwise copying a
 * group, or ungrouping the two copies, would produce duplicate ids and break selection and hit testing.
 */
export function cloneElement<T extends SlideElement>(element: T, newId = false): T {
  const copy = deepClone(element);
  if (newId) {
    copy.id = createId('el');
    if (copy.type === 'group') {
      copy.children = copy.children.map((child) => cloneElement(child, true));
    }
  }
  return copy;
}
