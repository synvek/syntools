import type { FilterId } from '../model/types';

/**
 * 扩展滤镜像素实现：扭曲 / 风格化 / 渲染 / 降噪。
 *
 * 与 `render/adjust.ts` 里既有的滤镜一样，全部是**就地修改 RGBA 数据**的纯函数，
 * 因此可以在没有 Canvas2D 的环境（单测）里直接断言结果。
 *
 * 两类实现风格：
 * - **几何类**（扭曲）走「反向映射 + 双线性采样」：目标像素反查源坐标，
 *   天然没有空洞，也不会出现正向映射的锯齿堆积；
 * - **随机类**（云彩）用**按坐标哈希**的确定性噪声，而不是 `Math.random` ——
 *   否则每次重新烘焙缓存都会得到不同的云，撤销 / 重做前后画面会跳变。
 */

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * 双线性采样（**坐标越界时钳制到边缘像素**）。
 *
 * 钳制而不是返回透明：扭曲会把画布角落旋出界外，若返回透明，成品会出现透明缺口、
 * 纯色图还会出现条纹 —— 边缘复制才是图像滤镜应有的行为（Photoshop 亦然）。
 */
export function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const sampleX = Math.min(width - 1, Math.max(0, x));
  const sampleY = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const fx = sampleX - x0;
  const fy = sampleY - y0;
  const at = (px: number, py: number, channel: number) => {
    if (px < 0 || py < 0 || px >= width || py >= height) return 0;
    return data[(py * width + px) * 4 + channel];
  };
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = at(x0, y0, channel) * (1 - fx) + at(x0 + 1, y0, channel) * fx;
    const bottom = at(x0, y0 + 1, channel) * (1 - fx) + at(x0 + 1, y0 + 1, channel) * fx;
    out[channel] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

/** 按「目标 → 源」的坐标映射重采样（扭曲类滤镜共用） */
function remap(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  map: (x: number, y: number, cx: number, cy: number) => { x: number; y: number },
): Uint8ClampedArray {
  const source = new Uint8ClampedArray(data);
  const cx = width / 2;
  const cy = height / 2;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = map(x + 0.5, y + 0.5, cx, cy);
      const sample = sampleBilinear(source, width, height, point.x - 0.5, point.y - 0.5);
      const offset = (y * width + x) * 4;
      out[offset] = sample[0];
      out[offset + 1] = sample[1];
      out[offset + 2] = sample[2];
      out[offset + 3] = sample[3];
    }
  }
  return out;
}

/** 旋转扭曲：绕画布中心按半径递增地旋转，中心不动、边缘扭得最厉害 */
export function applyTwirl(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  angleDegrees: number,
): void {
  if (!angleDegrees) return;
  const maxRadius = Math.max(1, Math.hypot(width / 2, height / 2));
  const radians = (angleDegrees * Math.PI) / 180;
  const result = remap(width, height, data, (x, y, cx, cy) => {
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.hypot(dx, dy);
    // 二次衰减：半径越大角度越大，到画布角落时达到设定角度
    const theta = radians * (radius / maxRadius) ** 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  data.set(result);
}

/** 球面化：正值向外鼓（放大中心），负值向内凹 */
export function applySpherize(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  amount: number,
): void {
  if (!amount) return;
  const maxRadius = Math.max(1, Math.hypot(width / 2, height / 2));
  const strength = Math.max(-100, Math.min(100, amount)) / 100;
  const result = remap(width, height, data, (x, y, cx, cy) => {
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.hypot(dx, dy);
    if (radius < 1e-6) return { x, y };
    const normalized = radius / maxRadius;
    // 球面投影：r' = r^(1 - k) 的线性化形式，中心放大倍数最大
    const factor = 1 + strength * (1 - normalized);
    if (factor <= 0.01) return { x, y };
    return { x: cx + dx / factor, y: cy + dy / factor };
  });
  data.set(result);
}

/** 挤压：向中心收缩（沿半径方向拉伸取样点） */
export function applyPinch(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  amount: number,
): void {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (strength <= 0) return;
  const maxRadius = Math.max(1, Math.hypot(width / 2, height / 2));
  const result = remap(width, height, data, (x, y, cx, cy) => {
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.hypot(dx, dy);
    if (radius < 1e-6) return { x, y };
    const normalized = Math.min(1, radius / maxRadius);
    const factor = 1 + strength * (1 - normalized) * 1.5;
    return { x: cx + dx * factor, y: cy + dy * factor };
  });
  data.set(result);
}

/** Sobel 梯度幅值（0~510）；风格化类滤镜共用 */
export function sobelMagnitude(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const luma = (px: number, py: number) => {
    const cx = Math.min(width - 1, Math.max(0, px));
    const cy = Math.min(height - 1, Math.max(0, py));
    const offset = (cy * width + cx) * 4;
    return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  };
  const gx =
    -luma(x - 1, y - 1) -
    2 * luma(x - 1, y) -
    luma(x - 1, y + 1) +
    luma(x + 1, y - 1) +
    2 * luma(x + 1, y) +
    luma(x + 1, y + 1);
  const gy =
    -luma(x - 1, y - 1) -
    2 * luma(x, y - 1) -
    luma(x + 1, y - 1) +
    luma(x - 1, y + 1) +
    2 * luma(x, y + 1) +
    luma(x + 1, y + 1);
  return Math.hypot(gx, gy);
}

/** 查找边缘：白底暗线（与 Photoshop 的呈现一致） */
export function applyFindEdges(width: number, height: number, data: Uint8ClampedArray): void {
  const source = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const magnitude = Math.min(255, sobelMagnitude(source, width, height, x, y));
      const value = 255 - magnitude;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
    }
  }
}

