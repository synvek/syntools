import type { ToolResult } from '@/core/types';

export type UnitCategory =
  'length' | 'mass' | 'area' | 'volume' | 'temperature' | 'speed' | 'data' | 'time';

/** 每个分类下的单位 → 基准单位的换算系数（温度单独处理） */
export const UNIT_FACTORS: Record<Exclude<UnitCategory, 'temperature'>, Record<string, number>> = {
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
    nmi: 1852,
  },
  mass: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
  area: {
    mm2: 1e-6,
    cm2: 1e-4,
    m2: 1,
    km2: 1e6,
    ha: 10000,
    in2: 0.00064516,
    ft2: 0.09290304,
    ac: 4046.8564224,
    mi2: 2589988.110336,
  },
  volume: {
    ml: 0.001,
    l: 1,
    m3: 1000,
    tsp: 0.00492892159375,
    tbsp: 0.01478676478125,
    floz: 0.0295735295625,
    cup: 0.2365882365,
    pt: 0.473176473,
    qt: 0.946352946,
    gal: 3.785411784,
  },
  speed: { mps: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444444, fps: 0.3048 },
  data: {
    b: 1,
    kb: 1000,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
    pb: 1e15,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  },
  time: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
};

export const TEMP_UNITS = ['c', 'f', 'k'] as const;
export type TempUnit = (typeof TEMP_UNITS)[number];

export const CATEGORIES: UnitCategory[] = [
  'length',
  'mass',
  'area',
  'volume',
  'temperature',
  'speed',
  'data',
  'time',
];

export function unitsOf(category: UnitCategory): string[] {
  if (category === 'temperature') return [...TEMP_UNITS];
  return Object.keys(UNIT_FACTORS[category]);
}

function toCelsius(value: number, from: TempUnit): number {
  if (from === 'c') return value;
  if (from === 'f') return (value - 32) / 1.8;
  return value - 273.15;
}

function fromCelsius(celsius: number, to: TempUnit): number {
  if (to === 'c') return celsius;
  if (to === 'f') return celsius * 1.8 + 32;
  return celsius + 273.15;
}

export function convertUnit(
  value: string,
  category: UnitCategory,
  from: string,
  to: string,
): ToolResult<number> {
  const text = value.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: 'INVALID' };

  if (category === 'temperature') {
    if (!TEMP_UNITS.includes(from as TempUnit) || !TEMP_UNITS.includes(to as TempUnit)) {
      return { ok: false, error: 'INVALID' };
    }
    return { ok: true, value: fromCelsius(toCelsius(n, from as TempUnit), to as TempUnit) };
  }

  const table = UNIT_FACTORS[category];
  if (!table || !(from in table) || !(to in table)) return { ok: false, error: 'INVALID' };
  return { ok: true, value: (n * table[from]) / table[to] };
}

/** 将数值格式化为可读小数（去除多余尾零）。 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  const fixed = n.toFixed(8).replace(/\.?0+$/, '');
  return fixed === '-0' ? '0' : fixed;
}
