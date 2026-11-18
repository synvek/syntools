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

/** Contextual tabs, Word style: present only while a matching object is selected */
export const CONTEXT_TAB_IDS = ['annotate-format', 'text-format', 'image-format'] as const;
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
  /** Ink / shape stroke width in points */
  width?: number;
  fit?: 'contain' | 'cover' | 'fill';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

const IMAGE_KINDS: readonly string[] = ['image', 'stamp', 'signature'];
const ANNOTATE_KINDS: readonly string[] = ['markup', 'ink', 'shape', 'note'];

/** Which contextual tab the current selection owns */
export function resolveContextTab(selection: PdfRibbonSelection | null): ContextTabId | null {
  if (!selection) return null;
  if (selection.kind === 'text') return 'text-format';
  if (IMAGE_KINDS.includes(selection.kind)) return 'image-format';
  if (ANNOTATE_KINDS.includes(selection.kind)) return 'annotate-format';
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
  setObjectWidth?(width: number): void;
  setObjectFit?(fit: 'contain' | 'cover' | 'fill'): void;
  setObjectOpacity?(value: number): void;
  setObjectFontSize?(size: number): void;
  toggleObjectBold?(): void;
  toggleObjectItalic?(): void;
  setObjectAlign?(align: 'left' | 'center' | 'right'): void;
  setObjectZ?(action: 'front' | 'back' | 'forward' | 'backward'): void;
  toggleObjectLock?(): void;
}

/** What the annotate tab needs to know beyond the tool itself */
export interface PdfRibbonAnnotate {
  style: AnnotationStyle;
  selectionCount: number;
  objectCount: number;
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

