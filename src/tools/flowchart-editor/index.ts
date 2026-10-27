import type { ToolMeta } from '@/core/types';

/**
 * Flowchart editor (a heavyweight tool in the "Documents & creation" category):
 * the self-built canvas uses React Flow (@xyflow/react) as the node editing engine and offers ProcessOn / DrawIO-like
 * diagramming: node dragging with edges, a shape library and templates, auto-layout, grid snapping and alignment guides,
 * undo/redo, plus PNG / SVG export and a local draft (data never leaves the browser).
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
