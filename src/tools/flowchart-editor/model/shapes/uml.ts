import type { ShapeDef } from './index';

/** 角色（火柴人）：头 + 躯干 + 手臂 + 腿 */
const actorPath = (w: number, h: number): string => {
  const cx = w / 2;
  const r = w * 0.13;
  return (
    `M${cx - r},${h * 0.16} a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0 ` +
    `M${cx},${h * 0.3} V${h * 0.6} ` +
    `M${w * 0.22},${h * 0.44} H${w * 0.78} ` +
    `M${w * 0.26},${h * 0.94} L${cx},${h * 0.6} L${w * 0.74},${h * 0.94}`
  );
};

/** 包：左上角标签 + 主体矩形 */
const packagePath = (w: number, h: number): string =>
  `M0,${h * 0.32} V${h} H${w} V${h * 0.32} H${w * 0.45} V0 H0 Z`;

/** 生命线：顶部对象框 + 向下竖虚线 */
const lifelinePath = (w: number, h: number): string =>
  `M${w * 0.2},0 H${w * 0.8} V${h * 0.16} H${w * 0.2} Z M${w * 0.5},${h * 0.16} V${h}`;

export const UML_SHAPES: ShapeDef[] = [
  {
    kind: 'umlActor',
    category: 'uml',
    draw: 'path',
    size: { width: 80, height: 110 },
    path: actorPath,
    defaultStyle: { fill: 'transparent', stroke: '#334155' },
  },
  {
    kind: 'umlUseCase',
    category: 'uml',
    draw: 'ellipse',
    size: { width: 160, height: 84 },
    defaultStyle: { fill: '#EEF2FF', stroke: '#4F46E5' },
  },
  {
    kind: 'umlClass',
    category: 'uml',
    draw: 'rect',
    size: { width: 170, height: 100 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'umlInterface',
    category: 'uml',
    draw: 'rect',
    size: { width: 160, height: 84 },
    decor: 'compartments',
    defaultStyle: { fill: '#FDF4FF', stroke: '#A21CAF' },
  },
  {
    kind: 'umlPackage',
    category: 'uml',
    draw: 'path',
    size: { width: 170, height: 100 },
    path: packagePath,
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlNote',
    category: 'uml',
    draw: 'note',
    size: { width: 150, height: 90 },
    defaultStyle: { fill: '#FEFCE8', stroke: '#A16207' },
  },
  {
    kind: 'umlLifeline',
    category: 'uml',
    draw: 'path',
    size: { width: 120, height: 300 },
    path: lifelinePath,
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlState',
    category: 'uml',
    draw: 'roundRect',
    size: { width: 160, height: 72 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlStateInitial',
    category: 'uml',
    draw: 'circle',
    size: { width: 44, height: 44 },
    defaultStyle: { fill: '#0F172A', stroke: '#0F172A' },
  },
  {
    kind: 'umlStateFinal',
    category: 'uml',
    draw: 'circle',
    size: { width: 46, height: 46 },
    decor: 'doubleCircle',
    defaultStyle: { fill: '#FFFFFF', stroke: '#0F172A' },
  },
  {
    kind: 'umlForkJoin',
    category: 'uml',
    draw: 'bar',
    size: { width: 180, height: 26 },
    defaultStyle: { fill: '#0F172A', stroke: '#0F172A' },
  },
];
