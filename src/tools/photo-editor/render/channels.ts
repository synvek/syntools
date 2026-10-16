import { COLOR_CHANNELS, PALETTE_SIZE, extractChannelData, extractPalette } from '../core';
import type { ChannelView } from '../core';
import { createCanvasElement } from '../model/assets';
import { docSignature } from './composite';
import { compositeDoc } from './export';
import type { PhotoDoc } from '../model/types';

/**
 * 通道相关渲染：单通道隔离显示、通道缩略图与「从图像提取调色板」。
 *
 * 三者都建立在「先合成整份文档」之上（`compositeDoc`），因此结果与画布、导出完全一致。
 * 通道视图是**显示态**：只影响画布呈现，不改动任何图层数据。
 */

/** 单通道缩略图最长边 */
const THUMB_MAX = 40;
/** 提取调色板时的采样边长上限：大图先降采样，避免为取几个主色扫过千万像素 */
const PALETTE_SAMPLE_MAX = 256;

/** 合成后取出单通道（灰度） */
export function channelCanvas(
  doc: PhotoDoc,
  channel: Exclude<ChannelView, 'rgb'>,
  scale = 1,
): HTMLCanvasElement | null {
  const canvas = compositeDoc(doc, null, scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  extractChannelData(frame.data, channel);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

/** 隔离显示用画布（整幅尺寸，供 Konva 通道层直接用） */
export function channelViewCanvas(
  doc: PhotoDoc,
  channel: Exclude<ChannelView, 'rgb'>,
): HTMLCanvasElement | null {
  return channelCanvas(doc, channel, 1);
}

const thumbCache = new Map<string, string>();
const THUMB_CACHE_LIMIT = 12;

/** 通道缩略图（面板用，dataURL）：按文档签名缓存，避免面板每次渲染都重合成 */
export function channelThumbnail(doc: PhotoDoc, channel: ChannelView): string {
  const key = `${docSignature(doc)}#${channel}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const scale = Math.min(1, THUMB_MAX / Math.max(doc.width, doc.height));
  const canvas =
    channel === 'rgb'
      ? compositeDoc(doc, null, scale)
      : (channelCanvas(doc, channel, scale) ?? compositeDoc(doc, null, scale));
  const url = canvas.toDataURL('image/png');
  if (thumbCache.size >= THUMB_CACHE_LIMIT) {
    const oldest = thumbCache.keys().next().value;
    if (oldest) thumbCache.delete(oldest);
  }
  thumbCache.set(key, url);
  return url;
}

/** 通道全集（复合 + R/G/B），面板按此顺序展示 */
export const CHANNEL_LIST: ChannelView[] = ['rgb', ...COLOR_CHANNELS];

/**
 * 从当前合成结果提取主色（文档色板用）。
 *
 * 先按 `PALETTE_SAMPLE_MAX` 降采样再统计，因此成本与画布尺寸无关（大图也不卡）。
 */
export function extractDocPalette(doc: PhotoDoc, count = PALETTE_SIZE): string[] {
  const scale = Math.min(1, PALETTE_SAMPLE_MAX / Math.max(doc.width, doc.height));
  const canvas = createCanvasElement(
    Math.max(1, Math.round(doc.width * scale)),
    Math.max(1, Math.round(doc.height * scale)),
  );
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const composited = compositeDoc(doc, null, scale);
  ctx.drawImage(composited, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return extractPalette(frame.data, count);
}
