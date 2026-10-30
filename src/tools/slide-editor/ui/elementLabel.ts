import type { SlideElement } from '../model/types';

/**
 * 元素在面板里的显示名：优先用元素自己的内容（文字、图表标题、公式源码），
 * 再退回工具栏里用的类型名。
 *
 * 单独成文件（而不是放在 `LayerPanel.tsx` 里）有实际原因：图层与动画窗格都要用，
 * 从组件文件里导出工具函数会触发 `react-refresh/only-export-components`。
 */
export function elementLabel(element: SlideElement, t: (key: string) => string): string {
  if (element.type === 'text' || element.type === 'shape') {
    const text = element.body?.paragraphs
      .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
      .join(' ')
      .trim();
    if (text) return text.length > 18 ? `${text.slice(0, 18)}…` : text;
  }
  if (element.type === 'image') return t('tools.slide.insertImage');
  if (element.type === 'table') return t('tools.slide.insertTable');
  if (element.type === 'group') return t('tools.slide.group');
  if (element.type === 'line') return t('tools.slide.insertLine');
  if (element.type === 'placeholder') return element.label;
  // Charts/formulas/icons used to fall into the "text box" fallback, inconsistent with the toolbar naming
  if (element.type === 'chart') {
    const title = element.title?.trim();
    return title || t('tools.slide.insertChart');
  }
  if (element.type === 'formula') {
    const latex = element.latex.trim();
    return latex
      ? `${t('tools.slide.insertFormula')}: ${latex.length > 14 ? `${latex.slice(0, 14)}…` : latex}`
      : t('tools.slide.insertFormula');
  }
  if (element.type === 'icon') return t('tools.slide.insertIcon');
  return t('tools.slide.insertText');
}
