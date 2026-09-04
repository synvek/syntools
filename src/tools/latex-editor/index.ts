import type { ToolMeta } from '@/core/types';

export const latexEditorTool: ToolMeta = {
  id: 'latex-editor',
  name: 'LaTeX 数学公式编辑器',
  description: '快捷符号与经典公式，KaTeX 预览，导出 PNG/JPG/SVG',
  category: 'formatting',
  keywords: ['latex', 'katex', '公式', 'math', '数学', 'tex', 'png', 'svg'],
  icon: 'latex',
  component: () => import('./LatexEditorTool'),
  weight: 15,
};
