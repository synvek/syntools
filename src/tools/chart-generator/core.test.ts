import { describe, expect, it } from 'vitest';
import {
  COLOR_SCHEME_IDS,
  colorAt,
  generateChartSvg,
  parseChartData,
  svgToDataUrl,
} from './core';

describe('chart-generator', () => {
  it('解析带表头 CSV', () => {
    const r = parseChartData('Label,Value\nA,10\nB,20');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual([
      { label: 'A', value: 10 },
      { label: 'B', value: 20 },
    ]);
  });

  it('空 / 无数值', () => {
    expect(parseChartData('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseChartData('a,b\nx,y')).toEqual({ ok: false, error: 'NO_NUMERIC' });
  });

  it('生成多种图表 SVG', () => {
    const points = [
      { label: 'A', value: 10 },
      { label: 'B', value: 20 },
      { label: 'C', value: 15 },
    ];
    for (const type of ['bar', 'hbar', 'line', 'area', 'pie', 'doughnut', 'scatter'] as const) {
      const r = generateChartSvg(points, {
        type,
        width: 480,
        height: 300,
        title: 'Demo',
        seriesLabel: '销量',
        xLabel: '类别',
        yLabel: '数值',
        legend: 'top',
        colorScheme: 'vibrant',
      });
      expect(r.ok, type).toBe(true);
      if (!r.ok) return;
      expect(r.value).toContain('<svg');
      expect(r.value).toContain('销量');
      expect(r.value).toContain('</svg>');
    }
  });

  it('配色与 Y 轴', () => {
    expect(COLOR_SCHEME_IDS.length).toBeGreaterThanOrEqual(5);
    expect(colorAt('ocean', 0)).toMatch(/^#/);
    const r = generateChartSvg(
      [
        { label: 'A', value: 10 },
        { label: 'B', value: 30 },
      ],
      {
        type: 'bar',
        width: 400,
        height: 240,
        title: '',
        seriesLabel: 'S',
        xLabel: 'X',
        yLabel: 'Y轴',
        legend: 'bottom',
        colorScheme: 'sunset',
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('Y轴');
    expect(r.value).toContain(colorAt('sunset', 0));
    expect(r.value).toContain(colorAt('sunset', 1));
  });

  it('svgToDataUrl', () => {
    expect(svgToDataUrl('<svg/>')).toContain('data:image/svg+xml');
  });
});
