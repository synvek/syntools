import { downloadBytes } from '@/core/pdf/download';
import { clampRect, intersectRect } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import { compositeLayers } from '../render/composite';
import { bakeMask } from '../render/mask';
import { compositeDoc } from '../render/export';
import { buildPsdPlan, type PsdPlanNode } from './map';
import type { PhotoDoc, Rect } from '../model/types';

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
    const rect = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
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

  const canvas = compositeLayers(doc, layers, {
    clip: region,
    background: 'none',
    signaturePrefix: `psd:${node.id}`,
  });
  return { canvas, rect: region };
}

interface AgLayer {
  name?: string;
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
    });
  }
  return out;
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
