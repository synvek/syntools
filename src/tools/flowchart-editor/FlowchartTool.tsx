import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import { i18n } from '@/core/i18n';
import { buildTemplateDoc, type TemplateKind, type TemplateTranslator } from './model/templates';
import { LAYOUT_DENSITY } from './layout';
import {
  copySelection,
  cutSelection,
  flipSelected,
  groupSelected,
  pasteClipboard,
  rotateSelected,
  ungroupSelected,
} from './flowOps';
import { useFlowStore } from './store';
import { readDraft, writeDraft, clearDraft } from './draft';
import {
  clearPersistedDoc,
  loadPersistedDoc,
  loadPersistedSession,
  loadPersistedSnapshots,
  savePersistedDoc,
  savePersistedSession,
  savePersistedSnapshots,
} from './store/persist';
import { hasFlowchartStrings, registerFlowchartStrings } from './strings';
import {
  FORMULA_NODE_SIZE,
  ICON_NODE_SIZE,
  IMAGE_NODE_SIZE,
  type FlowNodeData,
  type FlowNodeType,
  type ShapeKind,
} from './model/types';
import { shapeSize } from './model/shapes';
import { absolutePositionOf, absoluteRectOf, formulaData, iconData, imageData } from './core';
import { fitInto, loadImageFile } from './model/image';
import { activePageOf } from './model/migrate';
import { FlowCanvas } from './ui/FlowCanvas';
import { IoMenu } from './ui/IoMenu';
import { ShapePalette } from './ui/ShapePalette';
import { Toolbar } from './ui/Toolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { LayerPanel } from './ui/LayerPanel';
import { SnapshotPanel } from './ui/SnapshotPanel';
import { SearchPanel } from './ui/SearchPanel';
import { ShortcutHelpDialog } from './ui/ShortcutHelpDialog';
import { PageBrowser } from '@/core/components/PageBrowser';
import { PageThumbnail } from './model/PageThumbnail';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { TemplatePanel } from './ui/TemplatePanel';
import { captureViewportDataUrl, DEFAULT_RASTER_OPTIONS } from './io/raster';
import { parseDrawioXmlAsync } from './io/drawio';
import './flowchart.css';
import '@xyflow/react/dist/style.css';

const DRAFT_DEBOUNCE_MS = 1200;

/** 右侧面板：属性 / 图层 / 历史快照 / 全图搜索 */
const PANELS = ['prop', 'layer', 'history', 'search'] as const;
type PanelKey = (typeof PANELS)[number];

/** 面板 → i18n 键后缀 */
const PANEL_LABEL_KEY: Record<PanelKey, string> = {
  prop: 'panelTitle',
  layer: 'layers',
  history: 'history',
  search: 'searchNodes',
};

