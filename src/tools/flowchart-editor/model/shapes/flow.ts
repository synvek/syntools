import type { ShapeDef } from './index';

/** 预定义过程：矩形 + 两侧竖线 */
const predefinedPath = (w: number, h: number): string =>
  `M0,0 H${w} V${h} H0 Z M14,0 V${h} M${w - 14},0 V${h}`;

/** 离页连接符：房屋形五边形 */
const offPagePath = (w: number, h: number): string =>
  `M0,${h} V${h * 0.45} L${w / 2},0 L${w},${h * 0.45} V${h} Z`;

/** 循环上限：左下角缺角矩形 */
const loopLimitPath = (w: number, h: number): string =>
  `M0,0 H${w} V${h} H${h * 0.3} L0,${h * 0.7} Z`;

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
  },
];
