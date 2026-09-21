import type { ShapeDef } from './index';
import { SWIMLANE_SIZE, SWIMLANE_V_SIZE } from '../types';

const LANE_STYLE = {
  fill: '#F8FAFC',
  stroke: '#475569',
  align: 'left',
} as const;

export const CONTAINER_SHAPES: ShapeDef[] = [
  {
    kind: 'swimlane',
    category: 'flow',
    draw: 'laneH',
    size: SWIMLANE_SIZE,
    isContainer: true,
    defaultStyle: { ...LANE_STYLE },
  },
  {
    kind: 'swimlaneV',
    category: 'flow',
    draw: 'laneV',
    size: SWIMLANE_V_SIZE,
    isContainer: true,
    defaultStyle: { ...LANE_STYLE },
  },
  {
    kind: 'group',
    category: 'flow',
    draw: 'group',
    size: { width: 300, height: 200 },
    isContainer: true,
    defaultStyle: { fill: 'rgba(148,163,184,0.06)', stroke: '#94A3B8', align: 'left' },
  },
];