function FlowchartInner() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  /** 当前语言的文案是否已按需加载完成 */
  const [stringsReady, setStringsReady] = useState(() =>
    hasFlowchartStrings(i18nInstance.language),
  );

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const docName = useFlowStore((s) => s.docName);
  const setDocName = useFlowStore((s) => s.setDocName);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);
  const selectedCount = useFlowStore((s) => s.selectedNodes.length + s.selectedEdges.length);
  const pageOrder = useFlowStore((s) => s.pageOrder);
  const activePageId = useFlowStore((s) => s.activePageId);
  const pageData = useFlowStore((s) => s.pageData);
  // 需持久化的会话设置（网格 / 布局 / 对齐阈值）与命名快照
  const gridEnabled = useFlowStore((s) => s.gridEnabled);
  const gridSize = useFlowStore((s) => s.gridSize);
  const layoutDirection = useFlowStore((s) => s.layoutDirection);
  const layoutDensity = useFlowStore((s) => s.layoutDensity);
  const alignTolerance = useFlowStore((s) => s.alignTolerance);
  const wheelMode = useFlowStore((s) => s.wheelMode);
  const canvasBackground = useFlowStore((s) => s.canvasBackground);
  const gridStyle = useFlowStore((s) => s.gridStyle);
  const guides = useFlowStore((s) => s.guides);
  const rulersVisible = useFlowStore((s) => s.rulersVisible);
  const pageSize = useFlowStore((s) => s.pageSize);
  const snapshots = useFlowStore((s) => s.snapshots);

  /**
   * 各页的即时快照（活动页现场序列化），仅供总览缩略图使用。
   * 依赖 nodes/edges/pageData，编辑过程中缩略图也会跟着更新。
   */
  const pages = useMemo(
    () => useFlowStore.getState().getDoc().pages,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageOrder, activePageId, pageData, nodes, edges],
  );

  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKey>('prop');
  const [draftSaved, setDraftSaved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentSrc, setPresentSrc] = useState<string | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** 会话设置 / 快照是否已从 IndexedDB 恢复完成（避免用默认值覆盖已存设置） */
  const [hydrated, setHydrated] = useState(false);

  /** 放映：先渲染放映层（显示「生成中」），下一帧再截图，避免大图卡住首次绘制 */
  const openPresent = () => {
    setPresentSrc(null);
    setPresentFailed(false);
    setPresenting(true);
    window.setTimeout(() => {
      void captureViewportDataUrl(useFlowStore.getState().nodes, {
        ...DEFAULT_RASTER_OPTIONS,
        format: 'png',
        transparent: false,
        padding: 40,
      }).then((url) => {
        if (url) setPresentSrc(url);
        else setPresentFailed(true);
      });
    }, 0);
  };

  const saveTimer = useRef<number | null>(null);
  const firstSave = useRef(true);

  // 只在「载入整张图」（草稿 / 模板）时适配视图。
  // 不能用 fitView prop：它会在首个节点测量完成后自动适配，
  // 导致新图的第一个元素无论拖到哪里都被居中显示。
  // 默认以 100%（实际大小）呈现：文字与元件尺寸贴近设计时的大小，避免一进来被无限缩小看不清。
  const fitViewSoon = useCallback(() => {
    requestAnimationFrame(() => fitView({ padding: 0.3, minZoom: 1, maxZoom: 1 }));
  }, [fitView]);

  // 文案按语种按需加载：就绪后再渲染，避免闪现键名
  useEffect(() => {
    let alive = true;
    void registerFlowchartStrings(i18n, i18nInstance.language).then(() => {
      if (alive) setStringsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [i18nInstance.language]);

  // 文案就绪后载入：优先恢复 IndexedDB 完整草稿（含图片），回退 localStorage 草稿；都无则重置为空文档
  useEffect(() => {
    if (!stringsReady) return;
    let alive = true;
    void (async () => {
      const persisted = await loadPersistedDoc();
      if (!alive) return;
      if (persisted && (activePageOf(persisted)?.nodes.length ?? 0) > 0) {
        useFlowStore.getState().load(persisted);
        setDraftSaved(true);
        fitViewSoon();
        return;
      }
      // 回退：旧版 localStorage 草稿（可能已丢弃图片）
      const draft = readDraft();
      const page = activePageOf(draft);
      if (draft && page && page.nodes.length > 0) {
        useFlowStore.getState().load(draft);
        setDraftSaved(true);
        fitViewSoon();
        return;
      }
      useFlowStore.getState().load(null);
    })();
    return () => {
      alive = false;
    };
  }, [fitViewSoon, stringsReady]);

  // 恢复会话设置与命名快照（IndexedDB 不可用时静默降级为默认值）
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [session, snaps] = await Promise.all([
        loadPersistedSession(),
        loadPersistedSnapshots(),
      ]);
      if (!alive) return;
      if (session) {
        useFlowStore.setState(session);
        if (session.panel) setPanel(session.panel);
      }
      if (snaps.length > 0) useFlowStore.setState({ snapshots: snaps });
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 会话设置变更后持久化（hydrated 之前不写，避免默认值覆盖已存设置）
  useEffect(() => {
    if (!hydrated) return;
    void savePersistedSession({
      gridEnabled,
      gridSize,
      layoutDirection,
      layoutDensity,
      alignTolerance,
      panel,
      wheelMode,
      canvasBackground,
      gridStyle,
      guides,
      rulersVisible,
    });
  }, [
    hydrated,
    gridEnabled,
    gridSize,
    layoutDirection,
    layoutDensity,
    alignTolerance,
    panel,
    wheelMode,
    canvasBackground,
    gridStyle,
    guides,
    rulersVisible,
  ]);

  // 命名快照变更后持久化
  useEffect(() => {
    if (!hydrated) return;
    void savePersistedSnapshots(snapshots);
  }, [hydrated, snapshots]);

  /**
   * 落盘：先写 localStorage（同步、可即时恢复，体积受限可能丢图），
   * 再写 IndexedDB（异步、完整含图片）。任一成功即视为「已保存」；
   * 仅当 IndexedDB 也失败且 localStorage 丢图时才提示改用项目文件。
   */
  const persistNow = useCallback(async () => {
    const doc = useFlowStore.getState().getDoc();
    const local = writeDraft(doc);
    const persisted = await savePersistedDoc(doc);
    setDraftSaved(local.saved || persisted);
    if (local.droppedImages && !persisted) setFailure(t('tools.flowchart.draftTooLarge'));
  }, [t]);

  // 变更后防抖写入本地草稿（编辑 → 未保存 → 1.2s 后落盘为已保存）
  useEffect(() => {
    // 首次挂载的数据本身就来自草稿，不必再写一次
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setDraftSaved(false);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistNow();
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
    // docName 参与依赖：只改标题时也要落盘
  }, [nodes, edges, docName, persistNow]);

  const addNodeAtCenter = useCallback(
    (kind: ShapeKind) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const size = shapeSize(kind);
      useFlowStore.getState().addNode(kind, {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      });
    },
    [screenToFlowPosition],
  );

  /** 在画布中心插入非图形节点（图片 / 图标 / 公式） */
  const addMediaAtCenter = useCallback(
    (type: FlowNodeType, data: FlowNodeData, size: { width: number; height: number }) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      useFlowStore.getState().addTypedNode(type, data, size, {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      });
    },
    [screenToFlowPosition],
  );

  const handleAddIcon = useCallback(
    (iconId: string) => addMediaAtCenter('icon', iconData(iconId), ICON_NODE_SIZE),
    [addMediaAtCenter],
  );

  const handleAddFormula = useCallback(
    () => addMediaAtCenter('formula', formulaData('E = mc^2'), FORMULA_NODE_SIZE),
    [addMediaAtCenter],
  );

  const imageRef = useRef<HTMLInputElement>(null);
  const handleImageFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setFailure(null);
      const loaded = await loadImageFile(file);
      if (!loaded) {
        setFailure(t('tools.flowchart.imageFailed'));
        return;
      }
      const size = fitInto({ width: loaded.width, height: loaded.height }, IMAGE_NODE_SIZE);
      addMediaAtCenter('image', imageData(loaded.src), size);
    },
    [addMediaAtCenter, t],
  );

  const handleNew = useCallback(() => {
    if (useFlowStore.getState().nodes.length > 0 && !window.confirm(t('common.discardConfirm'))) {
      return;
    }
    useFlowStore.getState().load(null);
    clearDraft();
    void clearPersistedDoc();
    setDraftSaved(false);
  }, [t]);

  const handleClear = useCallback(() => {
    useFlowStore.getState().clear();
    useFlowStore.getState().setDocName('');
    clearDraft();
    void clearPersistedDoc();
    setDraftSaved(false);
  }, []);

  /** 模板内文案走 i18n（token 见 model/templateLabels.ts），缺键回退英文 */
  const translateTemplate = useCallback<TemplateTranslator>(
    (key) => String(i18n.t(`tools.flowchart.tpl_${key}`)),
    [],
  );

  const handleTemplate = useCallback(
    (kind: TemplateKind) => {
      useFlowStore.getState().load(buildTemplateDoc(kind, translateTemplate));
      fitViewSoon();
    },
    [fitViewSoon, translateTemplate],
  );

  const handleDelete = useCallback(() => useFlowStore.getState().removeSelected(), []);
  const handleDuplicate = useCallback(() => useFlowStore.getState().duplicateSelected(), []);

  /** 方向键微移的合并计时器：一次连续按键只产生一条撤销记录 */
  const nudgeTimer = useRef<number | null>(null);
  const nudge = useCallback((dx: number, dy: number) => {
    const st = useFlowStore.getState();
    if (st.selectedNodes.length === 0) return;
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    else st.commit();
    nudgeTimer.current = window.setTimeout(() => {
      nudgeTimer.current = null;
    }, 600);
    st.nudgeSelected(dx, dy);
  }, []);

  /** Tab / Enter：以选中的单个节点为源，在右侧 / 下方生成相连节点 */
  const spawnFromSelection = useCallback((dir: 'right' | 'bottom'): boolean => {
    const st = useFlowStore.getState();
    if (st.selectedNodes.length !== 1) return false;
    const node = st.nodes.find((n) => n.id === st.selectedNodes[0]);
    if (!node) return false;
    const byId = new Map(st.nodes.map((n) => [n.id, n] as const));
    const rect = absoluteRectOf(node, byId);
    const gap = 60;
    const position =
      dir === 'right'
        ? { x: rect.x + rect.width + gap, y: rect.y }
        : { x: rect.x, y: rect.y + rect.height + gap };
    return st.spawnConnectedNode(node.id, position) !== undefined;
  }, []);

  /**
   * Ctrl/⌘+S：跳过防抖，立即把当前文档写入本地存储。
   * 本工具无服务端，「保存」即把草稿落盘（localStorage + IndexedDB）。
   */
  const handleSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void persistNow();
  }, [persistNow]);

  /** 全图搜索定位：把视口居中到该节点（含父容器偏移的绝对坐标） */
  const locateNode = useCallback(
    (nodeId: string) => {
      const st = useFlowStore.getState();
      const node = st.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const byId = new Map(st.nodes.map((n) => [n.id, n] as const));
      const abs = absolutePositionOf(node, byId);
      const size = {
        width: node.width ?? 120,
        height: node.height ?? 60,
      };
      setCenter(abs.x + size.width / 2, abs.y + size.height / 2, { zoom: 1.1, duration: 300 });
    },
    [setCenter],
  );

  // 键盘快捷键：撤销/重做/剪切复制粘贴/保存/导出/删除/微移/全选/重命名/建节点（输入框聚焦时不拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // 任意模态弹层（放映 / 模板 / 页面总览）打开时让位：
      // 编辑器快捷键不应作用于被遮挡的画布，也不应抢走弹层的 Esc。
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/⌘ + PageUp/PageDown：上一页 / 下一页（与表格软件切换工作表的手感一致）
      if (mod && (e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
        const st = useFlowStore.getState();
        const index = st.pageOrder.findIndex((page) => page.id === st.activePageId);
        const next = st.pageOrder[index + (e.key === 'PageDown' ? 1 : -1)];
        if (next) st.switchPage(next.id);
        return;
      }
      if (!mod && e.key === 'Escape') {
        // Esc 取消选择。延迟到本次事件派发结束再更新 store：
        // 同步的 store 更新会让其它弹层（如页面总览）在派发中途重挂监听而收不到 Esc。
        queueMicrotask(() => useFlowStore.getState().clearSelection());
      } else if (!mod && e.key === 'F1') {
        // F1 打开快捷键帮助（`?`/`/` 已被全局工具搜索占用，避免抢占）
        e.preventDefault();
        setHelpOpen(true);
      } else if (!mod && e.key === 'F2') {
        // F2 重命名选中节点：聚焦属性面板的文本输入框
        const labelInput = document.querySelector<HTMLInputElement>(
          '[data-testid="flowchart-label-input"]',
        );
        if (labelInput) {
          e.preventDefault();
          labelInput.focus();
          labelInput.select();
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        // Ctrl/⌘+Y 重做（与 Ctrl/⌘+Shift+Z 等效）
        e.preventDefault();
        useFlowStore.getState().redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        // Ctrl/⌘+S 立即保存草稿
        e.preventDefault();
        handleSave();
      } else if (mod && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'e')) {
        // Ctrl/⌘+P / Ctrl/⌘+E 打开导出面板
        e.preventDefault();
        setExportOpen(true);
      } else if (mod && e.key.toLowerCase() === 'x') {
        // Ctrl/⌘+X 剪切选中元素
        e.preventDefault();
        cutSelection();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useFlowStore.getState().redo();
        else useFlowStore.getState().undo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useFlowStore.getState().duplicateSelected();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
      } else if (mod && e.key.toLowerCase() === 'a') {
        // 全选当前页节点与连线
        e.preventDefault();
        useFlowStore.getState().selectAll();
      } else if (mod && e.key.toLowerCase() === 'r') {
        // Ctrl/⌘+R 顺时针 90°，加 Shift 逆时针 90°（与 draw.io 的旋转快捷键一致）
        e.preventDefault();
        rotateSelected(e.shiftKey ? -90 : 90);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        // Ctrl/⌘+Shift+H 水平镜像
        e.preventDefault();
        flipSelected('h');
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'j') {
        // Ctrl/⌘+Shift+J 垂直镜像
        e.preventDefault();
        flipSelected('v');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useFlowStore.getState().removeSelected();
      } else if (!mod && !e.altKey && e.key.startsWith('Arrow')) {
        // 方向键微移选中节点（默认 1px，按住 ⇧ 加速为 10px）
        const st = useFlowStore.getState();
        if (st.selectedNodes.length === 0) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        e.preventDefault();
        nudge(dx, dy);
      } else if (!mod && !e.shiftKey && e.key === 'Tab') {
        if (spawnFromSelection('right')) e.preventDefault();
      } else if (!mod && !e.shiftKey && e.key === 'Enter') {
        if (spawnFromSelection('bottom')) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudge, spawnFromSelection, handleSave]);

  /**
   * 从 draw.io 直接粘贴：识别系统剪贴板中的 mxGraph 内容并插入当前页。
   *
   * - 只在画布空闲（非输入框 / 无模态弹层）时接管，普通文本粘贴不受影响；
   * - 复用既有 `parseDrawioXmlAsync`（支持未压缩、base64+deflate、URI 编码）；
   * - 解析纯属 XML 数据解析，不执行任何脚本；节点数量有上限保护。
   */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text || !/mxGraphModel|mxfile|<mxCell/i.test(text)) return;
      e.preventDefault();
      void (async () => {
        const doc = await parseDrawioXmlAsync(text);
        if (!doc) {
          setFailure(t('tools.flowchart.pasteFailed'));
          return;
        }
        const host = canvasRef.current?.getBoundingClientRect();
        const center = host
          ? { x: host.left + host.width / 2, y: host.top + host.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const point = screenToFlowPosition(center);
        useFlowStore.getState().insertDoc(doc, point);
      })();
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [screenToFlowPosition, t]);

  // 文案未就绪时先不渲染（只有当前语言的小 chunk 需要等待）
  if (!stringsReady) return null;

  return (
    <div className="flex flex-col gap-3">
      <DocumentHeader
        titleLabel={t('tools.flowchart.docTitle')}
        titlePlaceholder={t('tools.flowchart.titlePlaceholder')}
        title={docName}
        onTitleChange={setDocName}
        newLabel={t('tools.flowchart.newDoc')}
        newIcon="diagram"
        onNew={handleNew}
        afterNew={
          <button
            type="button"
            data-testid="flowchart-present"
            onClick={openPresent}
            disabled={nodes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="present" className="h-4 w-4" />
            {t('tools.flowchart.present')}
          </button>
        }

        io={
          <IoMenu
            busy={busy}
            setBusy={setBusy}
            onError={setFailure}
            open={exportOpen}
            onOpenChange={setExportOpen}
          />
        }
        stats={
          <>
            <span>
              {t('tools.flowchart.nodesLabel')}: {nodes.length} · {t('tools.flowchart.edgesLabel')}:{' '}
              {edges.length}
              {selectedCount > 0
                ? ` · ${t('tools.flowchart.selected', { count: selectedCount })}`
                : ''}
            </span>
          </>
        }
        status={draftSaved ? t('tools.flowchart.saved') : t('tools.flowchart.saving')}
        onClear={handleClear}
        clearDisabled={nodes.length === 0 && !docName.trim()}
      />

      <Toolbar
        onTemplates={() => setTemplatesOpen(true)}
        onShortcutHelp={() => setHelpOpen(true)}
        onAutoLayout={() => {
          const st = useFlowStore.getState();
          // 两段式布局：保留泳道 / 编组层级，方向与间距取工具栏设置
          st.applyAutoLayout({
            direction: st.layoutDirection,
            ...LAYOUT_DENSITY[st.layoutDensity],
          });
        }}
        onUndo={() => useFlowStore.getState().undo()}
        onRedo={() => useFlowStore.getState().redo()}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex h-[max(360px,calc(100vh-28rem))] gap-3">
        <ShapePalette
          onAddNode={addNodeAtCenter}
          onAddIcon={handleAddIcon}
          onAddImage={() => imageRef.current?.click()}
          onAddFormula={handleAddFormula}
        />
        <input
          ref={imageRef}
          data-testid="flowchart-image-input"
          type="file"
          accept="image/*"
          onChange={(e) => void handleImageFile(e)}
          className="hidden"
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="relative min-h-0 flex-1">
            <FlowCanvas containerRef={canvasRef} />
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                  {t('tools.flowchart.emptyHint')}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 px-2 py-1 dark:border-gray-800">
            <button
              type="button"
              data-testid="flowchart-duplicate-page"
              onClick={() => useFlowStore.getState().duplicatePage(activePageId)}
              className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
            >
              {t('tools.flowchart.duplicatePage')}
            </button>
            {pageSize ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {`${pageSize.width} × ${pageSize.height}`}
              </span>
            ) : null}
          </div>
          <PageBrowser
            pages={pageOrder}
            activeId={activePageId}
            labels={{
              add: t('tools.flowchart.addPage'),
              renameHint: t('tools.flowchart.renameHint'),
              moveLeft: t('tools.flowchart.movePageLeft'),
              moveRight: t('tools.flowchart.movePageRight'),
              remove: t('tools.flowchart.removePage'),
              prev: t('tools.flowchart.prevPage'),
              next: t('tools.flowchart.nextPage'),
              openOverview: t('tools.flowchart.openPageOverview'),
              overviewTitle: t('tools.flowchart.pageOverview'),
              close: t('tools.flowchart.closeOverview'),
              empty: t('tools.flowchart.emptyPage'),
              counter: t('tools.flowchart.pageCounter'),
            }}
            thumbnail={(id) => {
              const page = pages.find((item) => item.id === id);
              // 空页返回 null，总览卡片才会显示「空白页」提示
              const hasContent = page?.nodes.some((node) => !node.hidden) ?? false;
              return page && hasContent ? <PageThumbnail page={page} /> : null;
            }}
            onSelect={(id) => useFlowStore.getState().switchPage(id)}
            onAdd={() => useFlowStore.getState().addPage()}
            onRename={(id, name) => useFlowStore.getState().renamePage(id, name)}
            onRemove={(id) => useFlowStore.getState().removePage(id)}
            onMove={(id, dir) => useFlowStore.getState().movePage(id, dir)}
          />
        </main>

        <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
          <div className="flex gap-1">
            {PANELS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={`flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                  panel === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-blue-50 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-blue-500/10'
                }`}
              >
                {t(`tools.flowchart.${PANEL_LABEL_KEY[key]}`)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'prop' ? <PropertyPanel /> : null}
            {panel === 'layer' ? <LayerPanel /> : null}
            {panel === 'history' ? <SnapshotPanel /> : null}
            {panel === 'search' ? <SearchPanel onLocate={locateNode} /> : null}
          </div>
        </aside>
      </div>

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      ) : null}

      {presenting ? (
        <PresentOverlay
          title={docName.trim() || t('tools.flowchart.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.flowchart.exitPresent')}
          loadingLabel={t('tools.flowchart.presentLoading')}
          failedLabel={t('tools.flowchart.presentFailed')}
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

      {helpOpen ? <ShortcutHelpDialog onClose={() => setHelpOpen(false)} /> : null}

      <TemplatePanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={handleTemplate}
      />
    </div>
  );
}

export default function FlowchartTool() {
  return (
    <ReactFlowProvider>
      <FlowchartInner />
    </ReactFlowProvider>
  );
}
