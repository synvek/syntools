/**
 * Ribbon layout for the PDF editor, built as data for the shared Office ribbon.
 *
 * M0-4 only ships the tabs that already have a model behind them: `开始` (history / selection / zoom /
 * navigation) and `视图` (view mode / panes / dark canvas). Annotation, page-editing and conversion
 * tabs arrive with their milestones — no placeholder commands.
 *
 * The builder is pure and takes a small context object, so every enabled/disabled rule and every
 * command wiring is unit-testable without mounting the ribbon.
 */

import type {
  RibbonColorItem,
  RibbonGroup,
  RibbonSelectItem,
  RibbonTab,
  RibbonToggleItem,
} from '@/core/components/ribbon/types';
import {
  INITIAL_ANNOTATION_STYLE,
  styleColorFor,
  styleWidthFor,
  type AnnotationStyle,
  type PdfTool,
} from './model/annotate';
import { ZOOM_STEPS } from './model/doc';
import type { ViewMode, ZoomMode } from './model/types';

export type { PdfTool };
export type PdfPanel = 'thumbnails' | 'outline' | 'properties' | 'annotations';

/**
 * Contextual tabs, Word style: present only while a matching object is selected.
 *
 * Only images keep a tab. Annotation, page-editing, annotation-format and text-box-format tabs held
 * two or three groups each, and a tab that appears only after a selection is invisible until the user
 * happens to click an object — the commands read as missing rather than contextual. Those commands now
 * live in `开始` and simply disable themselves while nothing suitable is selected.
 */
export const CONTEXT_TAB_IDS = ['image-format'] as const;
export type ContextTabId = (typeof CONTEXT_TAB_IDS)[number];

/**
 * Flat view of the selected object.
 *
 * The ribbon takes plain data instead of `PdfObject` so the builder stays switchable in tests and in
 * `useMemo` without dragging the whole model through React.
 */
