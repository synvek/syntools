import type { TFunction } from 'i18next';
import { fontPreviewOptions } from '@/core/components/ribbon/ribbonPreviewOptions';
import type {
  RibbonGroup,
  RibbonItem,
  RibbonMenuItem,
  RibbonSelectItem,
  RibbonSelectOption,
  RibbonTab,
} from '@/core/components/ribbon/types';
import { SHAPE_PRESETS } from '../model/factory';
import type { RunStyle, ShapeGeometry, TextAlign } from '../model/types';

/**
 * Ribbon layout of the slide editor.
 *
 * Same split as the other two editors: the data table below says *what* each tab offers, while
 * `SlideToolbar` owns the store subscriptions and hands the commands in as plain closures. Nothing in
 * this file touches zustand, so the tab mapping is trivially unit-testable.
 */

export type SlideRightTab = 'element' | 'layers' | 'theme' | 'template' | 'comments' | 'animation';

export interface SlideRibbonContext {
  t: TFunction;
  /* ------------------------------ derived state ------------------------------ */
  hasSelection: boolean;
  selectionCount: number;
  canCombine: boolean;
  canDistribute: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canText: boolean;
  canFill: boolean;
  canStroke: boolean;
  canCorner: boolean;
  canShadow: boolean;
  run: RunStyle | undefined;
  align: TextAlign;
  listKind: 'none' | 'bullet' | 'numbering';
  fontFamily: string;
  fontSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  shadow: boolean;
  lineSpacing: number;
  scale: number;
  gridSnap: boolean;
  showRulers: boolean;
  penMode: boolean;
  pathEdit: boolean;
  canEditPoints: boolean;
  allLocked: boolean;
  anyHidden: boolean;
  painterActive: boolean;
  masterView: boolean;
  /* --------------------------------- commands -------------------------------- */
  undo: () => void;
  redo: () => void;
  stepFontSize: (delta: number) => void;
  applyRunStyle: (patch: Partial<RunStyle>) => void;
  applyAlign: (align: TextAlign) => void;
  applyList: (kind: 'none' | 'bullet' | 'numbering') => void;
  applyLineSpacing: (value: number) => void;
  applyFill: (color: string | null) => void;
  applyStroke: (color: string | null) => void;
  applyStrokeWidth: (width: number) => void;
  applyOpacity: (percent: number) => void;
  applyCornerRadius: (radius: number) => void;
  applyShadow: (on: boolean) => void;
  insertText: () => void;
  insertLine: () => void;
  insertTable: () => void;
  insertShape: (geom: ShapeGeometry) => void;
  pickImage: () => void;
  openInsertPanel: (panel: 'shape' | 'chart' | 'icon' | 'formula') => void;
  openRightPanel: (tab: SlideRightTab) => void;
  present: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  alignSelected: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
  distributeSelected: (axis: 'horizontal' | 'vertical') => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  toggleFlip: (axis: 'flipX' | 'flipY') => void;
  combine: (op: 'union' | 'subtract' | 'intersect' | 'exclude') => void;
  toggleLockSelected: () => void;
  toggleVisibleSelected: () => void;
  copyFormat: () => void;
  applyFormat: () => void;
  clearFormatPainter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  toggleGridSnap: () => void;
  toggleRulers: () => void;
  togglePen: () => void;
  togglePathEdit: () => void;
  toggleMasterView: () => void;
  moveSlideUp: () => void;
}

/** Font sizes offered by the ribbon (the current value is added by `RibbonSelect` when it is not listed) */
export const SLIDE_FONT_SIZES = [
  10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 80, 96,
] as const;
export const SLIDE_FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Impact',
  'PingFang SC',
  'Microsoft YaHei',
  'SimSun',
  'SimHei',
  'Noto Sans',
  'sans-serif',
  'serif',
  'monospace',
] as const;
const STROKE_WIDTHS = [0, 0.5, 1, 1.5, 2, 3, 4, 6] as const;
const OPACITY_PRESETS = [0, 25, 50, 75, 100] as const;
const RADIUS_PRESETS = [0, 2, 4, 8, 16, 24, 40] as const;
const LINE_SPACINGS = [0.8, 1, 1.2, 1.5, 2, 2.5, 3] as const;

interface ItemOptions {
  size?: 'large' | 'small';
  active?: boolean;
  disabled?: boolean;
  hint?: string;
}

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

const numericOptions = (values: readonly number[]) =>
  values.map((value) => ({ value: String(value), label: String(value) }));

