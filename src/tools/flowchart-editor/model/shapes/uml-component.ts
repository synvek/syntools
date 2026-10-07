import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { componentPath, providedInterfacePath, requiredInterfacePath } from './uml-paths';

/** 组件左侧凸块宽度可调 */
const COMPONENT_ADJUST = [
  axisAdjust({
    key: 'componentTab',
    labelKey: 'componentTab',
    axis: 'x',
    cross: (_w, h) => h * 0.16,
    default: (w) => Math.min(w * 0.18, 34),
    min: () => 8,
    max: (w) => w * 0.4,
    mx: pxMx((w) => w),
  }),
];

/** UML 组件图：组件、提供/需求接口、端口、子系统 */
export const UML_COMPONENT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlComponent',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 170, height: 96 },
    path: componentPath,
    adjust: COMPONENT_ADJUST,
    defaultStyle: { fill: '#ECFEFF', stroke: '#0891B2' },
  },
  {
    kind: 'umlProvidedInterface',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 96, height: 96 },
    path: providedInterfacePath,
    defaultStyle: { fill: 'transparent', stroke: '#0891B2' },
  },
  {
    kind: 'umlRequiredInterface',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 96, height: 96 },
    path: requiredInterfacePath,
    defaultStyle: { fill: 'transparent', stroke: '#0891B2' },
  },
  {
    kind: 'umlPort',
    category: 'umlComponent',
    draw: 'rect',
    size: { width: 22, height: 22 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#0891B2' },
  },
  {
    kind: 'umlSubsystem',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 190, height: 110 },
    path: componentPath,
    adjust: COMPONENT_ADJUST,
    defaultStyle: { fill: '#ECFEFF', stroke: '#0891B2' },
  },
];
