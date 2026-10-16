import { mixChannel, pointInSelection, type RetouchMode } from '../core';
import type { Selection } from '../model/types';
import { createStampSession, type StampFrame, type StampSession } from './stamp';
import type { StampHost } from './stamp';

/**
 * 润饰工具族：减淡（Dodge）/ 加深（Burn）/ 海绵（Sponge）。
 *
 * 印章步进、坐标换算、压感归一都交给 `render/stamp.ts` 的通用会话，
 * 本模块只负责「一枚印章里每个像素怎么变」。
 * 一次笔画 = 一次历史；落笔前必须由调用方 `commitPixels` 保存原始像素。
 */

export interface RetouchOptions {
  mode: RetouchMode;
  /** 文档坐标下的笔头直径 */
  size: number;
  /** 0~100：每枚印章的最大调制幅度（%） */
  strength: number;
  selection: Selection | null;
}

export type RetouchSession = StampSession;

/** 印章间距（相对直径）：过密会重复累加导致瞬间过曝 */
const SPACING = 0.25;
/** 单枚印章的基础幅度系数：把 0~100 的强度映射到每次可感知但不过头的量 */
const STAMP_GAIN = 0.06;

export function createRetouchSession(
  layer: StampHost,
  options: RetouchOptions,
): RetouchSession | null {
  const amount = Math.max(0, Math.min(100, options.strength)) / 100;
  return createStampSession(layer, {
    size: options.size,
    spacing: SPACING,
    selection: options.selection,
    onStamp: (frame, context) => {
      const gain = amount * context.pressure * STAMP_GAIN;
      let touched = false;
      const count = frame.width * frame.height;
      for (let index = 0; index < count; index += 1) {
        const falloff = frame.weightAt(index);
        if (falloff <= 0) continue;
        const offset = index * 4;
        if (frame.data[offset + 3] === 0) continue;
        modulate(frame, offset, options.mode, gain * falloff);
        touched = true;
      }
      return touched;
    },
  });
}

/** 单像素调制：减淡提亮 / 加深压暗 / 海绵降饱和 */
function modulate(frame: StampFrame, offset: number, mode: RetouchMode, weight: number): void {
  const data = frame.data;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  if (mode === 'sponge') {
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    data[offset] = mixChannel(r, gray, weight);
    data[offset + 1] = mixChannel(g, gray, weight);
    data[offset + 2] = mixChannel(b, gray, weight);
    return;
  }
  // 减淡：向白靠拢；加深：向黑靠拢。按通道独立计算，保持色彩关系
  const target = mode === 'dodge' ? 255 : 0;
  data[offset] = mixChannel(r, target, weight);
  data[offset + 1] = mixChannel(g, target, weight);
  data[offset + 2] = mixChannel(b, target, weight);
}

/** 供修复类工具复用：判断该像素是否在选区内（与印章权重同源） */
export { pointInSelection };
