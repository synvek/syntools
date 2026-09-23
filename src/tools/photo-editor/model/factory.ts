import type { ToolResult } from '@/core/types';
import { CANVAS_PRESETS, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import type {
  Adjustments,
  Layer,
  PhotoDoc,
  RasterLayer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from './types';

/** 文档与图层工厂：只做纯数据构造，不触碰 DOM。 */

let seq = 0;

export function createId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function createAdjustments(): Adjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    exposure: 0,
    sharpen: 0,
  };
}

/** 深拷贝：JSON 往返（jsdom 下 structuredClone 未必可用，与 slide-editor 一致） */
export function cloneDoc(doc: PhotoDoc): PhotoDoc {
  return JSON.parse(JSON.stringify(doc)) as PhotoDoc;
}

export function cloneLayer(layer: Layer, newId = false): Layer {
  const copy = JSON.parse(JSON.stringify(layer)) as Layer;
  if (newId) copy.id = createId(layer.kind);
  return copy;
}

export interface NewDocOptions {
  width: number;
  height: number;
  name?: string;
  background?: PhotoDoc['background'];
}

/** 新建文档：校验尺寸后返回 ToolResult（core.ts 契约：永不抛异常） */
export function createNewDoc(options: NewDocOptions): ToolResult<PhotoDoc> {
  const width = Math.round(options.width);
  const height = Math.round(options.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_CANVAS_SIZE ||
    height < MIN_CANVAS_SIZE ||
    width > MAX_CANVAS_SIZE ||
    height > MAX_CANVAS_SIZE
  ) {
    return {
      ok: false,
      error: 'INVALID_SIZE',
      params: { min: MIN_CANVAS_SIZE, max: MAX_CANVAS_SIZE },
    };
  }
  return {
    ok: true,
    value: {
      id: createId('doc'),
      // 空名称表示「未命名」：由 UI 用当前语言渲染占位名（见 PhotoTool 的 titlePlaceholder）
      name: options.name?.trim() ?? '',
      width,
      height,
      background: options.background ?? 'white',
      layers: [],
      activeLayerId: null,
    },
  };
}

/** 默认画布：16:9 的 1280×720 */
export function createDoc(): PhotoDoc {
  const preset = CANVAS_PRESETS[0];
  const result = createNewDoc({ width: preset.width, height: preset.height });
  return result.ok ? result.value : { ...emptyDoc(), id: createId('doc') };
}

function emptyDoc(): PhotoDoc {
  return {
    id: createId('doc'),
    name: '',
    width: 1280,
    height: 720,
    background: 'white',
    layers: [],
    activeLayerId: null,
  };
}

export function createRasterLayer(input: {
  assetId: string;
  width: number;
  height: number;
  /** 空字符串 = 自动命名（UI 按类型 + 序号展示当前语言的名字） */
  name?: string;
  x?: number;
  y?: number;
}): RasterLayer {
  return {
    id: createId('raster'),
    kind: 'raster',
    name: input.name ?? '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width,
    height: input.height,
    rotation: 0,
    flipX: false,
    flipY: false,
    assetId: input.assetId,
    rev: 1,
    adjustments: createAdjustments(),
    filters: [],
  };
}

export function createTextLayer(input: {
  doc: PhotoDoc;
  text?: string;
  x?: number;
  y?: number;
}): TextLayer {
  const fontSize = Math.max(12, Math.round(Math.min(input.doc.width, input.doc.height) / 12));
  return {
    id: createId('text'),
    kind: 'text',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? Math.round(input.doc.width * 0.1),
    y: input.y ?? Math.round(input.doc.height * 0.4),
    width: Math.round(input.doc.width * 0.8),
    height: Math.round(fontSize * 1.6),
    rotation: 0,
    flipX: false,
    flipY: false,
    // 空文本交给调用方用当前语言填写默认内容（见 store.addTextLayer 的 text 参数）
    text: input.text ?? '',
    fontSize,
    fontFamily: 'PingFang SC',
    fill: '#111827',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.4,
  };
}

export function createShapeLayer(input: {
  doc: PhotoDoc;
  shape: ShapeKind;
  x?: number;
  y?: number;
}): ShapeLayer {
  const size = Math.round(Math.min(input.doc.width, input.doc.height) * 0.3);
  return {
    id: createId('shape'),
    kind: 'shape',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: input.x ?? Math.round(input.doc.width * 0.2),
    y: input.y ?? Math.round(input.doc.height * 0.2),
    width: Math.max(24, size),
    height: Math.max(24, size),
    rotation: 0,
    flipX: false,
    flipY: false,
    shape: input.shape,
    fill: '#2563EB',
    stroke: '#1D4ED8',
    strokeWidth: 0,
    cornerRadius: 12,
  };
}
