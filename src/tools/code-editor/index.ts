import type { ToolMeta } from '@/core/types';

/**
 * 代码编辑器（「文档与创作」分类）：可编辑的语法高亮编辑器。
 * 编辑体验：查找替换（大小写 / 整词 / 正则）、行操作与快捷键、缩进引导线、
 * 括号配对与跳转、折叠范围标记、批量替换（选择同词）、当前行高亮。
 * 输出：多语言格式化（Prettier + 内置）、10 套风格主题、样式化导出卡片
 * （窗口样式 / 留白 / 圆角 / 阴影 / 背景 / 水印 / 指定行高亮 / 行号），
 * 导出源码 / 独立 HTML / PNG / JPG / SVG，复制 Markdown / 富文本 / 图片，
 * 压缩分享链接与本地草稿，全部在本地完成。
 */
export const codeEditorTool: ToolMeta = {
  id: 'code-editor',
  name: '代码编辑器',
  description:
    '可编辑语法高亮：查找替换、行操作、括号配对、折叠、批量编辑，10 套主题与样式化卡片导出',
  category: 'advanced',
  keywords: [
    'code',
    'editor',
    'ide',
    'prettier',
    'java',
    'rust',
    'highlight',
    'find',
    'replace',
    'fold',
    'watermark',
    '代码',
    '编辑器',
    '格式化',
    '高亮',
    '查找替换',
    '折叠',
    '水印',
    '导出',
  ],
  icon: 'codeEditor',
  component: () => import('./CodeEditorTool'),
  weight: 2,
  relatedIds: ['code-highlight', 'code-image', 'code-minify'],
};
