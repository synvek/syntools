import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/core/i18n';
import { useMindStore } from './store';
import { clearDraft, readDraft, writeDraft } from './draft';
import { registerMindmapStrings } from './strings';
import { buildMindTemplate, type MindTemplateKind } from './model/templates';
import { countOf } from './model/tree';
import { MindCanvas } from './ui/MindCanvas';
import { Toolbar } from './ui/Toolbar';
import { OutlinePanel } from './ui/OutlinePanel';
import { Inspector } from './ui/Inspector';
import { TemplatePanel } from './ui/TemplatePanel';
import './mindmap.css';
import '@xyflow/react/dist/style.css';

registerMindmapStrings(i18n);

const DRAFT_DEBOUNCE_MS = 1200;

function MindmapInner() {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const doc = useMindStore((s) => s.doc);
  const selectedId = useMindStore((s) => s.selectedId);

  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
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
    <div className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col gap-3">
      <Toolbar
        onNew={handleNew}
        onTemplates={() => setTemplatesOpen(true)}
        busy={busy}
        setBusy={setBusy}
        onError={setFailure}
      />

      <div className="flex min-h-0 flex-1 gap-3">
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

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-1 py-1 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span>
          {t('tools.mindmap.nodesLabel')}: {counts.nodes} · {t('tools.mindmap.branchesLabel')}:{' '}
          {counts.edges}
          {selectedId ? ` · ${t('tools.mindmap.selectedOne')}` : ''}
        </span>
        <span>{draftSaved ? t('tools.mindmap.saved') : t('tools.mindmap.saving')}</span>
      </footer>

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failure}
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

export default function MindmapTool() {
  return (
    <ReactFlowProvider>
      <MindmapInner />
    </ReactFlowProvider>
  );
}
