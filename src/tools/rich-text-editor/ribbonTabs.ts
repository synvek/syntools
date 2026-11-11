import { createElement } from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import type { TFunction } from 'i18next';
import type {
  RibbonGroup,
  RibbonItem,
  RibbonItemSize,
  RibbonSelectItem,
  RibbonSelectOption,
  RibbonTab,
} from '@/core/components/ribbon/types';
import { stepFontSize } from './typography';
import type { TextTransformValue } from './charFormat';
import type { ViewMode } from './draft';
import { normalizeHex } from '../../core/drawing/geometry';
import {
  IMAGE_LAYERS,
  findSelectedImage,
  normalizeImageLayer,
  type ImageLayer,
} from './imageLayer';
import { MM_TO_PX } from './pageSetup';
import { ShapeMenu } from './ShapeMenu';
import { StyleGallery } from './StyleGallery';
import type { NamedStyle } from './namedStyles';
import { findSelectedShape, shapeSpec, type DocShapeAttrs, type ShapeDash } from './shapeNode';
import { applyShapeAttrs } from './useSelectedShape';

/**
 * Commands of the word processor ribbon, described as data.
 *
 * The toolbar itself owns nothing but the editor state and the DOM measurements (installed fonts,
 * current content width); every command lives here so the Office tabs read like the Word ones and
 * the whole mapping stays testable without mounting the editor.
 */

/**
 * P0-6 rollback switch. When false, table/picture commands go back to the pre-P0-6 layout
 * (groups appended to 开始 / 插入) and only 形状格式 remains a contextual tab.
 */
export const CONTEXT_TABS_ENABLED = true;

export const CONTEXT_TAB_IDS = ['shape-format', 'table-tools', 'picture-format'] as const;

export type ContextTabId = (typeof CONTEXT_TAB_IDS)[number];

/**
 * One source of truth for *which* contextual tab exists: both `buildRichTextRibbonTabs` (tab
 * presence) and `EditorToolbar` (active tab) call this with the raw EditorState, so the ribbon
 * can never show a tab that is inactive or activate one that is missing.
 *
 * Priority mirrors Word when several objects overlap: a selected shape wins over a picture,
 * which wins over a table. The image predicate is intentionally the same lenient one used by
 * the picture commands, so moving those groups out of 插入 does not hide commands that used
 * to be reachable.
 */
export function resolveContextTab(state: EditorState | null): ContextTabId | null {
  if (!state) return null;
  if (findSelectedShape(state)) return 'shape-format';
  if (!CONTEXT_TABS_ENABLED) return null;
  if (findSelectedImage(state)) return 'picture-format';
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return 'table-tools';
  }
  return null;
}

/**
 * Entering a contextual tab activates it; leaving returns to the last non-contextual tab the
 * user was on (not a hard-coded 开始). Pure so the round trip is testable without a DOM.
 */
export function nextActiveTab(
  current: string | undefined,
  contextTabId: ContextTabId | null,
  lastBaseTab: string,
): string | undefined {
  if (contextTabId) return contextTabId;
  if (current && (CONTEXT_TAB_IDS as readonly string[]).includes(current)) return lastBaseTab;
  return current;
}

/** Subset of `useEditorState` the ribbon consumes — mirrors the old flat toolbar exactly */
export interface RichTextToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
  paragraph: boolean;
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  color: string;
  highlight: boolean;
  /** Active highlight colour (Word's highlighter keeps the colour, not just on/off) */
  highlightColor: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  superscript: boolean;
  subscript: boolean;
  letterSpacing: string;
  textTransform: string;
  smallCaps: boolean;
  indentLeft: number;
  hangingIndent: number;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  link: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  alignJustify: boolean;
  inTable: boolean;
  headerRow: boolean;
  canMergeCells: boolean;
  canSplitCell: boolean;
  tableBordered: boolean;
  tableZebra: boolean;
  cellVAlign: string;
  rowHeight: number | null;
  inImage: boolean;
  imageWidth: number | null;
  imageAlign: string | null;
  imageLayer: string;
  paragraphSpacing: string;
  /** P1-4 pagination state of the caret paragraph */
  keepNext: boolean;
  keepLines: boolean;
  /** Widow control is on unless the paragraph explicitly turns it off */
  widowControl: boolean;
  footnoteSelected: boolean;
  endnoteSelected: boolean;
  mathSelected: boolean;
  shapeSelected: boolean;
  /** P0-6: reactive context tab id, computed by resolveContextTab in the useEditorState selector */
  contextTab: ContextTabId | null;
}

/**
 * Everything the document shell hands to the toolbar: callbacks plus the panel open flags they
 * toggle. `EditorToolbarProps` extends this interface, so adding a command only touches one place.
 */
export interface RichTextRibbonActions {
  onToggleFind: () => void;
  findOpen: boolean;
  onToggleOutline: () => void;
  outlineOpen: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  pageSetupOpen: boolean;
  onTogglePageSetup: () => void;
  rulerOpen: boolean;
  onToggleRuler: () => void;
  onInsertToc: () => void;
  onRefreshToc: () => void;
  tocDisabled: boolean;
  onFootnote: () => void;
  onEndnote: () => void;
  onOpenBookmarks: () => void;
  bookmarksOpen: boolean;
  onOpenXrefs: () => void;
  xrefsOpen: boolean;
  onMath: () => void;
  stylesOpen: boolean;
  onToggleStyles: () => void;
  /** Named style set of the document (P1-1): the gallery applies and edits it */
  namedStyles: NamedStyle[];
  onNamedStylesChange: (styles: NamedStyle[]) => void;
  shapesOpen: boolean;
  shapeMenuOpen: boolean;
  onToggleShapeMenu: () => void;
  onPickShape: (prst: string) => void;
  onOpenShapePanel: () => void;
  activeShapePrst: string | null;
  templatesOpen: boolean;
  onToggleTemplates: () => void;
  spellcheckOpen: boolean;
  onToggleSpellcheck: () => void;
  reviewOpen: boolean;
  onToggleReview: () => void;
  onOpenVersions: () => void;
  versionsDisabled: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /* --- revisions & comparison (Word's 审阅 tab) --- */
  /** 修订模式：on = 之后的输入 / 删除自动记录为修订 */
  trackingMode: boolean;
  onToggleTracking: () => void;
  onMarkInsert: () => void;
  onMarkDelete: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  /** False when the document has no tracked change: 接受/拒绝 have nothing to work on */
  hasTrackedChanges: boolean;
  onCompareFile: () => void;
  /* --- section breaks (Word's 布局 → 分隔符) --- */
  onInsertSectionBreak: (type: 'nextPage' | 'continuous') => void;
  /* --- format painter --- */
  /** Armed: the next selection receives the copied character formatting */
  painterActive: boolean;
  /** Locked (Word's double-click): stays armed after every painted selection */
  painterSticky: boolean;
  onTogglePainter: () => void;
  /** Arms / disarms the locked painter */
  onLockPainter: () => void;
}

