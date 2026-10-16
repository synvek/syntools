import { SPACING_LINE_THRESHOLD, clampSpacing, pointInSelection, traceSelection } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import type { RasterLayer, Rect, Selection } from '../model/types';

/**
 * 落笔：直接改写图层位图的 2D 上下文。
 *
 * 选择这条路径而不是「每笔一个 Konva 节点」，是为了避免长笔画把节点数撑爆；
 * 一次笔画只产生一次 `rev` 自增（触发烘焙缓存失效），撤销粒度 = 一次笔画。
 *
 * 两种笔触形态：
 * - **连续描边**（间距 ≤ 5%）：`lineTo + stroke`，最快且边缘最平滑；
 * - **逐点盖章**（间距 > 5%）：把笔尖预渲染成一张精灵图，沿轨迹按 `间距 × 直径` 步进 `drawImage`，
 *   这样才能表达「间距」的颗粒感，也让每个印章可以独立受压感调制大小 / 不透明度。
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
  /** 锁定透明像素：只画在已有像素上（source-atop），不新增内容 */
  lockAlpha?: boolean;
  /** 落笔间距（相对直径），缺省 0.1 */
  spacing?: number;
  /** 压感调制笔触大小（需要设备支持，鼠标回落为 1） */
  pressureSize?: boolean;
  /** 压感调制不透明度 */
  pressureOpacity?: boolean;
}

export interface StrokeSession {
  /** `pressure` 为 0~1 的压感；缺失时按 1 处理 */
  move: (x: number, y: number, pressure?: number) => void;
  end: () => void;
}

/** 压感下限：鼠标 / 无压感设备报送 0 时不至于画不出来 */
const MIN_PRESSURE = 0.15;

function normalizePressure(pressure: number | undefined): number {
  if (pressure === undefined || !Number.isFinite(pressure) || pressure <= 0) return 1;
  return Math.max(MIN_PRESSURE, Math.min(1, pressure));
}

/**
 * 预渲染笔尖精灵：中心不透明、边缘按硬度衰减。
 * `hardness >= 1` 时直接画实心圆（依赖画布抗锯齿得到干净边缘）。
 */
