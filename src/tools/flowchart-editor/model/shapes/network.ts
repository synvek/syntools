import type { ShapeDef } from './index';

/** 云：多段圆弧组成的云形轮廓 */
const cloudPath = (w: number, h: number): string =>
  `M${w * 0.2},${h * 0.78} H${w * 0.8} a${w * 0.11},${w * 0.11} 0 0,0 0,-${h * 0.2} ` +
  `a${w * 0.17},${w * 0.17} 0 0,0 -${w * 0.24},-${h * 0.17} ` +
  `a${w * 0.2},${w * 0.2} 0 0,0 -${w * 0.3},${h * 0.09} ` +
  `a${w * 0.12},${w * 0.12} 0 0,0 -${w * 0.06},${h * 0.28} Z`;

const BLUE = { fill: '#EFF6FF', stroke: '#2563EB' } as const;
const SLATE = { fill: '#F8FAFC', stroke: '#475569' } as const;

export const NETWORK_SHAPES: ShapeDef[] = [
  {
    kind: 'netServer',
    category: 'network',
    draw: 'rect',
    size: { width: 116, height: 84 },
    decor: 'serverLines',
    defaultStyle: { ...SLATE },
  },
  {
    kind: 'netClient',
    category: 'network',
    draw: 'rect',
    size: { width: 116, height: 84 },
    decor: 'screen',
    defaultStyle: { ...BLUE },
  },
  {
    kind: 'netRouter',
    category: 'network',
    draw: 'rect',
    size: { width: 126, height: 74 },
    decor: 'crossArrows',
    defaultStyle: { ...BLUE },
  },
  {
    kind: 'netSwitch',
    category: 'network',
    draw: 'rect',
    size: { width: 126, height: 74 },
    decor: 'split',
    defaultStyle: { ...BLUE },
  },
  {
    kind: 'netFirewall',
    category: 'network',
    draw: 'rect',
    size: { width: 126, height: 74 },
    decor: 'brick',
    defaultStyle: { fill: '#FEF2F2', stroke: '#DC2626' },
  },
  {
    kind: 'netLoadBalancer',
    category: 'network',
    draw: 'rect',
    size: { width: 126, height: 84 },
    decor: 'split',
    defaultStyle: { fill: '#F5F3FF', stroke: '#7C3AED' },
  },
  {
    kind: 'netCloud',
    category: 'network',
    draw: 'path',
    size: { width: 156, height: 96 },
    path: cloudPath,
    defaultStyle: { ...BLUE },
  },
  {
    kind: 'netCdn',
    category: 'network',
    draw: 'ellipse',
    size: { width: 126, height: 74 },
    decor: 'globe',
    defaultStyle: { fill: '#ECFEFF', stroke: '#0891B2' },
  },
  {
    kind: 'netDatabase',
    category: 'network',
    draw: 'cylinder',
    size: { width: 126, height: 84 },
    defaultStyle: { fill: '#F0FDF4', stroke: '#15803D' },
  },
  {
    kind: 'netStorage',
    category: 'network',
    draw: 'rect',
    size: { width: 126, height: 74 },
    decor: 'disk',
    defaultStyle: { ...SLATE },
  },
];
