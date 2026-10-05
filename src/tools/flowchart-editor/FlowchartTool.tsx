import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import { i18n } from '@/core/i18n';
import { buildTemplateDoc, type TemplateKind, type TemplateTranslator } from './model/templates';
import { LAYOUT_DENSITY } from './layout';
import { copySelection, groupSelected, pasteClipboard, ungroupSelected } from './flowOps';
import { useFlowStore } from './store';
import { readDraft, writeDraft, clearDraft } from './draft';
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
import { absoluteRectOf, formulaData, iconData, imageData } from './core';
import { fitInto, loadImageFile } from './model/image';
import { activePageOf } from './model/migrate';
import { FlowCanvas } from './ui/FlowCanvas';
import { IoMenu } from './ui/IoMenu';
import { ShapePalette } from './ui/ShapePalette';
import { Toolbar } from './ui/Toolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { LayerPanel } from './ui/LayerPanel';
import { SnapshotPanel } from './ui/SnapshotPanel';
import { PageBrowser } from '@/core/components/PageBrowser';
import { PageThumbnail } from './model/PageThumbnail';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { TemplatePanel } from './ui/TemplatePanel';
import { captureViewportDataUrl, DEFAULT_RASTER_OPTIONS } from './io/raster';
import './flowchart.css';
import '@xyflow/react/dist/style.css';

const DRAFT_DEBOUNCE_MS = 1200;

/** 右侧面板：属性 / 图层 / 历史快照 */
const PANELS = ['prop', 'layer', 'history'] as const;
type PanelKey = (typeof PANELS)[number];

function FlowchartInner() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { screenToFlowPosition, fitView } = useReactFlow();
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
  const [failure, setFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKey>('prop');
  const [draftSaved, setDraftSaved] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentSrc, setPresentSrc] = useState<string | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);

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

  // 文案就绪后载入：恢复本地草稿；无草稿时重置为「本地化页名」的空文档
  useEffect(() => {
    if (!stringsReady) return;
    const draft = readDraft();
    const page = activePageOf(draft);
    if (draft && page && page.nodes.length > 0) {
      useFlowStore.getState().load(draft);
      setDraftSaved(true);
      fitViewSoon();
      return;
    }
    useFlowStore.getState().load(null);
  }, [fitViewSoon, stringsReady]);

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
      const result = writeDraft(useFlowStore.getState().getDoc());
      setDraftSaved(result.saved);
      // 体积超限时图片不会写进草稿，明确提示改用项目文件保存
      if (result.droppedImages) setFailure(t('tools.flowchart.draftTooLarge'));
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
    // docName 参与依赖：只改标题时也要落盘
  }, [nodes, edges, docName, t]);

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
    setDraftSaved(false);
  }, [t]);

  const handleClear = useCallback(() => {
    useFlowStore.getState().clear();
    useFlowStore.getState().setDocName('');
    clearDraft();
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

  // 键盘快捷键：撤销/重做/复制/删除/微移/全选/建节点（输入框聚焦时不拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
      if (mod && e.key.toLowerCase() === 'z') {
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
  }, [nudge, spawnFromSelection]);

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

        io={<IoMenu busy={busy} setBusy={setBusy} onError={setFailure} />}
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
                {t(
                  `tools.flowchart.${key === 'prop' ? 'panelTitle' : key === 'layer' ? 'layers' : 'history'}`,
                )}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'prop' ? <PropertyPanel /> : null}
            {panel === 'layer' ? <LayerPanel /> : null}
            {panel === 'history' ? <SnapshotPanel /> : null}
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