/** Values the toolbar derives from the DOM (fonts, image width in px) and passes down as-is */
export interface RichTextRibbonOptions {
  fontFamilyValue: string;
  fontOptions: { value: string; label: string }[];
  fontSizeOptions: { value: string; label: string }[];
  /** Shown in the size box (and as its placeholder) when the run has no explicit size */
  fontSizeDefault: string;
  lineHeightOptions: { value: string; label: string }[];
  letterSpacingOptions: { value: string; label: string }[];
  textTransformOptions: { value: string; label: string }[];
  /** Content width in px: image width presets are percentages of it */
  contentWidth: number;
  imageWidthValue: string;
  imageWidthOptions: { value: string; label: string }[];
  cellVAlignValue: string;
  rowHeightValue: string;
  rowHeightOptions: { value: string; label: string }[];
}

export interface RichTextRibbonInput {
  editor: Editor;
  state: RichTextToolbarState;
  t: TFunction;
  actions: RichTextRibbonActions;
  options: RichTextRibbonOptions;
  /** Opens the hidden file input of the toolbar (the input itself lives in the component) */
  onPickImage: () => void;
  /** "更改形状" gallery of the contextual shape tab */
  changeShapeOpen: boolean;
  onToggleChangeShape: () => void;
}

interface ItemOptions {
  size?: RibbonItemSize;
  active?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** `active` set → toggle (aria-pressed + accent fill), otherwise a plain command */
function item(
  id: string,
  label: string,
  icon: string,
  run: () => void,
  opts: ItemOptions = {},
): RibbonItem {
  const base = {
    id,
    label,
    icon,
    size: opts.size,
    disabled: opts.disabled,
    hint: opts.hint,
    onSelect: run,
  };
  return opts.active === undefined
    ? { kind: 'button', ...base }
    : { kind: 'toggle', ...base, active: opts.active };
}

function select(
  id: string,
  label: string,
  value: string,
  options: RibbonSelectOption[],
  onChange: (value: string) => void,
  width: 'xxs' | 'xs' | 'sm' | 'md' = 'sm',
  disabled = false,
  extra: Partial<RibbonSelectItem> = {},
): RibbonItem {
  return { kind: 'select', id, label, value, options, onChange, width, disabled, ...extra };
}

/** Lays the words on the page: font, character spacing, colour and highlight */
function fontGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
  // Size of the current run in px (the mark stores "18px"; unset means the document default)
  const currentFontSize = Number.parseFloat(state.fontSize) || Number(options.fontSizeDefault);
  return {
    id: 'font',
    label: t('tools.richText.ribbon.grp.font'),
    priority: 9,
    items: [],
    // Word's font block is two rows: the size box sits right of the font box, the character
    // buttons fill the row underneath. Row layout also keeps the narrow boxes from leaving a
    // hole to their right, which column packing did.
    rows: [
      [
        select(
          'font-family',
          t('tools.richText.fontFamily'),
          options.fontFamilyValue,
          options.fontOptions,
          (value) => (value ? chain().setFontFamily(value).run() : chain().unsetFontFamily().run()),
          'md',
          false,
          { listWidth: 'wide' },
        ),
        select(
          'font-size',
          t('tools.richText.fontSize'),
          state.fontSize,
          options.fontSizeOptions,
          // Typed sizes are plain numbers; the text-style mark wants a CSS length
          (value) =>
            value
              ? chain()
                  .setFontSize(/^[\d.]+$/.test(value) ? `${value}px` : value)
                  .run()
              : chain().unsetFontSize().run(),
          'xs',
          false,
          {
            // Word's size box takes any value, not only the presets; the empty state shows the default size
            editable: true,
            display: options.fontSizeDefault,
            toDraft: (value) => value.replace(/px$/, ''),
            fromDraft: (draft) => draft,
          },
        ),
        // A⁺ / A⁻: the Office habit of nudging the size without opening the box
        item(
          'grow-font',
          t('tools.richText.increaseFontSize'),
          'fontGrow',
          () =>
            chain()
              .setFontSize(`${stepFontSize(currentFontSize, 1)}px`)
              .run(),
          { size: 'small' },
        ),
        item(
          'shrink-font',
          t('tools.richText.decreaseFontSize'),
          'fontShrink',
          () =>
            chain()
              .setFontSize(`${stepFontSize(currentFontSize, -1)}px`)
              .run(),
          { size: 'small' },
        ),
        // Character spacing and case are narrow boxes: they close the first row instead of
        // opening two mostly-empty columns of their own
        select(
          'letter-spacing',
          t('tools.richText.letterSpacing'),
          state.letterSpacing,
          options.letterSpacingOptions,
          (value) =>
            chain()
              .setLetterSpacing(value ? Number(value) : null)
              .run(),
          'xxs',
        ),
        select(
          'text-transform',
          t('tools.richText.textTransform'),
          state.textTransform,
          options.textTransformOptions,
          (value) =>
            chain()
              .setTextTransform((value || null) as TextTransformValue | null)
              .run(),
          'xxs',
        ),
      ],
      [
        item('bold', t('tools.richText.bold'), 'bold', () => chain().toggleBold().run(), {
          size: 'small',
          active: state.bold,
        }),
        item('italic', t('tools.richText.italic'), 'italic', () => chain().toggleItalic().run(), {
          size: 'small',
          active: state.italic,
        }),
        item(
          'underline',
          t('tools.richText.underline'),
          'underline',
          () => chain().toggleUnderline().run(),
          { size: 'small', active: state.underline },
        ),
        item('strike', t('tools.richText.strike'), 'strike', () => chain().toggleStrike().run(), {
          size: 'small',
          active: state.strike,
        }),
        item(
          'superscript',
          t('tools.richText.superscript'),
          'superscript',
          () => chain().toggleSuperscript().run(),
          { size: 'small', active: state.superscript },
        ),
        item(
          'subscript',
          t('tools.richText.subscript'),
          'subscript',
          () => chain().toggleSubscript().run(),
          { size: 'small', active: state.subscript },
        ),
        item(
          'small-caps',
          t('tools.richText.smallCaps'),
          'smallCaps',
          () => chain().toggleSmallCaps().run(),
          { size: 'small', active: state.smallCaps },
        ),
        item('code', t('tools.richText.code'), 'codeMark', () => chain().toggleCode().run(), {
          size: 'small',
          active: state.code,
        }),
        {
          kind: 'color',
          id: 'font-color',
          label: t('tools.richText.color'),
          icon: 'fontColor',
          size: 'small',
          value: /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#111827',
          onPick: (color) => chain().setColor(color).run(),
          onReset: () => chain().unsetColor().run(),
          resetLabel: t('tools.richText.colorDefault'),
        },
        // Word's highlighter remembers the colour; a fixed yellow made "highlight" a one-way toggle
        {
          kind: 'color',
          id: 'highlight',
          label: t('tools.richText.highlight'),
          icon: 'fillColor',
          size: 'small',
          value: state.highlightColor ?? '#FEF08A',
          onPick: (color) => chain().setHighlight({ color }).run(),
          onReset: () => chain().unsetHighlight().run(),
          resetLabel: t('tools.richText.highlightNone'),
        },
        // 清除格式: back to body text — Word's eraser drops both the marks and the paragraph style
        item(
          'clear-format',
          t('tools.richText.clearFormat'),
          'clear',
          () => chain().setParagraph().unsetAllMarks().run(),
          { size: 'small' },
        ),
      ],
    ],
  };
}

