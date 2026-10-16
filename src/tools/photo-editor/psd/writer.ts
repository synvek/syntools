import { downloadBytes } from '@/core/pdf/download';
import { clampRect, intersectRect } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import { meshPadding } from '../core';
import { compositeLayers } from '../render/composite';
import { bakeMask } from '../render/mask';
import { compositeDoc } from '../render/export';
import { buildPsdPlan, type PsdPlanNode } from './map';
import { toPsdEffects } from './styleMap';
import type { Layer, PhotoDoc, Rect } from '../model/types';

/**
 * PSD 写出（只写不读）：让工程能在 Photoshop / Photopea 里继续编辑。
 *
 * - `ag-psd` 通过**动态 import** 载入：它只在这个功能被用到时才下载，
 *   独立成一个异步 chunk，不影响首屏体积；
 * - 图层像素、蒙版、混合模式都复用画布渲染的同一条合成管线，保证「所见即所得」；
 * - 调整图层 / 智能对象 / 文字 / 形状的降级策略见 `./map.ts`。
 */

export function psdFilename(title: string): string {
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .slice(0, 80);
  return `${safe || 'photo'}.psd`;
}

/** 合成某节点需要的像素：裁剪到「源图层并集 ∩ 画布」，避免导出一堆整画布大小的图层 */
function renderNode(
  doc: PhotoDoc,
  node: PsdPlanNode,
): { canvas: HTMLCanvasElement; rect: Rect } | null {
  const layers = doc.layers.filter((layer) => node.sources.includes(layer.id));
  if (layers.length === 0) return null;

  let box: Rect | null = null;
  for (const layer of layers) {
    // 网格变形会把内容甩出图层盒：包围盒必须按最大位移扩张，否则导出结果被裁
    const pad = meshPadding(layer.mesh, layer.width, layer.height);
    const rect = {
      x: layer.x - pad,
      y: layer.y - pad,
      width: layer.width + pad * 2,
      height: layer.height + pad * 2,
    };
    box = box
      ? {
          x: Math.min(box.x, rect.x),
          y: Math.min(box.y, rect.y),
          width: Math.max(box.x + box.width, rect.x + rect.width) - Math.min(box.x, rect.x),
          height: Math.max(box.y + box.height, rect.y + rect.height) - Math.min(box.y, rect.y),
        }
      : rect;
  }
  if (!box) return null;
  const region = intersectRect(clampRect(box, doc), {
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
  });
  if (!region || region.width < 1 || region.height < 1) return null;

  // PSD 的「用户蒙版」是独立通道，像素里不能再带一份，否则会叠加两次。
  // 因此合成像素时摘掉像素蒙版（蒙版本身由 `maskFields` 写成可编辑通道）；
  // 而矢量蒙版 / 图层样式 / 剪贴蒙版在 PSD 里没有对应通道，保持烘焙进像素。
  const paintLayers = layers.map((layer) =>
    layer.mask?.enabled ? ({ ...layer, mask: null } as Layer) : layer,
  );
  const canvas = compositeLayers(doc, paintLayers, {
    clip: region,
    background: 'none',
    signaturePrefix: `psd:${node.id}`,
  });
  return { canvas, rect: region };
}

interface AgLayer {
  name?: string;
  /** 图层效果（`lfx2`）：由 `./styleMap.ts` 从我们的 `LayerStyle` 映射而来 */
  effects?: ReturnType<typeof toPsdEffects>;
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
  blendMode?: string;
  opacity?: number;
  hidden?: boolean;
  canvas?: HTMLCanvasElement;
  children?: AgLayer[];
  opened?: boolean;
  mask?: {
    canvas?: HTMLCanvasElement;
    disabled?: boolean;
    userMaskDensity?: number;
    userMaskFeather?: number;
  };
}

