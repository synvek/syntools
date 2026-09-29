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

/** 元素 / 文档工厂：所有新建对象都从这里产出，保证字段默认值一致 */

let seq = 0;
export function createId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;

/** 文档结构版本号：与 `model/migrate.ts` 的 `CURRENT_SCHEMA_VERSION` 保持一致 */
export const SCHEMA_VERSION = 2;

/** 页面尺寸预设标识 */
export type PageSizeId = '16:9' | '16:10' | '4:3' | 'a4' | 'custom';

export interface PageSizePreset {
  id: PageSizeId;
  width: number;
  height: number;
}

/** 页面尺寸预设表（px @96dpi） */
export const PAGE_SIZES: Record<PageSizeId, PageSizePreset> = {
  '16:9': { id: '16:9', width: 1280, height: 720 },
  '16:10': { id: '16:10', width: 1280, height: 800 },
  '4:3': { id: '4:3', width: 960, height: 720 },
  a4: { id: 'a4', width: 794, height: 1123 },
  custom: { id: 'custom', width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
};

/** 依据宽高反查预设 id，非标准尺寸返回 custom */
export function resolvePageSizeId(width: number, height: number): PageSizeId {
  for (const preset of Object.values(PAGE_SIZES)) {
    if (preset.id === 'custom') continue;
    if (preset.width === width && preset.height === height) return preset.id;
  }
  return 'custom';
}

/** 默认主题（Office 主题色板的近似默认：蓝/灰） */
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
    version: 1,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** 新建元素默认占位尺寸（位于页面中部） */
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

/** 新建图表元素：默认 3 类别 × 2 系列柱状图 */
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

/** 新建公式元素：默认渲染一个示例公式，便于用户直接改写 */
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

/** 新建图标元素：内置素材库图标 */
export function createIconElement(doc: SlideDoc, iconId: string): IconElement {
  const size = Math.round(Math.min(doc.width, doc.height) * 0.12);
  return {
    id: createId('el'),
    type: 'icon',
    ...centerRect(doc, size, size),
    iconId,
  };
}

/** 页面尺寸（px）→ DrawingML sldSz EMU */
export function slideSizeToEmu(doc: SlideDoc): { cx: number; cy: number } {
  return { cx: pxToEmu(doc.width), cy: pxToEmu(doc.height) };
}

/**
 * 深拷贝：用于 history 快照。
 * 元素均为纯 JSON 数据，走 JSON 复制最为稳妥（jsdom 下 structuredClone 未必可用）；
 * media 的 bytes 是引用共享，避免历史栈把内存翻倍。
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
 * 深拷贝单个元素（复制/粘贴与历史回放使用）。
 *
 * `newId` 为真时**递归**为组合元素的所有后代换新 id —— 否则复制一个 group 后，
 * 副本与原件（以及取消组合后的两个副本）会出现重复 id，导致选中与命中错乱。
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
