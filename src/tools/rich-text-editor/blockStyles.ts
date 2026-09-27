import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { Extension } from '@tiptap/core';
import { CONTENT_WIDTH_PX } from './core';
import { findSelectedImage, isFloatingImageLayer, normalizeImageLayer } from './imageLayer';

/**
 * 排版细节扩展（Word 对标）：
 * - 段落：首行缩进、段前/段后间距（存为属性 → 渲染为内联 style，导出端可映射 OOXML）
 * - 图片：宽度百分比与对齐方式
 * - 表格：边框开关与斑马纹
 * 全部走「节点属性」而非外部改 DOM，符合 ProseMirror 约束。
 */

/** 从内联样式读取数值（px） */
function readPx(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function styleObject(styles: Record<string, string | undefined>): string {
  return Object.entries(styles)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

interface StyleAttrs {
  textIndent?: number | null;
  spacingBefore?: number | null;
  spacingAfter?: number | null;
  width?: number | null;
  align?: string | null;
  /** 图片层级：inline（嵌入）/ front（浮于文字上方）/ behind（衬于文字下方） */
  layer?: string | null;
  /** 浮动图片相对内容区左上角的偏移（px） */
  offsetX?: number | null;
  offsetY?: number | null;
  bordered?: boolean;
  zebra?: boolean;
}

/**
 * 段落排版：textIndent / spacingBefore / spacingAfter（px）。
 * StarterKit 的 paragraph 节点不可单独引入包，这里用全局属性注入。
 */
const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.textIndent),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.textIndent ? { style: `text-indent: ${attrs.textIndent}px` } : {},
          },
          spacingBefore: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginTop),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.spacingBefore ? { style: `margin-top: ${attrs.spacingBefore}px` } : {},
          },
          spacingAfter: {
            default: null,
            parseHTML: (el: HTMLElement) => readPx(el.style.marginBottom),
            renderHTML: (attrs: StyleAttrs) =>
              attrs.spacingAfter ? { style: `margin-bottom: ${attrs.spacingAfter}px` } : {},
          },
        },
      },
    ];
  },
});

/** 图片：宽度（%）、对齐、层级（嵌入 / 浮于文字上方 / 衬于文字下方）与浮动偏移 */
const ImageStyle = Image.extend({
  addAttributes() {
    return {
      // 关键：必须合并父类属性，否则 src / alt / title 会被整体覆盖，
      // 图片会渲染成没有 src 的空 <img>（看不到任何内容）。
      ...this.parent?.(),
      // 图片宽度统一以「像素」存储：拖动调整/工具栏预设都写入像素，
      // 渲染成 `width: Npx`（高度 auto 保持比例，与 Word 等比缩放一致）
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const raw = el.style.width || el.getAttribute('width') || '';
          const parsed = Number.parseFloat(raw);
          if (!Number.isFinite(parsed)) return null;
          // 兼容旧数据：历史版本存的是百分比，按 A4 内容宽度换算为像素
          return raw.includes('%')
            ? Math.round((parsed / 100) * CONTENT_WIDTH_PX)
            : Math.round(parsed);
        },
        renderHTML: (attrs: StyleAttrs) =>
          attrs.width
            ? {
                width: Math.round(attrs.width),
                style: `width: ${Math.round(attrs.width)}px; height: auto`,
              }
            : {},
      },
      align: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align'),
        renderHTML: (attrs: StyleAttrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
      layer: {
        default: 'inline',
        parseHTML: (el: HTMLElement) => normalizeImageLayer(el.getAttribute('data-layer')),
        renderHTML: (attrs: StyleAttrs) =>
          isFloatingImageLayer(attrs.layer) ? { 'data-layer': attrs.layer } : {},
      },
      offsetX: {
        default: null,
        parseHTML: (el: HTMLElement) => readPx(el.style.left),
        renderHTML: (attrs: StyleAttrs) =>
          isFloatingImageLayer(attrs.layer)
            ? { style: `left: ${Math.round(attrs.offsetX ?? 0)}px` }
            : {},
      },
      offsetY: {
        default: null,
        parseHTML: (el: HTMLElement) => readPx(el.style.top),
        renderHTML: (attrs: StyleAttrs) =>
          isFloatingImageLayer(attrs.layer)
            ? { style: `top: ${Math.round(attrs.offsetY ?? 0)}px` }
            : {},
      },
    };
  },
});