/**
 * Word's 剪贴板 group: paste, cut / copy and the format painter.
 *
 * The painter sits here (not in 字体) because that is where Word puts it, and because it is a
 * clipboard-shaped command: copy the format, then paste it onto another selection.
 */
function clipboardGroup(input: RichTextRibbonInput): RibbonGroup {
  const { t, actions } = input;
  const chain = () => input.editor.chain().focus();
  // Cut / copy use the browser command so the clipboard keeps the formatting. Focus has to go back
  // to the document first: the click landed on the ribbon button, and the command acts on focus.
  const runClipboard = (command: 'cut' | 'copy') => {
    input.editor.view.focus();
    document.execCommand(command);
  };
  return {
    id: 'clipboard',
    label: t('tools.richText.ribbon.grp.clipboard'),
    priority: 10,
    items: [
      item('paste', t('tools.richText.paste'), 'paste', () => {
        void navigator.clipboard
          .readText()
          .then((text) => {
            if (text) chain().insertContent(text).run();
          })
          .catch(() => undefined);
      }),
      item('cut', t('tools.richText.cut'), 'scissors', () => runClipboard('cut'), {
        size: 'small',
      }),
      item('copy', t('common.copy'), 'copy', () => runClipboard('copy'), { size: 'small' }),
      // Split: one click paints once, the arrow offers Word's locked (repeat) painter
      {
        kind: 'split',
        id: 'format-painter',
        label: t('tools.richText.formatPainter'),
        icon: 'formatPainter',
        active: actions.painterActive,
        onSelect: actions.onTogglePainter,
        menu: [
          {
            id: 'painter-once',
            label: t('tools.richText.formatPainterOnce'),
            checked: actions.painterActive && !actions.painterSticky,
            onSelect: actions.onTogglePainter,
          },
          {
            id: 'painter-lock',
            label: t('tools.richText.formatPainterLock'),
            checked: actions.painterSticky,
            onSelect: actions.onLockPainter,
          },
        ],
      },
    ],
  };
}

