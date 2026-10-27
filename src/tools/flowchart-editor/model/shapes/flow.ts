import type { ShapeDef } from './index';
import { axisAdjust, pxMx, type ParamGetter } from './adjust';

/** Predefined process: rectangle + vertical lines on both sides (inset adjustable via barWidth) */
const predefinedPath = (w: number, h: number, p: ParamGetter): string => {
  const bw = p('barWidth');
  return `M0,0 H${w} V${h} H0 Z M${bw},0 V${h} M${w - bw},0 V${h}`;
};

/** Off-page connector: house-shaped pentagon (roof height adjustable) */
const offPagePath = (w: number, h: number, p: ParamGetter): string => {
  const roof = p('roofHeight');
  return `M0,${h} V${roof} L${w / 2},0 L${w},${roof} V${h} Z`;
};

/** Loop limit: rectangle with a notch in the bottom-left corner (notch size adjustable) */
const loopLimitPath = (w: number, h: number, p: ParamGetter): string => {
  const notch = p('loopNotch');
  return `M0,0 H${w} V${h} H${notch} L0,${h - notch} Z`;
};

export const FLOW_SHAPES: ShapeDef[] = [
  {
    kind: 'startEnd',
    category: 'flow',
    draw: 'capsule',
    size: { width: 130, height: 56 },
    defaultStyle: { fill: '#ECFDF5', stroke: '#16A34A' },
  },
  {
    kind: 'decision',
    category: 'flow',
    draw: 'diamond',
    size: { width: 140, height: 90 },
    defaultStyle: { fill: '#FEFCE8', stroke: '#D97706' },
  },
  { kind: 'data', category: 'flow', draw: 'parallelogram', size: { width: 150, height: 64 } },
  { kind: 'document', category: 'flow', draw: 'document', size: { width: 150, height: 70 } },
  {
    kind: 'predefined',
    category: 'flow',
    draw: 'path',
    size: { width: 170, height: 64 },
    path: predefinedPath,
    adjust: [
      axisAdjust({
        key: 'barWidth',
        labelKey: 'barWidth',
        axis: 'x',
        cross: (_w, h) => h / 2,
        default: () => 14,
        min: () => 4,
        max: (w) => w * 0.4,
        mx: pxMx((w) => w),
      }),
    ],
  },
  { kind: 'manualInput', category: 'flow', draw: 'trapezoid', size: { width: 150, height: 64 } },
  {
    kind: 'manualOperation',
    category: 'flow',
    draw: 'invTrapezoid',
    size: { width: 150, height: 64 },
  },
  { kind: 'preparation', category: 'flow', draw: 'hexagon', size: { width: 170, height: 64 } },
  { kind: 'database', category: 'flow', draw: 'cylinder', size: { width: 130, height: 80 } },
  {
    kind: 'display',
    category: 'flow',
    draw: 'invParallelogram',
    size: { width: 150, height: 64 },
  },
  {
    kind: 'onPageConnector',
    category: 'flow',
    draw: 'circle',
    size: { width: 72, height: 72 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#2563EB' },
  },
  {
    kind: 'offPageConnector',
    category: 'flow',
    draw: 'path',
    size: { width: 96, height: 76 },
    path: offPagePath,
    adjust: [
      axisAdjust({
        key: 'roofHeight',
        labelKey: 'roofHeight',
        axis: 'y',
        cross: (w) => w / 2,
        default: (_w, h) => h * 0.45,
        max: (_w, h) => h * 0.9,
        mx: pxMx((_w, h) => h),
      }),
    ],
  },
  { kind: 'terminator', category: 'flow', draw: 'capsule', size: { width: 130, height: 56 } },
  {
    kind: 'parallelMode',
    category: 'flow',
    draw: 'bar',
    size: { width: 160, height: 46 },
    decor: 'grid',
  },
  {
    kind: 'loopLimit',
    category: 'flow',
    draw: 'path',
    size: { width: 170, height: 64 },
    path: loopLimitPath,
    adjust: [
      axisAdjust({
        key: 'loopNotch',
        labelKey: 'loopNotch',
        axis: 'x',
        cross: (_w, h) => h,
        default: (_w, h) => h * 0.3,
        max: (_w, h) => h * 0.9,
        mx: pxMx((_w, h) => h),
      }),
    ],
  },
];
