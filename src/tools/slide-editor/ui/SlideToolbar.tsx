import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ribbon } from '@/core/components/ribbon/Ribbon';
import type { EditorMenu } from '@/core/components/editorChrome';
import { RIBBON_ICON_BUTTON } from '@/core/components/ribbon/ribbonTheme';
import { RibbonIcon } from '@/core/components/ribbon/ribbonIcons';
import {
  createImageElement,
  createLineElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import { createMediaFromFile } from '../model/media';
import { hasCustomGeometry } from '../../../core/drawing/custGeom';
import {
  alignOf,
  alignPatch,
  cornerRadiusOf,
  cornerRadiusPatch,
  fillColorOf,
  fillPatch,
  fontSizeOf,
  fontSizeStepPatch,
  FONT_SIZE_STEP,
  lineSpacingOf,
  listKindOf,
  listPatch,
  opacityOf,
  opacityPatch,
  paragraphPatch,
  runStyleOf,
  runStylePatch,
  shadowOf,
  shadowPatch,
  strokeColorOf,
  strokeColorPatch,
  strokeWidthOf,
  strokeWidthPatch,
  supportsCorner,
  supportsFill,
  supportsShadow,
  supportsStroke,
  supportsText,
} from '../model/format';
import type { RunStyle, ShapeGeometry, SlideElement } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { InsertPanel } from './InsertPanel';
import { buildSlideRibbonTabs, type SlideRightTab, type SlideRibbonContext } from './ribbonTabs';

/**
 * Slide editor ribbon — eight Office tabs (开始 / 插入 / 绘图 / 设计 / 动画 / 放映 / 审阅 / 视图).
 *
 * This component keeps the store wiring and hands every command to `ribbonTabs.ts` as a closure; the
 * tab data itself has no zustand dependency. The formatting commands act on the *last clicked* element
 * (like PowerPoint) and stay disabled, not hidden, when nothing is selected, so the ribbon height never
 * jumps while selecting.
 */
export function SlideToolbar({
  onFailure,
  onOpenRightPanel,
  onPresent,
  menus,
  menuAriaLabel,
  headerRight,
}: {
  onFailure: (errorCode: string) => void;
  /** Reveals one of the right-hand panels (theme / template / comments / animation / notes) */
  onOpenRightPanel: (tab: SlideRightTab) => void;
  onPresent: () => void;
  /** 文件 / 编辑 / 插入 / 视图 menus as icon dropdowns on the tab strip */
  menus?: EditorMenu[];
  menuAriaLabel?: string;
  /** Save state, clear, title, new doc, present — right end of the tab strip */
  headerRight?: ReactNode;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const scale = useSlideStore((s) => s.viewport.scale);
  const gridSnap = useSlideStore((s) => s.gridSnap);
  const showRulers = useSlideStore((s) => s.showRulers);
  const penMode = useSlideStore((s) => s.penMode);
  const pathEditId = useSlideStore((s) => s.pathEditId);
  const canUndo = useSlideStore((s) => s.past.length > 0);
  const canRedo = useSlideStore((s) => s.future.length > 0);
  const formatPainter = useSlideStore((s) => s.formatPainter);
  const patchSelectedWith = useSlideStore((s) => s.patchSelectedWith);
  // Insert flyout lives in the store so the menu bar can open it too
  const panel = useSlideStore((s) => s.insertPanel);
  const setInsertPanel = useSlideStore((s) => s.setInsertPanel);
  const setScale = useSlideStore((s) => s.setScale);
  const setViewport = useSlideStore((s) => s.setViewport);
  const setViewMode = useSlideStore((s) => s.setViewMode);
  const setPathEdit = useSlideStore((s) => s.setPathEdit);
  const setPenMode = useSlideStore((s) => s.setPenMode);
  const addElement = useSlideStore((s) => s.addElement);
  const setDrawShapeGeom = useSlideStore((s) => s.setDrawShapeGeom);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const moveSlide = useSlideStore((s) => s.moveSlide);
  const toggleGridSnap = useSlideStore((s) => s.toggleGridSnap);
  const toggleRulers = useSlideStore((s) => s.toggleRulers);
  const bringToFront = useSlideStore((s) => s.bringToFront);
  const sendToBack = useSlideStore((s) => s.sendToBack);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);
  const alignSelected = useSlideStore((s) => s.alignSelected);
  const distributeSelected = useSlideStore((s) => s.distributeSelected);
  const groupSelected = useSlideStore((s) => s.groupSelected);
  const ungroupSelected = useSlideStore((s) => s.ungroupSelected);
  const toggleLockSelected = useSlideStore((s) => s.toggleLockSelected);
  const toggleVisibleSelected = useSlideStore((s) => s.toggleVisibleSelected);
  const patchSelected = useSlideStore((s) => s.patchSelected);
  const copyFormat = useSlideStore((s) => s.copyFormat);
  const applyFormat = useSlideStore((s) => s.applyFormat);
  const clearFormatPainter = useSlideStore((s) => s.clearFormatPainter);

  const elements = containerElements({ doc, viewMode, slideIndex, masterKind, masterIndex });
  // The active element is the last one clicked, consistent with the right panel
  const active: SlideElement | undefined = elements.find(
    (element) => element.id === selection[selection.length - 1],
  );

  const apply = (updater: (element: SlideElement) => Partial<SlideElement> | null) =>
    patchSelectedWith(updater);

  const run = active ? runStyleOf(active) : undefined;
  const hasSelection = selection.length > 0;
  const selectedShapeCount = elements.filter(
    (element) => selection.includes(element.id) && element.type === 'shape',
  ).length;

  /** Active state of the lock/hide commands: "on" only when every selected element is in that state */
  const allLocked = (() => {
    const picked = elements.filter((el) => selection.includes(el.id));
    return picked.length > 0 && picked.every((el) => el.locked);
  })();
  const anyHidden = (() => {
    const picked = elements.filter((el) => selection.includes(el.id));
    return picked.length > 0 && picked.every((el) => el.visible === false);
  })();

  /** Flip is a "negate" operation, so it must read the current value: patchSelected works for multi-select too */
  const toggleFlip = (axis: 'flipX' | 'flipY') => {
    const target = active ?? elements.find((el) => selection.includes(el.id));
    if (!target) return;
    patchSelected({ [axis]: !target[axis] } as never);
  };

  const insertText = () => addElement(createTextElement(doc, t('tools.slide.insertText')));
  const insertShape = (geom: ShapeGeometry) => setDrawShapeGeom(geom);
  const insertLine = () => addElement(createLineElement(doc));
  const insertTable = () => addElement(createTableElement(doc));

  const handleImage = async (file: File) => {
    const result = await createMediaFromFile(file);
    if (!result.ok) {
      onFailure(result.error);
      return;
    }
    const asset = result.value;
    useSlideStore.setState((state) => ({
      doc: {
        ...state.doc,
        media: { ...state.doc.media, [asset.id]: asset },
        version: state.doc.version + 1,
      },
    }));
    addElement(createImageElement(doc, asset));
  };

  const ctx: SlideRibbonContext = {
    t,
    hasSelection,
    selectionCount: selection.length,
    canCombine: selectedShapeCount >= 2,
    canDistribute: selection.length >= 3,
    canUndo,
    canRedo,
    canText: active ? supportsText(active) : false,
    canFill: active ? supportsFill(active) : false,
    canStroke: active ? supportsStroke(active) : false,
    canCorner: active ? supportsCorner(active) : false,
    canShadow: active ? supportsShadow(active) : false,
    run,
    align: active ? alignOf(active) : 'left',
    listKind: active ? listKindOf(active) : 'none',
    fontFamily: run?.font ?? 'Arial',
    fontSize: active ? fontSizeOf(active) : 18,
    fillColor: active ? (fillColorOf(active) ?? '') : '',
    strokeColor: active ? (strokeColorOf(active) ?? '') : '',
    strokeWidth: active ? strokeWidthOf(active) : 0,
    opacity: active ? opacityOf(active) : 1,
    cornerRadius: active ? cornerRadiusOf(active) : 0,
    shadow: Boolean(active && shadowOf(active)),
    lineSpacing: active ? lineSpacingOf(active) : 1.2,
    scale,
    gridSnap,
    showRulers,
    penMode,
    pathEdit: Boolean(pathEditId),
    canEditPoints: active?.type === 'shape' && hasCustomGeometry(active.geom),
    allLocked,
    anyHidden,
    painterActive: formatPainter !== null,
    masterView: viewMode === 'master',
    undo,
    redo,
    stepFontSize: (delta) => apply((element) => fontSizeStepPatch(element, delta * FONT_SIZE_STEP)),
    applyRunStyle: (patch: Partial<RunStyle>) => apply((element) => runStylePatch(element, patch)),
    applyAlign: (align) => apply((element) => alignPatch(element, align)),
    applyList: (kind) => apply((element) => listPatch(element, kind)),
    applyLineSpacing: (value) =>
      apply((element) => paragraphPatch(element, { lineSpacing: value })),
    applyFill: (color) =>
      apply((element) => fillPatch(element, color ? { type: 'solid', color } : 'none')),
    applyStroke: (color) =>
      apply((element) => (color ? strokeColorPatch(element, color) : strokeWidthPatch(element, 0))),
    applyStrokeWidth: (width) => apply((element) => strokeWidthPatch(element, width)),
    applyOpacity: (percent) => apply(() => opacityPatch(percent / 100)),
    applyCornerRadius: (radius) => apply((element) => cornerRadiusPatch(element, radius)),
    applyShadow: (on) => apply((element) => shadowPatch(element, on)),
    insertText,
    insertLine,
    insertTable,
    insertShape,
    pickImage: () => fileInputRef.current?.click(),
    openInsertPanel: setInsertPanel,
    openRightPanel: onOpenRightPanel,
    present: onPresent,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    alignSelected,
    distributeSelected,
    groupSelected,
    ungroupSelected,
    toggleFlip,
    combine: (op) => {
      void useSlideStore
        .getState()
        .combineSelection(op)
        .then((result) => {
          // Empty result / unsupported outline: nothing changed, so there is nothing to undo either
          if (result !== 'ok') console.warn('[slide] boolean combine skipped:', result);
        });
    },
    toggleLockSelected,
    toggleVisibleSelected,
    copyFormat,
    applyFormat,
    clearFormatPainter,
    zoomIn: () => setScale(Math.min(3, Math.round((scale + 0.1) * 100) / 100)),
    zoomOut: () => setScale(Math.max(0.1, Math.round((scale - 0.1) * 100) / 100)),
    // Fit to window also resets panning, otherwise it looks like the click did nothing
    zoomFit: () => setViewport({ scale: 0, panX: 0, panY: 0 }),
    toggleGridSnap,
    toggleRulers,
    togglePen: () => setPenMode(!penMode),
    togglePathEdit: () => setPathEdit(pathEditId ? null : (active?.id ?? null)),
    toggleMasterView: () => setViewMode(viewMode === 'master' ? 'normal' : 'master'),
    moveSlideUp: () => moveSlide(slideIndex, Math.max(0, slideIndex - 1)),
  };

  const tabs = buildSlideRibbonTabs(ctx);

  const quickAccess = (
    <>
      <button
        type="button"
        aria-label={t('tools.slide.undo')}
        title={t('tools.slide.undo')}
        data-testid="ribbon-qat-undo"
        disabled={!canUndo}
        onClick={undo}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="undo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.slide.redo')}
        title={t('tools.slide.redo')}
        data-testid="ribbon-qat-redo"
        disabled={!canRedo}
        onClick={redo}
        className={`${RIBBON_ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="redo" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={t('tools.slide.copyFormat')}
        title={t('tools.slide.copyFormat')}
        aria-pressed={formatPainter !== null}
        data-testid="ribbon-qat-painter"
        disabled={!hasSelection}
        onClick={copyFormat}
        className={`${RIBBON_ICON_BUTTON} ${formatPainter !== null ? 'bg-black/10 dark:bg-white/20' : ''} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <RibbonIcon name="formatPainter" className="h-3.5 w-3.5" />
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <Ribbon
        ariaLabel={t('tools.slide.ribbonLabel')}
        accent="orange"
        tabs={tabs}
        menus={menus}
        menuAriaLabel={menuAriaLabel}
        quickAccess={quickAccess}
        headerRight={headerRight}
        collapseLabel={t('tools.slide.ribbonCollapse')}
        expandLabel={t('tools.slide.ribbonExpand')}
        moreLabel={t('common.more')}
        testId="slide-ribbon"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImage(file);
        }}
      />

      {panel ? <InsertPanel initialTab={panel} onClose={() => setInsertPanel(null)} /> : null}
    </div>
  );
}
