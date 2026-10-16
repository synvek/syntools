import type { ToolResult } from '@/core/types';
import { checkPsdFile } from '../core';
import { createRasterLayer, createTextLayer } from '../model/factory';
import { registerCanvas } from '../model/assets';
import { createId } from '../model/factory';
import { mapPsdBounds, mapPsdBlendMode, mapPsdEffects, type PsdEffects } from './importMap';
import type { BlendMode, GroupLayer, Layer, MaskRef, PhotoDoc, TextLayer } from '../model/types';

/**
 * PSD 读入：把 Photoshop / Photopea 的文件还原成可继续编辑的文档。
 *
 * 与写出（`./writer.ts`）对称：同样**动态 import `ag-psd`**，只在真正导入时下载。
 *
 * 保真边界（刻意不做半成品）：
 * - **像素图层 / 组 / 蒙版 / 混合模式 / 不透明度 / 隐藏**：完整读取；
 * - **图层效果**：只读我们渲染得出的五种（投影 / 内阴影 / 外发光 / 颜色叠加 / 描边），其余静默忽略；
 * - **文字**：按 PSD 的文字属性还原为**可再编辑的文字图层**（PSD 的变形 / 段落细节无法完全等价，见下）；
 * - **调整图层 / 智能对象**：还原为栅格像素（有像素就读，没像素就跳过），并计入降级统计；
 * - **图层顺序**：与写出同序（PSD 的 children 即自下而上的层栈顺序，与我们的 `layers` 数组一致）。
 */

