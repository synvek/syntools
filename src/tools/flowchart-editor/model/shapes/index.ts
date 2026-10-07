/**
 * 图形目录：集中登记所有可用形状。
 * 新增形状只需在对应分类文件登记一条 ShapeDef，
 * ShapeNode 绘制、侧边栏、模板与导入导出全部由本目录驱动。
 */

import type { FlowNodeStyle, ShapeKind, ShapeSize } from '../types';
import type { ParamGetter, ShapeAdjustDef } from './adjust';
import { FLOW_SHAPES } from './flow';
import { UML_SHAPES } from './uml';
import { BPMN_SHAPES } from './bpmn';
import { NETWORK_SHAPES } from './network';
import { ORG_SHAPES } from './org';
import { MIND_SHAPES } from './mind';
import { ER_SHAPES } from './er';
import { CONTAINER_SHAPES } from './container';
import { GENERAL_SHAPES } from './general';

/** 形状分类（侧边栏以此分组）；UML 按 2.5 图种细分为 9 类 */
export type ShapeCategory =
  | 'general'
  | 'flow'
  | 'umlCommon'
  | 'umlUseCase'
  | 'umlClass'
  | 'umlObject'
  | 'umlSequence'
  | 'umlActivity'
  | 'umlState'
  | 'umlComponent'
  | 'umlDeployment'
  | 'bpmn'
  | 'network'
  | 'org'
  | 'mind'
  | 'er';

/** 基础外形 */
export type ShapeDraw =
  | 'rect'
  | 'roundRect'
  | 'capsule'
  | 'ellipse'
  | 'diamond'
  | 'parallelogram'
  | 'invParallelogram'
  | 'trapezoid'
  | 'invTrapezoid'
  | 'hexagon'
  | 'cylinder'
  | 'document'
  | 'note'
  | 'circle'
  | 'bar'
  | 'triangle'
  | 'star'
  | 'pentagon'
  | 'octagon'
  | 'chevron'
  | 'card'
  | 'callout'
  | 'cloud'
  | 'cross'
  | 'plus'
  | 'flag'
  | 'lightning'
  | 'arrow'
  | 'bracket'
  | 'laneH'
  | 'laneV'
  | 'group'
  | 'path';

/** 外形内部的装饰符号 */
export type ShapeDecor =
  | 'none'
  | 'x'
  | 'plus'
  | 'innerCircle'
  | 'doubleCircle'
  | 'thickRing'
  | 'brackets'
  | 'grid'
  | 'serverLines'
  | 'screen'
  | 'crossArrows'
  | 'brick'
  | 'split'
  | 'globe'
  | 'disk'
  | 'compartments'
  | 'plusBox'
  | 'person'
  | 'bullseye'
  | 'history'
  | 'historyDeep';

export interface ShapeDef {
  kind: ShapeKind;
  category: ShapeCategory;
  draw: ShapeDraw;
  size: ShapeSize;
  /** 内部装饰符号（网关 X/+、事件圈等） */
  decor?: ShapeDecor;
  /**
   * draw === 'path' 时的 SVG path 生成函数。
   * 第三个参数为可调参数读取器（`p('tabHeight')` 等），默认值由 `ShapeDef.adjust` 声明。
   */
  path?: (w: number, h: number, p: ParamGetter) => string;
  isContainer?: boolean;
  defaultStyle?: Partial<FlowNodeStyle>;
  /**
   * 形状专属的可调参数（类 draw.io 调整顶点）。
   * 通用参数（圆角/折角/斜切/分栏高……）由 `adjust.ts` 按 draw / decor 自动派生，无需在此重复声明。
   */
  adjust?: ShapeAdjustDef[];
}

const ALL_SHAPES: ShapeDef[] = [
  ...GENERAL_SHAPES,
  ...FLOW_SHAPES,
  ...UML_SHAPES,
  ...BPMN_SHAPES,
  ...NETWORK_SHAPES,
  ...ORG_SHAPES,
  ...MIND_SHAPES,
  ...ER_SHAPES,
  ...CONTAINER_SHAPES,
];

export const SHAPE_DEFS = Object.fromEntries(ALL_SHAPES.map((def) => [def.kind, def])) as Record<
  ShapeKind,
  ShapeDef
>;

/** 侧边栏分类展示顺序 */
export const SHAPE_CATEGORY_ORDER: ShapeCategory[] = [
  'general',
  'flow',
  'umlCommon',
  'umlUseCase',
  'umlClass',
  'umlObject',
  'umlSequence',
  'umlActivity',
  'umlState',
  'umlComponent',
  'umlDeployment',
  'bpmn',
  'network',
  'org',
  'mind',
  'er',
];

export function shapesOfCategory(category: ShapeCategory): ShapeDef[] {
  return ALL_SHAPES.filter((def) => def.category === category);
}

export function shapeDefOf(kind: ShapeKind): ShapeDef | undefined {
  return SHAPE_DEFS[kind];
}

/** 形状默认尺寸；未知 kind 回退为通用矩形尺寸 */
export function shapeSize(kind: ShapeKind): ShapeSize {
  return SHAPE_DEFS[kind]?.size ?? { width: 150, height: 64 };
}

export type { AdjustPoint, AdjustMx, ParamGetter, ShapeAdjustDef } from './adjust';
export { adjustsFor, hasAdjusts, paramGetterFor, paramValue, projectAdjust } from './adjust';
