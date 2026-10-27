import type { FilterId } from '../model/types';

/**
 * Extra filter pixel implementations: distort / stylize / render / noise reduction.
 *
 * Like the filters already in `render/adjust.ts`, these are pure functions that **mutate RGBA data in place**,
 * so unit tests can run without Canvas2D and assert on the result directly.
 *
 * Two implementation styles:
 * - **geometric** (distort) uses "inverse mapping + bilinear sampling": each target pixel looks up its source,
 *   which has no holes by construction and avoids the jagged pile-up of forward mapping;
 * - **random** (clouds) uses coordinate-hashed deterministic noise instead of `Math.random` —
 *   otherwise every rebake would yield different clouds and undo / redo would visibly jump.
 */

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Bilinear sampling (**out-of-range coordinates clamp to the edge pixels**).
 *
 * Clamping rather than returning transparent: distortion rotates corners out of bounds, and transparency
 * would leave see-through gaps and stripes on solid colors; edge replication is the right filter behavior.
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

/** Resample through a "target → source" coordinate map (shared by the distort filters) */
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

/** Twirl: rotate about the center with an angle that grows by radius — center still, edges twisted most */
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
    // Quadratic falloff: the angle grows with radius and reaches the set value at the corners
    const theta = radians * (radius / maxRadius) ** 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  data.set(result);
}

/** Spherize: positive bulges outward (enlarges the center), negative dents inward */
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
    // Spherical projection: a linearized form of r' = r^(1 - k), with maximum magnification at the center
    const factor = 1 + strength * (1 - normalized);
    if (factor <= 0.01) return { x, y };
    return { x: cx + dx / factor, y: cy + dy / factor };
  });
  data.set(result);
}

/** Pinch: contract toward the center (stretch the sample point along the radius) */
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

/** Sobel gradient magnitude (0~510), shared by the stylize filters */
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

/** Find edges: dark lines on white (matching Photoshop's look) */
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

/** Trace contour: pixels whose gradient exceeds the threshold go black, the rest go white */
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

/** Coordinate hash → deterministic pseudo-random in 0~1 (used by clouds / render filters) */
function hashNoise(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Value noise: hash the lattice, then interpolate smoothly (the basis of clouds) */
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
 * Clouds: several octaves of value noise summed (fractal), then blended in by strength.
 *
 * Noise depends only on coordinates, so rebaking the same parameters yields identical clouds.
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

/** Lens flare: center spot + halo + two symmetric ghosts (added over the image) */
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
  // Ghosts follow the classic "spot → mirrored center point" line (at ratios 0 / 0.5 / 1)
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
        // Spot (flat-top falloff) plus the outer halo
        add += Math.exp(-distance * distance * 3) * ghost.gain;
        // The halo must stay narrow: too wide grays out the frame (width 8 brightens corners by 20 levels)
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
 * Noise reduction: median filter (best on salt-and-pepper noise), then blended in by strength.
 *
 * Skipping the bilateral filter is deliberate: median depends only on sorting, with no float accumulation,
 * and its edge preservation handles photo grain; the strength slider lets users trade off detail themselves.
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

/** Extra filters that need the pixel pipeline (CSS filter can't express them) */
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