function toAgLayers(doc: PhotoDoc, nodes: PsdPlanNode[]): AgLayer[] {
  const out: AgLayer[] = [];
  for (const node of nodes) {
    if (node.kind === 'group') {
      const children = toAgLayers(doc, node.children ?? []);
      // 空组在 PSD 里没有意义，丢弃
      if (children.length === 0) continue;
      out.push({
        name: node.name || 'Group',
        blendMode: node.blend,
        opacity: Math.round(node.opacity * 255),
        hidden: node.hidden,
        opened: node.opened,
        children,
        ...maskFields(doc, node),
        ...styleFields(doc, node),
      });
      continue;
    }

    const rendered = renderNode(doc, node);
    if (!rendered) continue;
    out.push({
      name: node.name || 'Layer',
      top: Math.round(rendered.rect.y),
      left: Math.round(rendered.rect.x),
      bottom: Math.round(rendered.rect.y + rendered.rect.height),
      right: Math.round(rendered.rect.x + rendered.rect.width),
      blendMode: node.blend,
      opacity: Math.round(node.opacity * 255),
      hidden: node.hidden,
      canvas: rendered.canvas,
      ...maskFields(doc, node),
      ...styleFields(doc, node),
    });
  }
  return out;
}

/**
 * 图层效果：把我们的 `LayerStyle` 写成 PSD 的图层效果（`lfx2`），在 Photoshop 里仍可继续调参。
 *
 * 只有「单一来源」的像素节点才写：合并节点（调整图层折进下方等）的效果已经烘焙进像素，
 * 再写一份会在 PS 里叠加两次。
 */
function styleFields(doc: PhotoDoc, node: PsdPlanNode): Pick<AgLayer, 'effects'> {
  if (node.kind === 'pixel' && node.sources.length !== 1) return {};
  const layer = doc.layers.find((item) => item.id === node.id);
  const effects = toPsdEffects(layer?.style);
  return effects ? { effects } : {};
}

/** 蒙版：用 `bakeMask` 的输出——灰度已转成 alpha，正是 PSD 蒙版通道需要的形式 */
function maskFields(doc: PhotoDoc, node: PsdPlanNode): Pick<AgLayer, 'mask'> {
  const mask = node.mask;
  if (!mask) return {};
  const source = getCanvas(mask.assetId);
  if (!source) return {};
  const baked = bakeMask(
    {
      assetId: mask.assetId,
      rev: 0,
      enabled: true,
      inverted: mask.inverted,
      density: mask.density,
      feather: mask.feather,
    },
    `psd-mask:${mask.assetId}:${mask.density}:${mask.feather}:${mask.inverted ? 1 : 0}`,
  );
  if (!baked) return {};
  // 蒙版画布尺寸对齐图层包围盒（PSD 要求与图层矩形一致）
  const layers = doc.layers.filter((layer) => node.sources.includes(layer.id));
  const first = layers[0];
  const target =
    first && baked.width !== Math.max(1, Math.round(first.width))
      ? scaleCanvas(
          baked,
          Math.max(1, Math.round(first.width)),
          Math.max(1, Math.round(first.height)),
        )
      : baked;
  return {
    mask: {
      canvas: target,
      disabled: false,
      userMaskDensity: Math.round(mask.density * 255),
      userMaskFeather: mask.feather,
    },
  };
}

function scaleCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvasElement(width, height);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** 生成 PSD 字节流（不含下载） */
export async function buildPsdBytes(doc: PhotoDoc): Promise<Uint8Array> {
  const { writePsdUint8Array } = await import('ag-psd');
  const plan = buildPsdPlan(doc);
  const psd = {
    width: doc.width,
    height: doc.height,
    // 合并视图：多数看图软件与缩略图依赖它
    canvas: compositeDoc(doc),
    children: toAgLayers(doc, plan.nodes),
  };
  const bytes = writePsdUint8Array(psd as never);
  return new Uint8Array(bytes);
}

/** 导出并下载 .psd */
export async function exportPsdFile(doc: PhotoDoc, filename: string): Promise<void> {
  const bytes = await buildPsdBytes(doc);
  downloadBytes(bytes, filename, 'image/vnd.adobe.photoshop');
}
