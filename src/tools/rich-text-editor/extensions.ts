import { Extension, Node } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { FontFamily, FontSize, LineHeight, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { FindReplace } from './find-replace';
import { ImageLayerCommands } from './imageLayer';
import { BlockStyleCommands, ImageStyle, ParagraphStyle, TableStyle } from './blockStyles';
import { Comment, DocMarkCommands, TrackedDelete, TrackedInsert } from './marks';
import { createPageLayoutPlugin } from './PageView';
import { resolvePageMetrics, type PageMetrics } from './pageSetup';

/**
 * 编辑器扩展组合（技术设计 §8.3）：
 * StarterKit 已内置 Link / Underline（Tiptap v3），此处只补充其未覆盖的能力。
 * 本文件被 RichTextEditorTool 懒加载引用，因此 TipTap 不会进入首屏包。
 */

/** 分页符节点：导出 Word 时转 pageBreakBefore，打印/页面视图中自然分页 */
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },
  renderHTML() {
    return ['div', { 'data-page-break': 'true', class: 'rte-page-break-node' }];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: 'pageBreak' }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** 在光标处插入分页符 */
      setPageBreak: () => ReturnType;
    };
  }
}

/** 页面布局插件（Word 式分页）：仅页面视图启用，通过 Decoration.widget 渲染页间空白 */
const PageLayout = Extension.create<{
  onSheetTops?: (tops: number[]) => void;
  getPageMetrics?: () => PageMetrics;
}>({
  name: 'pageLayout',
  addOptions() {
    return { onSheetTops: undefined, getPageMetrics: undefined };
  },
  addProseMirrorPlugins() {
    const { onSheetTops, getPageMetrics } = this.options;
    if (!onSheetTops) return [];
    return [
      createPageLayoutPlugin(onSheetTops, getPageMetrics ?? (() => resolvePageMetrics(null))),
    ];
  },
});

export function createExtensions(
  placeholder: string,
  onPageLayout?: (tops: number[]) => void,
  getPageMetrics?: () => PageMetrics,
) {
  return [
    StarterKit.configure({
      // 链接点击不跳转，交由工具栏编辑
      link: { openOnClick: false, autolink: true },
    }),
    TextStyle,
    FontSize,
    FontFamily,
    LineHeight,
    Color,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // TableStyle 是 Table 的扩展（含边框/斑马纹属性），不可与原 Table 同时注册，
    // 否则会重复注册 tableColumnResizing 插件（PM 报 keyed plugin 实例冲突）
    TableStyle.configure({ resizable: true, HTMLAttributes: { class: 'rte-table' } }),
    TableRow,
    TableCell,
    TableHeader,
    // ImageStyle 同理替代原 Image
    ImageStyle.configure({ allowBase64: true }),
    ImageLayerCommands,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder }),
    FindReplace,
    PageBreak,
    ParagraphStyle,
    BlockStyleCommands,
    Comment,
    TrackedInsert,
    TrackedDelete,
    DocMarkCommands,
    PageLayout.configure({ onSheetTops: onPageLayout, getPageMetrics: getPageMetrics }),
  ];
}
