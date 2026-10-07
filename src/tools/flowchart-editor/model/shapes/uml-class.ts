import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { activeClassPath, templateClassPath } from './uml-paths';

/** UML 类图：类、接口、枚举、数据类型、抽象类、活动类、模板类、关联类 */
export const UML_CLASS_SHAPES: ShapeDef[] = [
  {
    kind: 'umlClass',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 170, height: 100 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlInterface',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 160, height: 84 },
    decor: 'compartments',
    defaultStyle: { fill: '#FDF4FF', stroke: '#A21CAF' },
  },
  {
    kind: 'umlEnumeration',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 170, height: 100 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlDataType',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 160, height: 80 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlAbstractClass',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 170, height: 100 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488', italic: true },
  },
  {
    kind: 'umlActiveClass',
    category: 'umlClass',
    draw: 'path',
    size: { width: 170, height: 100 },
    path: activeClassPath,
    decor: 'compartments',
    adjust: [
      axisAdjust({
        key: 'activeClassInset',
        labelKey: 'activeClassInset',
        axis: 'x',
        cross: (_w, h) => h / 2,
        default: (w) => Math.max(5, w * 0.05),
        min: () => 3,
        max: (w) => w * 0.25,
        mx: pxMx((w) => w),
      }),
    ],
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlTemplateClass',
    category: 'umlClass',
    draw: 'path',
    size: { width: 184, height: 104 },
    path: templateClassPath,
    decor: 'compartments',
    adjust: [
      axisAdjust({
        key: 'tabHeight',
        labelKey: 'tabHeight',
        axis: 'y',
        cross: (w) => w / 2,
        default: (_w, h) => Math.min(h * 0.24, 26),
        min: () => 10,
        max: (_w, h) => h * 0.5,
        mx: pxMx((_w, h) => h),
      }),
    ],
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlAssociationClass',
    category: 'umlClass',
    draw: 'rect',
    size: { width: 170, height: 100 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488', lineDash: 'dashed' },
  },
];