export function buildSlideRibbonTabs(ctx: SlideRibbonContext): RibbonTab[] {
  const { t } = ctx;
  const selectionDisabled = !ctx.hasSelection;

  const shapeMenu: RibbonMenuItem[] = SHAPE_PRESETS.map((preset) => ({
    id: preset.key,
    label: t(`tools.slide.${preset.key}`),
    icon:
      preset.geom.kind === 'ellipse'
        ? 'shapeEllipse'
        : preset.geom.kind === 'star' || preset.geom.kind === 'polygon'
          ? 'shapeStar'
          : 'shapeRect',
    onSelect: () => ctx.insertShape(preset.geom),
  }));

  const alignMenu: RibbonMenuItem[] = (
    [
      ['left', 'alignLeft'],
      ['hcenter', 'alignCenter'],
      ['right', 'alignRight'],
      ['top', 'alignTop'],
      ['vcenter', 'alignMiddle'],
      ['bottom', 'alignBottom'],
    ] as const
  ).map(([mode, labelKey]) => ({
    id: mode,
    label: t(`tools.slide.${labelKey}`),
    disabled: selectionDisabled,
    onSelect: () => ctx.alignSelected(mode),
  }));

  const distributeMenu: RibbonMenuItem[] = (
    [
      ['horizontal', 'distributeH'],
      ['vertical', 'distributeV'],
    ] as const
  ).map(([axis, labelKey]) => ({
    id: axis,
    label: t(`tools.slide.${labelKey}`),
    disabled: !ctx.canDistribute,
    onSelect: () => ctx.distributeSelected(axis),
  }));

  const flipMenu: RibbonMenuItem[] = (
    [
      ['flipX', 'flipH'],
      ['flipY', 'flipV'],
    ] as const
  ).map(([axis, labelKey]) => ({
    id: axis,
    label: t(`tools.slide.${labelKey}`),
    disabled: selectionDisabled,
    onSelect: () => ctx.toggleFlip(axis),
  }));

  const booleanMenu: RibbonMenuItem[] = (
    [
      ['union', 'booleanUnion'],
      ['subtract', 'booleanSubtract'],
      ['intersect', 'booleanIntersect'],
      ['exclude', 'booleanExclude'],
    ] as const
  ).map(([op, labelKey]) => ({
    id: op,
    label: t(`tools.slide.${labelKey}`),
    disabled: !ctx.canCombine,
    onSelect: () => ctx.combine(op),
  }));

  const arrangeGroup: RibbonGroup = {
    id: 'arrange',
    label: t('tools.slide.grpArrange'),
    // 排列 wins over the shape-style pickers: colours are also reachable in the right-hand panel,
    // alignment / grouping are not.
    priority: 8,
    items: [
      {
        kind: 'menu',
        id: 'align',
        label: t('tools.slide.alignTitle'),
        icon: 'alignArrange',
        disabled: selectionDisabled,
        menu: alignMenu,
      },
      {
        kind: 'menu',
        id: 'distribute',
        label: t('tools.slide.distributeTitle'),
        icon: 'distribute',
        disabled: !ctx.canDistribute,
        menu: distributeMenu,
      },
      item('bring-front', t('tools.slide.bringToFront'), 'layerFront', ctx.bringToFront, {
        size: 'small',
        disabled: selectionDisabled,
      }),
      item('send-back', t('tools.slide.sendToBack'), 'layerBack', ctx.sendToBack, {
        size: 'small',
        disabled: selectionDisabled,
      }),
      item('bring-forward', t('tools.slide.bringForward'), 'layerForward', ctx.bringForward, {
        size: 'small',
        disabled: selectionDisabled,
      }),
      item('send-backward', t('tools.slide.sendBackward'), 'layerBackward', ctx.sendBackward, {
        size: 'small',
        disabled: selectionDisabled,
      }),
      item('group', t('tools.slide.group'), 'group', ctx.groupSelected, {
        size: 'small',
        disabled: ctx.selectionCount < 2,
      }),
      item('ungroup', t('tools.slide.ungroup'), 'ungroup', ctx.ungroupSelected, {
        size: 'small',
        disabled: selectionDisabled,
      }),
      {
        kind: 'menu',
        id: 'flip',
        label: t('tools.slide.flipTitle'),
        icon: 'flipH',
        size: 'small',
        disabled: selectionDisabled,
        menu: flipMenu,
      },
      {
        kind: 'menu',
        id: 'boolean',
        label: t('tools.slide.booleanTitle'),
        icon: 'boolean',
        size: 'small',
        disabled: !ctx.canCombine,
        menu: booleanMenu,
      },
      item(
        'lock',
        t('tools.slide.lock'),
        ctx.allLocked ? 'lock' : 'unlock',
        ctx.toggleLockSelected,
        { size: 'small', active: ctx.allLocked, disabled: selectionDisabled },
      ),
      item(
        'hide',
        t('tools.slide.hide'),
        ctx.anyHidden ? 'eyeOff' : 'eye',
        ctx.toggleVisibleSelected,
        { size: 'small', active: ctx.anyHidden, disabled: selectionDisabled },
      ),
    ],
  };

  return [
    {
      id: 'home',
      label: t('tools.slide.tabHome'),
      groups: [
        {
          id: 'font',
          label: t('tools.slide.grpFont'),
          priority: 9,
          items: [
            select(
              'font-family',
              t('tools.slide.fontFamily'),
              ctx.fontFamily,
              fontPreviewOptions(SLIDE_FONT_FAMILIES.map((font) => ({ value: font, label: font }))),
              (font) => ctx.applyRunStyle({ font }),
              'md',
              !ctx.canText,
              // Long family names + the right-aligned specimen need the wider list
              { listWidth: 'wide' },
            ),
            select(
              'font-size',
              t('tools.slide.fontSize'),
              String(ctx.fontSize),
              numericOptions(SLIDE_FONT_SIZES),
              (size) => ctx.applyRunStyle({ size: Number(size) }),
              'xs',
              !ctx.canText,
              // PowerPoint lets you type any size (10.5 / 137 …), not just the presets
              { editable: true },
            ),
            item(
              'grow-font',
              t('tools.slide.increaseFontSize'),
              'fontGrow',
              () => ctx.stepFontSize(1),
              { size: 'small', disabled: !ctx.canText },
            ),
            item(
              'shrink-font',
              t('tools.slide.decreaseFontSize'),
              'fontShrink',
              () => ctx.stepFontSize(-1),
              { size: 'small', disabled: !ctx.canText },
            ),
            item(
              'bold',
              t('tools.slide.bold'),
              'bold',
              () => ctx.applyRunStyle({ bold: !ctx.run?.bold }),
              {
                active: Boolean(ctx.run?.bold),
                disabled: !ctx.canText,
              },
            ),
            item(
              'italic',
              t('tools.slide.italic'),
              'italic',
              () => ctx.applyRunStyle({ italic: !ctx.run?.italic }),
              { active: Boolean(ctx.run?.italic), disabled: !ctx.canText },
            ),
            item(
              'underline',
              t('tools.slide.underline'),
              'underline',
              () => ctx.applyRunStyle({ underline: !ctx.run?.underline }),
              { active: Boolean(ctx.run?.underline), disabled: !ctx.canText },
            ),
            item(
              'strike',
              t('tools.slide.strike'),
              'strike',
              () => ctx.applyRunStyle({ strike: !ctx.run?.strike }),
              { active: Boolean(ctx.run?.strike), disabled: !ctx.canText },
            ),
            {
              kind: 'color',
              id: 'text-color',
              label: t('tools.slide.color'),
              icon: 'fontColor',
              value: ctx.run?.color ?? null,
              disabled: !ctx.canText,
              onPick: (color) => ctx.applyRunStyle({ color }),
            },
            {
              kind: 'color',
              id: 'highlight',
              label: t('tools.slide.highlight'),
              icon: 'fillColor',
              value: ctx.run?.highlight ?? null,
              disabled: !ctx.canText,
              onPick: (color) => ctx.applyRunStyle({ highlight: color }),
              onReset: () => ctx.applyRunStyle({ highlight: undefined }),
              resetLabel: t('common.clear'),
            },
          ],
        },
        {
          id: 'paragraph',
          label: t('tools.slide.grpParagraph'),
          priority: 7,
          items: [
            item(
              'align-left',
              t('tools.slide.alignLeft'),
              'alignLeftCell',
              () => ctx.applyAlign('left'),
              { size: 'small', active: ctx.align === 'left', disabled: !ctx.canText },
            ),
            item(
              'align-center',
              t('tools.slide.alignCenter'),
              'alignCenterCell',
              () => ctx.applyAlign('center'),
              { size: 'small', active: ctx.align === 'center', disabled: !ctx.canText },
            ),
            item(
              'align-right',
              t('tools.slide.alignRight'),
              'alignRightCell',
              () => ctx.applyAlign('right'),
              { size: 'small', active: ctx.align === 'right', disabled: !ctx.canText },
            ),
            item(
              'align-justify',
              t('tools.slide.alignJustify'),
              'alignJustify',
              () => ctx.applyAlign('justify'),
              { size: 'small', active: ctx.align === 'justify', disabled: !ctx.canText },
            ),
            select(
              'line-spacing',
              t('tools.slide.lineHeight'),
              String(ctx.lineSpacing),
              LINE_SPACINGS.map((value) => ({ value: String(value), label: `${value}×` })),
              (value) => ctx.applyLineSpacing(Number(value)),
              'xs',
              !ctx.canText,
            ),
            item(
              'bullet',
              t('tools.slide.bullet'),
              'bulletList',
              () => ctx.applyList(ctx.listKind === 'bullet' ? 'none' : 'bullet'),
              { size: 'small', active: ctx.listKind === 'bullet', disabled: !ctx.canText },
            ),
            item(
              'numbering',
              t('tools.slide.numbering'),
              'orderedList',
              () => ctx.applyList(ctx.listKind === 'numbering' ? 'none' : 'numbering'),
              { size: 'small', active: ctx.listKind === 'numbering', disabled: !ctx.canText },
            ),
          ],
        },
        {
          id: 'shape-styles',
          label: t('tools.slide.grpShapeStyles'),
          priority: 6,
          items: [
            {
              kind: 'color',
              id: 'fill',
              label: t('tools.slide.fill'),
              icon: 'bucket',
              value: ctx.fillColor || null,
              disabled: !ctx.canFill,
              onPick: (color) => ctx.applyFill(color),
              onReset: () => ctx.applyFill(null),
              resetLabel: t('tools.slide.noFill'),
            },
            {
              kind: 'color',
              id: 'stroke',
              label: t('tools.slide.stroke'),
              icon: 'borders',
              value: ctx.strokeColor || null,
              disabled: !ctx.canStroke,
              onPick: (color) => ctx.applyStroke(color),
              onReset: () => ctx.applyStrokeWidth(0),
              resetLabel: t('tools.slide.noStroke'),
            },
            select(
              'stroke-width',
              t('tools.slide.strokeWidth'),
              String(ctx.strokeWidth),
              numericOptions(STROKE_WIDTHS),
              (value) => ctx.applyStrokeWidth(Number(value)),
              'xs',
              !ctx.canStroke,
            ),
            item(
              'shadow',
              t('tools.slide.panelShadow'),
              'shadow',
              () => ctx.applyShadow(!ctx.shadow),
              { size: 'small', active: ctx.shadow, disabled: !ctx.canShadow },
            ),
            select(
              'opacity',
              t('tools.slide.opacity'),
              String(Math.round(ctx.opacity * 100)),
              numericOptions(OPACITY_PRESETS),
              (value) => ctx.applyOpacity(Number(value)),
              'xs',
              selectionDisabled,
            ),
            select(
              'corner-radius',
              t('tools.slide.cornerRadius'),
              String(ctx.cornerRadius),
              numericOptions(RADIUS_PRESETS),
              (value) => ctx.applyCornerRadius(Number(value)),
              'xs',
              !ctx.canCorner,
            ),
            item('copy-format', t('tools.slide.copyFormat'), 'formatPainter', ctx.copyFormat, {
              size: 'small',
              active: ctx.painterActive,
              disabled: selectionDisabled,
            }),
            item('apply-format', t('tools.slide.applyFormat'), 'brush', ctx.applyFormat, {
              size: 'small',
              active: ctx.painterActive,
              disabled: !ctx.painterActive || selectionDisabled,
            }),
            item('clear-format', t('tools.slide.clearFormat'), 'close', ctx.clearFormatPainter, {
              size: 'small',
              disabled: !ctx.painterActive,
            }),
          ],
        },
        arrangeGroup,
      ],
    },
    {
      id: 'insert',
      label: t('tools.slide.tabInsert'),
      groups: [
        {
          id: 'text',
          label: t('tools.slide.grpText'),
          priority: 9,
          items: [item('text-box', t('tools.slide.insertText'), 'text', ctx.insertText)],
        },
        {
          id: 'shapes',
          label: t('tools.slide.grpShapes'),
          priority: 8,
          items: [
            {
              kind: 'menu',
              id: 'shape',
              label: t('tools.slide.insertShape'),
              icon: 'shapes',
              menu: shapeMenu,
            },
            item('line', t('tools.slide.insertLine'), 'shapeLine', ctx.insertLine, {
              size: 'small',
            }),
          ],
        },
        {
          id: 'illustrations',
          label: t('tools.slide.grpIllustrations'),
          priority: 7,
          items: [
            item('image', t('tools.slide.insertImage'), 'image', ctx.pickImage),
            item('table', t('tools.slide.insertTable'), 'table', ctx.insertTable),
            item('chart', t('tools.slide.insertChart'), 'chart', () =>
              ctx.openInsertPanel('chart'),
            ),
            item(
              'formula',
              t('tools.slide.insertFormula'),
              'math',
              () => ctx.openInsertPanel('formula'),
              {
                size: 'small',
              },
            ),
            item('icon', t('tools.slide.insertIcon'), 'star', () => ctx.openInsertPanel('icon'), {
              size: 'small',
            }),
            item(
              'shape-library',
              t('tools.slide.insertShapeLib'),
              'grid',
              () => ctx.openInsertPanel('shape'),
              { size: 'small' },
            ),
          ],
        },
      ],
    },
    {
      id: 'draw',
      label: t('tools.slide.tabDraw'),
      groups: [
        {
          id: 'drawing',
          label: t('tools.slide.grpDrawing'),
          items: [
            item('pen', t('tools.slide.penTool'), 'pen', ctx.togglePen, {
              active: ctx.penMode,
            }),
            item('edit-points', t('tools.slide.editPoints'), 'nodes', ctx.togglePathEdit, {
              active: ctx.pathEdit,
              disabled: !ctx.pathEdit && !ctx.canEditPoints,
            }),
          ],
        },
      ],
    },
    {
      id: 'design',
      label: t('tools.slide.tabDesign'),
      groups: [
        {
          id: 'theme',
          label: t('tools.slide.grpTheme'),
          items: [
            item('theme', t('tools.slide.panelTheme'), 'palette', () =>
              ctx.openRightPanel('theme'),
            ),
            item('template', t('tools.slide.panelTemplate'), 'grid', () =>
              ctx.openRightPanel('template'),
            ),
          ],
        },
      ],
    },
    {
      id: 'animation',
      label: t('tools.slide.tabAnimation'),
      groups: [
        {
          id: 'animation',
          label: t('tools.slide.grpAnimation'),
          items: [
            item('animate', t('tools.slide.panelAnimation'), 'film', () =>
              ctx.openRightPanel('animation'),
            ),
          ],
        },
      ],
    },
    {
      id: 'slideshow',
      label: t('tools.slide.tabSlideshow'),
      groups: [
        {
          id: 'start-show',
          label: t('tools.slide.grpSlideshow'),
          items: [
            item('present', t('tools.slide.present'), 'present', ctx.present),
            item(
              'notes',
              t('tools.slide.panelNotes'),
              'notes',
              () => ctx.openRightPanel('element'),
              {
                size: 'small',
              },
            ),
          ],
        },
      ],
    },
    {
      id: 'review',
      label: t('tools.slide.tabReview'),
      groups: [
        {
          id: 'comments',
          label: t('tools.slide.grpComments'),
          items: [
            item('comments', t('tools.slide.panelComments'), 'comment', () =>
              ctx.openRightPanel('comments'),
            ),
          ],
        },
      ],
    },
    {
      id: 'view',
      label: t('tools.slide.tabView'),
      groups: [
        {
          id: 'views',
          label: t('tools.slide.grpViews'),
          priority: 9,
          items: [
            item('grid-snap', t('tools.slide.gridSnap'), 'gridlines', ctx.toggleGridSnap, {
              active: ctx.gridSnap,
            }),
            item('rulers', t('tools.slide.showRulers'), 'rulerTicks', ctx.toggleRulers, {
              active: ctx.showRulers,
            }),
            item('master', t('tools.slide.masterView'), 'slides', ctx.toggleMasterView, {
              active: ctx.masterView,
            }),
          ],
        },
        {
          id: 'zoom',
          label: t('tools.slide.grpZoom'),
          priority: 7,
          items: [
            item('zoom-out', t('tools.slide.zoomOut'), 'zoomOut', ctx.zoomOut, { size: 'small' }),
            item('zoom-in', t('tools.slide.zoomIn'), 'zoomIn', ctx.zoomIn, { size: 'small' }),
            item('zoom-fit', t('tools.slide.zoomFit'), 'fitScreen', ctx.zoomFit, { size: 'small' }),
            select(
              'zoom-level',
              t('tools.slide.zoomOut'),
              String(ctx.scale),
              [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((value) => ({
                value: String(value),
                label: `${Math.round(value * 100)}%`,
              })),
              () => undefined,
              'xs',
              true,
            ),
          ],
        },
        {
          id: 'window',
          label: t('tools.slide.grpWindow'),
          priority: 5,
          items: [item('move-up', t('tools.slide.moveUp'), 'swap', ctx.moveSlideUp)],
        },
      ],
    },
  ];
}
