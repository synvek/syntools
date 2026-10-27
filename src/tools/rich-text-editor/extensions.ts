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
 * Editor extension set (technical design §8.3):
 * StarterKit already bundles Link / Underline (Tiptap v3), so only missing capabilities are added here.
 * This file is imported lazily by RichTextEditorTool, keeping TipTap out of the initial bundle.
 */

/** Page break node: becomes pageBreakBefore on Word export, paginates naturally in print / page view */
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
      /** Insert a page break at the cursor */
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * Drag drop cursor: draws a vertical line at the insertion point while dragging images / text blocks,
 * showing where the content will land.
 *
 * StarterKit's built-in dropcursor never worked in this project (the `.ProseMirror-dropcursor` element
 * never appeared during a drag), so the ProseMirror plugin is registered directly here, with color and
 * width tuned to be visible (the default 1px black is nearly invisible on body text).
 */
const DropIndicator = Extension.create({
  name: 'dropIndicator',
  addProseMirrorPlugins() {
    return [dropCursor({ color: '#2563eb', width: 2 })];
  },
});

/** Page layout plugin (Word-style pagination): enabled in page view only, rendering inter-page gaps via Decoration.widget */
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

/** Extension options: labels and host callbacks are injected by the tool layer from the current language / page state */
export interface RichTextExtensionOptions {
  /** Empty-document placeholder */
  placeholder: string;
  /** Pagination snapshot callback (sheet positions + each page's start position) */
  onLayout?: (snapshot: PageLayoutSnapshot) => void;
  /** Current page setup (paper / margins / orientation) */
  getPageMetrics?: () => PageMetrics;
  /** TOC labels */
  tocLabels?: TocLabels;
  /** Footnote labels */
  footnoteLabels?: FootnoteLabels;
  /** Callback on formula click (the tool layer opens the edit dialog) */
  onMathSelect?: (pos: number, latex: string, display: boolean) => void;
  /** Spellcheck: dictionary and toggle arrive as getters, so no editor rebuild is needed after the word list loads */
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
      // Links don't navigate on click; the toolbar handles editing
      link: { openOnClick: false, autolink: true },
      // The drop cursor comes from DropIndicator below (configurable color / width)
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
    // TableStyle extends Table (adding border/zebra attributes) and must not be registered alongside
    // the original Table, which would register tableColumnResizing twice (PM keyed plugin conflict)
    TableStyle.configure({ resizable: true, HTMLAttributes: { class: 'rte-table' } }),
    TableRow,
    TableCell,
    TableHeader,
    // ImageStyle likewise replaces the original Image
    // inline: true -> "inline" is a true inline node: it stays within the text instead of taking a line.
    // In front of / behind text still rely on absolute positioning (editor.css [data-layer]) and are unaffected.
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
    // TOC / footnote labels follow the language: the nodes carry no attributes, so titles localize on language switch
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