function createStampSprite(color: string, hardness: number): HTMLCanvasElement {
  const size = 128;
  const canvas = createCanvasElement(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const radius = size / 2;
  if (hardness >= 0.995) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }
  // 实心核心半径由硬度决定：hardness=1 → 核心≈半径；hardness=0 → 核心为 0（整体渐隐）
  const inner = Math.max(0, Math.min(0.98, hardness)) * radius;
  const gradient = ctx.createRadialGradient(radius, radius, inner, radius, radius, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** 文档坐标 → 资产像素坐标的缩放比 */
function assetScale(layer: StrokeTarget): { sx: number; sy: number } | null {
  const asset = getCanvas(layer.assetId);
  if (!asset) return null;
  return {
    sx: asset.width / Math.max(1, layer.width),
    sy: asset.height / Math.max(1, layer.height),
  };
}

/**
 * 把当前上下文裁剪到选区（调用前上下文必须已经被平移到「文档坐标」）。
 * 统一使用 nonzero：`traceSelection` 已按并集 / 差集规范化轮廓方向，
 * 因此反选的「外框 + 内洞」与布尔运算产生的多轮廓都能正确裁剪。
 */
function clipToSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  traceSelection(ctx, selection);
  ctx.clip('nonzero');
}

/** 单次 pointermove 的盖章上限：防止极端跳点（如设备异常）产生海量绘制 */
const MAX_STAMPS_PER_MOVE = 2048;

/**
 * 笔迹落点：只需要「一张画布 + 它在文档中的位置尺寸」。
 *
 * 抽成结构类型的原因：除了图层位图，笔迹还要能落到**图层蒙版**与**快速蒙版**上，
 * 后两者并非 `RasterLayer`；`RasterLayer` 天然满足本接口，因此原调用点无需改动。
 */
export interface StrokeTarget {
  assetId: string;
  /** 文档坐标下的左上角 */
  x: number;
  y: number;
  /** 文档坐标下的尺寸（与画布像素尺寸的比值即缩放） */
  width: number;
  height: number;
}

export function createStrokeSession(
  layer: StrokeTarget,
  options: StrokeOptions,
): StrokeSession | null {
  const asset = getCanvas(layer.assetId);
  const scale = assetScale(layer);
  if (!asset || !scale) return null;
  const ctx = asset.getContext('2d');
  if (!ctx) return null;

  const spacing = clampSpacing(options.spacing ?? 0.1);
  const stamping = spacing > SPACING_LINE_THRESHOLD;
  const sprite = stamping ? createStampSprite(options.color, options.hardness) : null;
  const step = Math.max(0.75, options.size * spacing);

  /**
   * 两条落笔路径，取决定义在「是否必须走缓冲」：
   *
   * - **直接落图**（不透明度 = 1，也就是绝大多数落笔）：笔迹直接画进图层位图。
   *   像素立刻变 → 画布每帧重新取图就能看到笔迹（实时反馈），且不需要额外画布。
   * - **缓冲合成**（不透明度 < 1）：笔迹先按 alpha 1 画进独立缓冲，再把
   *   「落笔前快照 + 缓冲按 opacity 合成」写回位图。重叠印章因此不会互相叠深，
   *   `不透明度` 的含义与用户预期一致；代价是多一张快照画布，且**每落点都要重合成**。
   *
   * 两条路径的共同硬要求：**位图必须在落笔过程中就拿到新像素**。
   * 画布刷新是「从位图重新取图」（`refreshLayerNode(..., live)`），
   * 位图不变就等于没有反馈 —— 这正是「笔迹要等松手才出现」的成因。
   */
  const direct = options.opacity >= 1;
  /** 缓冲模式下每次重合成都要先把目标区域还原成它（因此必须整幅留一份） */
  const base = direct ? null : createCanvasElement(asset.width, asset.height);
  const buffer = direct ? null : createCanvasElement(asset.width, asset.height);
  const baseCtx = base?.getContext('2d');
  if (!direct && (!base || !baseCtx || !buffer)) return null;
  if (baseCtx) baseCtx.drawImage(asset, 0, 0);

  const target = direct ? ctx : (buffer as HTMLCanvasElement).getContext('2d');
  if (!target) return null;
  target.save();
  target.scale(scale.sx, scale.sy);
  target.translate(-layer.x, -layer.y);
  // 选区裁剪：直接模式当场裁；缓冲模式在合成时裁（缓冲只负责累积笔迹）
  if (direct && options.selection) clipToSelection(target, options.selection);
  target.globalAlpha = direct ? options.opacity : 1;
  target.globalCompositeOperation = direct ? compositeOp(options) : 'source-over';
  target.lineCap = 'round';
  target.lineJoin = 'round';
  target.lineWidth = options.size;
  target.strokeStyle = options.color;
  target.fillStyle = options.color;
  const blurRadius = options.hardness < 1 ? options.size * (1 - options.hardness) * 0.6 : 0;
  if (!stamping && blurRadius > 0) {
    target.shadowColor = options.color;
    target.shadowBlur = blurRadius;
  }

  /** 本次重合成需要覆盖的区域（文档坐标）；null = 还没有待合成的笔迹 */
  let dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const markDirty = (x: number, y: number, radius: number) => {
    // 阴影模糊会让笔迹超出几何范围，必须一起算进脏区
    const pad = radius + blurRadius + 2;
    const box = { x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad };
    dirty = dirty
      ? {
          x0: Math.min(dirty.x0, box.x0),
          y0: Math.min(dirty.y0, box.y0),
          x1: Math.max(dirty.x1, box.x1),
          y1: Math.max(dirty.y1, box.y1),
        }
      : box;
  };

  /**
   * 把「快照 + 缓冲」合成回位图。
   *
   * 只处理脏区（松手时整幅收尾）—— 每帧整幅重合成在 4096² 的画布上是几十兆像素的无效功。
   * 合成是「区域的纯函数」（每次都从快照重新算），因此分区域重合成与整幅合成结果完全一致。
   */
  const composite = (whole: boolean) => {
    if (direct || !base || !buffer) return;
    const region =
      whole || !dirty
        ? { x0: layer.x, y0: layer.y, x1: layer.x + layer.width, y1: layer.y + layer.height }
        : dirty;
    ctx.save();
    ctx.scale(scale.sx, scale.sy);
    ctx.translate(-layer.x, -layer.y);
    if (options.selection) clipToSelection(ctx, options.selection);
    ctx.beginPath();
    ctx.rect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
    ctx.clip();
    // 'copy' 才会连透明一起精确还原（source-over 盖不回透明的像素）
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = options.opacity;
    ctx.globalCompositeOperation = compositeOp(options);
    ctx.drawImage(buffer, 0, 0);
    ctx.restore();
    dirty = null;
  };

  /** 按压感盖一个笔尖：压感调制直径与不透明度 */
  const stamp = (x: number, y: number, pressure: number) => {
    if (!sprite) return;
    const sizeFactor = options.pressureSize ? 0.25 + 0.75 * pressure : 1;
    const alphaFactor = options.pressureOpacity ? 0.2 + 0.8 * pressure : 1;
    const diameter = Math.max(0.5, options.size * sizeFactor);
    target.globalAlpha = (direct ? options.opacity : 1) * alphaFactor;
    target.drawImage(sprite, x - diameter / 2, y - diameter / 2, diameter, diameter);
    markDirty(x, y, diameter / 2);
  };

  let last: { x: number; y: number } | null = null;
  /** 距离下一次盖章还需前进的行程（跨 move 累积，保证步进与真实位移一致） */
  let next = step;

  return {
    move: (x, y, pressure) => {
      const value = normalizePressure(pressure);

      if (stamping) {
        if (!last) {
          // 单击（未拖动）也要留下一个点
          stamp(x, y, value);
          last = { x, y };
          next = step;
          composite(false);
          return;
        }
        let dx = x - last.x;
        let dy = y - last.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1e-6) return;
        dx /= distance;
        dy /= distance;
        let travelled = next;
        let count = 0;
        while (travelled <= distance && count < MAX_STAMPS_PER_MOVE) {
          stamp(last.x + dx * travelled, last.y + dy * travelled, value);
          travelled += step;
          count += 1;
        }
        next = Math.max(0, travelled - distance);
        last = { x, y };
        composite(false);
        return;
      }

      if (last) {
        target.beginPath();
        target.moveTo(last.x, last.y);
        target.lineTo(x, y);
        target.stroke();
        markDirty(last.x, last.y, options.size / 2);
        markDirty(x, y, options.size / 2);
      } else {
        target.beginPath();
        target.arc(x, y, Math.max(0.5, options.size / 2), 0, Math.PI * 2);
        target.fill();
        markDirty(x, y, options.size / 2);
      }
      last = { x, y };
      composite(false);
    },
    end: () => {
      last = null;
      if (direct) {
        ctx.restore();
        return;
      }
      // 整幅收尾：脏区只求「够用」，最终一致性由这里保证
      composite(true);
      target.restore();
      // 两张临时画布只服务本次笔迹，立即释放（大画布上这是几十兆的差别）
      base!.width = 0;
      base!.height = 0;
      buffer!.width = 0;
      buffer!.height = 0;
    },
  };
}

