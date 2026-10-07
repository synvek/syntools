import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { extendPath, includePath, subjectPath } from './uml-paths';

/** UML 用例图：用例、系统边界、包含/扩展关系、扩展点 */
export const UML_USECASE_SHAPES: ShapeDef[] = [
  {
    kind: 'umlUseCase',
    category: 'umlUseCase',
    draw: 'ellipse',
    size: { width: 160, height: 84 },
    defaultStyle: { fill: '#EEF2FF', stroke: '#4F46E5' },
  },
  {
    kind: 'umlSubject',
    category: 'umlUseCase',
    draw: 'path',
    size: { width: 340, height: 220 },
    path: subjectPath,
    adjust: [
      axisAdjust({
        key: 'tabHeight',
        labelKey: 'tabHeight',
        axis: 'y',
        cross: (w) => w / 2,
        default: (_w, h) => Math.min(h * 0.18, 28),
        min: () => 10,
        max: (_w, h) => h * 0.5,
        mx: pxMx((_w, h) => h),
      }),
    ],
    defaultStyle: { fill: 'transparent', stroke: '#4F46E5' },
  },
  {
    kind: 'umlInclude',
    category: 'umlUseCase',
    draw: 'path',
    size: { width: 130, height: 52 },
    path: includePath,
    defaultStyle: { fill: '#FFFFFF', stroke: '#4F46E5', lineDash: 'dashed' },
  },
  {
    kind: 'umlExtend',
    category: 'umlUseCase',
    draw: 'path',
    size: { width: 130, height: 52 },
    path: extendPath,
    defaultStyle: { fill: '#FFFFFF', stroke: '#4F46E5', lineDash: 'dashed' },
  },
  {
    kind: 'umlExtensionPoint',
    category: 'umlUseCase',
    draw: 'roundRect',
    size: { width: 150, height: 36 },
    defaultStyle: { fill: '#EEF2FF', stroke: '#4F46E5' },
  },
];
