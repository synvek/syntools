import type { ShapeDef } from './index';

export const MIND_SHAPES: ShapeDef[] = [
  {
    kind: 'mindCenter',
    category: 'mind',
    draw: 'roundRect',
    size: { width: 180, height: 76 },
    defaultStyle: { fill: '#2563EB', stroke: '#1D4ED8' },
  },
  {
    kind: 'mindTopic',
    category: 'mind',
    draw: 'roundRect',
    size: { width: 156, height: 60 },
    defaultStyle: { fill: '#DBEAFE', stroke: '#3B82F6' },
  },
  {
    kind: 'mindSub',
    category: 'mind',
    draw: 'rect',
    size: { width: 140, height: 52 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#93C5FD' },
  },
];
