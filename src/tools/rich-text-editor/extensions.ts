import { Extension, Node } from '@tiptap/core';
import { dropCursor } from '@tiptap/pm/dropcursor';
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
import { createPageLayoutPlugin, type PageLayoutSnapshot } from './PageView';
import { resolvePageMetrics, type PageMetrics } from './pageSetup';
import { DEFAULT_TOC_LABELS, TableOfContents, type TocLabels } from './toc';
import {
  DEFAULT_FOOTNOTE_LABELS,
  FootnoteList,
  FootnoteRef,
  type FootnoteLabels,
} from './footnotes';
import { MathBlock, MathCommands, MathInline } from './math';
import { Spellcheck, SpellcheckCommands, type SpellDictionary } from './spellcheck';

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

/**
 * 拖动落点光标：拖动图片 / 文本块时在插入位置画一条竖线，用来判断会插到哪个文字前面。
 *
 * StarterKit 虽然内置 dropcursor，但在本项目里始终没有生效（拖动过程中
 * `.ProseMirror-dropcursor` 元素从未出现），所以这里直接注册 ProseMirror 的插件，
 * 顺带把颜色 / 粗细调成可见（默认 1px 黑色在正文里几乎看不出来）。
 */
const DropIndicator = Extension.create({
  name: 'dropIndicator',
  addProseMirrorPlugins() {
    return [dropCursor({ color: '#2563eb', width: 2 })];
  },
});

/** 页面布局插件（Word 式分页）：仅页面视图启用，通过 Decoration.widget 渲染页间空白 */
const PageLayout = Extension.create<{
  onLayout?: (snapshot: PageLayoutSnapshot) => void;
  getPageMetrics?: () => PageMetrics;
}>({
  name: 'pageLayout',
  addOptions() {
    return { onLayout: undefined, getPageMetrics: undefined };
  },
  addProseMirrorPlugins() {
    const { onLayout, getPageMetrics } = this.options;
    if (!onLayout) return [];
    return [createPageLayoutPlugin(onLayout, getPageMetrics ?? (() => resolvePageMetrics(null)))];
  },
});

/** 扩展集合的构造选项：文案与宿主回调都由工具层按当前语言/页面状态注入 */
export interface RichTextExtensionOptions {
  /** 空文档占位文案 */
  placeholder: string;
  /** 分页快照回调（纸面位置 + 每页起始块位置） */
  onLayout?: (snapshot: PageLayoutSnapshot) => void;
  /** 当前页面设置（纸张 / 边距 / 方向） */
  getPageMetrics?: () => PageMetrics;
  /** 目录文案 */
  tocLabels?: TocLabels;
  /** 脚注文案 */
  footnoteLabels?: FootnoteLabels;
  /** 点击公式时回调（工具层打开编辑弹窗） */
  onMathSelect?: (pos: number, latex: string, display: boolean) => void;
  /** 拼写检查：词典与开关都以 getter 传入，词表加载完成后无需重建编辑器 */
  spellcheck?: {
    getDictionary: () => SpellDictionary;
    isEnabled: () => boolean;
  };
}

export function createExtensions({
  placeholder,
  onLayout: onPageLayout,
  getPageMetrics,
  tocLabels,
  footnoteLabels,
  onMathSelect,
  spellcheck,
}: RichTextExtensionOptions) {
  return [
    StarterKit.configure({
      // 链接点击不跳转，交由工具栏编辑
      link: { openOnClick: false, autolink: true },
      // 落点光标改由下面的 DropIndicator 提供（可配置颜色 / 粗细）
      dropcursor: false,
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
    // inline: true → 「嵌入型」是真正的行内节点：插入后留在文字中间，不再独占一行。
    // 浮于文字上方 / 衬于文字下方仍靠绝对定位（editor.css 的 [data-layer]），不受影响。
    ImageStyle.configure({ inline: true, allowBase64: true }),
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
    // 目录 / 脚注文案随语言注入：节点不含属性，切换语言后标题同步本地化
    TableOfContents.configure({ labels: tocLabels ?? DEFAULT_TOC_LABELS }),
    FootnoteRef.configure({ labels: footnoteLabels ?? DEFAULT_FOOTNOTE_LABELS }),
    FootnoteList.configure({ labels: footnoteLabels ?? DEFAULT_FOOTNOTE_LABELS }),
    MathInline.configure({ onSelect: onMathSelect }),
    MathBlock.configure({ onSelect: onMathSelect }),
    MathCommands,
    Spellcheck.configure({
      getDictionary: spellcheck?.getDictionary,
      isEnabled: spellcheck?.isEnabled,
    }),
    SpellcheckCommands,
    DropIndicator,
    PageLayout.configure({ onLayout: onPageLayout, getPageMetrics: getPageMetrics }),
  ];
}
