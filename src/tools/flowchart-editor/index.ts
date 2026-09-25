import type { ToolMeta } from '@/core/types';

/**
 * 流程图编辑器（「文档与创作」分类重工具）：
 * 自研 Canvas 采用 React Flow（@xyflow/react）节点编辑引擎，提供类 ProcessOn / DrawIO
 * 的流程图绘制能力——节点拖拽连线、图形库与模板、自动布局、网格吸附与对齐辅助线、
 * 撤销重做，并支持 PNG / SVG 导出与本地草稿（数据不离开浏览器）。
 */
export const flowchartEditorTool: ToolMeta = {
  id: 'flowchart-editor',
  name: '流程图编辑器',
  description: '本地绘制流程图，支持节点连线、模板、自动布局与 PNG/SVG 导出',
  category: 'advanced',
  keywords: [
    'flowchart',
    'diagram',
    'processon',
    'drawio',
    '流程图',
    '流程',
    '绘图',
    '示意图',
    'bpmn',
  ],
  icon: 'diagram',
  component: () => import('./FlowchartTool'),
  weight: 4,
  relatedIds: ['slide-editor', 'spreadsheet-editor', 'rich-text-editor'],
};