/** Lists, alignment, spacing and indents */
function paragraphGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
  return {
    id: 'paragraph',
    label: t('tools.richText.ribbon.grp.paragraph'),
    priority: 8,
    items: [],
    // Word's paragraph block: lists + alignment on top, spacing + indents underneath. Row layout
    // keeps the two spacing boxes next to the indent buttons instead of in half-empty columns.
    rows: [
      [
        item(
          'bullet-list',
          t('tools.richText.bulletList'),
          'bulletList',
          () => chain().toggleBulletList().run(),
          { size: 'small', active: state.bulletList },
        ),
        item(
          'ordered-list',
          t('tools.richText.orderedList'),
          'orderedList',
          () => chain().toggleOrderedList().run(),
          { size: 'small', active: state.orderedList },
        ),
        item(
          'task-list',
          t('tools.richText.taskList'),
          'taskList',
          () => chain().toggleTaskList().run(),
          { size: 'small', active: state.taskList },
        ),
        item('quote', t('tools.richText.quote'), 'quote', () => chain().toggleBlockquote().run(), {
          size: 'small',
          active: state.blockquote,
        }),
        item(
          'code-block',
          t('tools.richText.codeBlock'),
          'codeBlock',
          () => chain().toggleCodeBlock().run(),
          { size: 'small', active: state.codeBlock },
        ),
        item(
          'align-left',
          t('tools.richText.alignLeft'),
          'alignLeftCell',
          () => chain().setTextAlign('left').run(),
          { size: 'small', active: state.alignLeft },
        ),
        item(
          'align-center',
          t('tools.richText.alignCenter'),
          'alignCenterCell',
          () => chain().setTextAlign('center').run(),
          { size: 'small', active: state.alignCenter },
        ),
        item(
          'align-right',
          t('tools.richText.alignRight'),
          'alignRightCell',
          () => chain().setTextAlign('right').run(),
          { size: 'small', active: state.alignRight },
        ),
        item(
          'align-justify',
          t('tools.richText.alignJustify'),
          'alignJustify',
          () => chain().setTextAlign('justify').run(),
          { size: 'small', active: state.alignJustify },
        ),
      ],
      [
        select(
          'line-height',
          t('tools.richText.lineHeight'),
          state.lineHeight,
          options.lineHeightOptions,
          (value) => (value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run()),
          'xs',
        ),
        select(
          'paragraph-spacing',
          t('tools.richText.paragraphSpacing'),
          state.paragraphSpacing,
          [
            { value: '0-0', label: t('tools.richText.spacingPresetDefault') },
            { value: '0-12', label: t('tools.richText.spacingPresetCompact') },
            { value: '12-12', label: t('tools.richText.spacingPresetRelaxed') },
            { value: '24-24', label: t('tools.richText.spacingPresetLoose') },
          ],
          (value) => {
            const [before, after] = value.split('-').map(Number);
            chain()
              .setParagraphSpacing(before || 0, after || 0)
              .run();
          },
          'xs',
        ),
        item(
          'indent-decrease',
          t('tools.richText.indentDecrease'),
          'indentDecrease',
          () => chain().indentParagraph(-24).run(),
          { size: 'small' },
        ),
        item(
          'indent-increase',
          t('tools.richText.indentIncrease'),
          'indentIncrease',
          () => chain().indentParagraph(24).run(),
          { size: 'small' },
        ),
        item(
          'indent-left-decrease',
          t('tools.richText.indentLeftDecrease'),
          'indentDecrease',
          () =>
            chain()
              .setParagraphIndent({ left: state.indentLeft - 24 })
              .run(),
          { size: 'small', disabled: state.indentLeft <= 0 },
        ),
        item(
          'indent-left-increase',
          t('tools.richText.indentLeftIncrease'),
          'hangingIndent',
          () =>
            chain()
              .setParagraphIndent({ left: state.indentLeft + 24 })
              .run(),
          { size: 'small' },
        ),
        item(
          'hanging-indent',
          t('tools.richText.hangingIndent'),
          'indentIncrease',
          () =>
            chain()
              .setParagraphIndent({
                hanging: state.hangingIndent > 0 ? null : 24,
                // 悬挂缩进必须有左缩进做参照，否则负的 text-indent 会把首行顶到页边距外
                left: state.hangingIndent > 0 ? state.indentLeft : Math.max(24, state.indentLeft),
              })
              .run(),
          { size: 'small', active: state.hangingIndent > 0 },
        ),
        // P1-4: pagination control lives here rather than in a dialog — Word keeps it on the ribbon too
        item(
          'keep-next',
          t('tools.richText.keepNext'),
          'keepNext',
          () =>
            chain()
              .setParagraphPagination({ keepNext: state.keepNext ? null : true })
              .run(),
          { size: 'small', active: state.keepNext },
        ),
        item(
          'keep-lines',
          t('tools.richText.keepLines'),
          'keepLines',
          () =>
            chain()
              .setParagraphPagination({ keepLines: state.keepLines ? null : true })
              .run(),
          { size: 'small', active: state.keepLines },
        ),
        item(
          'widow-control',
          t('tools.richText.widowControl'),
          'widowControl',
          () =>
            chain()
              .setParagraphPagination({ widowControl: state.widowControl ? false : null })
              .run(),
          { size: 'small', active: state.widowControl },
        ),
      ],
    ],
  };
}

/** Contextual group: only exists while the caret is inside a table (Office's 表格工具) */
function tableGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
  return {
    id: 'table',
    label: t('tools.richText.ribbon.grp.table'),
    priority: 7,
    items: [
      item(
        'row-above',
        t('tools.richText.rowAbove'),
        'rowAbove',
        () => chain().addRowBefore().run(),
        {
          size: 'small',
        },
      ),
      item(
        'row-below',
        t('tools.richText.rowBelow'),
        'rowBelow',
        () => chain().addRowAfter().run(),
        {
          size: 'small',
        },
      ),
      item(
        'column-left',
        t('tools.richText.columnLeft'),
        'columnLeft',
        () => chain().addColumnBefore().run(),
        { size: 'small' },
      ),
      item(
        'column-right',
        t('tools.richText.columnRight'),
        'columnRight',
        () => chain().addColumnAfter().run(),
        { size: 'small' },
      ),
      item(
        'delete-row',
        t('tools.richText.deleteRow'),
        'rowDelete',
        () => chain().deleteRow().run(),
        { size: 'small' },
      ),
      item(
        'delete-column',
        t('tools.richText.deleteColumn'),
        'columnDelete',
        () => chain().deleteColumn().run(),
        { size: 'small' },
      ),
      item(
        'header-row',
        t('tools.richText.headerRow'),
        'headerRow',
        () => chain().toggleHeaderRow().run(),
        { size: 'small', active: state.headerRow },
      ),
      item(
        'merge-cells',
        t('tools.richText.mergeCells'),
        'mergeCenter',
        () => chain().mergeCells().run(),
        { size: 'small', disabled: !state.canMergeCells },
      ),
      item(
        'split-cell',
        t('tools.richText.splitCell'),
        'unmerge',
        () => chain().splitCell().run(),
        { size: 'small', disabled: !state.canSplitCell },
      ),
      item(
        'delete-table',
        t('tools.richText.deleteTable'),
        'tableDelete',
        () => chain().deleteTable().run(),
        {
          size: 'small',
        },
      ),
      item(
        'table-borders',
        t('tools.richText.tableBorders'),
        'borders',
        () => chain().toggleTableBorders().run(),
        { size: 'small', active: state.tableBordered },
      ),
      item(
        'table-zebra',
        t('tools.richText.tableZebra'),
        'tableZebra',
        () => chain().toggleTableZebra().run(),
        { size: 'small', active: state.tableZebra },
      ),
      select(
        'cell-valign',
        t('tools.richText.cellVAlign'),
        options.cellVAlignValue,
        [
          { value: '', label: t('tools.richText.cellVAlignTop') },
          { value: 'middle', label: t('tools.richText.cellVAlignMiddle') },
          { value: 'bottom', label: t('tools.richText.cellVAlignBottom') },
        ],
        (value) =>
          chain()
            .setCellVerticalAlign((value || null) as 'top' | 'middle' | 'bottom' | null)
            .run(),
        'xs',
      ),
      select(
        'row-height',
        t('tools.richText.rowHeight'),
        options.rowHeightValue,
        options.rowHeightOptions,
        (value) => {
          if (!value) {
            chain().setRowHeight(null).run();
            return;
          }
          if (value === 'custom') return;
          chain()
            .setRowHeight(Math.round(Number(value) * MM_TO_PX))
            .run();
        },
        'xs',
      ),
    ],
  };
}