/** 等高线：梯度超过阈值的像素压黑，其余压白 */
export function applyTraceContour(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  level: number,
): void {
  const source = new Uint8ClampedArray(data);
  const threshold = Math.max(0, Math.min(255, level));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const magnitude = sobelMagnitude(source, width, height, x, y);
      const value = magnitude >= threshold ? 0 : 255;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
    }
  }
}

/** 坐标哈希 → 0~1 的确定性伪随机（云彩 / 渲染类用） */
function hashNoise(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** 值噪声：对网格取哈希后做平滑插值（云彩的基础） */
function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const top = hashNoise(x0, y0, seed) * (1 - sx) + hashNoise(x0 + 1, y0, seed) * sx;
  const bottom = hashNoise(x0, y0 + 1, seed) * (1 - sx) + hashNoise(x0 + 1, y0 + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * 云彩：多层值噪声叠加（分形），再按强度与画面混合。
 *
 * 噪声完全由坐标决定，因此同一份参数重复烘焙得到完全相同的云。
 */
export function applyClouds(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  amount: number,
  size: number,
): void {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (strength <= 0) return;
  const scale = Math.max(2, size) / 8;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      let amplitude = 0.5;
      let frequency = 1;
      for (let octave = 0; octave < 4; octave += 1) {
        value += valueNoise((x / scale) * frequency, (y / scale) * frequency, octave) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      const cloud = value * 255;
      const offset = (y * width + x) * 4;
      data[offset] = data[offset] + (cloud - data[offset]) * strength;
      data[offset + 1] = data[offset + 1] + (cloud - data[offset + 1]) * strength;
      data[offset + 2] = data[offset + 2] + (cloud - data[offset + 2]) * strength;
    }
  }
}

/** 镜头光晕：中心光斑 + 光环 + 两个对称鬼影（叠加到原图上） */
export function applyLensFlare(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  amount: number,
  size: number,
  xPercent: number,
  yPercent: number,
): void {
  const strength = Math.max(0, amount) / 100;
  if (strength <= 0) return;
  const cx = (Math.max(0, Math.min(100, xPercent)) / 100) * width;
  const cy = (Math.max(0, Math.min(100, yPercent)) / 100) * height;
  const radius = (Math.max(10, size) / 100) * Math.max(width, height);
  // 鬼影沿「光斑 → 中心对称点」这条经典轨迹分布（比例 0 / 0.5 / 1）
  const mirrorX = width - cx;
  const mirrorY = height - cy;
  const ghosts = [
    { x: cx, y: cy, scale: 1, gain: 1 },
    {
      x: cx + (mirrorX - cx) * 0.5,
      y: cy + (mirrorY - cy) * 0.5,
      scale: 0.6,
      gain: 0.32,
    },
    { x: mirrorX, y: mirrorY, scale: 1.35, gain: 0.15 },
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let add = 0;
      for (const ghost of ghosts) {
        const distance = Math.hypot(x - ghost.x, y - ghost.y) / (radius * ghost.scale);
        // 光斑（平顶衰减）+ 外圈光环
        add += Math.exp(-distance * distance * 3) * ghost.gain;
        // 光环要窄：太宽会让整个画面发灰（实测 8 的宽度会让角落亮 20 级）
        add += Math.exp(-((distance - 1.3) ** 2) * 20) * ghost.gain * 0.5;
      }
      if (add <= 0.001) continue;
      const boost = add * strength * 255;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = clampByte(data[offset + channel] + boost);
      }
    }
  }
}

/**
 * 降噪：中值滤波（对椒盐噪声最有效），再按强度与原图混合。
 *
 * 没有做双边滤波是刻意的：中值只依赖排序、无浮点累积误差，
 * 且「保边」特性足以应付照片噪点；强度滑杆让用户自己权衡细节。
 */
export function applyReduceNoise(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  amount: number,
  radius: number,
): void {
  const strength = Math.max(0, Math.min(100, amount)) / 100;
  if (strength <= 0) return;
  const r = Math.max(1, Math.min(3, Math.round(radius)));
  const source = new Uint8ClampedArray(data);
  const samples: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        samples.length = 0;
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const px = Math.min(width - 1, Math.max(0, x + dx));
            const py = Math.min(height - 1, Math.max(0, y + dy));
            samples.push(source[(py * width + px) * 4 + channel]);
          }
        }
        samples.sort((a, b) => a - b);
        const median = samples[samples.length >> 1];
        data[offset + channel] =
          source[offset + channel] + (median - source[offset + channel]) * strength;
      }
    }
  }
}

/** 需要走像素管线的扩展滤镜（CSS filter 无法表达） */
const EXTRA_IDS: FilterId[] = [
  'twirl',
  'spherize',
  'pinch',
  'findEdges',
  'traceContour',
  'clouds',
  'lensFlare',
  'reduceNoise',
];

export function isExtraFilter(id: FilterId): boolean {
  return EXTRA_IDS.includes(id);
}
