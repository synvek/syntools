import type { ShapeDef } from './index';

export const ER_SHAPES: ShapeDef[] = [
  {
    kind: 'erEntity',
    category: 'er',
    draw: 'rect',
    size: { width: 155, height: 74 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'erAttribute',
    category: 'er',
    draw: 'ellipse',
    size: { width: 145, height: 64 },
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
  {
    kind: 'erRelationship',
    category: 'er',
    draw: 'diamond',
    size: { width: 155, height: 92 },
    defaultStyle: { fill: '#FEFCE8', stroke: '#D97706' },
  },
  {
    kind: 'erWeakEntity',
    category: 'er',
    draw: 'rect',
    size: { width: 155, height: 74 },
    decor: 'doubleCircle',
    defaultStyle: { fill: '#EFF6FF', stroke: '#1D4ED8', strokeWidth: 3 },
  },
];
