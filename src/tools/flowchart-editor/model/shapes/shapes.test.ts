import { describe, expect, it } from 'vitest';
import {
  SHAPE_CATEGORY_ORDER,
  SHAPE_DEFS,
  adjustsFor,
  paramValue,
  shapeSize,
  shapesOfCategory,
} from './index';
import type { ShapeKind } from '../types';
import { SHAPE_LABELS } from '../types';

const ALL_KINDS = Object.keys(SHAPE_DEFS) as ShapeKind[];

describe('图形目录', () => {
  it('每个分类都登记了形状', () => {
    for (const category of SHAPE_CATEGORY_ORDER) {
      expect(shapesOfCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('每个形状都有尺寸、绘制方式与中文名', () => {
    for (const kind of ALL_KINDS) {
      const def = SHAPE_DEFS[kind];
      expect(def.kind).toBe(kind);
      expect(def.size.width).toBeGreaterThan(0);
      expect(def.size.height).toBeGreaterThan(0);
      expect(def.draw).toBeTruthy();
      expect(SHAPE_LABELS[kind]).toBeTruthy();
    }
  });

  it('path 形状能生成不含 NaN 的合法 path', () => {
    for (const kind of ALL_KINDS) {
      const def = SHAPE_DEFS[kind];
      if (def.draw !== 'path' || !def.path) continue;
      const { width, height } = def.size;
      const getter = (key: string) => paramValue(def, undefined, key, width, height);
      const d = def.path(width, height, getter);
      expect(d.length).toBeGreaterThan(0);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });

  it('每个可调参数默认值均在 [min, max] 内且能反推手柄位置', () => {
    for (const kind of ALL_KINDS) {
      const def = SHAPE_DEFS[kind];
      const { width, height } = def.size;
      for (const adj of adjustsFor(def)) {
        const v = adj.default(width, height);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(adj.min(width, height));
        expect(v).toBeLessThanOrEqual(adj.max(width, height));
        const { x, y } = adj.anchor(width, height, v);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      }
    }
  });

  it('shapeSize 与目录一致，未知 kind 有兜底', () => {
    expect(shapeSize('rect')).toEqual({ width: 150, height: 64 });
    // 横向泳道宽大于高、纵向泳道高大于宽
    expect(shapeSize('swimlane').width).toBeGreaterThan(shapeSize('swimlane').height);
    expect(shapeSize('swimlaneV').height).toBeGreaterThan(shapeSize('swimlaneV').width);
    expect(shapeSize('unknown-kind' as ShapeKind)).toEqual({ width: 150, height: 64 });
  });

  it('容器形状覆盖泳道与编组', () => {
    expect(SHAPE_DEFS.swimlane.isContainer).toBe(true);
    expect(SHAPE_DEFS.swimlaneV.isContainer).toBe(true);
    expect(SHAPE_DEFS.group.isContainer).toBe(true);
  });
});