/** Contextual group: picture size, alignment and text wrapping */
function imageGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
  return {
    id: 'image-layout',
    label: t('tools.richText.ribbon.grp.imageLayout'),
    priority: 7,
    items: [
      select(
        'image-width',
        t('tools.richText.imageWidth'),
        options.imageWidthValue,
        options.imageWidthOptions,
        (value) => {
          if (!value) {
            chain().setImageWidth(null).run();
            return;
          }
          if (value === 'custom') return;
          chain()
            .setImageWidth(Math.round((Number(value) / 100) * options.contentWidth))
            .run();
        },
        'xs',
      ),
      ...(['left', 'center', 'right'] as const).map((align) =>
        item(
          `image-align-${align}`,
          t(`tools.richText.imageAlign_${align}`),
          `imageAlign${align[0]!.toUpperCase()}${align.slice(1)}`,
          () =>
            chain()
              .setImageStyle(state.imageWidth, state.imageAlign === align ? null : align)
              .run(),
          { size: 'small', active: state.imageAlign === align },
        ),
      ),
      select(
        'image-layer',
        t('tools.richText.imageLayer'),
        state.imageLayer,
        [
          { value: 'inline', label: t('tools.richText.imageLayerInline') },
          { value: 'wrap-left', label: t('tools.richText.imageLayerWrapLeft') },
          { value: 'wrap-right', label: t('tools.richText.imageLayerWrapRight') },
          { value: 'top-bottom', label: t('tools.richText.imageLayerTopBottom') },
          { value: 'front', label: t('tools.richText.imageLayerFront') },
          { value: 'behind', label: t('tools.richText.imageLayerBehind') },
        ],
        (value) => chain().setImageLayer(normalizeImageLayer(value)).run(),
        'sm',
      ),
    ],
  };
}

/** Word's 表格工具: the table commands now own a tab instead of trailing the 开始 groups (P0-6) */
function tableToolsTab(input: RichTextRibbonInput): RibbonTab {
  return {
    id: 'table-tools',
    label: input.t('tools.richText.ribbon.tab.tableTools'),
    groups: [tableGroup(input)],
  };
}

/** Word's 图片格式: picture size / alignment / wrapping, previously appended to 插入 (P0-6) */
function pictureFormatTab(input: RichTextRibbonInput): RibbonTab {
  return {
    id: 'picture-format',
    label: input.t('tools.richText.ribbon.tab.pictureFormat'),
    groups: [imageGroup(input)],
  };
}

/** Layer captions, shared by the picture and the shape tabs */
const LAYER_LABELS: Record<ImageLayer, string> = {
  inline: 'tools.richText.imageLayerInline',
  'wrap-left': 'tools.richText.imageLayerWrapLeft',
  'wrap-right': 'tools.richText.imageLayerWrapRight',
  'top-bottom': 'tools.richText.imageLayerTopBottom',
  front: 'tools.richText.imageLayerFront',
  behind: 'tools.richText.imageLayerBehind',
};

/** Common table sizes behind 插入 → 表格's split button (the icon itself inserts 3×3) */
const TABLE_SIZE_PRESETS = [
  [2, 2],
  [2, 3],
  [3, 3],
  [4, 4],
  [5, 5],
] as const;

const SHAPE_STROKE_WIDTHS = [0.5, 1, 1.5, 2, 3, 4, 6, 8] as const;
const SHAPE_TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72] as const;

/**
 * Contextual "形状格式" tab (Word shows it only while a shape is selected).
 *
 * Everything the old shape bar carried lives here now: swapping the preset, fill / outline / dash,
 * the shape's text style and the text-wrap layer. Size, rotation and the adjustment handles stay in
 * the side panel, reachable through the group's dialog launcher — the same split Word uses between
 * the ribbon and "设置形状格式".
 */