/** 表格：边框与斑马纹（data 属性驱动 CSS，导出端再映射 OOXML） */
const TableStyle = Table.extend({
  addAttributes() {
    return {
      bordered: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-bordered') !== 'false',
        renderHTML: (attrs: StyleAttrs) => ({ 'data-bordered': attrs.bordered ? 'true' : 'false' }),
      },
      zebra: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-zebra') === 'true',
        renderHTML: (attrs: StyleAttrs) => ({ 'data-zebra': attrs.zebra ? 'true' : 'false' }),
      },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphStyle: {
      /** 增加/减少首行缩进（步长 24px，约 2 字符） */
      indentParagraph: (delta: number) => ReturnType;
      /** 设置段前/段后间距（px；0 表示恢复默认） */
      setParagraphSpacing: (before: number, after: number) => ReturnType;
    };
    imageStyle: {
      /** 设置图片宽度（像素，null 表示自适应原始尺寸）与对齐 */
      setImageStyle: (width: number | null, align: string | null) => ReturnType;
      /** 仅设置图片宽度（像素）：拖动手柄 / 工具栏预设使用 */
      setImageWidth: (width: number | null) => ReturnType;
    };
    tableStyle: {
      /** 切换表格边框 / 斑马纹 */
      toggleTableBorders: () => ReturnType;
      toggleTableZebra: () => ReturnType;
    };
  }
}

/** 命令扩展：段落缩进与间距、图片样式、表格样式 */
export const BlockStyleCommands = Extension.create({
  name: 'blockStyleCommands',
  addCommands() {
    return {
      indentParagraph:
        (delta: number) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          const current = Number(node.attrs.textIndent ?? 0);
          const next = Math.max(0, Math.min(240, current + delta));
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            textIndent: next || null,
          });
          return true;
        },
      setParagraphSpacing:
        (before: number, after: number) =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (node.type.name !== 'paragraph') return false;
          tr.setNodeMarkup($from.before(), undefined, {
            ...node.attrs,
            spacingBefore: before || null,
            spacingAfter: after || null,
          });
          return true;
        },
      setImageStyle:
        (width: number | null, align: string | null) =>
        ({ state, tr }) => {
          // 复用统一的图片定位：块级图片被选中（NodeSelection）时父节点是 doc，
          // 只看 $from.parent.descendants 会导致命令永远失败、宽度改不动。
          const found = findSelectedImage(state);
          if (!found) return false;
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            width: width ? Math.max(16, Math.round(width)) : null,
            align,
          });
          return true;
        },
      setImageWidth:
        (width: number | null) =>
        ({ state, tr }) => {
          const found = findSelectedImage(state);
          if (!found) return false;
          tr.setNodeMarkup(found.pos, undefined, {
            ...found.node.attrs,
            width: width ? Math.max(16, Math.round(width)) : null,
          });
          return true;
        },
      toggleTableBorders:
        () =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const depth = $from.depth;
          for (let d = depth; d > 0; d -= 1) {
            const node = $from.node(d);
            if (node.type.name !== 'table') continue;
            tr.setNodeMarkup($from.before(d), undefined, {
              ...node.attrs,
              bordered: !node.attrs.bordered,
            });
            return true;
          }
          return false;
        },
      toggleTableZebra:
        () =>
        ({ state, tr }) => {
          const { $from } = state.selection;
          const depth = $from.depth;
          for (let d = depth; d > 0; d -= 1) {
            const node = $from.node(d);
            if (node.type.name !== 'table') continue;
            tr.setNodeMarkup($from.before(d), undefined, {
              ...node.attrs,
              zebra: !node.attrs.zebra,
            });
            return true;
          }
          return false;
        },
    };
  },
});

export { ParagraphStyle, ImageStyle, TableStyle };
export { styleObject };
