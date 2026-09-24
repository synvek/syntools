import { BLEND_MODES, FILTERS, MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import { createAdjustments, createId } from './factory';
import type {
  Adjustments,
  BlendMode,
  FilterId,
  Layer,
  LayerKind,
  MaskRef,
  PhotoDoc,
} from './types';

/**
 * 文档归一 / 迁移：把任意来源（工程文件、草稿、旧版本）的原始对象整理成合法的 `PhotoDoc`。
 *
 * 设计要点：
 * - **只做补全，不做猜测**：字段缺失按类型补默认值，类型不对就丢弃该图层（而不是抛错），
 *   这样单个图层损坏不会让整个文档打不开；
 * - **引用完整性**：`parentId` 指向不存在或非编组的图层时降级为顶层，避免「孤儿子图层永不渲染」；
 * - v1（无编组 / 蒙版 / 调整图层）可直接迁移为 v2：新字段全部补默认值，行为零变化。
 */

const KINDS: LayerKind[] = ['raster', 'text', 'shape', 'group', 'adjustment', 'smart'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function clampSize(value: number): number {
  return Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)));
}

function normalizeBlend(value: unknown): BlendMode {
  return BLEND_MODES.includes(value as BlendMode) ? (value as BlendMode) : 'normal';
}

function normalizeAdjustments(value: unknown): Adjustments {
  const base = createAdjustments();
  if (!isObject(value)) return base;
  for (const key of Object.keys(base) as (keyof Adjustments)[]) {
    base[key] = num(value[key], base[key]);
  }
  return base;
}

function normalizeFilters(value: unknown): FilterId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FilterId => FILTERS.includes(item as FilterId));
}

function normalizeMask(value: unknown): MaskRef | null {
  if (!isObject(value)) return null;
  const assetId = str(value.assetId);
  if (!assetId) return null;
  return {
    assetId,
    rev: Math.max(1, Math.round(num(value.rev, 1))),
    enabled: bool(value.enabled, true),
    inverted: bool(value.inverted, false),
    density: Math.min(1, Math.max(0, num(value.density, 1))),
    feather: Math.max(0, num(value.feather, 0)),
  };
}

function normalizeLayer(raw: unknown): Layer | null {
  if (!isObject(raw)) return null;
  const kind = raw.kind as LayerKind;
  if (!KINDS.includes(kind)) return null;

  const base = {
    id: str(raw.id) || createId(kind),
    name: str(raw.name),
    visible: bool(raw.visible, true),
    locked: bool(raw.locked, false),
    opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
    blend: normalizeBlend(raw.blend),
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: Math.max(1, num(raw.width, 1)),
    height: Math.max(1, num(raw.height, 1)),
    rotation: num(raw.rotation, 0),
    flipX: bool(raw.flipX, false),
    flipY: bool(raw.flipY, false),
    parentId: typeof raw.parentId === 'string' && raw.parentId ? raw.parentId : null,
    expanded: bool(raw.expanded, true),
    mask: normalizeMask(raw.mask),
  };

  switch (kind) {
    case 'raster':
      return {
        ...base,
        kind,
        assetId: str(raw.assetId),
        rev: Math.max(1, Math.round(num(raw.rev, 1))),
        adjustments: normalizeAdjustments(raw.adjustments),
        filters: normalizeFilters(raw.filters),
      };
    case 'smart':
      return {
        ...base,
        kind,
        sourceAssetId: str(raw.sourceAssetId),
        sourceWidth: Math.max(1, Math.round(num(raw.sourceWidth, 1))),
        sourceHeight: Math.max(1, Math.round(num(raw.sourceHeight, 1))),
      };
    case 'adjustment':
      return {
        ...base,
        kind,
        adjustments: normalizeAdjustments(raw.adjustments),
        filters: normalizeFilters(raw.filters),
      };
    case 'group':
      return { ...base, kind, passThrough: bool(raw.passThrough, true) };
    case 'text':
      return {
        ...base,
        kind,
        text: str(raw.text),
        fontSize: Math.max(1, num(raw.fontSize, 24)),
        fontFamily: str(raw.fontFamily, 'PingFang SC'),
        fill: str(raw.fill, '#111827'),
        bold: bool(raw.bold, false),
        italic: bool(raw.italic, false),
        underline: bool(raw.underline, false),
        align: (['left', 'center', 'right'] as const).includes(raw.align as never)
          ? (raw.align as 'left' | 'center' | 'right')
          : 'left',
        lineHeight: Math.max(1, num(raw.lineHeight, 1.4)),
      };
    default:
      return {
        ...base,
        kind: 'shape',
        shape: (['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'star'] as const).includes(
          raw.shape as never,
        )
          ? (raw.shape as 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'star')
          : 'rect',
        fill: str(raw.fill, '#2563EB'),
        stroke: str(raw.stroke, '#1D4ED8'),
        strokeWidth: Math.max(0, num(raw.strokeWidth, 0)),
        cornerRadius: Math.max(0, num(raw.cornerRadius, 12)),
      };
  }
}

/**
 * 归一（含 v1 → v2）：返回 null 表示结构不可用（调用方按空文档处理）。
 *
 * 引用完整性处理放在最后：先把全部图层解析出来，再清掉「指向不存在 / 非编组」的 parentId，
 * 并打断环（父链自指会让后续遍历死循环）。
 */
export function migrateDoc(raw: unknown): PhotoDoc | null {
  if (!isObject(raw)) return null;
  if (!Array.isArray(raw.layers)) return null;
  if (typeof raw.width !== 'number' || typeof raw.height !== 'number') return null;

  const layers: Layer[] = [];
  for (const item of raw.layers) {
    const layer = normalizeLayer(item);
    if (layer) layers.push(layer);
  }

  const groupIds = new Set(
    layers.filter((layer) => layer.kind === 'group').map((layer) => layer.id),
  );
  for (const layer of layers) {
    if (!layer.parentId) continue;
    // 父级不存在、不是编组、或指向自己 → 降级为顶层
    if (!groupIds.has(layer.parentId) || layer.parentId === layer.id) layer.parentId = null;
  }
  // 打断环：若某编组的祖先链能绕回自己，把它降级为顶层
  const byId = new Map(layers.map((layer) => [layer.id, layer] as const));
  for (const layer of layers) {
    const seen = new Set<string>([layer.id]);
    let cursor = layer.parentId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    if (cursor) layer.parentId = null;
  }

  const activeLayerId = str(raw.activeLayerId);
  return {
    id: str(raw.id) || createId('doc'),
    name: str(raw.name),
    width: clampSize(raw.width),
    height: clampSize(raw.height),
    background: (['transparent', 'white', 'black'] as const).includes(raw.background as never)
      ? (raw.background as PhotoDoc['background'])
      : 'white',
    layers,
    activeLayerId:
      activeLayerId && layers.some((layer) => layer.id === activeLayerId) ? activeLayerId : null,
  };
}