function shapeFormatTab(input: RichTextRibbonInput, attrs: DocShapeAttrs, pos: number): RibbonTab {
  const { editor, t, actions } = input;
  const update = (patch: Partial<DocShapeAttrs>) => applyShapeAttrs(editor, patch);
  // Colours are canonical `#rrggbb` across the app (docx export upper-cases them), so the swatch
  // value is normalised before it lands in the node attributes
  const hex = (color: string) => normalizeHex(color) ?? color;
  const setLayer = (layer: ImageLayer) =>
    editor.chain().focus().setNodeSelection(pos).setDocShapeLayer(layer).run();

  const strokeWidthValue = SHAPE_STROKE_WIDTHS.find(
    (width) => Math.abs(width - attrs.strokeWidth) < 0.01,
  );
  const textSizeValue = SHAPE_TEXT_SIZES.find((size) => size === Math.round(attrs.textSize));

  return {
    id: 'shape-format',
    label: t('tools.richText.ribbon.tab.shapeFormat'),
    groups: [
      {
        id: 'shape-change',
        label: t('tools.richText.ribbon.grp.shapeChange'),
        priority: 9,
        items: [
          item(
            'change-shape',
            t('tools.richText.ribbon.changeShape'),
            'changeShape',
            input.onToggleChangeShape,
            { active: input.changeShapeOpen },
          ),
        ],
        // Same gallery as 插入 → 形状: presets are visual, a text menu made users guess the codes
        overlay: input.changeShapeOpen
          ? createElement(ShapeMenu, {
              open: true,
              mode: 'change',
              activePrst: attrs.prst,
              onPick: (prst: string) => {
                update({ prst, adj: null });
                input.onToggleChangeShape();
              },
              onOpenPanel: actions.onOpenShapePanel,
              onClose: input.onToggleChangeShape,
            })
          : null,
      },
      {
        id: 'shape-style',
        label: t('tools.richText.ribbon.grp.shapeStyle'),
        priority: 8,
        // Dialog launcher: size / rotation / adjustment handles live in the side panel
        onLauncher: actions.onOpenShapePanel,
        items: [
          {
            kind: 'color',
            id: 'shape-fill',
            label: t('tools.richText.shapeFill'),
            icon: 'paintBucket',
            value: attrs.fill,
            onPick: (color) => update({ fill: hex(color) }),
          },
          {
            kind: 'color',
            id: 'shape-stroke',
            label: t('tools.richText.shapeStroke'),
            icon: 'borders',
            value: attrs.stroke,
            onPick: (color) => update({ stroke: hex(color) }),
          },
          select(
            'shape-stroke-width',
            t('tools.richText.shapeStrokeWidth'),
            strokeWidthValue === undefined ? 'custom' : String(strokeWidthValue),
            [
              ...SHAPE_STROKE_WIDTHS.map((width) => ({
                value: String(width),
                label: String(width),
              })),
              // Imported shapes can carry any width: show it instead of silently rounding to a preset
              ...(strokeWidthValue === undefined
                ? [{ value: 'custom', label: String(Math.round(attrs.strokeWidth * 10) / 10) }]
                : []),
            ],
            (value) => {
              if (value === 'custom') return;
              update({ strokeWidth: Number(value) });
            },
            'xs',
          ),
          select(
            'shape-dash',
            t('tools.richText.shapeDash'),
            attrs.dash ?? 'solid',
            [
              { value: 'solid', label: t('tools.richText.shapeDashSolid') },
              { value: 'dash', label: t('tools.richText.shapeDashDash') },
              { value: 'dot', label: t('tools.richText.shapeDashDot') },
            ],
            (value) => update({ dash: value as ShapeDash }),
            'xs',
          ),
        ],
      },
      {
        id: 'shape-text',
        label: t('tools.richText.ribbon.grp.shapeText'),
        priority: 7,
        items: [
          select(
            'shape-text-size',
            t('tools.richText.fontSize'),
            textSizeValue === undefined ? 'custom' : String(textSizeValue),
            [
              ...SHAPE_TEXT_SIZES.map((size) => ({ value: String(size), label: String(size) })),
              ...(textSizeValue === undefined
                ? [{ value: 'custom', label: String(Math.round(attrs.textSize)) }]
                : []),
            ],
            (value) => {
              if (value === 'custom') return;
              update({ textSize: Number(value) });
            },
            'xs',
          ),
          {
            kind: 'color',
            id: 'shape-text-color',
            label: t('tools.richText.color'),
            icon: 'fontColor',
            value: attrs.textColor,
            onPick: (color) => update({ textColor: hex(color) }),
          },
          item(
            'shape-bold',
            t('tools.richText.bold'),
            'bold',
            () => update({ textBold: !attrs.textBold }),
            { size: 'small', active: attrs.textBold },
          ),
          item(
            'shape-italic',
            t('tools.richText.italic'),
            'italic',
            () => update({ textItalic: !attrs.textItalic }),
            { size: 'small', active: attrs.textItalic },
          ),
          item(
            'shape-underline',
            t('tools.richText.underline'),
            'underline',
            () => update({ textUnderline: !attrs.textUnderline }),
            { size: 'small', active: attrs.textUnderline },
          ),
          {
            kind: 'menu',
            id: 'shape-align',
            label: t('tools.richText.alignCenter'),
            icon: 'alignArrange',
            menu: (['left', 'center', 'right'] as const).map((align) => ({
              id: `shape-align-${align}`,
              label: t(`tools.richText.align${align[0]!.toUpperCase()}${align.slice(1)}`),
              checked: attrs.textAlign === align,
              onSelect: () => update({ textAlign: align }),
            })),
          },
        ],
      },
      {
        id: 'shape-arrange',
        label: t('tools.richText.ribbon.grp.shapeArrange'),
        priority: 6,
        items: [
          {
            kind: 'menu',
            id: 'shape-layer',
            label: t('tools.richText.imageLayer'),
            icon: 'imageLayer',
            menu: IMAGE_LAYERS.map((layer) => ({
              id: `shape-layer-${layer}`,
              label: t(LAYER_LABELS[layer]),
              checked: layer === attrs.layer,
              onSelect: () => setLayer(layer),
            })),
          },
        ],
      },
    ],
  };
}

/**
 * Builds the six Office tabs. Contextual groups (table / picture) join the tab they belong to and
 * disappear again when the caret leaves them, exactly like Word's contextual tabs.
 */
