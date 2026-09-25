import type { ToolMeta } from '@/core/types';

/**
 * 脑图编辑器（「文档与创作」分类重工具）：
 * 自研 Canvas 同样采用 React Flow（@xyflow/react）渲染引擎，配合自研 tidy-tree 布局，
 * 提供类 XMind / MindMaster 的思维导图编辑能力——键盘快速建节点、分支折叠、
 * 多种布局与配色主题、拖拽改挂父节点、撤销重做，并支持 PNG / SVG / PDF / JSON /
 * Markdown 导出与本地草稿（数据不离开浏览器）。
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
