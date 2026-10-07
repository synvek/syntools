import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { combinedFragmentPath, interactionUsePath, lifelinePath } from './uml-paths';

/** 左上角标签高度可调（组合片段 / 交互引用） */
const tabHeightAdjust = (dflt: (w: number, h: number) => number) =>
  axisAdjust({
    key: 'tabHeight',
    labelKey: 'tabHeight',
    axis: 'y' as const,
    cross: (w: number) => w / 2,
    default: dflt,
    min: () => 10,
    max: (_w: number, h: number) => h * 0.5,
    mx: pxMx((_w, h) => h),
  });

/** UML 时序图：生命线、激活条、销毁、组合片段、交互引用、状态不变式、门 */
export const UML_SEQUENCE_SHAPES: ShapeDef[] = [
  {
    kind: 'umlLifeline',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 120, height: 300 },
    path: lifelinePath,
    adjust: [
      // 顶部对象框高度：固定像素（默认 40px），不再随生命线高度等比缩放；仍可拖拽/面板调整
      axisAdjust({
        key: 'lifelineHeader',
        labelKey: 'lifelineHeader',
        axis: 'y',
        cross: (w) => w / 2,
        default: () => 40,
        min: () => 16,
        max: (_w, h) => h * 0.9,
        mx: pxMx(() => 1),
      }),
    ],
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlActivation',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 22, height: 140 },
    defaultStyle: { fill: '#E2E8F0', stroke: '#64748B' },
  },
  {
    kind: 'umlDestroy',
    category: 'umlSequence',
    draw: 'cross',
    size: { width: 36, height: 36 },
    defaultStyle: { fill: 'transparent', stroke: '#334155', strokeWidth: 3 },
  },
  {
    kind: 'umlCombinedFragment',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 360, height: 200 },
    path: combinedFragmentPath,
    adjust: [tabHeightAdjust((_w, h) => Math.min(h * 0.2, 26))],
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlInteractionUse',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 220, height: 120 },
    path: interactionUsePath,
    adjust: [tabHeightAdjust((_w, h) => Math.min(h * 0.2, 26))],
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlStateInvariant',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 120, height: 40 },
    defaultStyle: { fill: '#F1F5F9', stroke: '#64748B', lineDash: 'dashed' },
  },
  {
    kind: 'umlGate',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 24, height: 24 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#64748B' },
  },
];