interface PsdLikeLayer {
  name?: string;
  canvas?: HTMLCanvasElement;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  opacity?: number;
  hidden?: boolean;
  blendMode?: string;
  clipping?: boolean;
  opened?: boolean;
  children?: PsdLikeLayer[];
  mask?: {
    canvas?: HTMLCanvasElement;
    disabled?: boolean;
    invert?: boolean;
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  effects?: PsdEffects;
  text?: {
    text?: string;
    transform?: number[];
    style?: {
      font?: { name?: string };
      fontSize?: number;
      fillColor?: { r: number; g: number; b: number };
    };
    styleRuns?: {
      style?: {
        font?: { name?: string };
        fontSize?: number;
        fillColor?: { r: number; g: number; b: number };
      };
    }[];
  };
  placedLayer?: { id?: string };
}

interface PsdLike {
  width?: number;
  height?: number;
  children?: PsdLikeLayer[];
}

export interface PsdImportReport {
  /** 被降级成位图的图层名（调整图层 / 智能对象 / 形状） */
  rasterized: string[];
  /** 完全跳过的图层名（既无像素又无法还原） */
  skipped: string[];
}

export interface PsdImportResult {
  doc: PhotoDoc;
  report: PsdImportReport;
}

/** 从字体名里取族名（PSD 常带 "Family-Bold" / "Family,Bold" 这类后缀） */
function fontFamilyOf(name: string | undefined): string {
  if (!name) return 'Helvetica';
  const cut = name.split(/[-,_]/)[0];
  return cut.trim() || 'Helvetica';
}

/** 从 PSD 文本的仿射矩阵近似还原旋转角（度） */
function rotationOf(transform: number[] | undefined): number {
  if (!transform || transform.length < 4) return 0;
  // 2×3/3×3 矩阵的 [a, b] 列即 x 轴方向
  const a = transform[0];
  const b = transform[1];
  if (!Number.isFinite(a) || !Number.isFinite(b) || (a === 0 && b === 0)) return 0;
  return Math.round(((Math.atan2(b, a) * 180) / Math.PI) * 100) / 100;
}

function maskOf(layer: PsdLikeLayer): MaskRef | null {
  const canvas = layer.mask?.canvas;
  if (!canvas || layer.mask?.disabled) return null;
  return {
    assetId: registerCanvas(canvas),
    rev: 0,
    enabled: true,
    inverted: Boolean(layer.mask?.invert),
    density: 1,
    feather: 0,
  };
}

function textOf(
  layer: PsdLikeLayer,
  context: { width: number; height: number },
  bounds: { x: number; y: number; width: number },
): TextLayer | null {
  const text = layer.text?.text;
  if (!text) return null;
  const run = layer.text?.styleRuns?.[0]?.style ?? layer.text?.style;
  const fontSize = Math.max(4, Math.round(run?.fontSize ?? 24));
  const { x, y, width } = bounds;
  const base = createTextLayer({
    doc: { width: context.width, height: context.height } as PhotoDoc,
    text,
    x,
    y,
  });
  const fill = run?.fillColor;
  return {
    ...base,
    x,
    y,
    // PSD 的文字块宽度由变换决定；取不到时给一个够用的默认宽，用户可再拖
    width: Math.max(16, Math.round(width)),
    text,
    fontSize,
    fontFamily: fontFamilyOf(run?.font?.name),
    fill: fill
      ? `#${[fill.r, fill.g, fill.b]
          .map((channel) =>
            Math.max(0, Math.min(255, Math.round(channel)))
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
          .toUpperCase()}`
      : base.fill,
    rotation: rotationOf(layer.text?.transform),
    bold: /bold/i.test(run?.font?.name ?? ''),
    italic: /italic|oblique/i.test(run?.font?.name ?? ''),
  };
}

/** 单个 PSD 图层 → 我们的图层（组只转换自身，子层由 `flattenPsdLayers` 紧随其后展开） */
function convertLayer(
  layer: PsdLikeLayer,
  report: PsdImportReport,
  parentId: string | null,
  context: { width: number; height: number },
): Layer | null {
  const name = layer.name ?? '';
  const base = {
    blend: mapPsdBlendMode(layer.blendMode),
    opacity: Math.max(0, Math.min(1, (layer.opacity ?? 255) / 255)),
    visible: !layer.hidden,
    clipped: Boolean(layer.clipping),
    style: mapPsdEffects(layer.effects),
    parentId,
  } satisfies Partial<Layer>;

  if (layer.children && layer.children.length > 0) {
    const id = createId('group');
    const group: GroupLayer = {
      id,
      kind: 'group',
      name,
      visible: base.visible,
      locked: false,
      opacity: base.opacity,
      blend: base.blend as BlendMode,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      flipX: false,
      flipY: false,
      passThrough: (layer.blendMode ?? '').toLowerCase().startsWith('pass'),
      expanded: layer.opened ?? true,
      parentId,
    };
    // 组自身不带像素，尺寸由子层在 sync 时推导
    return group;
  }

  const bounds = mapPsdBounds(layer);
  const canvas = layer.canvas;
  if (canvas && bounds) {
    const text = textOf(layer, context, bounds);
    if (text) {
      return { ...text, ...base, parentId } as Layer;
    }
    const raster = createRasterLayer({
      assetId: registerCanvas(canvas),
      width: bounds.width,
      height: bounds.height,
      name,
      x: bounds.x,
      y: bounds.y,
    });
    // 智能对象与调整图层在我们模型里没有对应表达，落成位图后计入降级统计
    if (layer.placedLayer) report.rasterized.push(name);
    return { ...raster, ...base, mask: maskOf(layer) } as Layer;
  }
  report.skipped.push(name);
  return null;
}

/** 把一个 PSD 图层树按「自下而上」展开成扁平数组（与我们的 `layers` 数组一致） */
export function flattenPsdLayers(
  layers: PsdLikeLayer[] | undefined,
  report: PsdImportReport,
  context: { width: number; height: number },
  parentId: string | null = null,
): Layer[] {
  const out: Layer[] = [];
  for (const layer of layers ?? []) {
    if (layer.children && layer.children.length > 0) {
      const converted = convertLayer(layer, report, parentId, context) as GroupLayer | null;
      if (!converted) continue;
      out.push(converted);
      // 组内子层紧随其后（我们的扁平数组约定）
      out.push(...flattenPsdLayers(layer.children, report, context, converted.id));
      continue;
    }
    const converted = convertLayer(layer, report, parentId, context);
    if (converted) out.push(converted);
  }
  return out;
}

/**
 * 读取 PSD 文件为文档。
 *
 * `ag-psd` 会就地解码图层像素（返回 canvas），因此这里不再做二次裁剪 ——
 * `layer.canvas` 已经是该图层自己的像素，`left/top` 是它在画布中的位置。
 */
export async function loadPsdFile(file: File): Promise<ToolResult<PsdImportResult>> {
  const check = checkPsdFile(file);
  if (!check.ok) return check;
  try {
    const { readPsd } = await import('ag-psd');
    const buffer = await file.arrayBuffer();
    const psd = readPsd(buffer, {
      // 只解码不压缩的原始像素：我们需要真实图层，而不是便于查看的缩略图
      skipLayerImageData: false,
      skipCompositeImageData: true,
      skipThumbnail: true,
    }) as PsdLike;

    const width = Math.max(1, Math.round(psd.width ?? 0));
    const height = Math.max(1, Math.round(psd.height ?? 0));
    if (!psd.children || psd.children.length === 0) {
      return { ok: false, error: 'INVALID_PSD' };
    }
    const report: PsdImportReport = { rasterized: [], skipped: [] };
    const layers = flattenPsdLayers(psd.children, report, { width, height });
    if (layers.length === 0) return { ok: false, error: 'INVALID_PSD' };

    const doc: PhotoDoc = {
      id: createId('doc'),
      name: file.name.replace(/\.[^.]+$/, ''),
      width,
      height,
      // PSD 默认没有「画布底色」概念，保留透明底以免把导入图压成白底
      background: 'transparent',
      layers,
      activeLayerId: layers[layers.length - 1]?.id ?? null,
      swatches: [],
    };
    return { ok: true, value: { doc, report } };
  } catch {
    return { ok: false, error: 'INVALID_PSD' };
  }
}

/** PSD 文件名判定（读入口径与写出对称，只认 .psd） */
export function isPsdFile(name: string): boolean {
  return /\.psd$/i.test(name.trim());
}
