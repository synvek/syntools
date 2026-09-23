import { pointInSelection, traceSelection } from '../core';
import { getCanvas } from '../model/assets';
import type { RasterLayer, Rect, Selection } from '../model/types';

/**
 * 落笔：直接改写图层位图的 2D 上下文。
 *
 * 选择这条路径而不是「每笔一个 Konva 节点」，是为了避免长笔画把节点数撑爆；
 * 一次笔画只产生一次 `rev` 自增（触发烘焙缓存失效），撤销粒度 = 一次笔画。
 */

export interface StrokeOptions {
  color: string;
  /** 文档坐标下的笔刷直径 */
  size: number;
  /** 0~1：1 为硬边，越小边缘越柔 */
  hardness: number;
  /** 0~1 */
  opacity: number;
  mode: 'brush' | 'eraser';
  selection: Selection | null;
}

export interface StrokeSession {
  move: (x: number, y: number) => void;
  end: () => void;
}

/** 文档坐标 → 资产像素坐标的缩放比 */
function assetScale(layer: RasterLayer): { sx: number; sy: number } | null {
  const asset = getCanvas(layer.assetId);
  if (!asset) return null;
  return {
    sx: asset.width / Math.max(1, layer.width),
    sy: asset.height / Math.max(1, layer.height),
  };
}

/**
 * 把当前上下文裁剪到选区（调用前上下文必须已经被平移到「文档坐标」）。
 * 一律用 even-odd：反选产生的「外框 + 内洞」两条轮廓才能正确挖空。
 */
function clipToSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  traceSelection(ctx, selection);
  ctx.clip('evenodd');
}

export function createStrokeSession(
  layer: RasterLayer,
  options: StrokeOptions,
): StrokeSession | null {
  const asset = getCanvas(layer.assetId);
  const scale = assetScale(layer);
  if (!asset || !scale) return null;
  const ctx = asset.getContext('2d');
  if (!ctx) return null;

  const sx = scale.sx;
  const sy = scale.sy;
  ctx.save();
  // 统一在「文档坐标」下作画：先放大回图层尺寸，再把图层原点平移到文档原点
  ctx.scale(sx, sy);
  ctx.translate(-layer.x, -layer.y);
  if (options.selection) clipToSelection(ctx, options.selection);
  ctx.globalCompositeOperation = options.mode === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = options.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = options.size;
  ctx.strokeStyle = options.color;
  ctx.fillStyle = options.color;
  if (options.hardness < 1) {
    ctx.shadowColor = options.mode === 'eraser' ? 'rgba(0,0,0,1)' : options.color;
    ctx.shadowBlur = options.size * (1 - options.hardness) * 0.6;
  }

  let last: { x: number; y: number } | null = null;

  return {
    move: (x, y) => {
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        // 单击（未拖动）也要留下一个点
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, options.size / 2), 0, Math.PI * 2);
        ctx.fill();
      }
      last = { x, y };
    },
    end: () => {
      ctx.restore();
      last = null;
    },
  };
}

/**
 * 选区内的整块填充 / 清除（右键菜单「填充选区」「清除选区内容」）。
 * fill：以前景色覆盖；clear：destination-out 擦成透明。
 */
export function paintSelection(
  layer: RasterLayer,
  selection: Selection,
  mode: 'fill' | 'clear',
  color: string,
): boolean {
  const asset = getCanvas(layer.assetId);
  const scale = assetScale(layer);
  if (!asset || !scale) return false;
  const ctx = asset.getContext('2d');
  if (!ctx) return false;

  ctx.save();
  ctx.scale(scale.sx, scale.sy);
  ctx.translate(-layer.x, -layer.y);
  clipToSelection(ctx, selection);
  ctx.globalCompositeOperation = mode === 'clear' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
  return true;
}

/** 选区遮罩：把非选区部分涂成透明（反选的洞也按 even-odd 处理） */
export function maskToSelection(
  canvas: HTMLCanvasElement,
  selection: Selection,
  region: Rect,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(-region.x, -region.y);
  traceSelection(ctx, selection);
  ctx.fill('evenodd');
  ctx.restore();
}

/** 油漆桶：从落点开始做扫描线漫水填充（容差内同色连通区域） */
export function floodFill(
  layer: RasterLayer,
  docX: number,
  docY: number,
  color: string,
  tolerance: number,
  selection: Selection | null,
): boolean {
  const asset = getCanvas(layer.assetId);
  if (!asset) return false;
  const ctx = asset.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const scale = assetScale(layer);
  if (!scale) return false;
  const px = Math.floor((docX - layer.x) * scale.sx);
  const py = Math.floor((docY - layer.y) * scale.sy);
  if (px < 0 || py < 0 || px >= asset.width || py >= asset.height) return false;

  const frame = ctx.getImageData(0, 0, asset.width, asset.height);
  const data = frame.data;
  const start = (py * asset.width + px) * 4;
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const fill = hexToRgba(color);
  if (
    Math.abs(target[0] - fill[0]) <= tolerance &&
    Math.abs(target[1] - fill[1]) <= tolerance &&
    Math.abs(target[2] - fill[2]) <= tolerance &&
    Math.abs(target[3] - fill[3]) <= tolerance &&
    fill[3] === target[3]
  ) {
    return false;
  }

  const visited = new Uint8Array(asset.width * asset.height);
  const stack: number[] = [px, py];
  const tol = tolerance;
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (y < 0 || y >= asset.height) continue;
    let left = x;
    while (
      left >= 0 &&
      matches(data, left, y, asset.width, target, tol) &&
      !visited[y * asset.width + left]
    ) {
      left -= 1;
    }
    left += 1;
    let right = x;
    while (
      right < asset.width &&
      matches(data, right, y, asset.width, target, tol) &&
      !visited[y * asset.width + right]
    ) {
      right += 1;
    }
    right -= 1;
    for (let i = left; i <= right; i += 1) {
      const index = y * asset.width + i;
      if (visited[index]) continue;
      visited[index] = 1;
      if (selection && !insideSelectionDoc(selection, layer, scale, i, y)) continue;
      const offset = index * 4;
      data[offset] = fill[0];
      data[offset + 1] = fill[1];
      data[offset + 2] = fill[2];
      data[offset + 3] = fill[3];
    }
    for (let i = left; i <= right; i += 1) {
      if (
        y > 0 &&
        !visited[(y - 1) * asset.width + i] &&
        matches(data, i, y - 1, asset.width, target, tol)
      ) {
        stack.push(i, y - 1);
      }
      if (
        y + 1 < asset.height &&
        !visited[(y + 1) * asset.width + i] &&
        matches(data, i, y + 1, asset.width, target, tol)
      ) {
        stack.push(i, y + 1);
      }
    }
  }
  ctx.putImageData(frame, 0, 0);
  return true;
}

function matches(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  target: number[],
  tolerance: number,
): boolean {
  const offset = (y * width + x) * 4;
  return (
    Math.abs(data[offset] - target[0]) <= tolerance &&
    Math.abs(data[offset + 1] - target[1]) <= tolerance &&
    Math.abs(data[offset + 2] - target[2]) <= tolerance &&
    Math.abs(data[offset + 3] - target[3]) <= tolerance
  );
}

function insideSelectionDoc(
  selection: Selection,
  layer: RasterLayer,
  scale: { sx: number; sy: number },
  assetX: number,
  assetY: number,
): boolean {
  // 复用 core 的命中判定：它已处理矩形 / 椭圆 / 套索以及反选产生的「洞」
  return pointInSelection(selection, layer.x + assetX / scale.sx, layer.y + assetY / scale.sy);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0, 255];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}
