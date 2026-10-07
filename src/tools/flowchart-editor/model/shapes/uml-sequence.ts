import type { ShapeDef } from './index';
import { combinedFragmentPath, interactionUsePath, lifelinePath } from './uml-paths';

/** UML 时序图：生命线、激活条、销毁、组合片段、交互引用、状态不变式、门 */
export const UML_SEQUENCE_SHAPES: ShapeDef[] = [
  {
    kind: 'umlLifeline',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 120, height: 300 },
    path: lifelinePath,
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlActivation',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 22, height: 140 },
    defaultStyle: { fill: '#E2E8F0', stroke: '#64748B' },
  },
  {
    kind: 'umlDestroy',
    category: 'umlSequence',
    draw: 'cross',
    size: { width: 36, height: 36 },
    defaultStyle: { fill: 'transparent', stroke: '#334155', strokeWidth: 3 },
  },
  {
    kind: 'umlCombinedFragment',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 360, height: 200 },
    path: combinedFragmentPath,
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlInteractionUse',
    category: 'umlSequence',
    draw: 'path',
    size: { width: 220, height: 120 },
    path: interactionUsePath,
    defaultStyle: { fill: 'transparent', stroke: '#64748B' },
  },
  {
    kind: 'umlStateInvariant',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 120, height: 40 },
    defaultStyle: { fill: '#F1F5F9', stroke: '#64748B', lineDash: 'dashed' },
  },
  {
    kind: 'umlGate',
    category: 'umlSequence',
    draw: 'rect',
    size: { width: 24, height: 24 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#64748B' },
  },
];
