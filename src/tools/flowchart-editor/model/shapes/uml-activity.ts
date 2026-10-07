import type { ShapeDef } from './index';
import { axisAdjust, pxMx } from './adjust';
import { activityPartitionPath, receiveSignalPath, sendSignalPath } from './uml-paths';

/** UML 活动图：动作、活动、判断/合并、初始/结束、流结束、对象节点、信号、分区、分叉/汇合 */
export const UML_ACTIVITY_SHAPES: ShapeDef[] = [
  {
    kind: 'umlForkJoin',
    category: 'umlActivity',
    draw: 'bar',
    size: { width: 180, height: 26 },
    defaultStyle: { fill: '#0F172A', stroke: '#0F172A' },
  },
  {
    kind: 'umlAction',
    category: 'umlActivity',
    draw: 'roundRect',
    size: { width: 150, height: 60 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlActivity',
    category: 'umlActivity',
    draw: 'roundRect',
    size: { width: 190, height: 96 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB', strokeWidth: 3 },
  },
  {
    kind: 'umlDecisionMerge',
    category: 'umlActivity',
    draw: 'diamond',
    size: { width: 64, height: 64 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlInitialNode',
    category: 'umlActivity',
    draw: 'circle',
    size: { width: 40, height: 40 },
    defaultStyle: { fill: '#0F172A', stroke: '#0F172A' },
  },
  {
    kind: 'umlActivityFinal',
    category: 'umlActivity',
    draw: 'circle',
    size: { width: 48, height: 48 },
    decor: 'bullseye',
    defaultStyle: { fill: '#FFFFFF', stroke: '#0F172A' },
  },
  {
    kind: 'umlFlowFinal',
    category: 'umlActivity',
    draw: 'circle',
    size: { width: 48, height: 48 },
    decor: 'x',
    defaultStyle: { fill: '#FFFFFF', stroke: '#0F172A' },
  },
  {
    kind: 'umlObjectNode',
    category: 'umlActivity',
    draw: 'rect',
    size: { width: 130, height: 60 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlSendSignal',
    category: 'umlActivity',
    draw: 'path',
    size: { width: 130, height: 60 },
    path: sendSignalPath,
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlReceiveSignal',
    category: 'umlActivity',
    draw: 'path',
    size: { width: 130, height: 60 },
    path: receiveSignalPath,
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'umlActivityPartition',
    category: 'umlActivity',
    draw: 'path',
    size: { width: 240, height: 180 },
    path: activityPartitionPath,
    adjust: [
      axisAdjust({
        key: 'partitionHeader',
        labelKey: 'partitionHeader',
        axis: 'x',
        cross: (_w, h) => h / 2,
        default: (w) => Math.min(w * 0.2, 44),
        min: () => 12,
        max: (w) => w * 0.5,
        mx: pxMx((w) => w),
      }),
    ],
    defaultStyle: { fill: 'transparent', stroke: '#2563EB' },
  },
];
