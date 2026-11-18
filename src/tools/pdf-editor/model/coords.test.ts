import { describe, expect, it } from 'vitest';
import {
  clampNormRect,
  fitPageScale,
  fitWidthScale,
  normalizeRotation,
  normPointToVisual,
  normRectToVisual,
  pageVisualSize,
  pdfPointToVisualPoint,
  pdfRectToVisualRect,
  pxToPt,
  visualPointToNorm,
  visualPointToPdfPoint,
  visualRectToNorm,
  visualRectToPdfRect,
} from './coords';
import type { PdfRotation } from './types';

const RAW = { width: 600, height: 800 };
const VISUAL_90 = pageVisualSize(RAW, 90);
const RECT = { x: 60, y: 60, width: 180, height: 320 };

describe('normalizeRotation', () => {
  it('归一化任意角度到 0/90/180/270', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-360)).toBe(0);
  });

  it('非直角按 0 处理（与 core/pdf/draw.ts 同口径）', () => {
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(89)).toBe(0);
    // 只有四舍五入后正好落在直角上才会保留
    expect(normalizeRotation(90.4)).toBe(90);
  });
});

describe('pageVisualSize', () => {
  it('四分之一转交换宽高', () => {
    expect(pageVisualSize(RAW, 0)).toEqual({ width: 600, height: 800 });
    expect(pageVisualSize(RAW, 180)).toEqual({ width: 600, height: 800 });
    expect(pageVisualSize(RAW, 90)).toEqual({ width: 800, height: 600 });
    expect(pageVisualSize(RAW, 270)).toEqual({ width: 800, height: 600 });
  });
});

describe('归一化 ↔ 视觉坐标', () => {
  it('normRectToVisual 以左下角为原点', () => {
    expect(normRectToVisual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, RAW)).toEqual({
      x: 60,
      y: 320,
      width: 180,
      height: 320,
    });
  });

  it('往返转换保持原值', () => {
    const norm = { x: 0.13, y: 0.27, w: 0.41, h: 0.19 };
    const roundTrip = visualRectToNorm(normRectToVisual(norm, VISUAL_90), VISUAL_90);
    expect(roundTrip.x).toBeCloseTo(norm.x, 10);
    expect(roundTrip.y).toBeCloseTo(norm.y, 10);
    expect(roundTrip.w).toBeCloseTo(norm.w, 10);
    expect(roundTrip.h).toBeCloseTo(norm.h, 10);
  });

  it('点转换同样往返一致', () => {
    const point = { x: 0.25, y: 0.75 };
    const roundTrip = visualPointToNorm(normPointToVisual(point, RAW), RAW);
    expect(roundTrip.x).toBeCloseTo(point.x, 10);
    expect(roundTrip.y).toBeCloseTo(point.y, 10);
  });

  it('空尺寸不产生 NaN', () => {
    expect(visualRectToNorm(RECT, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(visualPointToNorm({ x: 5, y: 5 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('视觉坐标 ↔ PDF 原始坐标（旋转）', () => {
  const cases: Array<{ rotation: PdfRotation; expected: typeof RECT }> = [
    { rotation: 0, expected: { x: 60, y: 60, width: 180, height: 320 } },
    { rotation: 90, expected: { x: 220, y: 60, width: 320, height: 180 } },
    { rotation: 180, expected: { x: 360, y: 420, width: 180, height: 320 } },
    { rotation: 270, expected: { x: 60, y: 560, width: 320, height: 180 } },
  ];

  for (const { rotation, expected } of cases) {
    it(`/Rotate ${rotation} 的矩形映射`, () => {
      const actual = visualRectToPdfRect(RECT, { size: RAW, rotation });
      expect(actual.x).toBeCloseTo(expected.x, 6);
      expect(actual.y).toBeCloseTo(expected.y, 6);
      expect(actual.width).toBeCloseTo(expected.width, 6);
      expect(actual.height).toBeCloseTo(expected.height, 6);
    });
  }

  it('四种旋转下往返一致', () => {
    for (const rotation of [0, 90, 180, 270] as PdfRotation[]) {
      const page = { size: RAW, rotation };
      const back = pdfRectToVisualRect(visualRectToPdfRect(RECT, page), page);
      expect(back.x).toBeCloseTo(RECT.x, 6);
      expect(back.y).toBeCloseTo(RECT.y, 6);
      expect(back.width).toBeCloseTo(RECT.width, 6);
      expect(back.height).toBeCloseTo(RECT.height, 6);
    }
  });

  it('CropBox 非零原点时加上偏移', () => {
    const page = { size: RAW, rotation: 0 as PdfRotation, originX: 20, originY: 30 };
    expect(visualRectToPdfRect(RECT, page)).toEqual({ x: 80, y: 90, width: 180, height: 320 });
    expect(visualPointToPdfPoint({ x: 0, y: 0 }, page)).toEqual({ x: 20, y: 30 });
    expect(pdfPointToVisualPoint({ x: 20, y: 30 }, page)).toEqual({ x: 0, y: 0 });
  });

  it('旋转与 CropBox 组合也不漂移', () => {
    const page = { size: RAW, rotation: 90 as PdfRotation, originX: 20, originY: 30 };
    const back = pdfRectToVisualRect(visualRectToPdfRect(RECT, page), page);
    expect(back.x).toBeCloseTo(RECT.x, 6);
    expect(back.y).toBeCloseTo(RECT.y, 6);
  });
});

describe('缩放与单位换算', () => {
  it('fitWidthScale 扣掉两侧留白', () => {
    expect(fitWidthScale(VISUAL_90, 400, 20)).toBeCloseTo(0.45, 10);
  });

  it('fitPageScale 取宽高比的较小值', () => {
    expect(fitPageScale(VISUAL_90, { width: 400, height: 300 })).toBeCloseTo(0.5, 10);
    expect(fitPageScale(VISUAL_90, { width: 1600, height: 300 })).toBeCloseTo(0.5, 10);
  });

  it('空尺寸不会算出 Infinity', () => {
    expect(fitWidthScale({ width: 0, height: 0 }, 400)).toBe(1);
    expect(fitPageScale({ width: 0, height: 0 }, { width: 400, height: 400 })).toBe(1);
  });

  it('pxToPt 按渲染宽度换算', () => {
    expect(pxToPt(600, 595.28)).toBeCloseTo(0.992133, 6);
    expect(pxToPt(0, 595.28)).toBe(1);
  });
});

describe('clampNormRect', () => {
  it('越界矩形收进页面', () => {
    expect(clampNormRect({ x: -0.2, y: -0.1, w: 1.4, h: 1.2 })).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it('反向拖拽（负宽高）转成正矩形', () => {
    const rect = clampNormRect({ x: 0.6, y: 0.7, w: -0.4, h: -0.5 });
    expect(rect.x).toBeCloseTo(0.2, 10);
    expect(rect.y).toBeCloseTo(0.2, 10);
    expect(rect.w).toBeCloseTo(0.4, 10);
    expect(rect.h).toBeCloseTo(0.5, 10);
  });

  it('NaN 退化为零尺寸而不是传播', () => {
    expect(clampNormRect({ x: Number.NaN, y: 0, w: Number.NaN, h: 0 })).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    });
  });
});
