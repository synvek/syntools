import type { ToolMeta } from '@/core/types';

export const mermaidEditorTool: ToolMeta = {
  id: 'mermaid-editor',
  name: 'Mermaid 在线绘图',
  description: '本地渲染 Mermaid，多主题、缩放，导出 PNG/SVG',
  category: 'generator',
  keywords: ['mermaid', 'flowchart', 'sequence', '图表', '流程图', 'uml', 'png', 'svg'],
  icon: 'mermaid',
  component: () => import('./MermaidEditorTool'),
  weight: 18,
};
