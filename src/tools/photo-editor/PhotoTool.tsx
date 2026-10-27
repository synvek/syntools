import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import {
  blobToImageFile,
  canvasToPngBlob,
  clipboardCanvas,
  readClipboardImage,
  writeClipboardImage,
} from './clipboard';
import {
  MAX_CANVAS_SIZE,
  VIEW_ROTATION_STEP,
  buildExportFilename,
  checkImageFile,
  checkProjectFile,
  checkPsdFile,
} from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { loadPsdFile } from './psd/reader';
import { attachKeyboard } from './interaction/keyboard';
import type { PickedColor } from './interaction/pointer';
import { loadImageFile } from './model/assets';
import { loadSvgFile } from './render/svg';
import { resolveImageKind } from './core';
import { createDoc, createRasterLayer } from './model/factory';
import { PANEL_GROUPS, loadPanelLayout, savePanelLayout } from './panels';
import type { PanelId } from './panels';
import { buildProjectJson, projectFilename, readProjectFile } from './project';
import { downloadCanvas, downloadExport, exportDoc, exportExtension } from './render/export';
import { registerPhotoStrings } from './strings';
import { usePhotoStore } from './store';
import { AdjustPanel } from './ui/AdjustPanel';
import { CanvasContextMenu } from './ui/CanvasContextMenu';
import { ChannelsPanel } from './ui/ChannelsPanel';
import { ColorPanel } from './ui/ColorPanel';
import { TextPanel } from './ui/TextPanel';
import { docDisplayName } from './ui/layerName';
import { CanvasSizeDialog, ExportDialog, NewCanvasDialog, type ExportSubmit } from './ui/Dialogs';
import { DropZone } from './ui/DropZone';
import { ShortcutHelp } from './ui/ShortcutHelp';
import { FilterPanel } from './ui/FilterPanel';
import { HistoryPanel } from './ui/HistoryPanel';
import { LayerPanel } from './ui/LayerPanel';
import { LayerStylePanel } from './ui/LayerStylePanel';
import { MenuBar } from './ui/MenuBar';
import { menuItem } from './ui/menuModel';
import type { MenuBarMenu } from './ui/menuModel';
import { PanelDock } from './ui/PanelDock';
import { PhotoCanvas } from './ui/PhotoCanvas';
import { PhotoToolbar } from './ui/PhotoToolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { StatusBar } from './ui/StatusBar';
import { ToolPalette } from './ui/ToolPalette';
import { NARROW_QUERY, useMediaQuery } from './ui/useMediaQuery';
import type { CanvasBackground, PhotoDoc } from './model/types';
import './photo.css';

// Tool labels register with this lazily loaded chunk, keeping them out of the first-paint bundle
registerPhotoStrings(i18n);

type Failure = { error: string; params?: Record<string, string | number> };
type DialogKind = 'new' | 'canvas' | 'export' | 'shortcuts' | null;

const DRAFT_DEBOUNCE_MS = 1200;

/**
 * Minimum workspace height.
 *
 * 460 = the natural height of 11 tool rows (about 454px: 32px buttons plus dividers) plus a little slack:
 * below it the left rail scrolls internally, and since it beats the old 520px the canvas ends up taller.
 */
const MIN_WORK_HEIGHT = 460;

/**
 * Photo editor: a Konva canvas plus browser-local, multi-layer image editing.
 * All Konva / DOM side effects live inside the lazy module (PhotoCanvas), so prerender's SSR never runs them.
 *
 * Workspace layout (top to bottom): menu bar (canvas name / new / present / status / clear) → tool options bar
 * → left toolbox / canvas / right panel dock → status bar (canvas info and memory usage).
 */
