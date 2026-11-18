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

import type { RibbonGroup, RibbonTab } from '@/core/components/ribbon/types';
import { ZOOM_STEPS } from './model/doc';
import type { ViewMode, ZoomMode } from './model/types';

export type PdfTool = 'select' | 'hand';
export type PdfPanel = 'thumbnails' | 'outline' | 'properties';

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
}

export interface PdfRibbonContext {
  /** i18next translate, bound to `tools.pdfEditor.*` */
  t: (key: string, options?: Record<string, unknown>) => string;
  hasDoc: boolean;
  view: PdfRibbonView;
  history: { canUndo: boolean; canRedo: boolean };
  panels: PdfRibbonPanels;
  /**
   * Panel toggles only appear once the panels themselves exist (M1-4). Shipping a toggle that
   * changes nothing would be a fake control, so the view tab grows by one group instead.
   */
  panelsAvailable?: boolean;
  darkCanvas: boolean;
  tool: PdfTool;
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
    ],
  };

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
  ];
}
