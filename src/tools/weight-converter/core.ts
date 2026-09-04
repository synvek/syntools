import type { ToolResult } from '@/core/types';

/**
 * 重量单位转换：全部换算到克后再输出目标单位。
 */

export type WeightUnit = 'mg' | 'g' | 'kg' | 't' | 'oz' | 'lb' | 'st';
export type WeightError = 'EMPTY' | 'INVALID';

/** 1 单位 = 多少克 */
export const WEIGHT_TO_GRAMS: Record<WeightUnit, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  t: 1_000_000,
  oz: 28.349523125,
  lb: 453.59237,
  st: 6350.29318,
};

export const WEIGHT_UNITS: WeightUnit[] = ['mg', 'g', 'kg', 't', 'oz', 'lb', 'st'];

export function formatWeight(n: number): string {
  if (!Number.isFinite(n)) return '';
  // 整数量级的整数直接展示，避免 1000000 → 1e+6
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  const fixed = n.toFixed(10).replace(/\.?0+$/, '');
  return fixed === '-0' ? '0' : fixed;
}

export function convertWeight(
  value: string,
  from: WeightUnit,
  to: WeightUnit,
): ToolResult<number> {
  const text = value.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: 'INVALID' };
  const grams = n * WEIGHT_TO_GRAMS[from];
  return { ok: true, value: grams / WEIGHT_TO_GRAMS[to] };
}

export function convertWeightAll(
  value: string,
  from: WeightUnit,
): ToolResult<Record<WeightUnit, string>> {
  const text = value.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: 'INVALID' };
  const grams = n * WEIGHT_TO_GRAMS[from];
  const out = {} as Record<WeightUnit, string>;
  for (const unit of WEIGHT_UNITS) {
    out[unit] = formatWeight(grams / WEIGHT_TO_GRAMS[unit]);
  }
  return { ok: true, value: out };
}
