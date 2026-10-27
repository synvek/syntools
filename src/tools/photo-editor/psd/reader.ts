import type { ToolResult } from '@/core/types';
import { checkPsdFile } from '../core';
import { createRasterLayer, createTextLayer } from '../model/factory';
import { registerCanvas } from '../model/assets';
import { createId } from '../model/factory';
import { mapPsdBounds, mapPsdBlendMode, mapPsdEffects, type PsdEffects } from './importMap';
import type { BlendMode, GroupLayer, Layer, MaskRef, PhotoDoc, TextLayer } from '../model/types';

/**
 * PSD reading: turn Photoshop / Photopea files back into an editable document.
 *
 * Symmetric with writing (`./writer.ts`): also a **dynamic import of `ag-psd`**, fetched only on import.
 *
 * Fidelity boundaries (no half-baked support on purpose):
 * - **pixel layers / groups / masks / blend modes / opacity / visibility**: read in full;
 * - **layer effects**: only the five we can render (shadow / inner shadow / outer glow / overlay / stroke);
 * - **text**: restored as **re-editable text layers** from the PSD attributes (warp / paragraph details
 *   don't map exactly, see below); **adjustment layers / smart objects** become raster pixels (read when
 *   present, skipped when not) and count as degraded; **layer order** matches writing (bottom-up children).
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
  /** Names of layers degraded to bitmaps (adjustment layers / smart objects / shapes) */
  rasterized: string[];
  /** Names of layers skipped entirely (no pixels and not restorable) */
  skipped: string[];
}

export interface PsdImportResult {
  doc: PhotoDoc;
  report: PsdImportReport;
}

/** Extract the family from a font name (PSD often appends "Family-Bold" / "Family,Bold") */
function fontFamilyOf(name: string | undefined): string {
  if (!name) return 'Helvetica';
  const cut = name.split(/[-,_]/)[0];
  return cut.trim() || 'Helvetica';
}

/** Approximate the rotation angle (degrees) from the PSD text's affine matrix */
function rotationOf(transform: number[] | undefined): number {
  if (!transform || transform.length < 4) return 0;
  // In a 2×3 / 3×3 matrix the [a, b] column is the x axis
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
    // The PSD text box width comes from the transform; fall back to a usable default the user can drag
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

/** One PSD layer → our layer (groups convert themselves; children are expanded by `flattenPsdLayers`) */
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
    // A group has no pixels; its size is derived from the children during sync
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
    // Smart objects and adjustment layers have no equivalent here, so they become bitmaps, counted as degraded
    if (layer.placedLayer) report.rasterized.push(name);
    return { ...raster, ...base, mask: maskOf(layer) } as Layer;
  }
  report.skipped.push(name);
  return null;
}

/** Flatten a PSD layer tree bottom-up into a flat array (matching our `layers` array) */
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
      // The group's children follow right after it (our flat-array convention)
      out.push(...flattenPsdLayers(layer.children, report, context, converted.id));
      continue;
    }
    const converted = convertLayer(layer, report, parentId, context);
    if (converted) out.push(converted);
  }
  return out;
}

/**
 * Read a PSD file into a document.
 *
 * `ag-psd` decodes layer pixels into canvases, so nothing is cropped a second time here —
 * `layer.canvas` already holds the layer's own pixels, and `left/top` is its position on the canvas.
 */
export async function loadPsdFile(file: File): Promise<ToolResult<PsdImportResult>> {
  const check = checkPsdFile(file);
  if (!check.ok) return check;
  try {
    const { readPsd } = await import('ag-psd');
    const buffer = await file.arrayBuffer();
    const psd = readPsd(buffer, {
      // Decode uncompressed raw pixels only: we need real layers, not view-friendly thumbnails
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
      // PSD has no "canvas background", so keep it transparent instead of flattening onto white
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

/** PSD file-name test (symmetric with writing: only .psd) */
export function isPsdFile(name: string): boolean {
  return /\.psd$/i.test(name.trim());
}
