import type { ShapeDef } from './index';
import { componentPath, providedInterfacePath, requiredInterfacePath } from './uml-paths';

/** UML 组件图：组件、提供/需求接口、端口、子系统 */
export const UML_COMPONENT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlComponent',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 170, height: 96 },
    path: componentPath,
    defaultStyle: { fill: '#ECFEFF', stroke: '#0891B2' },
  },
  {
    kind: 'umlProvidedInterface',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 96, height: 96 },
    path: providedInterfacePath,
    defaultStyle: { fill: 'transparent', stroke: '#0891B2' },
  },
  {
    kind: 'umlRequiredInterface',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 96, height: 96 },
    path: requiredInterfacePath,
    defaultStyle: { fill: 'transparent', stroke: '#0891B2' },
  },
  {
    kind: 'umlPort',
    category: 'umlComponent',
    draw: 'rect',
    size: { width: 22, height: 22 },
    defaultStyle: { fill: '#FFFFFF', stroke: '#0891B2' },
  },
  {
    kind: 'umlSubsystem',
    category: 'umlComponent',
    draw: 'path',
    size: { width: 190, height: 110 },
    path: componentPath,
    defaultStyle: { fill: '#ECFEFF', stroke: '#0891B2' },
  },
];
