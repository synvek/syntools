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
 * PSD writing (write-only): keeps projects editable in Photoshop / Photopea.
 *
 * - `ag-psd` loads through a **dynamic import**: downloaded only when this feature is used,
 *   as its own async chunk, leaving the first-paint bundle alone;
 * - layer pixels, masks and blend modes reuse the canvas render pipeline, so WYSIWYG holds;
 * - degradation rules for adjustment layers / smart objects / text / shapes live in `./map.ts`.
 */

export function psdFilename(title: string): string {
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .slice(0, 80);
  return `${safe || 'photo'}.psd`;
}

/** Pixels a node needs: crop to "union of source layers ∩ canvas", avoiding full-canvas layers */
function renderNode(
  doc: PhotoDoc,
  node: PsdPlanNode,
): { canvas: HTMLCanvasElement; rect: Rect } | null {
  const layers = doc.layers.filter((layer) => node.sources.includes(layer.id));
  if (layers.length === 0) return null;

  let box: Rect | null = null;
  for (const layer of layers) {
    // Mesh warp throws content outside the layer box: grow the bbox by the max offset, or the export clips
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

  // A PSD "user mask" is a separate channel; pixels must not carry it too, or it would apply twice.
  // So the pixel mask is stripped while compositing (it becomes an editable channel via `maskFields`),
  // while vector masks / layer styles / clipping masks have no PSD channel and stay baked into pixels.
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
  /** Layer effects (`lfx2`): mapped from our `LayerStyle` by `./styleMap.ts` */
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
      // An empty group means nothing in PSD, so drop it
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
 * Layer effects: write our `LayerStyle` as PSD layer effects (`lfx2`), still tunable in Photoshop.
 *
 * Only single-source pixel nodes get them: merged nodes (adjustments folded down etc.) already baked
 * their effects into pixels, and writing them again would double them in PS.
 */
function styleFields(doc: PhotoDoc, node: PsdPlanNode): Pick<AgLayer, 'effects'> {
  if (node.kind === 'pixel' && node.sources.length !== 1) return {};
  const layer = doc.layers.find((item) => item.id === node.id);
  const effects = toPsdEffects(layer?.style);
  return effects ? { effects } : {};
}

/** Mask: use `bakeMask`'s output — grayscale already converted to alpha, exactly what PSD wants */
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
  // The mask canvas matches the layer bbox (PSD requires it to match the layer rect)
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

/** Produce the PSD byte stream (no download) */
export async function buildPsdBytes(doc: PhotoDoc): Promise<Uint8Array> {
  const { writePsdUint8Array } = await import('ag-psd');
  const plan = buildPsdPlan(doc);
  const psd = {
    width: doc.width,
    height: doc.height,
    // The composite view: most viewers and thumbnailers rely on it
    canvas: compositeDoc(doc),
    children: toAgLayers(doc, plan.nodes),
  };
  const bytes = writePsdUint8Array(psd as never);
  return new Uint8Array(bytes);
}

/** Export and download a .psd */
export async function exportPsdFile(doc: PhotoDoc, filename: string): Promise<void> {
  const bytes = await buildPsdBytes(doc);
  downloadBytes(bytes, filename, 'image/vnd.adobe.photoshop');
}
