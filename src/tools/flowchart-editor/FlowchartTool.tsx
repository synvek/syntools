import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { buildTemplate, type TemplateKind } from './core';
import { useFlowStore } from './store';
import { readDraft, writeDraft, clearDraft } from './draft';
import { registerFlowchartStrings } from './strings';
import { exportFlowchart, type ExportFormat } from './export';
import { shapeSize, type ShapeKind } from './model/types';
import { FlowCanvas } from './ui/FlowCanvas';
import { ShapePalette } from './ui/ShapePalette';
import { Toolbar } from './ui/Toolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { TemplatePanel } from './ui/TemplatePanel';
import './flowchart.css';
import '@xyflow/react/dist/style.css';

registerFlowchartStrings(i18n);

const DRAFT_DEBOUNCE_MS = 1200;

function FlowchartInner() {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);
  const selectedCount = useFlowStore((s) => s.selectedNodes.length + s.selectedEdges.length);

  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // 首次挂载恢复本地草稿
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.nodes.length > 0) {
      useFlowStore.getState().load(draft);
      setDraftSaved(true);
    }
  }, []);

  // 变更后防抖写入本地草稿
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setDraftSaved(writeDraft(useFlowStore.getState().getDoc()));
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [nodes, edges]);

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
    clearDraft();
    setDraftSaved(false);
  }, []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setFailure(null);
    setBusy(true);
    const result = await exportFlowchart(useFlowStore.getState().nodes, format, 'flowchart');
    setBusy(false);
    if (!result.ok) setFailure(result.error);
  }, []);

  const handleTemplate = useCallback((kind: TemplateKind) => {
    useFlowStore.getState().load(buildTemplate(kind));
  }, []);

  const handleDelete = useCallback(() => useFlowStore.getState().removeSelected(), []);
  const handleDuplicate = useCallback(() => useFlowStore.getState().duplicateSelected(), []);

  // 键盘快捷键：撤销/重做/复制/删除（输入框聚焦时不拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useFlowStore.getState().redo();
        else useFlowStore.getState().undo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useFlowStore.getState().duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useFlowStore.getState().removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col gap-3">
      <Toolbar
        onNew={handleNew}
        onTemplates={() => setTemplatesOpen(true)}
        onAutoLayout={() => useFlowStore.getState().applyAutoLayout('TB')}
        onUndo={() => useFlowStore.getState().undo()}
        onRedo={() => useFlowStore.getState().redo()}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onExportPng={() => void handleExport('png')}
        onExportSvg={() => void handleExport('svg')}
        onClear={handleClear}
        canUndo={canUndo}
        canRedo={canRedo}
        busy={busy}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <ShapePalette onAddNode={addNodeAtCenter} />

        <main className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <FlowCanvas containerRef={canvasRef} />
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                {t('tools.flowchart.emptyHint')}
              </p>
            </div>
          )}
        </main>

        <aside className="w-[248px] shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
          <PropertyPanel />
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-1 py-1 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span>
          {t('tools.flowchart.nodesLabel')}: {nodes.length} · {t('tools.flowchart.edgesLabel')}:{' '}
          {edges.length}
          {selectedCount > 0 ? ` · ${t('tools.flowchart.selected', { count: selectedCount })}` : ''}
        </span>
        <span>{draftSaved ? t('tools.flowchart.saved') : t('tools.flowchart.saving')}</span>
      </footer>

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.flowchart', { ok: false, error: failure })}
        </p>
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