export interface PdfRibbonSelection {
  kind: 'text' | 'image' | 'ink' | 'markup' | 'shape' | 'note' | 'stamp' | 'signature';
  opacity: number;
  locked: boolean;
  /** Text colour, annotation colour or shape stroke */
  color?: string;
  /** Shape stroke, kept apart from `color` so the ribbon can offer text and stroke colours separately */
  stroke?: string;
  /** Shape fill; absent means no fill (the shape is transparent) */
  fill?: string;
  /** Ink / shape stroke width in points */
  width?: number;
  fit?: 'contain' | 'cover' | 'fill';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

const IMAGE_KINDS: readonly string[] = ['image', 'stamp', 'signature'];

/** Which contextual tab the current selection owns */
export function resolveContextTab(selection: PdfRibbonSelection | null): ContextTabId | null {
  if (!selection) return null;
  if (IMAGE_KINDS.includes(selection.kind)) return 'image-format';
  // Everything else (text boxes, markup / ink / shape / note) stays on the current tab: its controls
  // are always present in `开始`, disabled until a matching object is selected
  return null;
}

/**
 * Word semantics: selecting an object jumps to its contextual tab; clearing the selection returns to
 * the tab the user came from, never leaving a contextual tab open with nothing to edit.
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

/** Project the model object onto the flat shape the contextual tabs consume */
export function ribbonSelectionOf(object: {
  kind: PdfRibbonSelection['kind'];
  opacity: number;
  locked?: boolean;
  color?: string;
  stroke?: string;
  fill?: string;
  width?: number;
  fit?: 'contain' | 'cover' | 'fill';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}): PdfRibbonSelection {
  return {
    kind: object.kind,
    opacity: object.opacity,
    locked: object.locked === true,
    color: object.color ?? object.stroke,
    stroke: object.stroke,
    fill: object.fill,
    width: object.width,
    fit: object.fit,
    fontSize: object.fontSize,
    bold: object.bold,
    italic: object.italic,
    align: object.align,
  };
}

export interface PdfRibbonView {
  mode: ViewMode;
  zoom: number;
  zoomMode: ZoomMode;
  /** 1-based visible page */
  page: number;
  pageCount: number;
}

export interface PdfRibbonPanels {
  thumbnails: boolean;
  outline: boolean;
  properties: boolean;
  annotations?: boolean;
}

export interface PdfRibbonActions {
  undo(): void;
  redo(): void;
  setTool(tool: PdfTool): void;
  setZoom(zoom: number): void;
  fit(mode: 'fit-width' | 'fit-page'): void;
  goToPage(page: number): void;
  prevPage(): void;
  nextPage(): void;
  setViewMode(mode: ViewMode): void;
  togglePanel(panel: PdfPanel): void;
  toggleDarkCanvas(): void;
  /** Annotation format: colour and stroke width of the tool that is currently active */
  setAnnotateColor?(color: string): void;
  setAnnotateWidth?(width: number): void;
  deleteSelection?(): void;
  clearAnnotations?(): void;
  /** Object-level edits used by the contextual tabs (M2-8) */
  setObjectColor?(color: string): void;
  /** Shape fill; `null` clears it (the shape renders without a background) */
  setObjectFill?(color: string | null): void;
  /** Default stroke colour for the next shape, when nothing is selected */
  setShapeColor?(color: string): void;
  setObjectWidth?(width: number): void;
  setObjectFit?(fit: 'contain' | 'cover' | 'fill'): void;
  setObjectOpacity?(value: number): void;
  setObjectFontSize?(size: number): void;
  toggleObjectBold?(): void;
  toggleObjectItalic?(): void;
  setObjectAlign?(align: 'left' | 'center' | 'right'): void;
  setObjectZ?(action: 'front' | 'back' | 'forward' | 'backward'): void;
  toggleObjectLock?(): void;
  /** M3: bitmap / signature / stamp insertion opens the matching picker */
  insertImage?(): void;
  /** M3-3: swap the bitmap behind the selected image/stamp/signature */
  replaceImage?(): void;
  openSignature?(): void;
  openStamp?(): void;
  /** M3-5: clipboard, alignment and the format painter */
  copySelection?(): void;
  cutSelection?(): void;
  pasteSelection?(): void;
  alignObjects?(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void;
  distributeObjects?(axis: 'horizontal' | 'vertical'): void;
  toggleFormatPainter?(): void;
  /** M4: export dialogs / direct text download */
  exportDocx?(): void;
  exportImages?(): void;
  exportText?(): void;
  /** M3-3: open the crop dialog for the selected image */
  cropImage?(): void;
}

/** What the annotate tab needs to know beyond the tool itself */
export interface PdfRibbonAnnotate {
  style: AnnotationStyle;
  selectionCount: number;
  objectCount: number;
}

/** What the `edit` tab needs beyond the document itself (M3-5) */
export interface PdfRibbonEdit {
  selectionCount: number;
  /** Objects currently in the in-memory clipboard */
  clipboard: number;
  /** Format painter armed: the next click applies the copied style */
  painter: boolean;
}

export interface PdfRibbonContext {
  /** i18next translate, bound to `tools.pdfEditor.*` */
  t: (key: string, options?: Record<string, unknown>) => string;
  hasDoc: boolean;
  view: PdfRibbonView;
  history: { canUndo: boolean; canRedo: boolean };
  panels: PdfRibbonPanels;
  /** Annotation state; omitted in older tests, which then see an empty annotate tab */
  annotate?: PdfRibbonAnnotate;
  /** Edit tab state; omitted in older tests, which then see an empty edit tab */
  edit?: PdfRibbonEdit;
  /**
   * Panel toggles only appear once the panels themselves exist (M1-4). Shipping a toggle that
   * changes nothing would be a fake control, so the view tab grows by one group instead.
   */
  panelsAvailable?: boolean;
  darkCanvas: boolean;
  tool: PdfTool;
  /** Selected object, projected for the contextual tabs */
  selection?: PdfRibbonSelection | null;
  /** Forced context tab id (controller-controlled); omit to derive it from `selection` */
  contextTab?: ContextTabId | null;
  actions: PdfRibbonActions;
}

/** `'120%'` / `'120 %'` / `'120'` → 1.2; garbage → null so the combo can ignore it */
export function parseZoomPercent(value: string): number | null {
  const parsed = Number(value.replace('%', '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed / 100;
}

export function buildPdfRibbonTabs(ctx: PdfRibbonContext): RibbonTab[] {
  const { t, actions, hasDoc, view } = ctx;
  const lock = !hasDoc;
  const hint = lock ? t('tools.pdfEditor.openFirstHint') : undefined;
  const key = (name: string) => `tools.pdfEditor.${name}`;

  const zoomPercent = Math.round(view.zoom * 100);
  const zoomOptions = ZOOM_STEPS.map((step) => {
    const percent = `${Math.round(step * 100)}%`;
    return { value: percent, label: percent };
  });
  const pageOptions = Array.from({ length: view.pageCount }, (_, index) => {
    const page = String(index + 1);
    return { value: page, label: page };
  });

  const panelsGroup: RibbonGroup = {
    id: 'panels',
    label: t(key('grpPanels')),
    priority: 5,
    items: [
      {
        kind: 'toggle',
        id: 'thumbnails',
        label: t(key('cmdThumbnails')),
        icon: 'grid',
        size: 'small',
        active: ctx.panels.thumbnails,
        disabled: lock,
        hint,
        onSelect: () => actions.togglePanel('thumbnails'),
      },
      {
        kind: 'toggle',
        id: 'outline',
        label: t(key('cmdOutline')),
        icon: 'book',
        size: 'small',
        active: ctx.panels.outline,
        disabled: lock,
        hint,
        onSelect: () => actions.togglePanel('outline'),
      },
      {
        kind: 'toggle',
        id: 'properties',
        label: t(key('cmdProperties')),
        icon: 'info',
        size: 'small',
        active: ctx.panels.properties,
        disabled: lock,
        hint,
        onSelect: () => actions.togglePanel('properties'),
      },
      {
        kind: 'toggle',
        id: 'annotations',
        label: t(key('cmdAnnotations')),
        icon: 'listCheck',
        size: 'small',
        active: ctx.panels.annotations === true,
        disabled: lock,
        hint,
        onSelect: () => actions.togglePanel('annotations'),
      },
    ],
  };

  const annotate = ctx.annotate ?? {
    style: INITIAL_ANNOTATION_STYLE,
    selectionCount: 0,
    objectCount: 0,
  };

  const toolToggle = (id: PdfTool, icon: string, labelKey: string): RibbonToggleItem => ({
    kind: 'toggle',
    id,
    label: t(key(labelKey)),
    icon,
    size: 'small',
    active: ctx.tool === id,
    disabled: lock,
    hint,
    onSelect: () => actions.setTool(id),
  });

  const annotateColor = styleColorFor(annotate.style, ctx.tool);
  const annotateWidth = styleWidthFor(annotate.style, ctx.tool);

  /** Annotation commands; merged into `开始` so the two or three commands per tab are one click away */
  const annotateGroups: RibbonGroup[] = [
    {
      id: 'markup',
      label: t(key('grpMarkup')),
      priority: 6,
      items: [
        toolToggle('highlight', 'brush', 'cmdHighlight'),
        toolToggle('underline', 'underline', 'cmdUnderline'),
        toolToggle('strikeout', 'strike', 'cmdStrikeout'),
      ],
    },
    {
      id: 'shapes',
      label: t(key('grpShapes')),
      priority: 4,
      items: [
        toolToggle('rect', 'shapeRect', 'cmdRect'),
        toolToggle('ellipse', 'shapeEllipse', 'cmdEllipse'),
        toolToggle('arrow', 'shapeArrow', 'cmdArrow'),
        toolToggle('line', 'shapeLine', 'cmdLine'),
      ],
    },
    {
      id: 'ink',
      label: t(key('grpInk')),
      priority: 4,
      items: [toolToggle('ink', 'pen', 'cmdInk'), toolToggle('eraser', 'eraser', 'cmdEraser')],
    },
    {
      id: 'insert',
      label: t(key('grpInsert')),
      priority: 7,
      items: [
        toolToggle('note', 'comment', 'cmdNote'),
        toolToggle('text', 'text', 'cmdText'),
        toolToggle('patch', 'pdfAddText', 'cmdPatch'),
        {
          kind: 'button',
          id: 'image',
          label: t(key('cmdImage')),
          icon: 'pdfInsertImage',
          size: 'small',
          disabled: lock,
          hint,
          onSelect: () => actions.insertImage?.(),
        },
        {
          kind: 'button',
          id: 'signature',
          label: t(key('cmdSignature')),
          icon: 'pdfSign',
          size: 'small',
          disabled: lock,
          hint,
          onSelect: () => actions.openSignature?.(),
        },
        {
          kind: 'button',
          id: 'stamp',
          label: t(key('cmdStamp')),
          icon: 'tag',
          size: 'small',
          disabled: lock,
          hint,
          onSelect: () => actions.openStamp?.(),
        },
      ],
    },
    {
      id: 'manage',
      label: t(key('grpManage')),
      priority: 3,
      items: [
        {
          kind: 'button',
          id: 'delete-selection',
          label: t(key('cmdDeleteSelection')),
          icon: 'trash',
          size: 'small',
          disabled: lock || annotate.selectionCount === 0,
          hint,
          onSelect: () => actions.deleteSelection?.(),
        },
        {
          kind: 'button',
          id: 'clear-annotations',
          label: t(key('cmdClearAnnotations')),
          icon: 'pdfDelete',
          size: 'small',
          disabled: lock || annotate.objectCount === 0,
          hint,
          onSelect: () => actions.clearAnnotations?.(),
        },
      ],
    },
  ];

  const edit = ctx.edit ?? { selectionCount: 0, clipboard: 0, painter: false };
  const multi = edit.selectionCount;

  /** Clipboard / alignment / format painter; merged into `开始` for the same reason */
  const editGroups: RibbonGroup[] = [
    {
      id: 'clipboard',
      label: t(key('grpClipboard')),
      priority: 5,
      items: [
        {
          kind: 'button',
          id: 'copy',
          label: t(key('cmdCopy')),
          icon: 'copy',
          size: 'small',
          disabled: lock || multi === 0,
          hint,
          onSelect: () => actions.copySelection?.(),
        },
        {
          kind: 'button',
          id: 'cut',
          label: t(key('cmdCut')),
          icon: 'scissors',
          size: 'small',
          disabled: lock || multi === 0,
          hint,
          onSelect: () => actions.cutSelection?.(),
        },
        {
          kind: 'button',
          id: 'paste',
          label: t(key('cmdPaste')),
          icon: 'paste',
          size: 'small',
          disabled: lock || edit.clipboard === 0,
          hint,
          onSelect: () => actions.pasteSelection?.(),
        },
      ],
    },
    {
      id: 'object-align',
      label: t(key('grpAlign')),
      priority: 2,
      items: (
        [
          ['left', 'cmdAlignLeft', 'alignLeftCell'],
          ['center', 'cmdAlignCenter', 'alignCenterCell'],
          ['right', 'cmdAlignRight', 'alignRightCell'],
          ['top', 'cmdAlignTop', 'alignTopCell'],
          ['middle', 'cmdAlignMiddle', 'alignMiddleCell'],
          ['bottom', 'cmdAlignBottom', 'alignBottomCell'],
        ] as const
      ).map(([mode, labelKey, icon]) => ({
        kind: 'button' as const,
        id: `align-object-${mode}`,
        label: t(key(labelKey)),
        icon,
        size: 'small' as const,
        disabled: lock || multi < 2,
        hint,
        onSelect: () => actions.alignObjects?.(mode),
      })),
    },
    {
      id: 'object-distribute',
      label: t(key('grpDistribute')),
      priority: 1,
      items: [
        {
          kind: 'button',
          id: 'distribute-h',
          label: t(key('cmdDistributeH')),
          icon: 'distribute',
          size: 'small',
          disabled: lock || multi < 3,
          hint,
          onSelect: () => actions.distributeObjects?.('horizontal'),
        },
        {
          kind: 'button',
          id: 'distribute-v',
          label: t(key('cmdDistributeV')),
          icon: 'distribute',
          size: 'small',
          disabled: lock || multi < 3,
          hint,
          onSelect: () => actions.distributeObjects?.('vertical'),
        },
      ],
    },
    {
      id: 'format-painter',
      label: t(key('grpFormatPainter')),
      priority: 2,
      items: [
        {
          kind: 'toggle',
          id: 'format-painter',
          label: edit.painter ? t(key('painterArmed')) : t(key('cmdFormatPainter')),
          icon: 'formatPainter',
          size: 'small',
          active: edit.painter,
          disabled: lock || multi === 0,
          hint,
          onSelect: () => actions.toggleFormatPainter?.(),
        },
      ],
    },
  ];

  const selection = ctx.selection ?? null;
  const contextTab = ctx.contextTab === undefined ? resolveContextTab(selection) : ctx.contextTab;
  const canEdit = !lock && selection !== null && !selection.locked;

  const opacityItem: RibbonSelectItem = {
    kind: 'select',
    id: 'opacity',
    label: t(key('cmdOpacity')),
    value: String(Math.round((selection?.opacity ?? 1) * 100)),
    options: [100, 75, 50, 25, 0].map((percent) => ({
      value: String(percent),
      label: `${percent}%`,
    })),
    width: 'xs',
    disabled: !canEdit,
    hint,
    onChange: (value: string) => actions.setObjectOpacity?.(Number(value) / 100),
  };

  const arrangeGroup: RibbonGroup = {
    id: 'arrange',
    label: t(key('grpArrange')),
    priority: 3,
    items: [
      {
        kind: 'menu',
        id: 'z-order',
        label: t(key('cmdArrange')),
        icon: 'layers',
        // Icon-only: the caption only repeated the group name and ate a full column
        size: 'small',
        disabled: !canEdit,
        hint,
        menu: [
          {
            id: 'front',
            label: t(key('cmdBringFront')),
            onSelect: () => actions.setObjectZ?.('front'),
          },
          {
            id: 'forward',
            label: t(key('cmdBringForward')),
            onSelect: () => actions.setObjectZ?.('forward'),
          },
          {
            id: 'backward',
            label: t(key('cmdSendBackward')),
            onSelect: () => actions.setObjectZ?.('backward'),
          },
          {
            id: 'back',
            label: t(key('cmdSendBack')),
            onSelect: () => actions.setObjectZ?.('back'),
          },
        ],
      },
      {
        kind: 'toggle',
        id: 'lock',
        label: selection?.locked ? t(key('cmdUnlock')) : t(key('cmdLock')),
        icon: selection?.locked ? 'unlock' : 'lock',
        size: 'small',
        active: selection?.locked ?? false,
        disabled: lock || selection === null,
        hint,
        onSelect: () => actions.toggleObjectLock?.(),
      },
      {
        kind: 'button',
        id: 'delete',
        label: t(key('cmdDeleteSelection')),
        icon: 'trash',
        size: 'small',
        disabled: lock || selection === null,
        hint,
        onSelect: () => actions.deleteSelection?.(),
      },
    ],
  };

  const contextTabs: RibbonTab[] = [];

  /**
   * One `格式` group instead of three.
   *
   * `开始` used to show three sibling groups all labelled 格式: the armed tool's palette (colour +
   * width), the selected object's colour / width / opacity, and a text box's font, alignment and
   * colour. Only the middle one followed the selection, so the first looked permanently disabled —
   * "how do I enable this?" — and the third looked like it belonged to another tab. Every control now
   * resolves its target the same way: the selected object first, the armed annotation tool second.
   */
  const selectedKind = selection?.kind ?? null;
  const textSelected = canEdit && selectedKind === 'text';
  /** Only ink and shapes own a stroke; images / stamps / signatures have opacity alone */
  const strokeSelected = canEdit && (selectedKind === 'ink' || selectedKind === 'shape');
  /** Text boxes and markup both carry a text-like colour behind the `A` button */
  const textColorSelected = canEdit && (selectedKind === 'text' || selectedKind === 'markup');
  /** Only shapes have a background fill */
  const fillSelected = canEdit && selectedKind === 'shape';

  /**
   * With an object selected the group only edits that object — an image has no stroke, so the width
   * box must go quiet rather than silently editing the tool palette behind the user's back. With no
   * selection the same controls edit the palette of the armed tool (markup colour by default).
   */
  const objectTargeted = selection !== null;
  /** Default stroke colour for the next shape; the `A` button cannot reach it when no shape is active */
  const annotateStroke = annotate ? annotate.style.shapeStroke : null;

  /**
   * Three colour buttons instead of one, because Office users read `A` as "font colour" and expect a
   * second, shape-coloured button for strokes — and a paint bucket for fills, which shapes have always
   * supported in the model (`fill` + pdf-lib `color`) but had no UI for.
   */
  const formatColor: RibbonColorItem = {
    kind: 'color',
    id: 'color',
    label: t(key('cmdColor')),
    icon: 'fontColor',
    size: 'small',
    value: objectTargeted ? (textColorSelected ? (selection?.color ?? null) : null) : annotateColor,
    disabled: objectTargeted
      ? !textColorSelected || selection?.color === undefined
      : lock || annotateColor === null,
    hint,
    onPick: (color) =>
      objectTargeted ? actions.setObjectColor?.(color) : actions.setAnnotateColor?.(color),
  };

  const formatStroke: RibbonColorItem = {
    kind: 'color',
    id: 'stroke',
    label: t(key('cmdStrokeColor')),
    icon: 'shapeRect',
    size: 'small',
    // Ink keeps its colour in `color`, shapes in `stroke`
    value: objectTargeted
      ? strokeSelected
        ? selectedKind === 'ink'
          ? (selection?.color ?? null)
          : (selection?.stroke ?? null)
        : null
      : annotateStroke,
    disabled: objectTargeted ? !strokeSelected : lock || annotateStroke === null,
    hint,
    onPick: (color) =>
      objectTargeted ? actions.setObjectColor?.(color) : actions.setShapeColor?.(color),
  };

  const formatFill: RibbonColorItem = {
    kind: 'color',
    id: 'fill',
    label: t(key('cmdFillColor')),
    icon: 'paintBucket',
    size: 'small',
    value: fillSelected ? (selection?.fill ?? null) : null,
    disabled: !fillSelected,
    hint,
    onPick: (color) => actions.setObjectFill?.(color),
    // Transparent fill: the shape renders with no background, which is the PDF default
    onReset: () => actions.setObjectFill?.(null),
    resetLabel: t(key('cmdNoFill')),
  };

  const formatWidth: RibbonSelectItem = {
    kind: 'select',
    id: 'width',
    label: t(key('cmdWidth')),
    value: String(
      objectTargeted ? (strokeSelected ? (selection?.width ?? 2) : 2) : (annotateWidth ?? 2),
    ),
    options: [1, 2, 3, 4, 6].map((width) => ({ value: String(width), label: `${width} pt` })),
    width: 'xs',
    disabled: objectTargeted
      ? !strokeSelected || selection?.width === undefined
      : lock || annotateWidth === null,
    hint,
    onChange: (next: string) => {
      const width = Number(next);
      if (!Number.isFinite(width)) return;
      if (objectTargeted) actions.setObjectWidth?.(width);
      else actions.setAnnotateWidth?.(width);
    },
  };

  const fontSizeItem: RibbonSelectItem = {
    kind: 'select',
    id: 'font-size',
    label: t(key('cmdFontSize')),
    value: String(Math.round(selection?.fontSize ?? 11)),
    options: [8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 48, 72].map((size) => ({
      value: String(size),
      label: String(size),
    })),
    width: 'xxs',
    disabled: !textSelected,
    hint,
    onChange: (value: string) => actions.setObjectFontSize?.(Number(value)),
  };

  const boldItem: RibbonToggleItem = {
    kind: 'toggle',
    id: 'bold',
    label: t(key('cmdBold')),
    icon: 'richText',
    size: 'small',
    active: selection?.bold === true,
    disabled: !textSelected,
    hint,
    onSelect: () => actions.toggleObjectBold?.(),
  };

  const italicItem: RibbonToggleItem = {
    kind: 'toggle',
    id: 'italic',
    label: t(key('cmdItalic')),
    icon: 'text',
    size: 'small',
    active: selection?.italic === true,
    disabled: !textSelected,
    hint,
    onSelect: () => actions.toggleObjectItalic?.(),
  };

  const alignItems: RibbonToggleItem[] = (
    [
      ['left', 'cmdAlignLeft', 'panelLeftOpen'],
      ['center', 'cmdAlignCenter', 'actualSize'],
      ['right', 'cmdAlignRight', 'panelLeftClose'],
    ] as const
  ).map(([align, labelKey, icon]) => ({
    kind: 'toggle' as const,
    id: `align-${align}`,
    label: t(key(labelKey)),
    icon,
    size: 'small' as const,
    active: selection?.align === align,
    disabled: !textSelected,
    hint,
    onSelect: () => actions.setObjectAlign?.(align),
  }));

  /**
   * Word-style two rows: the colour buttons and wide combos share the first row (a narrow box under a
   * wide one would leave a hole), the icon buttons fill the second.
   */
  const formatGroup: RibbonGroup = {
    id: 'format',
    label: t(key('grpFormat')),
    priority: 7,
    items: [],
    rows: [
      [formatColor, formatStroke, formatFill, formatWidth, opacityItem],
      [fontSizeItem, boldItem, italicItem, ...alignItems],
    ],
  };

  if (contextTab === 'image-format' && selection) {
    contextTabs.push({
      id: 'image-format',
      label: t(key('tabImageFormat')),
      groups: [
        {
          id: 'image-fit',
          label: t(key('grpImageFit')),
          priority: 6,
          items: [
            {
              kind: 'select',
              id: 'fit',
              label: t(key('cmdImageFit')),
              value: selection.fit ?? 'contain',
              options: [
                { value: 'contain', label: t(key('fitContain')) },
                { value: 'cover', label: t(key('fitCover')) },
                { value: 'fill', label: t(key('fitFill')) },
              ],
              width: 'sm',
              disabled: !canEdit,
              hint,
              onChange: (value: string) =>
                actions.setObjectFit?.(value as 'contain' | 'cover' | 'fill'),
            },
            // Opacity / arrange are shared object commands and live in `开始`
            {
              kind: 'button',
              id: 'replace-image',
              label: t(key('cmdReplaceImage')),
              icon: 'swap',
              size: 'small',
              disabled: !canEdit,
              hint,
              onSelect: () => actions.replaceImage?.(),
            },
            {
              kind: 'button',
              id: 'crop-image',
              label: t(key('cmdCropImage')),
              icon: 'image',
              size: 'small',
              // Stamps and signatures are fixed bitmaps; only `image` objects own a crop window
              disabled: !canEdit || selection.kind !== 'image',
              hint,
              onSelect: () => actions.cropImage?.(),
            },
          ],
        },
      ],
    });
  }

  return [
    {
      id: 'home',
      label: t(key('tabHome')),
      groups: [
        {
          id: 'select',
          label: t(key('grpSelect')),
          // The merged tab holds 16 groups: select / zoom / navigation must survive the longest,
          // otherwise a narrow window hides the tool picker behind the overflow menu
          priority: 10,
          items: [
            {
              kind: 'toggle',
              id: 'select',
              label: t(key('cmdSelect')),
              icon: 'cursor',
              size: 'small',
              active: ctx.tool === 'select',
              disabled: lock,
              hint,
              onSelect: () => actions.setTool('select'),
            },
            {
              kind: 'toggle',
              id: 'hand',
              label: t(key('cmdHand')),
              icon: 'hand',
              size: 'small',
              active: ctx.tool === 'hand',
              disabled: lock,
              hint,
              onSelect: () => actions.setTool('hand'),
            },
          ],
        },
        {
          id: 'zoom',
          label: t(key('grpZoom')),
          priority: 9,
          items: [],
          // Row layout so the two fit buttons sit side by side under the zoom box: in the default
          // column packing they stacked vertically and left the group looking lopsided
          rows: [
            [
              {
                kind: 'select',
                id: 'zoom',
                label: t(key('cmdZoom')),
                value: `${zoomPercent}%`,
                options: zoomOptions,
                // Typing a zoom is expected in Office; presets stay in the dropdown
                editable: true,
                width: 'xs',
                disabled: lock,
                hint,
                onChange: (value: string) => {
                  const zoom = parseZoomPercent(value);
                  if (zoom !== null) actions.setZoom(zoom);
                },
              },
            ],
            // fitScreen ≈ fit page, actualSize stands in for fit width in the shared glyph set
            [
              {
                kind: 'button',
                id: 'fit-width',
                label: t(key('cmdFitWidth')),
                icon: 'actualSize',
                size: 'small',
                disabled: lock,
                hint,
                onSelect: () => actions.fit('fit-width'),
              },
              {
                kind: 'button',
                id: 'fit-page',
                label: t(key('cmdFitPage')),
                icon: 'fitScreen',
                size: 'small',
                disabled: lock,
                hint,
                onSelect: () => actions.fit('fit-page'),
              },
            ],
          ],
        },
        // Page navigation moved to `视图`: flipping pages is browsing, not editing. It sits next to
        // the view mode there instead of splitting the editing commands below.
        //
        // The 注释, 编辑, 注释格式 and 文本框格式 tabs each held two or three groups, so every second
        // command cost a tab switch. They now sit together in `开始`, right after selection / zoom.
        ...annotateGroups,
        formatGroup,
        arrangeGroup,
        ...editGroups,
        {
          id: 'export',
          label: t(key('grpExport')),
          priority: 8,
          items: [
            {
              kind: 'button',
              id: 'docx',
              label: t(key('cmdExportDocx')),
              icon: 'download',
              size: 'small',
              disabled: lock,
              hint,
              onSelect: () => actions.exportDocx?.(),
            },
            {
              kind: 'button',
              id: 'images',
              label: t(key('cmdExportImages')),
              icon: 'image',
              size: 'small',
              disabled: lock,
              hint,
              onSelect: () => actions.exportImages?.(),
            },
            {
              kind: 'button',
              id: 'plaintext',
              label: t(key('cmdExportText')),
              icon: 'text',
              size: 'small',
              disabled: lock,
              hint,
              onSelect: () => actions.exportText?.(),
            },
          ],
        },
      ],
    },
    {
      id: 'view',
      label: t(key('tabView')),
      groups: [
        {
          id: 'view-mode',
          label: t(key('grpViewMode')),
          priority: 6,
          items: [
            {
              kind: 'select',
              id: 'mode',
              label: t(key('grpViewMode')),
              value: view.mode,
              options: [
                { value: 'single', label: t(key('viewSingle')) },
                { value: 'continuous', label: t(key('viewContinuous')) },
              ],
              width: 'sm',
              disabled: lock,
              hint,
              onChange: (value: string) => actions.setViewMode(value as ViewMode),
            },
          ],
        },
        // Page navigation: browsing commands sit with the view mode, not with the editing tools
        {
          id: 'navigate',
          label: t(key('grpNavigate')),
          priority: 9,
          items: [
            {
              kind: 'button',
              id: 'prev',
              label: t(key('cmdPrevPage')),
              icon: 'chevronLeft',
              size: 'small',
              disabled: lock || view.page <= 1,
              hint,
              onSelect: actions.prevPage,
            },
            {
              kind: 'button',
              id: 'next',
              label: t(key('cmdNextPage')),
              icon: 'chevronRight',
              size: 'small',
              disabled: lock || view.page >= view.pageCount,
              hint,
              onSelect: actions.nextPage,
            },
            {
              kind: 'select',
              id: 'page',
              label: t(key('cmdPageJump')),
              value: String(view.page),
              options: pageOptions,
              editable: true,
              width: 'xxs',
              disabled: lock,
              hint,
              onChange: (value: string) => actions.goToPage(Number(value)),
            },
          ],
        },
        ...(ctx.panelsAvailable ? [panelsGroup] : []),
        {
          id: 'display',
          label: t(key('grpDisplay')),
          priority: 4,
          items: [
            {
              kind: 'toggle',
              id: 'dark-canvas',
              label: t(key('cmdDarkCanvas')),
              icon: 'moon',
              size: 'small',
              active: ctx.darkCanvas,
              disabled: lock,
              hint,
              onSelect: actions.toggleDarkCanvas,
            },
          ],
        },
      ],
    },
    // Contextual tabs always sit at the end, like Word's; the ribbon shows them when selected
    ...contextTabs,
  ];
}
