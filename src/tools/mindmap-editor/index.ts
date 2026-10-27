import type { ToolMeta } from '@/core/types';

/**
 * Mind map editor (a heavyweight tool in the "Documents & creation" category):
 * The home-grown canvas also uses React Flow (`@xyflow/react`) as its rendering engine, paired with
 * our own tidy-tree layout, to deliver XMind / MindMaster-style mind mapping — rapid keyboard node
 * creation, branch collapsing, multiple layouts and colour themes, drag-and-drop reparenting,
 * undo / redo, plus PNG / SVG / PDF / JSON / Markdown export and local drafts (data never leaves
 * the browser).
 */
export const mindmapEditorTool: ToolMeta = {
  id: 'mindmap-editor',
  name: '脑图编辑器',
  description: '本地绘制思维导图，支持键盘建节点、折叠分支、多布局主题与 PNG/SVG/Markdown 导出',
  category: 'advanced',
  keywords: [
    'mindmap',
    'mind map',
    'brainstorm',
    'xmind',
    '脑图',
    '思维导图',
    '大纲',
    '结构图',
    '思维',
  ],
  icon: 'mindmap',
  component: () => import('./MindmapTool'),
  weight: 5,
  relatedIds: ['flowchart-editor', 'md-mindmap', 'slide-editor'],
};
