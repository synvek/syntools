import { createElement } from 'react';
import type { Editor } from '@tiptap/react';
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
import { IMAGE_LAYERS, normalizeImageLayer, type ImageLayer } from './imageLayer';
import { MM_TO_PX } from './pageSetup';
import { ShapeMenu } from './ShapeMenu';
import { findSelectedShape, shapeSpec, type DocShapeAttrs, type ShapeDash } from './shapeNode';
import { applyShapeAttrs } from './useSelectedShape';

/**
 * Commands of the word processor ribbon, described as data.
 *
 * The toolbar itself owns nothing but the editor state and the DOM measurements (installed fonts,
 * current content width); every command lives here so the Office tabs read like the Word ones and
 * the whole mapping stays testable without mounting the editor.
 */

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
  footnoteSelected: boolean;
  endnoteSelected: boolean;
  mathSelected: boolean;
  shapeSelected: boolean;
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
  headingOptions: { value: string; label: string }[];
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
  width: 'xs' | 'sm' | 'md' = 'sm',
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
    items: [
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
      item('bold', t('tools.richText.bold'), 'bold', () => chain().toggleBold().run(), {
        active: state.bold,
      }),
      item('italic', t('tools.richText.italic'), 'italic', () => chain().toggleItalic().run(), {
        active: state.italic,
      }),
      item(
        'underline',
        t('tools.richText.underline'),
        'underline',
        () => chain().toggleUnderline().run(),
        { active: state.underline },
      ),
      item('strike', t('tools.richText.strike'), 'strike', () => chain().toggleStrike().run(), {
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
        value: /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#111827',
        onPick: (color) => chain().setColor(color).run(),
        onReset: () => chain().unsetColor().run(),
        resetLabel: t('tools.richText.colorDefault'),
      },
      item(
        'highlight',
        t('tools.richText.highlight'),
        'fillColor',
        () => chain().toggleHighlight({ color: '#FEF08A' }).run(),
        { active: state.highlight },
      ),
      select(
        'letter-spacing',
        t('tools.richText.letterSpacing'),
        state.letterSpacing,
        options.letterSpacingOptions,
        (value) =>
          chain()
            .setLetterSpacing(value ? Number(value) : null)
            .run(),
        'xs',
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
        'xs',
      ),
    ],
  };
}

/** Lists, alignment and indents */
function paragraphGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
  return {
    id: 'paragraph',
    label: t('tools.richText.ribbon.grp.paragraph'),
    priority: 8,
    items: [
      select(
        'heading',
        t('tools.richText.headingSelect'),
        state.headingLevel ? String(state.headingLevel) : 'paragraph',
        options.headingOptions,
        (value) =>
          value === 'paragraph'
            ? chain().setParagraph().run()
            : chain()
                .toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                .run(),
        'md',
        false,
        { listWidth: 'wide' },
      ),
      select(
        'line-height',
        t('tools.richText.lineHeight'),
        state.lineHeight,
        options.lineHeightOptions,
        (value) => (value ? chain().setLineHeight(value).run() : chain().unsetLineHeight().run()),
        'xs',
      ),
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
      item(
        'indent-increase',
        t('tools.richText.indentIncrease'),
        'indentIncrease',
        () => chain().indentParagraph(24).run(),
        { size: 'small' },
      ),
      item(
        'indent-decrease',
        t('tools.richText.indentDecrease'),
        'indentDecrease',
        () => chain().indentParagraph(-24).run(),
        { size: 'small' },
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

/** Layer captions, shared by the picture and the shape tabs */
const LAYER_LABELS: Record<ImageLayer, string> = {
  inline: 'tools.richText.imageLayerInline',
  'wrap-left': 'tools.richText.imageLayerWrapLeft',
  'wrap-right': 'tools.richText.imageLayerWrapRight',
  'top-bottom': 'tools.richText.imageLayerTopBottom',
  front: 'tools.richText.imageLayerFront',
  behind: 'tools.richText.imageLayerBehind',
};

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
        item('templates', t('tools.richText.templates'), 'grid', actions.onToggleTemplates, {
          size: 'small',
          active: actions.templatesOpen,
        }),
      ],
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
  if (state.inTable) home.push(tableGroup(input));

  const insert: RibbonGroup[] = [
    {
      id: 'tables',
      label: t('tools.richText.ribbon.grp.table'),
      priority: 9,
      items: [
        item('insert-table', t('tools.richText.table'), 'table', () =>
          chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        ),
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
        item(
          'page-break',
          t('tools.richText.pageBreak'),
          'pageBreak',
          () => chain().setPageBreak().run(),
          { size: 'small' },
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
  if (state.inImage) insert.push(imageGroup(input));

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
            item('templates', t('tools.richText.templates'), 'grid', actions.onToggleTemplates, {
              size: 'small',
              active: actions.templatesOpen,
            }),
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
          items: [
            item('insert-toc', t('tools.richText.insertToc'), 'toc', actions.onInsertToc, {
              disabled: actions.tocDisabled,
            }),
            item('refresh-toc', t('tools.richText.refreshToc'), 'refresh', actions.onRefreshToc, {
              size: 'small',
              disabled: actions.tocDisabled,
            }),
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
          items: [
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

  // Contextual tab: present only while a shape node is selected, like Word's 形状格式
  const selectedShape = findSelectedShape(editor.state);
  if (selectedShape) {
    tabs.push(shapeFormatTab(input, shapeSpec(selectedShape.node.attrs), selectedShape.pos));
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
