import { createElement } from 'react';
import type { Editor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import type {
  RibbonGroup,
  RibbonItem,
  RibbonItemSize,
  RibbonTab,
} from '@/core/components/ribbon/types';
import type { TextTransformValue } from './charFormat';
import type { ViewMode } from './draft';
import { normalizeImageLayer } from './imageLayer';
import { MM_TO_PX } from './pageSetup';
import { ShapeMenu } from './ShapeMenu';

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
  options: { value: string; label: string }[],
  onChange: (value: string) => void,
  width: 'xs' | 'sm' | 'md' = 'sm',
  disabled = false,
): RibbonItem {
  return { kind: 'select', id, label, value, options, onChange, width, disabled };
}

/** Lays the words on the page: font, character spacing, colour and highlight */
function fontGroup(input: RichTextRibbonInput): RibbonGroup {
  const { state, t, options } = input;
  const chain = () => input.editor.chain().focus();
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
      ),
      select(
        'font-size',
        t('tools.richText.fontSize'),
        state.fontSize,
        options.fontSizeOptions,
        (value) => (value ? chain().setFontSize(value).run() : chain().unsetFontSize().run()),
        'xs',
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

  return [
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
}

/** 100% = 1; kept in sync with the toolbar's previous ZOOM_LEVELS */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function zoomOptions(): { value: string; label: string }[] {
  return ZOOM_LEVELS.map((level) => ({
    value: String(level),
    label: `${Math.round(level * 100)}%`,
  }));
}