export function buildRichTextRibbonTabs(input: RichTextRibbonInput): RibbonTab[] {
  const { editor, state, t, actions, options } = input;
  const chain = () => editor.chain().focus();

  const home: RibbonGroup[] = [
    clipboardGroup(input),
    fontGroup(input),
    paragraphGroup(input),
    {
      id: 'styles',
      label: t('tools.richText.ribbon.grp.styles'),
      priority: 4,
      items: [
        item('styles', t('tools.richText.styles'), 'palette', actions.onToggleStyles, {
          active: actions.stylesOpen,
        }),
        // Both are primary commands: two large buttons fill the group, a small one left a hole
        item('templates', t('tools.richText.templates'), 'grid', actions.onToggleTemplates, {
          active: actions.templatesOpen,
        }),
      ],
      // Word's style gallery hangs under the button: picking one applies it right away, and the
      // document never loses screen space to a separate panel
      overlay: actions.stylesOpen
        ? createElement(StyleGallery, {
            open: true,
            editor,
            styles: actions.namedStyles,
            onChangeStyles: actions.onNamedStylesChange,
            onClose: actions.onToggleStyles,
          })
        : null,
    },
    {
      id: 'editing',
      label: t('tools.richText.ribbon.grp.editing'),
      priority: 2,
      items: [
        item('find', t('tools.richText.findReplace'), 'search', actions.onToggleFind, {
          active: actions.findOpen,
        }),
      ],
    },
  ];
  // P0-6 rollback: with CONTEXT_TABS_ENABLED the group lives in its own 表格工具 tab
  if (!CONTEXT_TABS_ENABLED && state.inTable) home.push(tableGroup(input));

  const insert: RibbonGroup[] = [
    {
      id: 'tables',
      label: t('tools.richText.ribbon.grp.table'),
      priority: 9,
      items: [
        // Word opens a size grid; a split button keeps the one-click 3×3 and offers the common sizes
        {
          kind: 'split',
          id: 'insert-table',
          label: t('tools.richText.table'),
          icon: 'table',
          onSelect: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          menu: TABLE_SIZE_PRESETS.map(([rows, cols]) => ({
            id: `insert-table-${rows}x${cols}`,
            label: `${rows} × ${cols}`,
            icon: 'table',
            onSelect: () => chain().insertTable({ rows, cols, withHeaderRow: true }).run(),
          })),
        },
      ],
    },
    {
      id: 'illustrations',
      label: t('tools.richText.ribbon.grp.illustrations'),
      priority: 8,
      items: [
        item('insert-image', t('tools.richText.image'), 'image', input.onPickImage),
        item(
          'insert-shape',
          t('tools.richText.shapeInsert'),
          'shapeInsert',
          actions.onToggleShapeMenu,
          { active: actions.shapeMenuOpen || actions.shapesOpen || state.shapeSelected },
        ),
        item(
          'insert-math',
          state.mathSelected ? t('tools.richText.mathEdit') : t('tools.richText.mathInsert'),
          'math',
          actions.onMath,
          { size: 'small', active: state.mathSelected },
        ),
        item(
          'divider',
          t('tools.richText.divider'),
          'horizontalRule',
          () => chain().setHorizontalRule().run(),
          {
            size: 'small',
          },
        ),
      ],
      // Gallery instead of a menu: picking a preset arms the draw layer, so the grid is the point.
      // `createElement` instead of JSX so this module can stay a `.ts` data table (no Fast Refresh noise).
      overlay: actions.shapeMenuOpen
        ? createElement(ShapeMenu, {
            open: true,
            activePrst: actions.activeShapePrst,
            onPick: actions.onPickShape,
            onOpenPanel: actions.onOpenShapePanel,
            onClose: actions.onToggleShapeMenu,
          })
        : null,
    },
    {
      id: 'links',
      label: t('tools.richText.ribbon.grp.links'),
      priority: 5,
      items: [
        item(
          'link',
          t('tools.richText.link'),
          'link',
          () => {
            if (state.link) {
              chain().extendMarkRange('link').unsetLink().run();
              return;
            }
            const href = window.prompt(t('tools.richText.linkPrompt'), 'https://');
            if (!href) return;
            chain().extendMarkRange('link').setLink({ href }).run();
          },
          { active: state.link },
        ),
      ],
    },
  ];
  // P0-6 rollback: with CONTEXT_TABS_ENABLED the group lives in its own 图片格式 tab
  if (!CONTEXT_TABS_ENABLED && state.inImage) insert.push(imageGroup(input));

  const tabs: RibbonTab[] = [
    { id: 'home', label: t('tools.richText.ribbon.tab.home'), groups: home },
    { id: 'insert', label: t('tools.richText.ribbon.tab.insert'), groups: insert },
    {
      id: 'layout',
      label: t('tools.richText.ribbon.tab.layout'),
      groups: [
        {
          id: 'page-setup',
          label: t('tools.richText.ribbon.grp.pageSetup'),
          priority: 9,
          onLauncher: actions.onTogglePageSetup,
          items: [
            item(
              'page-setup',
              t('tools.richText.pageSetup'),
              'pageSetup',
              actions.onTogglePageSetup,
              { active: actions.pageSetupOpen },
            ),
          ],
        },
        {
          // Word 的「布局 → 分隔符」：分页符 + 分节符（下一页 / 连续）
          id: 'breaks',
          label: t('tools.richText.ribbon.grp.breaks'),
          priority: 7,
          items: [
            item('page-break', t('tools.richText.pageBreak'), 'pageBreak', () =>
              chain().setPageBreak().run(),
            ),
            {
              kind: 'split',
              id: 'section-break',
              label: t('tools.richText.sectionBreak'),
              icon: 'sectionBreak',
              onSelect: () => actions.onInsertSectionBreak('nextPage'),
              menu: [
                {
                  id: 'section-break-next-page',
                  label: t('tools.richText.sectionBreakNextPage'),
                  icon: 'sectionBreak',
                  onSelect: () => actions.onInsertSectionBreak('nextPage'),
                },
                {
                  id: 'section-break-continuous',
                  label: t('tools.richText.sectionBreakContinuous'),
                  icon: 'horizontalRule',
                  onSelect: () => actions.onInsertSectionBreak('continuous'),
                },
              ],
            },
          ],
        },
        {
          id: 'layout-paragraph',
          label: t('tools.richText.ribbon.grp.paragraph'),
          priority: 6,
          items: [
            item('indent-increase', t('tools.richText.indentIncrease'), 'indentIncrease', () =>
              chain().indentParagraph(24).run(),
            ),
            item('indent-decrease', t('tools.richText.indentDecrease'), 'indentDecrease', () =>
              chain().indentParagraph(-24).run(),
            ),
            select(
              'line-height',
              t('tools.richText.lineHeight'),
              state.lineHeight,
              options.lineHeightOptions,
              (value) =>
                value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run(),
              'xs',
            ),
            select(
              'paragraph-spacing',
              t('tools.richText.paragraphSpacing'),
              state.paragraphSpacing,
              [
                { value: '0-0', label: t('tools.richText.spacingPresetDefault') },
                { value: '0-12', label: t('tools.richText.spacingPresetCompact') },
                { value: '12-12', label: t('tools.richText.spacingPresetRelaxed') },
                { value: '24-24', label: t('tools.richText.spacingPresetLoose') },
              ],
              (value) => {
                const [before, after] = value.split('-').map(Number);
                chain()
                  .setParagraphSpacing(before || 0, after || 0)
                  .run();
              },
              'xs',
            ),
          ],
        },
      ],
    },
    {
      id: 'references',
      label: t('tools.richText.ribbon.tab.references'),
      groups: [
        {
          id: 'toc',
          label: t('tools.richText.ribbon.grp.toc'),
          priority: 9,
          items: [],
          // One row: the small "update" button sits beside the large "table of contents" one
          rows: [
            [
              item('insert-toc', t('tools.richText.insertToc'), 'toc', actions.onInsertToc, {
                disabled: actions.tocDisabled,
              }),
              item('refresh-toc', t('tools.richText.refreshToc'), 'refresh', actions.onRefreshToc, {
                size: 'small',
                disabled: actions.tocDisabled,
              }),
            ],
          ],
        },
        {
          id: 'notes',
          label: t('tools.richText.ribbon.grp.notes'),
          priority: 8,
          items: [
            item(
              'footnote',
              state.footnoteSelected
                ? t('tools.richText.footnoteEdit')
                : t('tools.richText.footnoteInsert'),
              'footnote',
              actions.onFootnote,
              { active: state.footnoteSelected },
            ),
            item(
              'endnote',
              state.endnoteSelected
                ? t('tools.richText.endnoteEdit')
                : t('tools.richText.endnoteInsert'),
              'endnote',
              actions.onEndnote,
              { active: state.endnoteSelected },
            ),
          ],
        },
        {
          id: 'cross-references',
          label: t('tools.richText.ribbon.grp.references'),
          priority: 6,
          items: [
            item('bookmark', t('tools.richText.bookmark'), 'bookmark', actions.onOpenBookmarks, {
              active: actions.bookmarksOpen,
            }),
            item('xref', t('tools.richText.xref'), 'crossReference', actions.onOpenXrefs, {
              active: actions.xrefsOpen,
            }),
          ],
        },
      ],
    },
    {
      id: 'review',
      label: t('tools.richText.ribbon.tab.review'),
      groups: [
        {
          id: 'proofing',
          label: t('tools.richText.ribbon.grp.proofing'),
          priority: 9,
          items: [
            item('spellcheck', t('tools.richText.spellcheck'), 'book', actions.onToggleSpellcheck, {
              active: actions.spellcheckOpen,
            }),
          ],
        },
        {
          // Word 的审阅核心：标记修订、接受/拒绝、与文件比较
          id: 'tracking',
          label: t('tools.richText.ribbon.grp.tracking'),
          priority: 7,
          items: [],
          // Two full rows instead of six buttons packed into 2½ columns
          rows: [
            [
              // Revision mode first: it is the switch that decides whether the next edit is recorded
              item(
                'track-revisions',
                t('tools.richText.trackRevisions'),
                'trackRevisions',
                actions.onToggleTracking,
                { size: 'small', active: actions.trackingMode },
              ),
              item(
                'track-insert',
                t('tools.richText.markInsert'),
                'trackInsert',
                actions.onMarkInsert,
                { size: 'small' },
              ),
              item(
                'track-delete',
                t('tools.richText.markDelete'),
                'trackDelete',
                actions.onMarkDelete,
                { size: 'small' },
              ),
            ],
            [
              item(
                'compare-file',
                t('tools.richText.compareWithFile'),
                'diff',
                actions.onCompareFile,
                { size: 'small' },
              ),
              item('accept-all', t('tools.richText.acceptAll'), 'accept', actions.onAcceptAll, {
                size: 'small',
                disabled: !actions.hasTrackedChanges,
              }),
              item('reject-all', t('tools.richText.rejectAll'), 'reject', actions.onRejectAll, {
                size: 'small',
                disabled: !actions.hasTrackedChanges,
              }),
            ],
          ],
        },
        {
          id: 'comments',
          label: t('tools.richText.ribbon.grp.comments'),
          priority: 8,
          items: [
            item('review', t('tools.richText.review'), 'pen', actions.onToggleReview, {
              active: actions.reviewOpen,
            }),
          ],
        },
        {
          id: 'changes',
          label: t('tools.richText.ribbon.grp.changes'),
          priority: 5,
          items: [
            item('versions', t('tools.richText.versionHistory'), 'clock', actions.onOpenVersions, {
              disabled: actions.versionsDisabled,
            }),
          ],
        },
      ],
    },
    {
      id: 'view',
      label: t('tools.richText.ribbon.tab.view'),
      groups: [
        {
          id: 'document-views',
          label: t('tools.richText.ribbon.grp.documentViews'),
          priority: 9,
          items: [],
          // View mode belongs beside the outline button, not in a column of its own
          rows: [
            [
              item('outline', t('tools.richText.outline'), 'outline', actions.onToggleOutline, {
                active: actions.outlineOpen,
              }),
              select(
                'view-mode',
                t('tools.richText.viewMode'),
                actions.viewMode,
                [
                  { value: 'flow', label: t('tools.richText.viewFlow') },
                  { value: 'paged', label: t('tools.richText.viewPaged') },
                ],
                (value) => actions.onViewModeChange(value as ViewMode),
                'md',
              ),
            ],
          ],
        },
        {
          id: 'show',
          label: t('tools.richText.ribbon.grp.show'),
          priority: 6,
          items: [
            item('ruler', t('tools.richText.ruler'), 'rulerTicks', actions.onToggleRuler, {
              active: actions.rulerOpen,
            }),
          ],
        },
        {
          id: 'zoom',
          label: t('tools.richText.ribbon.grp.zoom'),
          priority: 4,
          items: [
            select(
              'zoom',
              t('tools.richText.zoom'),
              String(actions.zoom),
              zoomOptions(),
              (value) => actions.onZoomChange(Number(value)),
              'xs',
            ),
          ],
        },
      ],
    },
  ];

  // Contextual tabs (Word-style). `resolveContextTab` is also used by EditorToolbar to activate
  // the tab, so tab presence and tab activation can never disagree (P0-6).
  const contextTabId = input.state.contextTab ?? resolveContextTab(editor.state);
  if (contextTabId === 'shape-format') {
    const selectedShape = findSelectedShape(editor.state);
    if (selectedShape) {
      tabs.push(shapeFormatTab(input, shapeSpec(selectedShape.node.attrs), selectedShape.pos));
    }
  } else if (contextTabId === 'table-tools') {
    tabs.push(tableToolsTab(input));
  } else if (contextTabId === 'picture-format') {
    tabs.push(pictureFormatTab(input));
  }
  return tabs;
}

/** 100% = 1; kept in sync with the toolbar's previous ZOOM_LEVELS */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function zoomOptions(): { value: string; label: string }[] {
  return ZOOM_LEVELS.map((level) => ({
    value: String(level),
    label: `${Math.round(level * 100)}%`,
  }));
}
