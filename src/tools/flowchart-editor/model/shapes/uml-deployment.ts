import type { ShapeDef } from './index';
import { artifactPath, devicePath, executionEnvironmentPath, nodePath } from './uml-paths';

/** UML 部署图：节点、设备、运行环境、制品、部署规范 */
export const UML_DEPLOYMENT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlNode',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: nodePath,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlDevice',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: devicePath,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlExecutionEnvironment',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: executionEnvironmentPath,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlArtifact',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 130, height: 96 },
    path: artifactPath,
    defaultStyle: { fill: '#FEF3C7', stroke: '#B45309' },
  },
  {
    kind: 'umlDeploymentSpec',
    category: 'umlDeployment',
    draw: 'rect',
    size: { width: 150, height: 90 },
    decor: 'compartments',
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
];
