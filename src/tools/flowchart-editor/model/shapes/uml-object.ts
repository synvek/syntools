import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { packagePath } from './uml-paths';

/** 包标签高度可调（左上角名称栏） */
const PACKAGE_ADJUST = [
  axisAdjust({
    key: 'tabHeight',
    labelKey: 'tabHeight',
    axis: 'y',
    cross: (w) => w / 2,
    default: (_w, h) => h * 0.32,
    min: () => 10,
    max: (_w, h) => h * 0.6,
    mx: pxMx((_w, h) => h),
  }),
];

/** UML 对象/包图：包、对象、带槽对象、模型、剖面 */
export const UML_OBJECT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlPackage',
    category: 'umlObject',
    draw: 'path',
    size: { width: 170, height: 100 },
    path: packagePath,
    adjust: PACKAGE_ADJUST,
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlObject',
    category: 'umlObject',
    draw: 'rect',
    size: { width: 140, height: 80 },
    decor: 'compartments',
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlObjectSlot',
    category: 'umlObject',
    draw: 'rect',
    size: { width: 160, height: 110 },
    decor: 'compartments',
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlModel',
    category: 'umlObject',
    draw: 'path',
    size: { width: 180, height: 110 },
    path: packagePath,
    adjust: PACKAGE_ADJUST,
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlProfile',
    category: 'umlObject',
    draw: 'path',
    size: { width: 180, height: 110 },
    path: packagePath,
    adjust: PACKAGE_ADJUST,
    defaultStyle: { fill: '#FFEDD5', stroke: '#C2410C' },
  },
];
