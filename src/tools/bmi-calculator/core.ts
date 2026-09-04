import type { ToolResult } from '@/core/types';

/**
 * BMI 计算：BMI = kg / m²，并按 WHO 成人标准分级。
 */

export type BmiUnit = 'metric' | 'imperial';
export type BmiError = 'INVALID' | 'RANGE';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  /** 换算后的千克 / 米，便于展示 */
  kg: number;
  meters: number;
}

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function computeBmi(
  height: string,
  weight: string,
  unit: BmiUnit,
): ToolResult<BmiResult> {
  const h = Number(height);
  const w = Number(weight);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) {
    return { ok: false, error: 'INVALID' };
  }

  let meters: number;
  let kg: number;
  if (unit === 'metric') {
    // 身高允许 cm（>3）或 m（≤3）
    meters = h > 3 ? h / 100 : h;
    kg = w;
  } else {
    // imperial: 英寸 / 磅
    meters = h * 0.0254;
    kg = w * 0.45359237;
  }

  if (meters < 0.5 || meters > 2.5 || kg < 10 || kg > 400) {
    return { ok: false, error: 'RANGE' };
  }

  const bmi = kg / (meters * meters);
  return {
    ok: true,
    value: {
      bmi: Math.round(bmi * 10) / 10,
      category: classifyBmi(bmi),
      kg: Math.round(kg * 10) / 10,
      meters: Math.round(meters * 1000) / 1000,
    },
  };
}
