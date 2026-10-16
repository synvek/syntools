import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { Icon } from '@/core/components/Icon';
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
import { createDoc } from './model/factory';
import { loadPanelLayout, savePanelLayout } from './panels';
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
import { Button } from './ui/controls';
import type { CanvasBackground, PhotoDoc } from './model/types';
import './photo.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerPhotoStrings(i18n);

type Failure = { error: string; params?: Record<string, string | number> };
type DialogKind = 'new' | 'canvas' | 'export' | 'shortcuts' | null;

const DRAFT_DEBOUNCE_MS = 1200;

/**
 * 工作区高度下限。
 *
 * 460 = 工具箱 11 行的自然高度（约 454px，32px 按钮 + 分隔线）再留一点余量：
 * 比它更矮时左侧栏会出现内部滚动条，而它比改前的 520px 更小 —— 画布反而更高了。
 */
const MIN_WORK_HEIGHT = 460;
/** 工作区下方预留给状态栏 + 「相关工具」的高度（只留一点，提示下面还有内容） */
const WORK_BOTTOM_RESERVE = 200;

/**
 * 照片编辑器：Konva 画布 + 浏览器本地的多图层图像编辑。
 * 所有 Konva / DOM 副作用都收在懒加载模块内（PhotoCanvas），避免被 prerender 的 SSR 载入触发。
 *
 * 工作区结构（自上而下）：菜单栏 → 文档头 → 工具参数条 → 左工具箱 / 画布 / 右面板停靠列 → 状态栏。
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
  const togglePanelVisible = usePhotoStore((s) => s.togglePanelVisible);
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
  /** 工作区高度（首屏剩余空间）；null 表示尚未测量，此时用 CSS 下限兜底 */
  const [workHeight, setWorkHeight] = useState<number | null>(null);
  const [presenting, setPresenting] = useState(false);
  /** PSD 导出进行中（只有这个分支会异步载入 ag-psd） */
  const [psdBusy, setPsdBusy] = useState(false);
  const [presentSrc, setPresentSrc] = useState<string | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const fail = useCallback((result: Failure) => setFailure(result), []);

  /**
   * 工作区高度 = 首屏剩余空间。
   *
   * 必须测，不能写死 `calc(100vh - Npx)`：工作区上方的行数会变（提示条、降级提示、画布为空时的说明），
   * 写死常量会在这些情况下把状态栏与「相关工具」挤出视口（同一坑在富文本编辑器里已踩过一次）。
   *
   * 另一重意义：**切断「左侧工具栏高度 → 工作区高度」的传导**。
   * 之前工具栏平铺 26 个工具约 1100px，它是 flex 行里最高的元素，于是整行被撑到 1100px，
   * 画布也一起被拉长，页面只能滚动 —— 工作区高度改由视口决定后，工具栏再高也只会自己内部滚动。
   */
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const compute = () => {
      // 用 offsetTop 链求文档内偏移：不受当前滚动位置影响，避免滚动时高度抖动
      let top = 0;
      let node: HTMLElement | null = host;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const available = window.innerHeight - top - WORK_BOTTOM_RESERVE;
      setWorkHeight(Math.max(MIN_WORK_HEIGHT, Math.round(available)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
    // 提示条 / 空文档说明会改变上方高度，需要重算
  }, [notice, doc.layers.length]);

  /* --------------------------- 面板布局持久化 --------------------------- */

  useEffect(() => {
    setPanels(loadPanelLayout());
  }, [setPanels]);

  useEffect(() => {
    savePanelLayout(panels);
  }, [panels]);

  /** 放映：先渲染放映层（显示「生成中」），下一帧再合成整幅位图，避免大图卡住首次绘制 */
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
   * 吸管结果：写入前景色并给出瞬时反馈。
   * 单独做一层反馈是因为「只改笔刷颜色」在界面上看不出任何变化，
   * 用户会以为吸管没反应（尤其吸到透明像素时）。
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

  // 提示 2 秒后自动消失
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ------------------------------ 草稿 ------------------------------ */

  useEffect(() => {
    let cancelled = false;
    void readDraft().then((draft) => {
      if (cancelled || !draft) {
        setRestored(true);
        return;
      }
      loadDoc(draft.doc);
      setDegraded(draft.degraded);
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

  /* ------------------------------ 导入 / 导出 ------------------------------ */

  const handleImage = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImageFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      // SVG 是矢量：先解析固有尺寸，再按倍数栅格化（默认 2 倍，导入后缩放不易糊）
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
   * 导入 PSD：还原为可继续编辑的图层（组 / 蒙版 / 混合模式 / 文字 / 图层效果）。
   * 无法还原的部分（调整图层等）由读取器统计并提示，避免用户以为「导进来少了东西」。
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
        // TIFF / GIF / PDF 需要现场编码字节（浏览器只能原生编码 png / jpeg / webp）
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

  /** PSD 导出：动态载入 writer（ag-psd 只在这一次使用时才下载） */
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
      const next: PhotoDoc = {
        ...createDoc(),
        name: usePhotoStore.getState().doc.name,
        width,
        height,
        background,
      };
      loadDoc(next);
      setScale(0);
      setViewport({ x: 0, y: 0 });
      clearDraft();
      setDraftSaved(false);
      setDegraded(false);
    },
    [loadDoc, setScale, setViewport],
  );

  /** 应用画布尺寸 / 背景（单次历史提交） */
  const handleCanvasSize = useCallback(
    (width: number, height: number, background: CanvasBackground) => {
      usePhotoStore.getState().applyCanvas(width, height, background);
    },
    [],
  );

  const handleClear = useCallback(() => {
    loadDoc(createDoc());
    clearDraft();
    setDraftSaved(false);
    setDegraded(false);
    setFailure(null);
  }, [loadDoc]);

  /* ------------------------------ 缩放 ------------------------------ */

  const zoomBy = useCallback(
    (delta: number) => setScale((scale > 0 ? scale : 1) + delta),
    [scale, setScale],
  );

  /** 适应窗口：置回「待适配」哨兵值，画布宿主按容器算出真实比例后写回 */
  const fitToWindow = useCallback(() => {
    setScale(0);
    setViewport({ x: 0, y: 0 });
  }, [setScale, setViewport]);

  /** 100%：回到原始像素，并重新居中 */
  const zoomActual = useCallback(() => {
    setScale(1);
    setViewport({ x: 0, y: 0 });
  }, [setScale, setViewport]);

  /* --------------------------- 系统剪贴板 / 拖放 --------------------------- */

  /** 拷贝到系统剪贴板：优先选区内容，其次当前图层，最后整幅合并 */
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
      // 无权限 / 不支持时降级为下载，避免用户以为「什么都没发生」
      downloadCanvas(canvas, filename, { format: 'png', quality: 1 });
      setNotice(i18n.t('tools.photo.copyFailed'));
    })();
  }, []);

  /** 从系统剪贴板粘贴为新图层；返回 true 表示已处理 */
  const handlePasteSystem = useCallback(async (): Promise<boolean> => {
    const blob = await readClipboardImage();
    if (!blob) return false;
    await handleImage(blobToImageFile(blob));
    return true;
  }, [handleImage]);

  /** 拖入文件：`.photo.json` 视为工程，其余交给图片导入流程校验 */
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

  /* ------------------------------ 快捷键 ------------------------------ */

  /** 快捷键一览打开时暂停全局绑定：否则 Esc（关面板）会连带清掉选区 */
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
   * 浏览器原生 paste：覆盖「用系统菜单 / 触控板粘贴」这类不走我们 keydown 的路径。
   * 只在事件确实带图片时接管，避免抢走输入框内的文本粘贴。
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

  /* ------------------------------ 菜单 ------------------------------ */

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

  const openImagePicker = useCallback(() => imageInputRef.current?.click(), []);
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
        ...(Object.keys(panelTitle) as PanelId[]).map((id) =>
          menuItem(
            `window-${id}`,
            `${panelTitle[id]}${panels.hidden.includes(id) ? '' : ' ✓'}`,
            () => togglePanelVisible(id),
          ),
        ),
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

  return (
    <DropZone onFile={handleDropFile} testId="photo-drop">
      <div className="flex flex-col gap-3">
        <DocumentHeader
          titleLabel={t('tools.photo.docTitle')}
          titlePlaceholder={t('tools.photo.titlePlaceholder')}
          title={doc.name}
          onTitleChange={setDocName}
          newLabel={t('tools.photo.newCanvas')}
          newIcon="photoEditor"
          onNew={() => setDialog('new')}
          afterNew={
            <Button onClick={openPresent} testId="photo-present">
              <Icon name="present" className="h-3.5 w-3.5" />
              {t('tools.photo.present')}
            </Button>
          }
          io={
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.svg,.psd"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // PSD 与普通图片共用同一个选择器，按扩展名分流
                  if (file) void (checkPsdFile(file).ok ? handlePsd(file) : handleImage(file));
                  event.target.value = '';
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
              <Button onClick={openImagePicker}>
                <Icon name="upload" className="h-3.5 w-3.5" />
                {t('tools.photo.importImage')}
              </Button>
              <Button onClick={openProjectPicker}>
                <Icon name="upload" className="h-3.5 w-3.5" />
                {t('tools.photo.importProject')}
              </Button>
              <Button onClick={() => setDialog('export')} primary>
                <Icon name="download" className="h-3.5 w-3.5" />
                {t('tools.photo.exportImage')}
              </Button>
              <Button onClick={handleExportProject}>
                <Icon name="download" className="h-3.5 w-3.5" />
                {t('tools.photo.exportProject')}
              </Button>
            </>
          }
          stats={
            <>
              <span data-testid="photo-stats">
                {t('tools.photo.stats', {
                  width: doc.width,
                  height: doc.height,
                  count: doc.layers.length,
                })}
              </span>
              <HintTip text={t('tools.photo.hint')} label={t('tools.photo.hint')} />
            </>
          }
          status={
            degraded ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t('tools.photo.degraded')}
              </span>
            ) : draftSaved ? (
              <span className="text-green-600 dark:text-green-400">{t('tools.photo.saved')}</span>
            ) : (
              <span>{t('tools.photo.saving')}</span>
            )
          }
          onClear={handleClear}
        />

        {/* 菜单紧贴工具栏上方：菜单影响的是「文档级」操作，放在工作区之上、工具栏之前的层级最直观 */}
        <MenuBar menus={menus} ariaLabel={t('tools.photo.menuBar')} />

        <PhotoToolbar
          onFit={fitToWindow}
          onZoom={zoomBy}
          onActual={zoomActual}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {notice ? (
          <p
            role="status"
            data-testid="photo-notice"
            className="self-start rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          >
            {notice}
          </p>
        ) : null}

        <div
          data-testid="photo-work-area"
          className="flex gap-3"
          style={{ height: workHeight ? `${workHeight}px` : undefined, minHeight: MIN_WORK_HEIGHT }}
        >
          <ToolPalette />
          <div ref={canvasHostRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            className="flex max-h-full w-72 shrink-0 flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <PanelDock content={panelContent} />
          </aside>
        </div>

        <StatusBar cursor={cursor} />

        {doc.layers.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.photo.emptyHint')}</p>
        ) : null}

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
