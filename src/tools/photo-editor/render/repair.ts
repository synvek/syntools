import { REPAIR_SPACING, healOffset, mixChannel } from '../core';
import { createCanvasElement, getCanvas } from '../model/assets';
import type { Selection } from '../model/types';
import { createStampSession, type StampHost, type StampSession } from './stamp';

/**
 * 修复类工具族：仿制图章 / 修复画笔 / 污点修复 / 涂抹 / 模糊 / 锐化。
 *
 * 全部建立在 `render/stamp.ts` 的印章会话上，本模块只实现「一枚印章里像素怎么变」：
 * - **图章**：从落笔时拍下的图层快照按固定偏移复制（源点跟随笔头移动）；
 * - **修复**：复制源纹理，但按「源区均值 → 目标区均值」的增量做色彩匹配（去瑕疵同时保色）；
 * - **污点修复**：不做取样，直接用笔头外环的均值填充（简化实现，见文末说明）；
 * - **涂抹**：把上一次印章的结果当缓冲拖过来，形成晕开；
 * - **模糊 / 锐化**：对印章局部做盒式模糊，再按权重混合（锐化用 unsharp：原图减去模糊）。
 */

export type RepairMode = 'clone' | 'heal' | 'spot' | 'smudge' | 'blur' | 'sharpen';

export interface RepairOptions {
  mode: RepairMode;
  /** 文档坐标下的笔头直径 */
  size: number;
  /** 0~100 的强度（不透明度） */
  strength: number;
  selection: Selection | null;
  /** 图章 / 修复的取样点（文档坐标） */
  source?: { x: number; y: number } | null;
}

export type RepairSession = StampSession;

/** 一次笔画 = 一张快照：边涂边取样会让图案自我复制出「拖影」 */
function snapshotOf(host: StampHost): HTMLCanvasElement | null {
  const asset = getCanvas(host.assetId);
  if (!asset) return null;
  const copy = createCanvasElement(asset.width, asset.height);
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(asset, 0, 0);
  return copy;
}

export function createCloneSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const asset = getCanvas(host.assetId);
  const ctx = asset?.getContext('2d', { willReadFrequently: true }) ?? null;
  const snapshot = snapshotOf(host);
  const snapshotCtx = snapshot?.getContext('2d', { willReadFrequently: true }) ?? null;
  if (!asset || !ctx || !snapshot || !snapshotCtx) return null;
  const sx = asset.width / Math.max(1, host.width);
  const sy = asset.height / Math.max(1, host.height);
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  const mode = options.mode;
  const source = options.source ?? null;

  /** 源点相对笔头的固定偏移：落笔第一枚印章时确定（等价于 Photoshop 的「对齐」关闭） */
  let offset: { x: number; y: number } | null = null;

  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const cx = (context.x - host.x) * sx;
      const cy = (context.y - host.y) * sy;
      if (context.first && mode !== 'spot') {
        if (!source) return false;
        offset = { x: (source.x - context.x) * sx, y: (source.y - context.y) * sy };
      }

      const count = frame.width * frame.height;

      // 污点修复：用笔头外环（1.0~1.5 倍半径）的均值直接覆盖，不需要取样点
      if (mode === 'spot') {
        const ring = ringMean(asset, ctx, cx, cy, options.size / 2, sx, sy);
        if (!ring) return false;
        let touched = false;
        for (let index = 0; index < count; index += 1) {
          const weight = frame.weightAt(index);
          if (weight <= 0) continue;
          const offsetByte = index * 4;
          if (frame.data[offsetByte + 3] === 0) continue;
          const blend = weight * amount * context.pressure;
          for (let channel = 0; channel < 3; channel += 1) {
            frame.data[offsetByte + channel] = mixChannel(
              frame.data[offsetByte + channel],
              ring[channel],
              blend,
            );
          }
          touched = true;
        }
        return touched;
      }

      const shift = offset;
      if (!shift) return false;
      // 源区块与印章同尺寸一次取出：逐像素 getImageData 会慢到不可用
      const sourceFrame = snapshotCtx.getImageData(
        Math.round(frame.left + shift.x),
        Math.round(frame.top + shift.y),
        frame.width,
        frame.height,
      );
      const weights = new Float32Array(count);
      for (let index = 0; index < count; index += 1) weights[index] = frame.weightAt(index);

      // 修复：把源区均值平移到目标区均值，保留源纹理的同时匹配目标色彩
      let colorShift: [number, number, number] = [0, 0, 0];
      if (mode === 'heal') {
        const sourceMean = weightedMean(sourceFrame.data, weights);
        const targetMean = weightedMean(frame.data, weights);
        if (sourceMean && targetMean) colorShift = healOffset(sourceMean, targetMean);
      }

      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = weights[index];
        if (weight <= 0) continue;
        const offsetByte = index * 4;
        if (sourceFrame.data[offsetByte + 3] === 0) continue;
        if (frame.data[offsetByte + 3] === 0 && mode === 'clone') continue;
        const blend = weight * amount * context.pressure;
        for (let channel = 0; channel < 3; channel += 1) {
          frame.data[offsetByte + channel] = mixChannel(
            frame.data[offsetByte + channel],
            sourceFrame.data[offsetByte + channel] + colorShift[channel],
            blend,
          );
        }
        frame.data[offsetByte + 3] = Math.max(
          frame.data[offsetByte + 3],
          Math.round(sourceFrame.data[offsetByte + 3] * blend),
        );
        touched = true;
      }
      return touched;
    },
  });
}

