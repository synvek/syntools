import type { ShapeDef } from './index';
import { packagePath } from './uml-paths';

/** UML 对象/包图：包、对象、带槽对象、模型、剖面 */
export const UML_OBJECT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlPackage',
    category: 'umlObject',
    draw: 'path',
    size: { width: 170, height: 100 },
    path: packagePath,
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlObject',
    category: 'umlObject',
    draw: 'rect',
    size: { width: 140, height: 80 },
    decor: 'compartments',
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlObjectSlot',
    category: 'umlObject',
    draw: 'rect',
    size: { width: 160, height: 110 },
    decor: 'compartments',
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlModel',
    category: 'umlObject',
    draw: 'path',
    size: { width: 180, height: 110 },
    path: packagePath,
    defaultStyle: { fill: '#FFF7ED', stroke: '#C2410C' },
  },
  {
    kind: 'umlProfile',
    category: 'umlObject',
    draw: 'path',
    size: { width: 180, height: 110 },
    path: packagePath,
    defaultStyle: { fill: '#FFEDD5', stroke: '#C2410C' },
  },
];