export default function PhotoTool() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const panels = usePhotoStore((s) => s.panels);
  const overlay = usePhotoStore((s) => s.overlay);
  const snapEnabled = usePhotoStore((s) => s.snapEnabled);
  const setSnapEnabled = usePhotoStore((s) => s.setSnapEnabled);
  const rotateView = usePhotoStore((s) => s.rotateView);
  const resetViewRotation = usePhotoStore((s) => s.resetViewRotation);
  const patchOverlay = usePhotoStore((s) => s.patchOverlay);
  const setDocName = usePhotoStore((s) => s.setDocName);
  const loadDoc = usePhotoStore((s) => s.loadDoc);
  const setScale = usePhotoStore((s) => s.setScale);
  const setViewport = usePhotoStore((s) => s.setViewport);
  const setPanels = usePhotoStore((s) => s.setPanels);
  const showPanel = usePhotoStore((s) => s.showPanel);
  const resetPanels = usePhotoStore((s) => s.resetPanels);
  const undo = usePhotoStore((s) => s.undo);
  const redo = usePhotoStore((s) => s.redo);
  const canUndo = usePhotoStore((s) => s.past.length > 0);
  const canRedo = usePhotoStore((s) => s.future.length > 0);

  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [restored, setRestored] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  /** PSD export in progress (only this branch loads ag-psd asynchronously) */
  const [psdBusy, setPsdBusy] = useState(false);
  const [presentSrc, setPresentSrc] = useState<string | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** Narrow screens stack vertically: a fixed workspace height would squeeze the canvas away, so content decides */
  const isNarrow = useMediaQuery(NARROW_QUERY);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  /** The image picker serves two purposes: place into the current canvas (default) / open as a new document */
  const imageIntentRef = useRef<'import' | 'open'>('import');
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const workRowRef = useRef<HTMLDivElement | null>(null);
  /**
   * Workspace height (toolbox + canvas + right panel) = the space left below the first screen.
   *
   * It must be measured, not hard-coded as `calc(100vh - Npx)`: the rows above vary (hints, degraded notices,
   * empty-canvas help), and a constant would push the status bar out of view; the hook re-measures on resize.
   *
   * It also **cuts the "left toolbar height → workspace height" chain**.
   * Before, 26 flat tools made the rail about 1100px, the tallest item in the flex row, so the whole row
   * stretched and the page scrolled. With the height driven by the viewport, a tall rail only scrolls itself.
   */
  const workHeight = useViewportFill(workRowRef, { min: MIN_WORK_HEIGHT });

  const fail = useCallback((result: Failure) => setFailure(result), []);

  /* --------------------------- Panel layout persistence --------------------------- */

  const [panelsRestored, setPanelsRestored] = useState(false);

  useEffect(() => {
    setPanels(loadPanelLayout());
    setPanelsRestored(true);
  }, [setPanels]);

  // Don't write back before loading finishes: StrictMode mounts twice and a default write would clobber it
  useEffect(() => {
    if (!panelsRestored) return;
    savePanelLayout(panels);
  }, [panels, panelsRestored]);

  /** Present: show the layer first ("generating"), composite the bitmap next frame, so big images stay fluid */
  const openPresent = useCallback(() => {
    setPresentSrc(null);
    setPresentFailed(false);
    setPresenting(true);
    window.setTimeout(() => {
      try {
        const canvas = exportDoc(usePhotoStore.getState().doc, { format: 'png', quality: 1 });
        setPresentSrc(canvas.toDataURL('image/png'));
      } catch {
        setPresentFailed(true);
      }
    }, 0);
  }, []);

  /**
   * Eyedropper result: write the foreground color and give instant feedback.
   * The extra feedback exists because "just change the brush color" is invisible in the UI,
   * so users would think the eyedropper did nothing (especially when sampling a transparent pixel).
   */
  const handlePickColor = useCallback(
    (picked: PickedColor | null) => {
      if (!picked) return;
      if (picked.alpha === 0) {
        setNotice(t('tools.photo.pickTransparent'));
        return;
      }
      usePhotoStore.getState().patchBrush({ color: picked.hex });
      setNotice(t('tools.photo.picked', { color: picked.hex }));
    },
    [t],
  );

  // The toast disappears after 2 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ------------------------------ Draft ------------------------------ */

  useEffect(() => {
    let cancelled = false;
    void readDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        loadDoc(draft.doc);
        setDegraded(draft.degraded);
      }
      // First visit (no draft) or a draft that is itself an empty document: seed one editable background layer,
      // matching PS / Photopea where a new document starts with a "Background" layer, so no empty-state hint.
      const state = usePhotoStore.getState();
      if (state.doc.layers.length === 0) state.ensurePaintLayer();
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadDoc]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      setDraftSaved(writeDraft(usePhotoStore.getState().doc));
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [doc, restored]);

  /* ------------------------------ Import / export ------------------------------ */

  const handleImage = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImageFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      // SVG is vector: read its intrinsic size, then rasterize at a multiple (2× by default, so zoom stays crisp)
      const result =
        resolveImageKind(file.name) === 'svg' ? await loadSvgFile(file) : await loadImageFile(file);
      if (!result.ok) {
        fail(result as Failure);
        return;
      }
      usePhotoStore
        .getState()
        .addImageLayer(
          result.value.assetId,
          result.value.width,
          result.value.height,
          file.name.replace(/\.[^.]+$/, ''),
        );
      setScale(0);
      setViewport({ x: 0, y: 0 });
    },
    [fail, setScale, setViewport],
  );

  /**
   * Open image: create a canvas at the image size and load the image (replacing the current document).
   *
   * Unlike `handleImage`, which places the image into the current canvas (same size, one more layer),
   * this is a real "open": the canvas follows the image, the image fills it, and edits hit the original.
   */
  const handleOpenImage = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImageFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      const result =
        resolveImageKind(file.name) === 'svg' ? await loadSvgFile(file) : await loadImageFile(file);
      if (!result.ok) {
        fail(result as Failure);
        return;
      }
      const { assetId, width, height } = result.value;
      // Canvas cap 4096: oversized images shrink the canvas proportionally and scale the layer, staying in range
      const ratio = Math.min(1, MAX_CANVAS_SIZE / width, MAX_CANVAS_SIZE / height);
      const canvasWidth = Math.max(1, Math.round(width * ratio));
      const canvasHeight = Math.max(1, Math.round(height * ratio));
      const name = file.name.replace(/\.[^.]+$/, '');
      const layer = createRasterLayer({
        assetId,
        width: canvasWidth,
        height: canvasHeight,
        name,
        x: 0,
        y: 0,
      });
      // Hand the document and layers to loadDoc in one go: it reclaims unreferenced assets, so the
      // references must exist first, or the freshly read image would be collected as an old asset.
      loadDoc({
        ...createDoc(),
        name,
        width: canvasWidth,
        height: canvasHeight,
        // A white base matches "new canvas": erasing reveals white, not the stage's dark checkerboard.
        // For a transparent background (e.g. a cut-out PNG) use the menu "Image → Transparent".
        background: 'white',
        layers: [layer],
        activeLayerId: layer.id,
      });
      setScale(0);
      setViewport({ x: 0, y: 0 });
      clearDraft();
      setDraftSaved(false);
      setDegraded(false);
    },
    [fail, loadDoc, setScale, setViewport],
  );

  const handleProject = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkProjectFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      const result = await readProjectFile(file);
      if (!result.ok) {
        fail(result as Failure);
        return;
      }
      loadDoc(result.value);
      setScale(0);
    },
    [fail, loadDoc, setScale],
  );

  /**
   * Import PSD: restore layers that stay editable (groups / masks / blend modes / text / layer effects).
   * Whatever can't be restored (adjustment layers etc.) is counted by the reader and reported to the user.
   */
  const handlePsd = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkPsdFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      const result = await loadPsdFile(file);
      if (!result.ok) {
        fail(result as Failure);
        return;
      }
      loadDoc(result.value.doc);
      setScale(0);
      setViewport({ x: 0, y: 0 });
      const { rasterized, skipped } = result.value.report;
      const parts: string[] = [t('tools.photo.psdImported')];
      if (rasterized.length > 0)
        parts.push(t('tools.photo.psdRasterized', { n: rasterized.length }));
      if (skipped.length > 0) parts.push(t('tools.photo.psdSkipped', { n: skipped.length }));
      setNotice(parts.join(' · '));
    },
    [fail, loadDoc, setScale, setViewport, t],
  );

  const handleExportImage = useCallback(
    async ({ format, quality, selectionOnly, dpi }: ExportSubmit) => {
      setFailure(null);
      const current = usePhotoStore.getState().doc;
      try {
        const options = {
          format,
          quality,
          clip: selectionOnly ? selection : null,
          dpi,
        };
        const canvas = exportDoc(current, options);
        // TIFF / GIF / PDF need bytes encoded here (browsers only encode png / jpeg / webp natively)
        await downloadExport(
          canvas,
          buildExportFilename(docDisplayName(current.name, t), exportExtension(format)),
          options,
        );
        setDialog(null);
      } catch {
        fail({ error: 'EXPORT_FAILED' });
      }
    },
    [fail, selection, t],
  );

  /** PSD export: load the writer dynamically (ag-psd is downloaded only for this one use) */
  const handleExportPsd = useCallback(async () => {
    setFailure(null);
    setPsdBusy(true);
    try {
      const current = usePhotoStore.getState().doc;
      const { exportPsdFile, psdFilename } = await import('./psd/writer');
      await exportPsdFile(current, psdFilename(docDisplayName(current.name, t)));
      setDialog(null);
      setNotice(t('tools.photo.psdDone'));
    } catch {
      fail({ error: 'PSD_FAILED' });
    } finally {
      setPsdBusy(false);
    }
  }, [fail, t]);

  const handleExportProject = useCallback(() => {
    const current = usePhotoStore.getState().doc;
    const blob = new Blob([buildProjectJson(current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFilename(docDisplayName(current.name, t));
    a.click();
    URL.revokeObjectURL(url);
  }, [t]);

  const handleNewCanvas = useCallback(
    (width: number, height: number, background: CanvasBackground) => {
      // A new document starts blank: reset the name too (the UI shows the "Untitled canvas" placeholder),
      // or the exported file name would keep carrying the previous image's name.
      const next: PhotoDoc = {
        ...createDoc(),
        name: '',
        width,
        height,
        background,
      };
      loadDoc(next);
      // A new canvas seeds one background layer (consistent with init / clear)
      usePhotoStore.getState().ensurePaintLayer();
      setScale(0);
      setViewport({ x: 0, y: 0 });
      clearDraft();
      setDraftSaved(false);
      setDegraded(false);
    },
    [loadDoc, setScale, setViewport],
  );

  /** Apply canvas size / background (a single history entry) */
  const handleCanvasSize = useCallback(
    (width: number, height: number, background: CanvasBackground) => {
      usePhotoStore.getState().applyCanvas(width, height, background);
    },
    [],
  );

  const handleClear = useCallback(() => {
    loadDoc(createDoc());
    // Clearing returns to the initial state with one background layer, same as the first visit
    usePhotoStore.getState().ensurePaintLayer();
    clearDraft();
    setDraftSaved(false);
    setDegraded(false);
    setFailure(null);
  }, [loadDoc]);

  /* ------------------------------ Zoom ------------------------------ */

  const zoomBy = useCallback(
    (delta: number) => setScale((scale > 0 ? scale : 1) + delta),
    [scale, setScale],
  );

  /** Fit to window: restore the "needs fit" sentinel; the canvas host writes the real ratio back */
  const fitToWindow = useCallback(() => {
    setScale(0);
    setViewport({ x: 0, y: 0 });
  }, [setScale, setViewport]);

  /** 100%: back to native pixels, re-centered */
  const zoomActual = useCallback(() => {
    setScale(1);
    setViewport({ x: 0, y: 0 });
  }, [setScale, setViewport]);

  /* --------------------------- System clipboard / drag and drop --------------------------- */

  /** Copy to the system clipboard: selection first, then the current layer, finally the whole composite */
  const handleCopySystem = useCallback(() => {
    const state = usePhotoStore.getState();
    const canvas = clipboardCanvas(state.doc, state.selection, state.doc.activeLayerId);
    if (!canvas) {
      setNotice(i18n.t('tools.photo.copyFailed'));
      return;
    }
    const filename = `${docDisplayName(state.doc.name, i18n.t)}.png`;
    void (async () => {
      const blob = await canvasToPngBlob(canvas);
      const copied = blob ? await writeClipboardImage(blob) : false;
      if (copied) {
        setNotice(i18n.t('tools.photo.copiedToClipboard'));
        return;
      }
      // Without permission / support, fall back to a download so it doesn't look like nothing happened
      downloadCanvas(canvas, filename, { format: 'png', quality: 1 });
      setNotice(i18n.t('tools.photo.copyFailed'));
    })();
  }, []);

  /** Paste from the system clipboard as a new layer; true means it was handled */
  const handlePasteSystem = useCallback(async (): Promise<boolean> => {
    const blob = await readClipboardImage();
    if (!blob) return false;
    await handleImage(blobToImageFile(blob));
    return true;
  }, [handleImage]);

  /** Dropped file: `.photo.json` is a project, everything else goes through the image import validation */
  const handleDropFile = useCallback(
    (file: File) => {
      if (checkProjectFile(file).ok) {
        void handleProject(file);
        return;
      }
      if (checkPsdFile(file).ok) {
        void handlePsd(file);
        return;
      }
      void handleImage(file);
    },
    [handleImage, handleProject, handlePsd],
  );

  /* ------------------------------ Shortcuts ------------------------------ */

  /** Pause global bindings while the shortcut sheet is open, or Esc (close) would also clear the selection */
  const shortcutsOpen = dialog === 'shortcuts';

  useEffect(() => {
    if (shortcutsOpen) return;
    return attachKeyboard({
      onExport: () => setDialog('export'),
      onFit: fitToWindow,
      onActual: zoomActual,
      onShortcuts: () => setDialog('shortcuts'),
      onCopySystem: handleCopySystem,
      onPasteSystem: handlePasteSystem,
    });
  }, [shortcutsOpen, fitToWindow, zoomActual, handleCopySystem, handlePasteSystem]);

  /**
   * Native browser paste: covers paths that bypass our keydown, like the system menu / trackpad paste.
   * It only takes over when the event really carries an image, so text pasting inside inputs still works.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      const image = files.find((file) => file.type.startsWith('image/'));
      if (!image) return;
      event.preventDefault();
      void handleImage(image);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handleImage]);

  /* ------------------------------ Menu ------------------------------ */

  const activeLayerId = doc.activeLayerId;
  const hasActive = Boolean(activeLayerId);

  const panelTitle: Record<PanelId, string> = {
    color: t('tools.photo.tabColor'),
    layers: t('tools.photo.tabLayers'),
    style: t('tools.photo.tabStyle'),
    text: t('tools.photo.tabText'),
    channels: t('tools.photo.tabChannels'),
    property: t('tools.photo.tabProperty'),
    adjust: t('tools.photo.tabAdjust'),
    filter: t('tools.photo.tabFilter'),
    history: t('tools.photo.tabHistory'),
  };

  const openImagePicker = useCallback(() => {
    imageIntentRef.current = 'import';
    imageInputRef.current?.click();
  }, []);
  const openImageAsDocPicker = useCallback(() => {
    imageIntentRef.current = 'open';
    imageInputRef.current?.click();
  }, []);
  const openProjectPicker = useCallback(() => projectInputRef.current?.click(), []);
  const store = () => usePhotoStore.getState();

  const menus: MenuBarMenu[] = [
    {
      id: 'file',
      label: t('tools.photo.menuFile'),
      entries: [
        menuItem('file-new', t('tools.photo.newCanvas'), () => setDialog('new'), {
          shortcut: '⌘N',
        }),
        menuItem('file-open', t('tools.photo.openImage'), openImageAsDocPicker),
        menuItem('file-image', t('tools.photo.importImage'), openImagePicker),
        menuItem('file-project', t('tools.photo.importProject'), openProjectPicker),
        { type: 'separator' },
        menuItem('file-export', t('tools.photo.exportImage'), () => setDialog('export'), {
          shortcut: '⌘S',
        }),
        menuItem('file-psd', t('tools.photo.psdExport'), () => void handleExportPsd()),
        menuItem('file-export-project', t('tools.photo.exportProject'), handleExportProject),
        { type: 'separator' },
        menuItem('file-clear', t('tools.photo.clear'), handleClear, { danger: true }),
      ],
    },
    {
      id: 'edit',
      label: t('tools.photo.menuEdit'),
      entries: [
        menuItem('edit-undo', t('tools.photo.undo'), undo, { shortcut: '⌘Z', disabled: !canUndo }),
        menuItem('edit-redo', t('tools.photo.redo'), redo, {
          shortcut: '⇧⌘Z',
          disabled: !canRedo,
        }),
        { type: 'separator' },
        menuItem('edit-copy', t('tools.photo.duplicate'), () => store().copyLayer(), {
          shortcut: '⌘C',
          disabled: !hasActive,
        }),
        menuItem('edit-paste', t('tools.photo.ctxPaste'), () => store().pasteLayer(), {
          shortcut: '⌘V',
          disabled: !store().clipboard,
        }),
        menuItem('edit-copy-system', t('tools.photo.copySystem'), handleCopySystem, {
          shortcut: '⇧⌘C',
        }),
        menuItem(
          'edit-paste-system',
          t('tools.photo.pasteSystem'),
          () => void handlePasteSystem(),
          { shortcut: '⇧⌘V' },
        ),
        { type: 'separator' },
        menuItem('edit-select-all', t('tools.photo.selectAll'), () => store().selectAll(), {
          shortcut: '⌘A',
        }),
        menuItem('edit-invert', t('tools.photo.invertSelection'), () => store().invertSelection(), {
          shortcut: '⇧⌘I',
        }),
        menuItem('edit-via-copy', t('tools.photo.viaCopy'), () => store().copySelectionToLayer(), {
          shortcut: '⌘J',
          disabled: !selection,
        }),
        { type: 'separator' },
        menuItem(
          'edit-clear-sel',
          t('tools.photo.ctxClear'),
          () => store().fillSelectionArea('clear'),
          {
            shortcut: 'Del',
            disabled: !selection,
          },
        ),
      ],
    },
    {
      id: 'layer',
      label: t('tools.photo.menuLayer'),
      entries: [
        menuItem('layer-group', t('tools.photo.addGroup'), () => void store().addGroup()),
        menuItem(
          'layer-adjust',
          t('tools.photo.addAdjustment'),
          () => void store().addAdjustment(),
        ),
        menuItem('layer-raster', t('tools.photo.addRaster'), () => void store().ensurePaintLayer()),
        menuItem('layer-text', t('tools.photo.addText'), () =>
          store().addTextLayer(
            Math.round(store().doc.width * 0.1),
            Math.round(store().doc.height * 0.4),
            t('tools.photo.textPlaceholder'),
          ),
        ),
        menuItem('layer-shape', t('tools.photo.addShape'), () => {
          const d = store().doc;
          store().addShapeLayer({
            x: Math.round(d.width * 0.2),
            y: Math.round(d.height * 0.2),
            width: Math.round(d.width * 0.3),
            height: Math.round(d.height * 0.3),
          });
        }),
        { type: 'separator' },
        menuItem(
          'layer-duplicate',
          t('tools.photo.duplicate'),
          () => activeLayerId && store().duplicateLayer(activeLayerId, t('tools.photo.copySuffix')),
          { disabled: !hasActive },
        ),
        menuItem(
          'layer-merge',
          t('tools.photo.mergeDown'),
          () => activeLayerId && store().mergeDown(activeLayerId),
          { disabled: !hasActive },
        ),
        menuItem('layer-flatten', t('tools.photo.flatten'), () => store().flattenVisible()),
        { type: 'separator' },
        menuItem(
          'layer-delete',
          t('tools.photo.delete'),
          () => activeLayerId && store().removeLayer(activeLayerId),
          { disabled: !hasActive, danger: true },
        ),
      ],
    },
    {
      id: 'image',
      label: t('tools.photo.menuImage'),
      entries: [
        menuItem('image-size', t('tools.photo.canvasSize'), () => setDialog('canvas')),
        { type: 'separator' },
        menuItem('image-bg-white', t('tools.photo.bgWhite'), () =>
          store().applyCanvas(doc.width, doc.height, 'white'),
        ),
        menuItem('image-bg-black', t('tools.photo.bgBlack'), () =>
          store().applyCanvas(doc.width, doc.height, 'black'),
        ),
        menuItem('image-bg-transparent', t('tools.photo.bgTransparent'), () =>
          store().applyCanvas(doc.width, doc.height, 'transparent'),
        ),
      ],
    },
    {
      id: 'select',
      label: t('tools.photo.menuSelect'),
      entries: [
        menuItem('select-all', t('tools.photo.ctxSelectAll'), () => store().selectAll(), {
          shortcut: '⌘A',
        }),
        menuItem('select-none', t('tools.photo.deselect'), () => store().setSelection(null), {
          shortcut: '⌘D',
          disabled: !selection,
        }),
        menuItem('select-invert', t('tools.photo.ctxInvert'), () => store().invertSelection(), {
          shortcut: '⇧⌘I',
          disabled: !selection,
        }),
        { type: 'separator' },
        menuItem('select-quick-mask', t('tools.photo.quickMask'), () => store().toggleQuickMask(), {
          shortcut: 'Q',
        }),
        { type: 'separator' },
        menuItem(
          'select-expand',
          `${t('tools.photo.selExpand')}…`,
          () => store().modifySelection('expand', 4),
          { disabled: !selection },
        ),
        menuItem(
          'select-contract',
          `${t('tools.photo.selContract')}…`,
          () => store().modifySelection('contract', 4),
          { disabled: !selection },
        ),
        menuItem(
          'select-smooth',
          t('tools.photo.selSmooth'),
          () => store().modifySelection('smooth', 2),
          { disabled: !selection },
        ),
      ],
    },
    {
      id: 'view',
      label: t('tools.photo.menuView'),
      entries: [
        menuItem('view-in', t('tools.photo.zoomIn'), () => zoomBy(0.1), { shortcut: '⌘+' }),
        menuItem('view-out', t('tools.photo.zoomOut'), () => zoomBy(-0.1), { shortcut: '⌘-' }),
        { type: 'separator' },
        menuItem('view-fit', t('tools.photo.zoomFit'), fitToWindow, { shortcut: '⌘0' }),
        menuItem('view-actual', t('tools.photo.zoomActual'), zoomActual, { shortcut: '⌘1' }),
        { type: 'separator' },
        menuItem('view-rulers', `${t('tools.photo.rulers')}${overlay.rulers ? ' ✓' : ''}`, () =>
          patchOverlay({ rulers: !overlay.rulers }),
        ),
        menuItem('view-grid', `${t('tools.photo.grid')}${overlay.grid ? ' ✓' : ''}`, () =>
          patchOverlay({ grid: !overlay.grid }),
        ),
        menuItem('view-snap', `${t('tools.photo.snap')}${snapEnabled ? ' ✓' : ''}`, () =>
          setSnapEnabled(!snapEnabled),
        ),
        { type: 'separator' },
        menuItem('view-rotate-cw', t('tools.photo.rotateCW'), () => rotateView(VIEW_ROTATION_STEP)),
        menuItem('view-rotate-ccw', t('tools.photo.rotateCCW'), () =>
          rotateView(-VIEW_ROTATION_STEP),
        ),
        menuItem('view-rotate-reset', t('tools.photo.rotateReset'), () => {
          resetViewRotation();
        }),
        menuItem(
          'view-clear-guides',
          t('tools.photo.clearGuides'),
          () => patchOverlay({ guides: [] }),
          { disabled: overlay.guides.length === 0 },
        ),
      ],
    },
    {
      id: 'window',
      label: t('tools.photo.menuWindow'),
      entries: [
        // List sub tabs grouped by the three panels: clicking switches to that tab (✓ marks the current one)
        ...PANEL_GROUPS.flatMap((group, index) => [
          ...(index > 0 ? ([{ type: 'separator' }] as const) : []),
          ...group.panels.map((id) =>
            menuItem(
              `window-${id}`,
              `${panelTitle[id]}${panels.tabs[group.id] === id ? ' ✓' : ''}`,
              () => showPanel(id),
            ),
          ),
        ]),
        { type: 'separator' },
        menuItem('window-reset', t('tools.photo.menuWindowReset'), resetPanels),
      ],
    },
    {
      id: 'help',
      label: t('tools.photo.menuHelp'),
      entries: [
        menuItem('help-shortcuts', t('tools.photo.shortcuts'), () => setDialog('shortcuts'), {
          shortcut: 'F1',
        }),
      ],
    },
  ];

  const panelContent: Record<PanelId, ReactNode> = {
    color: <ColorPanel />,
    layers: <LayerPanel />,
    style: <LayerStylePanel />,
    text: <TextPanel />,
    channels: <ChannelsPanel />,
    property: <PropertyPanel />,
    adjust: <AdjustPanel />,
    filter: <FilterPanel />,
    history: <HistoryPanel />,
  };

  /** Draft status: icon + tooltip (no longer takes a whole text row) */
  const statusText = degraded
    ? t('tools.photo.degraded')
    : draftSaved
      ? t('tools.photo.saved')
      : t('tools.photo.saving');
  const statusIcon = degraded ? 'info' : draftSaved ? 'check' : 'clock';
  const statusClass = degraded
    ? 'text-amber-600 dark:text-amber-400'
    : draftSaved
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-400 dark:text-gray-500';

  return (
    <DropZone onFile={handleDropFile} testId="photo-drop">
      <div className="flex flex-col gap-3" data-tool-root>
        {/* Hidden file inputs: the menu's "open image / import into canvas / import project" still reuse them */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.svg,.psd"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // PSD and plain images share one picker and are routed by extension;
            // plain images are then routed by intent: place into the canvas / new document at image size
            if (file) {
              if (checkPsdFile(file).ok) void handlePsd(file);
              else
                void (imageIntentRef.current === 'open'
                  ? handleOpenImage(file)
                  : handleImage(file));
            }
            event.target.value = '';
            imageIntentRef.current = 'import';
          }}
        />
        <input
          ref={projectInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleProject(file);
            event.target.value = '';
          }}
        />

        {/* Menu bar: menus on the left plus the help icon; canvas name in the middle; new / present on the right */}
        <MenuBar
          menus={menus}
          ariaLabel={t('tools.photo.menuBar')}
          actions={
            <>
              <span
                role="status"
                title={statusText}
                aria-label={statusText}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${statusClass}`}
              >
                <Icon name={statusIcon} className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={handleClear}
                aria-label={t('tools.photo.clear')}
                title={t('tools.photo.clear')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
              <HintTip text={t('tools.photo.hint')} label={t('tools.photo.hint')} />
            </>
          }
          center={
            <input
              type="text"
              value={doc.name}
              aria-label={t('tools.photo.docTitle')}
              placeholder={t('tools.photo.titlePlaceholder')}
              onChange={(event) => setDocName(event.target.value)}
              className="w-full max-w-[240px] rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          }
          right={
            <>
              <button
                type="button"
                onClick={() => setDialog('new')}
                aria-label={t('tools.photo.newCanvas')}
                title={t('tools.photo.newCanvas')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Icon name="photoEditor" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openPresent}
                data-testid="photo-present"
                aria-label={t('tools.photo.present')}
                title={t('tools.photo.present')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Icon name="present" className="h-4 w-4" />
              </button>
            </>
          }
        />

        {/*
          The options bar grows with its content (no fixed height): tools show different numbers of rows —
          the eyedropper has one, the brush three. With a fixed height, lean tools leave an empty band and
          rich ones push the zoom controls into an inner scroll area. The ResizeObserver above feeds height
          changes to the workspace, and pointer mapping re-reads `getBoundingClientRect()` per event.
        */}
        <div className="shrink-0">
          <PhotoToolbar
            onFit={fitToWindow}
            onZoom={zoomBy}
            onActual={zoomActual}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>

        {notice ? (
          <p
            role="status"
            data-testid="photo-notice"
            className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          >
            {notice}
          </p>
        ) : null}

        <div
          ref={workRowRef}
          data-testid="photo-work-area"
          className={`flex gap-3 ${isNarrow ? 'flex-col' : ''}`}
          style={
            isNarrow
              ? undefined
              : {
                  height: workHeight ? `${workHeight}px` : undefined,
                  minHeight: MIN_WORK_HEIGHT,
                }
          }
        >
          <ToolPalette />
          <div
            ref={canvasHostRef}
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isNarrow ? 'min-h-[360px]' : ''}`}
          >
            <PhotoCanvas
              onRuntimeFailure={() => setRuntimeError(true)}
              onCursorMove={setCursor}
              onContextMenu={setContextMenu}
              onPickColor={handlePickColor}
              defaultText={t('tools.photo.textPlaceholder')}
            />
          </div>
          <aside
            data-testid="photo-panels"
            className={`flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${
              isNarrow ? 'h-[40vh] w-full' : 'h-full w-72'
            }`}
          >
            <PanelDock content={panelContent} />
          </aside>
        </div>

        <StatusBar cursor={cursor} />

        {failure ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {translateToolError('tools.photo', {
              ok: false,
              error: failure.error,
              params: failure.params,
            })}
          </p>
        ) : null}
        {runtimeError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {translateToolError('tools.photo', { ok: false, error: 'RUNTIME_FAILED' })}
          </p>
        ) : null}

        {contextMenu ? (
          <CanvasContextMenu
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            onFit={fitToWindow}
            onActual={zoomActual}
          />
        ) : null}

        {presenting ? (
          <PresentOverlay
            title={docDisplayName(doc.name, t)}
            onClose={() => setPresenting(false)}
            exitLabel={t('tools.photo.exitPresent')}
            loadingLabel={t('tools.photo.presentLoading')}
            failedLabel={t('tools.photo.presentFailed')}
            loading={!presentSrc && !presentFailed}
            failed={presentFailed}
          >
            {presentSrc ? (
              <img
                src={presentSrc}
                alt=""
                data-testid="present-image"
                className="max-h-full max-w-full rounded-lg bg-white shadow-2xl"
              />
            ) : null}
          </PresentOverlay>
        ) : null}

        {dialog === 'new' ? (
          <NewCanvasDialog onClose={() => setDialog(null)} onCreate={handleNewCanvas} />
        ) : null}
        {dialog === 'canvas' ? (
          <CanvasSizeDialog
            width={doc.width}
            height={doc.height}
            background={doc.background}
            onClose={() => setDialog(null)}
            onApply={handleCanvasSize}
          />
        ) : null}
        {dialog === 'export' ? (
          <ExportDialog
            hasSelection={Boolean(selection)}
            onClose={() => setDialog(null)}
            onExport={handleExportImage}
            onExportPsd={handleExportPsd}
            psdBusy={psdBusy}
          />
        ) : null}
        {dialog === 'shortcuts' ? <ShortcutHelp onClose={() => setDialog(null)} /> : null}
      </div>
    </DropZone>
  );
}