  const annotateTab: RibbonTab = {
    id: 'annotate',
    label: t(key('tabAnnotate')),
    groups: [
      {
        id: 'markup',
        label: t(key('grpMarkup')),
        priority: 7,
        items: [
          toolToggle('highlight', 'brush', 'cmdHighlight'),
          toolToggle('underline', 'underline', 'cmdUnderline'),
          toolToggle('strikeout', 'strike', 'cmdStrikeout'),
        ],
      },
      {
        id: 'shapes',
        label: t(key('grpShapes')),
        priority: 6,
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
        priority: 5,
        items: [toolToggle('ink', 'pen', 'cmdInk'), toolToggle('eraser', 'eraser', 'cmdEraser')],
      },
      {
        id: 'insert',
        label: t(key('grpInsert')),
        priority: 4,
        items: [toolToggle('note', 'comment', 'cmdNote'), toolToggle('text', 'text', 'cmdText')],
      },
      {
        id: 'format',
        label: t(key('grpFormat')),
        priority: 8,
        items: [
          {
            kind: 'color',
            id: 'annotate-color',
            label: t(key('cmdColor')),
            value: annotateColor,
            disabled: lock || annotateColor === null,
            hint: annotateColor === null ? t(key('hintPickTool')) : hint,
            onPick: (color) => actions.setAnnotateColor?.(color),
          },
          {
            kind: 'select',
            id: 'annotate-width',
            label: t(key('cmdWidth')),
            value: String(annotateWidth ?? 2),
            options: [1, 2, 3, 4, 6].map((width) => ({
              value: String(width),
              label: `${width} pt`,
            })),
            width: 'xs',
            disabled: lock || annotateWidth === null,
            hint: annotateWidth === null ? t(key('hintPickTool')) : hint,
            onChange: (value: string) => {
              const width = Number(value);
              if (Number.isFinite(width)) actions.setAnnotateWidth?.(width);
            },
          },
        ],
      },
      {
        id: 'manage',
        label: t(key('grpManage')),
        priority: 2,
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
    ],
  };

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
    priority: 5,
    items: [
      {
        kind: 'menu',
        id: 'z-order',
        label: t(key('cmdArrange')),
        icon: 'layers',
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

  const widthSelect = (id: string, value: number | undefined): RibbonSelectItem => ({
    kind: 'select',
    id,
    label: t(key('cmdWidth')),
    value: String(value ?? 2),
    options: [1, 2, 3, 4, 6].map((width) => ({ value: String(width), label: `${width} pt` })),
    width: 'xs',
    disabled: !canEdit || value === undefined,
    hint,
    onChange: (next: string) => actions.setObjectWidth?.(Number(next)),
  });

  const contextTabs: RibbonTab[] = [];

  if (contextTab === 'annotate-format' && selection) {
    contextTabs.push({
      id: 'annotate-format',
      label: t(key('tabAnnotateFormat')),
      groups: [
        {
          id: 'ann-format',
          label: t(key('grpFormat')),
          priority: 6,
          items: [
            {
              kind: 'color',
              id: 'ann-color',
              label: t(key('cmdColor')),
              value: selection.color ?? null,
              disabled: !canEdit || selection.color === undefined,
              hint,
              onPick: (color) => actions.setObjectColor?.(color),
            },
            widthSelect('ann-width', selection.width),
            opacityItem,
          ],
        },
        arrangeGroup,
      ],
    });
  }

  if (contextTab === 'text-format' && selection) {
    contextTabs.push({
      id: 'text-format',
      label: t(key('tabTextFormat')),
      groups: [
        {
          id: 'text-style',
          label: t(key('grpTextStyle')),
          priority: 6,
          items: [
            {
              kind: 'select',
              id: 'font-size',
              label: t(key('cmdFontSize')),
              value: String(Math.round(selection.fontSize ?? 11)),
              options: [8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 48, 72].map((size) => ({
                value: String(size),
                label: String(size),
              })),
              width: 'xxs',
              disabled: !canEdit,
              hint,
              onChange: (value: string) => actions.setObjectFontSize?.(Number(value)),
            },
            {
              kind: 'toggle',
              id: 'bold',
              label: t(key('cmdBold')),
              icon: 'richText',
              size: 'small',
              active: selection.bold === true,
              disabled: !canEdit,
              hint,
              onSelect: () => actions.toggleObjectBold?.(),
            },
            {
              kind: 'toggle',
              id: 'italic',
              label: t(key('cmdItalic')),
              icon: 'text',
              size: 'small',
              active: selection.italic === true,
              disabled: !canEdit,
              hint,
              onSelect: () => actions.toggleObjectItalic?.(),
            },
          ],
        },
        {
          id: 'text-align',
          label: t(key('grpAlign')),
          priority: 4,
          items: (
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
            active: selection.align === align,
            disabled: !canEdit,
            hint,
            onSelect: () => actions.setObjectAlign?.(align),
          })),
        },
        {
          id: 'text-color',
          label: t(key('grpFormat')),
          priority: 5,
          items: [
            {
              kind: 'color',
              id: 'text-color',
              label: t(key('cmdColor')),
              value: selection.color ?? null,
              disabled: !canEdit,
              hint,
              onPick: (color) => actions.setObjectColor?.(color),
            },
            opacityItem,
          ],
        },
        arrangeGroup,
      ],
    });
  }

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
            opacityItem,
          ],
        },
        arrangeGroup,
      ],
    });
  }

  return [
    {
      id: 'home',
      label: t(key('tabHome')),
      groups: [
        {
          id: 'history',
          label: t(key('grpHistory')),
          priority: 9,
          items: [
            {
              kind: 'button',
              id: 'undo',
              label: t(key('cmdUndo')),
              icon: 'undo',
              size: 'small',
              disabled: lock || !ctx.history.canUndo,
              hint,
              onSelect: actions.undo,
            },
            {
              kind: 'button',
              id: 'redo',
              label: t(key('cmdRedo')),
              icon: 'redo',
              size: 'small',
              disabled: lock || !ctx.history.canRedo,
              hint,
              onSelect: actions.redo,
            },
          ],
        },
        {
          id: 'select',
          label: t(key('grpSelect')),
          priority: 3,
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
          priority: 7,
          items: [
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
            // fitScreen ≈ fit page, actualSize stands in for fit width in the shared glyph set
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
        },
        {
          id: 'navigate',
          label: t(key('grpNavigate')),
          priority: 8,
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
      ],
    },
    annotateTab,
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
