import { Extension, Node } from '@tiptap/core';
import { dropCursor } from '@tiptap/pm/dropcursor';
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
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
import { charFormatExtensions } from './charFormat';
import { ImageLayerCommands } from './imageLayer';
import { DocShape } from './shapeNode';
import { BlockStyleCommands, ImageStyle, ParagraphStyle, TableStyle } from './blockStyles';
import { Comment, DocMarkCommands, TrackedDelete, TrackedFormat, TrackedInsert } from './marks';
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

/**
 * Insert a break atom (page/section break) *after the block that holds the caret*, never at the raw caret
 * offset.
 *
 * Inserting at the offset splits the paragraph and leaves a stray fragment after the break: the text is
 * chopped in two and — worse — the fragment gives the caret a home on the wrong side of the break, so the
 * next keystroke or paste silently lands in the previous section and the break drifts to the document end.
 * The projection also guarantees a block after the atom, because a document ending on an atom has no valid
 * text position left (the caret would fall back to before the break).
 */
function insertBreakAfterBlock(state: EditorState, node: PmNode): Transaction {
  const { $to } = state.selection;
  const pos = $to.depth > 0 ? $to.after(1) : $to.pos;
  const atomEnd = pos + node.nodeSize;
  const tr = state.tr.insert(pos, node);
  if (atomEnd >= tr.doc.content.size) {
    tr.insert(atomEnd, state.schema.nodes.paragraph.create());
  }
  // `near` snaps to the closest valid text position, so this also survives a neighbouring atom
  tr.setSelection(TextSelection.near(tr.doc.resolve(atomEnd + 1), 1));
  return tr.scrollIntoView();
}

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
        ({ state, dispatch }) => {
          dispatch?.(insertBreakAfterBlock(state, state.schema.nodes.pageBreak.create()));
          return true;
        },
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
 * Section break node (P2-2): starts a new document section.
 *
 * The section's page setup travels with the node as a JSON snapshot instead of living in a
 * document-level `sections[]`. That keeps one source of truth (the HTML), so drafts, version
 * snapshots, imports and exports need no extra migration path.
 */
const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      /** How the new section starts: 'nextPage' | 'continuous' */
      startType: {
        default: 'nextPage',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-section-break') ?? 'nextPage',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-section-break': attributes.startType ?? 'nextPage',
        }),
      },
      /** `true` = reuse the previous section's header (Word's "link to previous") */
      headerLinked: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-section-header-linked') === 'true',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-section-header-linked': attributes.headerLinked === true ? 'true' : 'false',
        }),
      },
      /** `true` = reuse the previous section's footer */
      footerLinked: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-section-footer-linked') === 'true',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-section-footer-linked': attributes.footerLinked === true ? 'true' : 'false',
        }),
      },
      /** Page setup snapshot of the section that starts here (null = inherit the document setup) */
      pageSetup: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-section-setup');
          if (!raw) return null;
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            // A broken snapshot must not swallow the break itself
            return null;
          }
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.pageSetup
            ? { 'data-section-setup': JSON.stringify(attributes.pageSetup) }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-section-break]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, class: 'rte-section-break-node' }];
  },
  addCommands() {
    return {
      setSectionBreak:
        (options?: {
          startType?: 'nextPage' | 'continuous';
          pageSetup?: unknown;
          headerLinked?: boolean;
          footerLinked?: boolean;
        }) =>
        ({ state, dispatch }) => {
          // Insert after the current block, never on top of the atom's NodeSelection (that would replace
          // the previous break instead of adding another one) and never mid-paragraph (that splits the
          // paragraph and leaves the caret on the wrong side of the break)
          const node = state.schema.nodes[this.name].create({
            startType: options?.startType ?? 'nextPage',
            pageSetup: options?.pageSetup ?? null,
            headerLinked: options?.headerLinked ?? false,
            footerLinked: options?.footerLinked ?? false,
          });
          dispatch?.(insertBreakAfterBlock(state, node));
          return true;
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionBreak: {
      /** Insert a section break; `pageSetup` is a snapshot of the new section's page setup */
      setSectionBreak: (options?: {
        startType?: 'nextPage' | 'continuous';
        pageSetup?: unknown;
        headerLinked?: boolean;
        footerLinked?: boolean;
      }) => ReturnType;
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
    SectionBreak,
    // DrawingML preset shape atom (P3-1.1): geometry comes from the shared kernel
    DocShape,
    ParagraphStyle,
    BlockStyleCommands,
    Comment,
    TrackedInsert,
    TrackedDelete,
    TrackedFormat,
    DocMarkCommands,
    // Character-level formatting (superscript / subscript / letter spacing / text transform)
    ...charFormatExtensions,
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
