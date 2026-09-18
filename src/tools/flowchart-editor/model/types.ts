/**
 * 流程图编辑器数据模型契约。
 * 这里只放纯数据结构（不依赖 React Flow），方便 core.ts 单测与草稿序列化。
 * React Flow 的 Node/Edge 类型在 store.ts 中按需引入。
 */

export type ShapeKind = 'rect' | 'startEnd' | 'decision' | 'data' | 'swimlane' | 'bpmnTask';

export type Align = 'left' | 'center' | 'right';

export interface FlowNodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: Align;
}

export interface FlowNodeData extends Record<string, unknown> {
  kind: ShapeKind;
  label: string;
  style: FlowNodeStyle;
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string;
}

/** 部分更新节点数据：style 允许只传需要改动的字段 */
export type FlowNodePatch = Partial<Omit<FlowNodeData, 'style'>> & {
  style?: Partial<FlowNodeStyle>;
};

/** 画布上一帧可被序列化/反序列化的快照 */
export interface FlowDoc {
  nodes: Array<{
    id: string;
    type: 'shape';
    position: { x: number; y: number };
    data: FlowNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
  }>;
  version: number;
}

/** 各形状的默认尺寸（像素），用于自动布局与未测量时的占位 */
export interface ShapeSize {
  width: number;
  height: number;
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: '过程',
  startEnd: '开始/结束',
  decision: '判断',
  data: '数据',
  swimlane: '泳道',
  bpmnTask: 'BPMN 任务',
};

export function shapeSize(kind: ShapeKind): ShapeSize {
  switch (kind) {
    case 'decision':
      return { width: 140, height: 90 };
    case 'swimlane':
      return { width: 320, height: 140 };
    case 'bpmnTask':
      return { width: 150, height: 70 };
    case 'startEnd':
      return { width: 130, height: 56 };
    case 'data':
      return { width: 150, height: 64 };
    case 'rect':
    default:
      return { width: 150, height: 64 };
  }
}
