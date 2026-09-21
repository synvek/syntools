import type { ShapeDef } from './index';

export const ORG_SHAPES: ShapeDef[] = [
  {
    kind: 'orgUnit',
    category: 'org',
    draw: 'rect',
    size: { width: 180, height: 74 },
    defaultStyle: { fill: '#EFF6FF', stroke: '#2563EB' },
  },
  {
    kind: 'orgAssistant',
    category: 'org',
    draw: 'rect',
    size: { width: 180, height: 74 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#64748B', strokeWidth: 1 },
  },
  {
    kind: 'orgTeam',
    category: 'org',
    draw: 'rect',
    size: { width: 200, height: 74 },
    decor: 'compartments',
    defaultStyle: { fill: '#F0FDFA', stroke: '#0D9488' },
  },
];
