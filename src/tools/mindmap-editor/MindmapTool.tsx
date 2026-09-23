import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow, type Node } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import { i18n } from '@/core/i18n';
import { useMindStore } from './store';
import { clearDraft, readDraft, writeDraft } from './draft';
import { registerMindmapStrings } from './strings';
import { buildMindTemplate, type MindTemplateKind } from './model/templates';
import { countOf } from './model/tree';
import { MindCanvas } from './ui/MindCanvas';
import { IoMenu } from './ui/IoMenu';
import { Toolbar } from './ui/Toolbar';
import { OutlinePanel } from './ui/OutlinePanel';
import { Inspector } from './ui/Inspector';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { TemplatePanel } from './ui/TemplatePanel';
import { captureViewportDataUrl, DEFAULT_RASTER_OPTIONS } from './io/raster';
import type { MindNodeData } from './nodes/MindNode';
import { PageBrowser } from '@/core/components/PageBrowser';
import { SheetThumbnail } from './model/SheetThumbnail';
import './mindmap.css';
import '@xyflow/react/dist/style.css';

registerMindmapStrings(i18n);

const DRAFT_DEBOUNCE_MS = 1200;

function MindmapInner() {
  const { t } = useTranslation();
  const { fitView, getNodes } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const doc = useMindStore((s) => s.doc);
  const selectedId = useMindStore((s) => s.selectedId);
  const docName = useMindStore((s) => s.docName);
  const setDocName = useMindStore((s) => s.setDocName);
  const sheetOrder = useMindStore((s) => s.sheetOrder);
  const activeSheetId = useMindStore((s) => s.activeSheetId);
  const sheetData = useMindStore((s) => s.sheetData);

  /** 各画布的即时快照（活动画布现场序列化），仅供总览缩略图使用 */
  const sheets = useMemo(
    () => useMindStore.getState().getDoc().sheets,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetOrder, activeSheetId, sheetData, doc],
  );

  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
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
      void captureViewportDataUrl(getNodes() as Node<MindNodeData>[], {
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

  const fitViewSoon = useCallback(() => {
    requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1 }));
  }, [fitView]);

  // 首次挂载：恢复本地草稿，并把中心主题适配到画布中央
  // （布局坐标以内容左上角为原点，不做适配的话默认会贴在画布左上角）
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      useMindStore.getState().load(draft);
      setDraftSaved(true);
    }
    fitViewSoon();
  }, [fitViewSoon]);

  // 变更后防抖写入本地草稿（编辑 → 未保存 → 1.2s 后落盘为已保存）
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setDraftSaved(false);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setDraftSaved(writeDraft(useMindStore.getState().getDoc()));
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [doc]);

  const handleNew = useCallback(() => {
    if (
      useMindStore.getState().doc.nodes.length > 1 &&
      !window.confirm(t('common.discardConfirm'))
    ) {
      return;
    }
    useMindStore.getState().load(null);
    clearDraft();
    setDraftSaved(false);
    fitViewSoon();
  }, [t, fitViewSoon]);

  const handleClear = useCallback(() => {
    useMindStore.getState().load(null);
    clearDraft();
    setDraftSaved(false);
    fitViewSoon();
  }, [fitViewSoon]);

  const handleTemplate = useCallback(
    (kind: MindTemplateKind) => {
      useMindStore.getState().load(buildMindTemplate(kind));
      fitViewSoon();
    },
    [fitViewSoon],
  );

  // 键盘快捷键：脑图习惯（Enter 同级 / Tab 子级 / 方向键移动 / F2 改名）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const st = useMindStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/⌘ + PageUp/PageDown：上一张 / 下一张画布
      if (mod && (e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
        const st = useMindStore.getState();
        const index = st.sheetOrder.findIndex((sheet) => sheet.id === st.activeSheetId);
        const next = st.sheetOrder[index + (e.key === 'PageDown' ? 1 : -1)];
        if (next) st.switchSheet(next.id);
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateAt();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        st.addSiblingOf();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) st.outdentAt();
        else st.addChildOf();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.removeAt();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (st.selectedId) st.beginEdit(st.selectedId);
        return;
      }
      if (e.key === 'Escape') {
        st.endEdit();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        st.moveSelection('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        st.moveSelection('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        st.moveSelection('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        st.moveSelection('right');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = countOf(doc.nodes);
  const onlyRoot = doc.nodes.length <= 1;

  return (
    <div className="flex flex-col gap-3">
      <DocumentHeader
        titleLabel={t('tools.mindmap.docTitle')}
        titlePlaceholder={t('tools.mindmap.titlePlaceholder')}
        title={docName}
        onTitleChange={setDocName}
        newLabel={t('tools.mindmap.newDoc')}
        newIcon="mindmap"
        onNew={handleNew}
        afterNew={
          <button
            type="button"
            data-testid="mindmap-present"
            onClick={openPresent}
            disabled={counts.nodes === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="present" className="h-4 w-4" />
            {t('tools.mindmap.present')}
          </button>
        }

        io={<IoMenu busy={busy} setBusy={setBusy} onError={setFailure} />}
        stats={
          <>
            <span>
              {t('tools.mindmap.nodesLabel')}: {counts.nodes} · {t('tools.mindmap.branchesLabel')}:{' '}
              {counts.edges}
              {selectedId ? ` · ${t('tools.mindmap.selectedOne')}` : ''}
            </span>
          </>
        }
        status={draftSaved ? t('tools.mindmap.saved') : t('tools.mindmap.saving')}
        onClear={handleClear}
        clearDisabled={onlyRoot && !docName.trim()}
      />

      <Toolbar onTemplates={() => setTemplatesOpen(true)} />

      <PageBrowser
        pages={sheetOrder}
        activeId={activeSheetId}
        labels={{
          add: t('tools.mindmap.addSheet'),
          renameHint: t('tools.mindmap.renameHint'),
          moveLeft: t('tools.mindmap.movePageLeft'),
          moveRight: t('tools.mindmap.movePageRight'),
          remove: t('tools.mindmap.removePage'),
          prev: t('tools.mindmap.prevPage'),
          next: t('tools.mindmap.nextPage'),
          openOverview: t('tools.mindmap.openPageOverview'),
          overviewTitle: t('tools.mindmap.pageOverview'),
          close: t('tools.mindmap.closeOverview'),
          empty: t('tools.mindmap.emptyPage'),
          counter: t('tools.mindmap.pageCounter'),
        }}
        thumbnail={(id) => {
          const sheet = sheets.find((item) => item.id === id);
          // 空画布返回 null，总览卡片才会显示「空白画布」提示
          return sheet && sheet.doc.nodes.length > 0 ? <SheetThumbnail doc={sheet.doc} /> : null;
        }}
        onSelect={(id) => useMindStore.getState().switchSheet(id)}
        onAdd={() => useMindStore.getState().addSheet()}
        onRename={(id, name) => useMindStore.getState().renameSheet(id, name)}
        onRemove={(id) => useMindStore.getState().removeSheet(id)}
        onMove={(id, dir) => useMindStore.getState().moveSheet(id, dir)}
      />

      <div className="flex h-[max(360px,calc(100vh-28rem))] gap-3">
        <OutlinePanel />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="relative min-h-0 flex-1">
            <MindCanvas containerRef={canvasRef} />
            {onlyRoot ? (
              // 提示条靠画布底部居中，避免盖住居中的中心主题
              <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
                <p className="rounded-full bg-white/85 px-4 py-1.5 text-[12px] text-gray-500 shadow-sm dark:bg-gray-900/85 dark:text-gray-400">
                  {t('tools.mindmap.emptyHint')}
                </p>
              </div>
            ) : null}
          </div>
        </main>

        <Inspector />
      </div>

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      ) : null}

      {presenting ? (
        <PresentOverlay
          title={docName.trim() || t('tools.mindmap.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.mindmap.exitPresent')}
          loadingLabel={t('tools.mindmap.presentLoading')}
          failedLabel={t('tools.mindmap.presentFailed')}
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

export default function MindmapTool() {
  return (
    <ReactFlowProvider>
      <MindmapInner />
    </ReactFlowProvider>
  );
}
