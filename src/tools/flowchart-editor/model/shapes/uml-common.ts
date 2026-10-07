import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { actorPath, boundaryPath, controlPath, entityPath, framePath } from './uml-paths';

/** UML 通用：跨图种复用的基础元素（角色、注释、分析类、图框） */
export const UML_COMMON_SHAPES: ShapeDef[] = [
  {
    kind: 'umlActor',
    category: 'umlCommon',
    draw: 'path',
    size: { width: 80, height: 110 },
    path: actorPath,
    defaultStyle: { fill: 'transparent', stroke: '#334155' },
  },
  {
    kind: 'umlNote',
    category: 'umlCommon',
    draw: 'note',
    size: { width: 150, height: 90 },
    defaultStyle: { fill: '#FEFCE8', stroke: '#A16207' },
  },
  {
    kind: 'umlBoundary',
    category: 'umlCommon',
    draw: 'path',
    size: { width: 120, height: 96 },
    path: boundaryPath,
    defaultStyle: { fill: 'transparent', stroke: '#334155' },
  },
  {
    kind: 'umlControl',
    category: 'umlCommon',
    draw: 'path',
    size: { width: 120, height: 96 },
    path: controlPath,
    defaultStyle: { fill: 'transparent', stroke: '#334155' },
  },
  {
    kind: 'umlEntity',
    category: 'umlCommon',
    draw: 'path',
    size: { width: 120, height: 96 },
    path: entityPath,
    defaultStyle: { fill: 'transparent', stroke: '#334155' },
  },
  {
    kind: 'umlFrame',
    category: 'umlCommon',
    draw: 'path',
    size: { width: 280, height: 190 },
    path: framePath,
    adjust: [
      axisAdjust({
        key: 'tabHeight',
        labelKey: 'tabHeight',
        axis: 'y',
        cross: (w) => w / 2,
        default: (_w, h) => Math.min(h * 0.16, 26),
        min: () => 10,
        max: (_w, h) => h * 0.5,
        mx: pxMx((_w, h) => h),
      }),
    ],
    defaultStyle: { fill: 'transparent', stroke: '#475569' },
  },
];
