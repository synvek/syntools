import { describe, expect, it } from 'vitest';
import {
  backdropOf,
  clampBrushSize,
  clampZoom,
  compositeOver,
  createScene,
  hexToRgb,
  nextZoom,
  parseScene,
  rgbToHex,
  serializeScene,
  translateOp,
  translateOps,
  type PolygonOp,
  type StrokeOp,
} from './core';

describe('doodle-board', () => {
  it('钳制画笔', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(40)).toBe(32);
    expect(clampBrushSize(8.6)).toBe(9);
  });

  it('钳制缩放并限定档位步进', () => {
    expect(clampZoom(0.01)).toBe(0.1);
    expect(clampZoom(100)).toBe(8);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(8, 1)).toBe(8);
    expect(nextZoom(0.1, -1)).toBe(0.1);
  });

  it('解析十六进制颜色', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#0f172a')).toEqual({ r: 15, g: 23, b: 42 });
    expect(hexToRgb('rgb(1,2,3)')).toBeNull();
    expect(rgbToHex({ r: 15, g: 23, b: 42 })).toBe('#0f172a');
  });

  it('吸管取色按背景合成半透明像素', () => {
    expect(compositeOver({ r: 0, g: 0, b: 0, a: 255 }, '#ffffff')).toBe('#000000');
    expect(compositeOver({ r: 0, g: 0, b: 0, a: 0 }, '#ffffff')).toBe('#ffffff');
    expect(compositeOver({ r: 0, g: 0, b: 0, a: 128 }, '#ffffff')).toBe('#7f7f7f');
    expect(backdropOf('transparent', '#123456')).toBe('#ffffff');
    expect(backdropOf('grid', '#123456')).toBe('#123456');
  });

  it('平移操作烘焙进坐标', () => {
    const stroke: StrokeOp = {
      kind: 'stroke',
      mode: 'pen',
      color: '#000000',
      width: 4,
      opacity: 1,
      points: [{ x: 1, y: 2, p: 1 }],
    };
    const movedStroke = translateOp(stroke, 10, -5) as StrokeOp;
    expect(movedStroke.points[0]).toMatchObject({ x: 11, y: -3 });

    const polygon: PolygonOp = {
      kind: 'polygon',
      points: [
        { x: 0, y: 0, p: 1 },
        { x: 4, y: 0, p: 1 },
        { x: 4, y: 4, p: 1 },
      ],
      color: '#000000',
      width: 2,
      opacity: 1,
      fill: false,
    };
    const movedPolygon = translateOp(polygon, 2, 3) as PolygonOp;
    expect(movedPolygon.points.map((point) => [point.x, point.y])).toEqual([
      [2, 3],
      [6, 3],
      [6, 7],
    ]);
    expect(translateOps([stroke, polygon], 1, 1)).toHaveLength(2);
  });

  it('多边形可序列化与反序列化', () => {
    const scene = createScene(400, 300);
    scene.ops.push({
      kind: 'polygon',
      points: [
        { x: 10, y: 10, p: 1 },
        { x: 120, y: 20, p: 1 },
        { x: 60, y: 90, p: 1 },
      ],
      color: '#ef4444',
      width: 3,
      opacity: 0.8,
      fill: true,
      fillColor: '#ffffff',
    });
    const raw = serializeScene(scene);
    expect(raw).not.toBeNull();
    const parsed = parseScene(raw as string);
    const polygon = parsed?.ops[0] as PolygonOp;
    expect(polygon.kind).toBe('polygon');
    expect(polygon.points).toHaveLength(3);
    expect(polygon.fillColor).toBe('#ffffff');
  });

  it('点数不足的多边形被丢弃', () => {
    const raw = JSON.stringify({
      width: 400,
      height: 300,
      background: { kind: 'solid', color: '#ffffff' },
      ops: [{ kind: 'polygon', points: [{ x: 1, y: 1, p: 1 }] }],
    });
    expect(parseScene(raw)?.ops).toHaveLength(0);
  });
});
