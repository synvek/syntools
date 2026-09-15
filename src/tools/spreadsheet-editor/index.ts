import type { ToolMeta } from '@/core/types';

/**
 * 电子表格编辑器（「高级工具」分类）：基于 Univer 的表格编辑
 * + 浏览器本地 .xlsx 导入导出，数据不离开浏览器。
 */
export const spreadsheetEditorTool: ToolMeta = {
  id: 'spreadsheet-editor',
  name: '电子表格编辑器',
  description: '本地编辑表格并导入导出 Excel(.xlsx)，支持公式与多工作表',
  category: 'advanced',
  keywords: [
    'sheet',
    'spreadsheet',
    'excel',
    'xlsx',
    'univer',
    '电子表格',
    '表格',
    '工作表',
    '导入',
    '导出',
  ],
  icon: 'sheet',
  component: () => import('./SpreadsheetTool'),
  weight: 2,
};
