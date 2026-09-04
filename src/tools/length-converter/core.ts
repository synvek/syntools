import type { ToolResult } from '@/core/types';

/**
 * 长度单位转换：全部换算到米后再输出目标单位。
 */

export type LengthUnit =
  | 'mm'
  | 'cm'
  | 'm'
  | 'km'
  | 'in'
  | 'ft'
  | 'yd'
  | 'mi'
  | 'nmi';

export type LengthError = 'EMPTY' | 'INVALID';

/** 1 单位 = 多少米 */
export const LENGTH_TO_METERS: Record<LengthUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
  nmi: 1852,
};

export const LENGTH_UNITS: LengthUnit[] = [
  'mm',
  'cm',
  'm',
  'km',
  'in',
  'ft',
  'yd',
  'mi',
  'nmi',
];

export function convertLength(
  value: string,
  from: LengthUnit,
  to: LengthUnit,
): ToolResult<number> {
  const text = value.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: 'INVALID' };
  const meters = n * LENGTH_TO_METERS[from];
  return { ok: true, value: meters / LENGTH_TO_METERS[to] };
}

/** 将数值格式化为可读小数（去掉多余尾零） */
export function formatLength(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  const fixed = n.toFixed(10).replace(/\.?0+$/, '');
  return fixed === '-0' ? '0' : fixed;
}

export function convertLengthAll(
  value: string,
  from: LengthUnit,
): ToolResult<Record<LengthUnit, string>> {
  const text = value.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: 'INVALID' };
  const meters = n * LENGTH_TO_METERS[from];
  const out = {} as Record<LengthUnit, string>;
  for (const unit of LENGTH_UNITS) {
    out[unit] = formatLength(meters / LENGTH_TO_METERS[unit]);
  }
  return { ok: true, value: out };
}
