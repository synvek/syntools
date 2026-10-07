import { describe, expect, it } from 'vitest';
import { SHAPE_DEFS, adjustsFor, paramValue, projectAdjust, type ShapeAdjustDef } from './index';
import type { ShapeKind } from '../types';
import type { FlowNodeStyle } from '../types';

const ALL_KINDS = Object.keys(SHAPE_DEFS) as ShapeKind[];

/** 定位某形状的某个可调参数 */
function adjustOf(kind: ShapeKind, key: string): ShapeAdjustDef {
  const adj = adjustsFor(SHAPE_DEFS[kind]).find((a) => a.key === key);
  if (!adj) throw new Error(`missing adjust ${kind}.${key}`);
  return adj;
}

describe('形状可调参数 - 解析器', () => {
  it('缺省时取图形目录默认值', () => {
    const note = SHAPE_DEFS.note;
    expect(paramValue(note, undefined, 'foldSize', 150, 90)).toBeCloseTo(Math.min(16, 150 * 0.13));
    expect(paramValue(SHAPE_DEFS.rect, undefined, 'cornerRadius', 150, 64)).toBe(4);
    expect(paramValue(SHAPE_DEFS.roundRect, undefined, 'cornerRadius', 150, 64)).toBe(10);
  });

  it('shapeParams 覆盖默认值并按 min/max 夹取', () => {
    const note = SHAPE_DEFS.note;
    const style: Partial<FlowNodeStyle> = { shapeParams: { foldSize: 40 } };
    expect(paramValue(note, style, 'foldSize', 300, 300)).toBe(40);
    // 超过 max（min(w,h)*0.9）时夹取
    const big: Partial<FlowNodeStyle> = { shapeParams: { foldSize: 999 } };
    expect(paramValue(note, big, 'foldSize', 100, 100)).toBeCloseTo(90);
  });

  it('兼容历史字段 foldSize / cornerRadius', () => {
    expect(paramValue(SHAPE_DEFS.note, { foldSize: 20 }, 'foldSize', 300, 300)).toBe(20);
    expect(paramValue(SHAPE_DEFS.rect, { cornerRadius: 12 }, 'cornerRadius', 300, 300)).toBe(12);
  });

  it('非有限值回退默认值', () => {
    const style: Partial<FlowNodeStyle> = { shapeParams: { foldSize: Number.NaN } };
    expect(paramValue(SHAPE_DEFS.note, style, 'foldSize', 300, 300)).toBeCloseTo(
      Math.min(16, 300 * 0.13),
    );
  });
});

describe('形状可调参数 - 手柄与投影', () => {
  it('anchor 与 project 互为逆变换（逐形状逐参数）', () => {
    for (const kind of ALL_KINDS) {
      const def = SHAPE_DEFS[kind];
      const { width: w, height: h } = def.size;
      for (const adj of adjustsFor(def)) {
        const v = adj.default(w, h);
        const { x, y } = adj.anchor(w, h, v);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        const back = adj.project(x, y, w, h);
        expect(back).toBeCloseTo(v, 6);
      }
    }
  });

  it('projectAdjust 会把越界指针夹取到 [min, max]', () => {
    const adj = adjustOf('note', 'foldSize');
    // 指针拖到节点左外侧：fold 应被夹到 max（min(w,h)*0.9）
    const v = projectAdjust(adj, -1000, 0, 100, 100);
    expect(v).toBeCloseTo(90);
  });
});

describe('形状可调参数 - draw.io 双向映射', () => {
  const cases: Array<{ kind: ShapeKind; key: string }> = [
    { kind: 'rect', key: 'cornerRadius' },
    { kind: 'note', key: 'foldSize' },
    { kind: 'card', key: 'foldSize' },
    { kind: 'predefined', key: 'barWidth' },
    { kind: 'parallelogram', key: 'skew' },
    { kind: 'hexagon', key: 'inset' },
    { kind: 'cylinder', key: 'capHeight' },
    { kind: 'chevron', key: 'chevronDepth' },
    { kind: 'star', key: 'starInner' },
    { kind: 'plus', key: 'plusArm' },
    { kind: 'umlLifeline', key: 'lifelineHeader' },
    { kind: 'umlPackage', key: 'tabHeight' },
    { kind: 'umlComponent', key: 'componentTab' },
    { kind: 'umlNode', key: 'cubeDepth' },
    { kind: 'bpmnDataObject', key: 'foldSize' },
  ];

  it('to → from 往返还原参数值', () => {
    for (const { kind, key } of cases) {
      const def = SHAPE_DEFS[kind];
      const { width: w, height: h } = def.size;
      const adj = adjustOf(kind, key);
      expect(adj.mx).toBeTruthy();
      const value = adj.default(w, h);
      const token = adj.mx!.to(value, w, h);
      const back = adj.mx!.from(token, w, h);
      expect(back).not.toBeNull();
      // 像素参数导出时取整，允许 ≤0.5px 的往返误差；比例参数应精确还原
      const tolerance = adj.unit === 'ratio' ? 1e-6 : 0.5;
      expect(Math.abs(back! - value)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('生命线标题框默认为固定像素（不随高度等比缩放）', () => {
    const adj = adjustOf('umlLifeline', 'lifelineHeader');
    expect(adj.default(120, 300)).toBe(40);
    expect(adj.default(120, 600)).toBe(40);
    // 面板/手柄仍可在 [16, h*0.9] 内调整
    expect(adj.min(120, 300)).toBe(16);
    expect(adj.max(120, 300)).toBeCloseTo(270);
  });
});
