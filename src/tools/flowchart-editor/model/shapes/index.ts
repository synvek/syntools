/**
 * Shape catalog: registers every available shape in one place.
 * Adding a shape only takes one ShapeDef registration in the relevant category file;
 * ShapeNode drawing, the sidebar, templates and import/export are all driven by this catalog.
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

/** Shape categories (the sidebar groups by these); UML is split into 9 kinds following 2.5 diagram types */
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

/** Base outlines */
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

/** Decorative symbols inside an outline */
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
  /** Internal decorative symbols (gateway X/+, event circles, etc.) */
  decor?: ShapeDecor;
  /**
   * SVG path generator used when draw === 'path'.
   * The third parameter is the adjustable-parameter reader (`p('tabHeight')` etc.), with defaults declared in `ShapeDef.adjust`.
   */
  path?: (w: number, h: number, p: ParamGetter) => string;
  isContainer?: boolean;
  defaultStyle?: Partial<FlowNodeStyle>;
  /**
   * Shape-specific adjustable parameters (draw.io-style adjustment vertices).
   * Generic ones (corner radius/fold/shear/compartment height…) are derived in `adjust.ts` from draw / decor and need no repetition here.
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

/** Display order of sidebar categories */
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

/** Default size per shape; unknown kinds fall back to the generic rectangle size */
export function shapeSize(kind: ShapeKind): ShapeSize {
  return SHAPE_DEFS[kind]?.size ?? { width: 150, height: 64 };
}

export type { AdjustPoint, AdjustMx, ParamGetter, ShapeAdjustDef } from './adjust';
export { adjustsFor, hasAdjusts, paramGetterFor, paramValue, projectAdjust } from './adjust';
