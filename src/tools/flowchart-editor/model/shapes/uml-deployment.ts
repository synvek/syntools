import type { ShapeDef } from './index';
import { axisAdjust, foldAdjust, pxMx } from './adjust';
import { artifactPath, devicePath, executionEnvironmentPath, nodePath } from './uml-paths';

/** 3D 立方体深度可调（节点 / 设备 / 运行环境） */
const CUBE_ADJUST = [
  axisAdjust({
    key: 'cubeDepth',
    labelKey: 'cubeDepth',
    axis: 'x',
    cross: 0,
    default: (w, h) => Math.min(w, h) * 0.18,
    min: () => 4,
    max: (w, h) => Math.min(w, h) * 0.45,
    mx: pxMx((_w, h) => h),
  }),
];

/** UML 部署图：节点、设备、运行环境、制品、部署规范 */
export const UML_DEPLOYMENT_SHAPES: ShapeDef[] = [
  {
    kind: 'umlNode',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: nodePath,
    adjust: CUBE_ADJUST,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlDevice',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: devicePath,
    adjust: CUBE_ADJUST,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlExecutionEnvironment',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 170, height: 110 },
    path: executionEnvironmentPath,
    adjust: CUBE_ADJUST,
    defaultStyle: { fill: '#FFFBEB', stroke: '#B45309' },
  },
  {
    kind: 'umlArtifact',
    category: 'umlDeployment',
    draw: 'path',
    size: { width: 130, height: 96 },
    path: artifactPath,
    adjust: [foldAdjust('foldSize', (w, h) => Math.max(0, Math.min(16, w * 0.16, h * 0.24)))],
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
