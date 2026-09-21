import type { ShapeDef } from './index';

/** 数据对象：右上角折角矩形 */
const dataObjectPath = (w: number, h: number): string => `M0,0 H${w - 14} L${w},14 V${h} H0 Z`;

/** 文本注释：左侧开放括号形 */
const textAnnotationPath = (w: number, h: number): string => `M${w * 0.24},0 H0 V${h} H${w * 0.24}`;

const EVENT_GREEN = { fill: '#ECFDF5', stroke: '#16A34A' } as const;
const EVENT_RED = { fill: '#FEF2F2', stroke: '#DC2626' } as const;
const EVENT_AMBER = { fill: '#FFFBEB', stroke: '#D97706' } as const;
const GATEWAY = { fill: '#FFFBEB', stroke: '#D97706' } as const;

export const BPMN_SHAPES: ShapeDef[] = [
  {
    kind: 'bpmnEventStart',
    category: 'bpmn',
    draw: 'circle',
    size: { width: 62, height: 62 },
    defaultStyle: { ...EVENT_GREEN },
  },
  {
    kind: 'bpmnEventIntermediate',
    category: 'bpmn',
    draw: 'circle',
    size: { width: 62, height: 62 },
    decor: 'doubleCircle',
    defaultStyle: { ...EVENT_AMBER },
  },
  {
    kind: 'bpmnEventEnd',
    category: 'bpmn',
    draw: 'circle',
    size: { width: 62, height: 62 },
    decor: 'thickRing',
    defaultStyle: { ...EVENT_RED },
  },
  {
    kind: 'bpmnGatewayExclusive',
    category: 'bpmn',
    draw: 'diamond',
    size: { width: 74, height: 74 },
    decor: 'x',
    defaultStyle: { ...GATEWAY },
  },
  {
    kind: 'bpmnGatewayParallel',
    category: 'bpmn',
    draw: 'diamond',
    size: { width: 74, height: 74 },
    decor: 'plus',
    defaultStyle: { ...GATEWAY },
  },
  {
    kind: 'bpmnGatewayInclusive',
    category: 'bpmn',
    draw: 'diamond',
    size: { width: 74, height: 74 },
    decor: 'innerCircle',
    defaultStyle: { ...GATEWAY },
  },
  {
    kind: 'bpmnTask',
    category: 'bpmn',
    draw: 'roundRect',
    size: { width: 155, height: 72 },
    defaultStyle: { fill: '#FDF2F8', stroke: '#DB2777' },
  },
  {
    kind: 'bpmnSubProcess',
    category: 'bpmn',
    draw: 'roundRect',
    size: { width: 190, height: 96 },
    decor: 'plusBox',
    defaultStyle: { fill: '#FDF2F8', stroke: '#DB2777' },
  },
  {
    kind: 'bpmnCallActivity',
    category: 'bpmn',
    draw: 'roundRect',
    size: { width: 155, height: 72 },
    defaultStyle: { fill: '#FDF2F8', stroke: '#DB2777', strokeWidth: 4 },
  },
  {
    kind: 'bpmnDataObject',
    category: 'bpmn',
    draw: 'path',
    size: { width: 140, height: 72 },
    path: dataObjectPath,
    defaultStyle: { fill: '#F0FDF4', stroke: '#15803D' },
  },
  {
    kind: 'bpmnDataStore',
    category: 'bpmn',
    draw: 'cylinder',
    size: { width: 130, height: 84 },
    defaultStyle: { fill: '#F0FDF4', stroke: '#15803D' },
  },
  {
    kind: 'bpmnTextAnnotation',
    category: 'bpmn',
    draw: 'path',
    size: { width: 160, height: 84 },
    path: textAnnotationPath,
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
];
