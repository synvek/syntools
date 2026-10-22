import type { PhotoDoc } from '../model/types';
import { compositeDoc } from '../render/export';

/**
 * 磁性套索的边缘吸附。
 *
 * 思路：手势开始时把当前文档拍成一张缩略合成图，按 Sobel 算子算出归一化的梯度强度，
 * 拖动过程中把光标**吸附到附近梯度最强**的位置。这样套索会「贴」着轮廓走，
 * 而不是像手绘套索那样只能靠手感。
 *
 * 只算一次（而不是每帧重算）：文档在手势期间不会变，重算是纯浪费；
 * 缩略到 512px 也把每次查找的窗口控制在几千像素内。
 */

/** 梯度图的边长上限：够用来找边缘，又不至于拖慢首帧 */
const MAX_EDGE_SIZE = 512;

export interface EdgeMap {
  width: number;
  height: number;
  /** 文档坐标 → 梯度图坐标的比例 */
  scale: number;
  /** 归一化梯度强度（0..1） */
  magnitude: Float32Array;
}

export function buildEdgeMap(doc: PhotoDoc): EdgeMap {
  const scale = Math.min(1, MAX_EDGE_SIZE / Math.max(1, Math.max(doc.width, doc.height)));
  const width = Math.max(1, Math.round(doc.width * scale));
  const height = Math.max(1, Math.round(doc.height * scale));
  const magnitude = new Float32Array(width * height);
  const empty: EdgeMap = { width, height, scale, magnitude };

  const canvas = compositeDoc(doc, null, scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;
  const { data } = ctx.getImageData(0, 0, width, height);

  // 亮度：透明处按 0 计，于是「图层与透明背景的边界」也是一条边
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i += 1) {
    const offset = i * 4;
    luma[i] =
      (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) *
      (data[offset + 3] / 255);
  }

  let max = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      const gx =
        -luma[i - width - 1] -
        2 * luma[i - 1] -
        luma[i + width - 1] +
        luma[i - width + 1] +
        2 * luma[i + 1] +
        luma[i + width + 1];
      const gy =
        -luma[i - width - 1] -
        2 * luma[i - width] -
        luma[i - width + 1] +
        luma[i + width - 1] +
        2 * luma[i + width] +
        luma[i + width + 1];
      const value = Math.hypot(gx, gy);
      magnitude[i] = value;
      if (value > max) max = value;
    }
  }
  if (max > 0) for (let i = 0; i < magnitude.length; i += 1) magnitude[i] /= max;
  return { width, height, scale, magnitude };
}

/**
 * 把文档坐标吸附到附近的强边缘。
 *
 * - `radius`：搜索半径（文档像素，来自工具选项条「宽度」）
 * - `contrast`：对比度阈值 0..100（越高越只认硬边，低对比度区域就不会乱吸）
 *
 * 找不到满足阈值的边缘时原样返回，保证快速划过平滑区域时路径仍连续。
 */
export function snapToEdge(
  map: EdgeMap,
  point: { x: number; y: number },
  radius: number,
  contrast: number,
): { x: number; y: number } {
  const threshold = Math.max(0.02, Math.min(0.9, (contrast / 100) * 0.75));
  const cx = point.x * map.scale;
  const cy = point.y * map.scale;
  const searchRadius = Math.max(1, radius * map.scale);

  let best = -1;
  let bx = cx;
  let by = cy;
  const r = Math.ceil(searchRadius);
  for (let dy = -r; dy <= r; dy += 1) {
    const py = Math.round(cy + dy);
    if (py < 1 || py >= map.height - 1) continue;
    for (let dx = -r; dx <= r; dx += 1) {
      const px = Math.round(cx + dx);
      if (px < 1 || px >= map.width - 1) continue;
      const value = map.magnitude[py * map.width + px];
      if (value <= threshold) continue;
      const distance = Math.hypot(dx, dy);
      if (distance > searchRadius) continue;
      // 边缘越强越好，但同样强度下优先取更近的点，避免折线被扯到远处
      const score = value - (distance / searchRadius) * 0.35;
      if (score > best) {
        best = score;
        bx = px;
        by = py;
      }
    }
  }
  return best < 0 ? point : { x: bx / map.scale, y: by / map.scale };
}