/** 落笔的合成方式：橡皮擦除 / 锁定 alpha 只在原像素上画 / 常规覆盖 */
function compositeOp(options: StrokeOptions): GlobalCompositeOperation {
  if (options.mode === 'eraser') return 'destination-out';
  return options.lockAlpha ? 'source-atop' : 'source-over';
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
  lockAlpha = false,
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
  ctx.globalCompositeOperation =
    mode === 'clear' ? 'destination-out' : lockAlpha ? 'source-atop' : 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
  return true;
}

/**
 * 选区遮罩：把非选区部分涂成透明（多轮廓按 nonzero 处理）。
 * 若选区带羽化半径，则对遮罩 alpha 做一次高斯模糊，得到柔和的边缘。
 */
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
  ctx.fill('nonzero');
  ctx.restore();
  if (selection.feather > 0) featherCanvas(canvas, selection.feather);
}

/** 对画布 alpha 做高斯羽化（借临时画布做一次自绘，避免源与目标相同） */
export function featherCanvas(canvas: HTMLCanvasElement, radius: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const temp = createCanvasElement(canvas.width, canvas.height);
  const tempCtx = temp.getContext('2d');
  if (!tempCtx) return;
  tempCtx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `blur(${Math.max(0.1, Math.min(200, radius))}px)`;
  ctx.drawImage(temp, 0, 0);
  ctx.filter = 'none';
}

/**
 * 油漆桶：容差内同色区域填充。
 * `contiguous = true` 走扫描线漫水（只填连通区域）；`false` 则全图扫描，把所有落在容差内的像素一起换色。
 */
export function floodFill(
  layer: RasterLayer,
  docX: number,
  docY: number,
  color: string,
  tolerance: number,
  selection: Selection | null,
  lockAlpha = false,
  contiguous = true,
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

  const tol = tolerance;

  if (!contiguous) {
    // 全图替换：逐像素判定，不再做连通性检查
    for (let y = 0; y < asset.height; y += 1) {
      for (let x = 0; x < asset.width; x += 1) {
        if (!matches(data, x, y, asset.width, target, tol)) continue;
        if (selection && !insideSelectionDoc(selection, layer, scale, x, y)) continue;
        const offset = (y * asset.width + x) * 4;
        if (lockAlpha && data[offset + 3] === 0) continue;
        data[offset] = fill[0];
        data[offset + 1] = fill[1];
        data[offset + 2] = fill[2];
        data[offset + 3] = fill[3];
      }
    }
    ctx.putImageData(frame, 0, 0);
    return true;
  }

  const visited = new Uint8Array(asset.width * asset.height);
  const stack: number[] = [px, py];
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
      // 锁定透明像素：不往全透明处新增内容
      if (lockAlpha && data[offset + 3] === 0) continue;
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