/** 印章内（权重 > 0 且不透明）的加权均值 */
function weightedMean(
  data: Uint8ClampedArray,
  weights: Float32Array,
): [number, number, number] | null {
  const acc = [0, 0, 0];
  let sum = 0;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index];
    if (weight <= 0) continue;
    const offset = index * 4;
    if (data[offset + 3] === 0) continue;
    acc[0] += data[offset] * weight;
    acc[1] += data[offset + 1] * weight;
    acc[2] += data[offset + 2] * weight;
    sum += weight;
  }
  if (sum <= 0) return null;
  return [acc[0] / sum, acc[1] / sum, acc[2] / sum];
}

/** 笔头外环的均值（污点修复的取样来源） */
function ringMean(
  asset: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusDoc: number,
  sx: number,
  sy: number,
): [number, number, number] | null {
  const rx = radiusDoc * sx;
  const ry = radiusDoc * sy;
  const left = Math.max(0, Math.floor(cx - rx * 1.6));
  const top = Math.max(0, Math.floor(cy - ry * 1.6));
  const right = Math.min(asset.width, Math.ceil(cx + rx * 1.6));
  const bottom = Math.min(asset.height, Math.ceil(cy + ry * 1.6));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  const data = ctx.getImageData(left, top, width, height).data;
  const acc = [0, 0, 0];
  let sum = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot((left + x + 0.5 - cx) / rx, (top + y + 0.5 - cy) / ry);
      if (distance < 1 || distance > 1.5) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 8) continue;
      acc[0] += data[offset];
      acc[1] += data[offset + 1];
      acc[2] += data[offset + 2];
      sum += 1;
    }
  }
  if (sum === 0) return null;
  return [acc[0] / sum, acc[1] / sum, acc[2] / sum];
}

/**
 * 涂抹：把上一枚印章的结果当作缓冲，按强度拖到当前位置。
 *
 * 缓冲随笔头移动而重新取样，因此连续落章会自然形成「晕开」——
 * 这正是涂抹的本质，而不是简单的高斯模糊。
 */
export function createSmudgeSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  let buffer: { width: number; height: number; data: Uint8ClampedArray } | null = null;
  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const count = frame.width * frame.height;
      const current = new Uint8ClampedArray(frame.data);
      if (!buffer || buffer.width !== frame.width || buffer.height !== frame.height) {
        // 首章 / 包围盒尺寸变化（贴边）：本次仅初始化缓冲，不改画面
        buffer = { width: frame.width, height: frame.height, data: current };
        return false;
      }
      const previous = buffer;
      const blend = amount * context.pressure;
      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = frame.weightAt(index);
        if (weight <= 0) continue;
        const offset = index * 4;
        const mix = weight * blend;
        frame.data[offset] = mixChannel(frame.data[offset], previous.data[offset], mix);
        frame.data[offset + 1] = mixChannel(frame.data[offset + 1], previous.data[offset + 1], mix);
        frame.data[offset + 2] = mixChannel(frame.data[offset + 2], previous.data[offset + 2], mix);
        frame.data[offset + 3] = mixChannel(frame.data[offset + 3], previous.data[offset + 3], mix);
        touched = true;
      }
      buffer = {
        width: frame.width,
        height: frame.height,
        data: new Uint8ClampedArray(frame.data),
      };
      return touched;
    },
  });
}

/** 模糊 / 锐化笔：局部盒式模糊，再按权重混合（锐化用 unsharp 反推） */
export function createFocusSession(host: StampHost, options: RepairOptions): RepairSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  const sharpen = options.mode === 'sharpen';
  return createStampSession(host, {
    size: options.size,
    spacing: REPAIR_SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const blurred = boxBlurRgba(frame.data, frame.width, frame.height, 1);
      const count = frame.width * frame.height;
      let touched = false;
      for (let index = 0; index < count; index += 1) {
        const weight = frame.weightAt(index);
        if (weight <= 0) continue;
        const offset = index * 4;
        if (frame.data[offset + 3] === 0) continue;
        const blend = weight * amount * context.pressure;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = frame.data[offset + channel];
          const target = sharpen
            ? Math.max(0, Math.min(255, value + (value - blurred[offset + channel]) * blend * 2))
            : blurred[offset + channel];
          frame.data[offset + channel] = sharpen ? target : mixChannel(value, target, blend);
        }
        touched = true;
      }
      return touched;
    },
  });
}

/**
 * 盒式模糊（可分离：先横向再纵向，O(w·h·r) 的两遍扫描）。
 *
 * 导出为实现细节供测试使用：jsdom 没有 2D 上下文，像素运算只能靠这类纯函数覆盖。
 */
export function boxBlurRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius));
  const out = new Uint8ClampedArray(data.length);
  const temp = new Float32Array(data.length);
  const windowSize = r * 2 + 1;
  // 横向
  for (let y = 0; y < height; y += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      let acc = 0;
      for (let x = -r; x <= r; x += 1) {
        acc += data[(y * width + Math.min(width - 1, Math.max(0, x))) * 4 + channel];
      }
      for (let x = 0; x < width; x += 1) {
        temp[(y * width + x) * 4 + channel] = acc / windowSize;
        const addX = Math.min(width - 1, x + r + 1);
        const subX = Math.max(0, x - r);
        acc += data[(y * width + addX) * 4 + channel] - data[(y * width + subX) * 4 + channel];
      }
    }
  }
  // 纵向
  for (let x = 0; x < width; x += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      let acc = 0;
      for (let y = -r; y <= r; y += 1) {
        acc += temp[(Math.min(height - 1, Math.max(0, y)) * width + x) * 4 + channel];
      }
      for (let y = 0; y < height; y += 1) {
        out[(y * width + x) * 4 + channel] = acc / windowSize;
        const addY = Math.min(height - 1, y + r + 1);
        const subY = Math.max(0, y - r);
        acc += temp[(addY * width + x) * 4 + channel] - temp[(subY * width + x) * 4 + channel];
      }
    }
  }
  return out;
}
