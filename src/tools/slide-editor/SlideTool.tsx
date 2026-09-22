import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/core/components/ProgressBar';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import { buildExportFilename } from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { attachKeyboard } from './interaction/keyboard';
import { disposeThumbnails } from './render/thumbnail';
import { revokeAllMediaUrls } from './model/media';
import { createDoc } from './model/factory';
import { checkImportFile, importPptxFile } from './pptx/import';
import { exportPptx } from './pptx/export';
import { registerSlideStrings } from './strings';
import { useSlideStore } from './store';
import { PresentOverlay } from './ui/PresentOverlay';
import { PropertyPanel } from './ui/PropertyPanel';
import { SlideCanvas } from './ui/SlideCanvas';
import { SlideToolbar } from './ui/SlideToolbar';
import { ThemePanel } from './ui/ThemePanel';
import { ThumbnailRail } from './ui/ThumbnailRail';
import './slide.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerSlideStrings(i18n);

type BusyKind = 'import' | 'export' | null;
type Failure = { error: string; params?: Record<string, string | number> };

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DRAFT_DEBOUNCE_MS = 1200;

/**
 * 幻灯片编辑器：Konva 画布 + 浏览器本地 pptx 导入导出。
 * 所有 Konva / DOM 副作用都收在懒加载模块内，避免被 prerender 的 SSR 载入触发。
 */
export default function SlideTool() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const report = useSlideStore((s) => s.report);
  const loadDoc = useSlideStore((s) => s.loadDoc);
  const selectSlide = useSlideStore((s) => s.selectSlide);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const removeSelected = useSlideStore((s) => s.removeSelected);
  const duplicateSelected = useSlideStore((s) => s.duplicateSelected);
  const patchSelected = useSlideStore((s) => s.patchSelected);
  const select = useSlideStore((s) => s.select);
  const setDocName = useSlideStore((s) => s.setDocName);

  const [busy, setBusy] = useState<BusyKind>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [rightTab, setRightTab] = useState<'element' | 'theme'>('element');
  const saveTimer = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fail = useCallback((error: string, params?: Record<string, string | number>) => {
    setFailure({ error, params });
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImportFile(file);
      if (!check.ok) {
        setFailure(check as Failure);
        return;
      }
      setBusy('import');
      const result = await importPptxFile(file);
      setBusy(null);
      if (!result.ok) {
        setFailure(result as Failure);
        return;
      }
      loadDoc(result.value.doc, result.value.report);
    },
    [loadDoc],
  );

  const handleExport = useCallback(async () => {
    setFailure(null);
    setBusy('export');
    const result = await exportPptx(useSlideStore.getState().doc);
    setBusy(null);
    if (!result.ok) {
      setFailure(result as Failure);
      return;
    }
    downloadBytes(
      result.value,
      buildExportFilename(useSlideStore.getState().doc.name || 'presentation', 'pptx'),
      PPTX_MIME,
    );
  }, []);

  const handleNew = useCallback(() => {
    if (
      useSlideStore.getState().doc.slides.length > 0 &&
      !window.confirm(t('common.discardConfirm'))
    ) {
      return;
    }
    loadDoc(createDoc(''), null);
    clearDraft();
    setDraftSaved(false);
  }, [loadDoc, t]);

  const handleClear = useCallback(() => {
    loadDoc(createDoc(''), null);
    clearDraft();
    setDraftSaved(false);
  }, [loadDoc]);

  // 首次挂载时恢复本地草稿
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.doc.slides.length > 0) loadDoc(draft.doc, null);
    return () => {
      revokeAllMediaUrls();
      disposeThumbnails();
    };
  }, [loadDoc]);

  // 文档变更后防抖写入草稿
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setDraftSaved(writeDraft(useSlideStore.getState().doc));
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [doc]);

  useEffect(
    () =>
      attachKeyboard({
        onDelete: () => removeSelected(),
        onUndo: () => undo(),
        onRedo: () => redo(),
        onDuplicate: () => duplicateSelected(),
        onNudge: (dx, dy) => moveBy(dx, dy),
        onSelectAll: () => {
          const state = useSlideStore.getState();
          select(state.doc.slides[state.slideIndex]?.elements.map((el) => el.id) ?? []);
        },
        onEscape: () => select([]),
        onPrevSlide: () => selectSlide(useSlideStore.getState().slideIndex - 1),
        onNextSlide: () => selectSlide(useSlideStore.getState().slideIndex + 1),
        onPresent: () => setPresenting(true),
      }),
    [duplicateSelected, patchSelected, redo, removeSelected, select, selectSlide, undo],
  );

  return (
    <div className="flex flex-col gap-3">
      <DocumentHeader
        titleLabel={t('tools.slide.docTitle')}
        titlePlaceholder={t('tools.slide.titlePlaceholder')}
        title={doc.name}
        onTitleChange={setDocName}
        newLabel={t('tools.slide.newDoc')}
        newIcon="slides"
        onNew={handleNew}
        afterNew={
          <button
            type="button"
            onClick={() => setPresenting(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="slides" className="h-4 w-4" />
            {t('tools.slide.present')}
          </button>
        }
        io={
          <>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={busy !== null}
              title={t('tools.slide.importHint')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="upload" className="h-4 w-4" />
              {busy === 'import' ? t('tools.slide.importing') : t('tools.slide.importPptx')}
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {busy === 'export' ? t('tools.slide.exporting') : t('tools.slide.exportPptx')}
            </button>

            {/* 兼容性说明改为 tooltip，避免占用行内空间 */}
            <HintTip text={t('tools.slide.unsupportedTip')} />
          </>
        }
        stats={
          <>
            <span>
              {t('tools.slide.slidesLabel')}: {doc.slides.length} · {slideIndex + 1}/
              {doc.slides.length}
            </span>
            <span>
              {selection.length > 0
                ? t('tools.slide.selected', { count: selection.length })
                : t('tools.slide.noSelection')}
            </span>
            {report && report.placeholders > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t('tools.slide.downgraded', { count: report.placeholders })}
              </span>
            ) : null}
          </>
        }
        status={draftSaved ? t('tools.slide.saved') : t('tools.slide.saving')}
        onClear={handleClear}
        clearDisabled={doc.slides.length === 0 && !doc.name.trim()}
      />

      <SlideToolbar onFailure={(error) => fail(error)} />

      <div className="flex h-[max(360px,calc(100vh-28rem))] gap-3">
        <ThumbnailRail />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <SlideCanvas onRuntimeFailure={() => setRuntimeError(true)} />
        </main>

        <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/40">
          <div className="flex gap-1">
            {(['element', 'theme'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={`h-7 flex-1 rounded-md text-[12px] transition-colors ${
                  rightTab === tab
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {tab === 'element' ? t('tools.slide.panelElement') : t('tools.slide.panelTheme')}
              </button>
            ))}
          </div>
          {rightTab === 'element' ? <PropertyPanel /> : <ThemePanel />}
        </aside>
      </div>

      {busy !== null ? (
        <ProgressBar
          indeterminate
          label={busy === 'import' ? t('tools.slide.importing') : t('tools.slide.exporting')}
        />
      ) : null}

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.slide', {
            ok: false,
            error: failure.error,
            params: failure.params,
          })}
        </p>
      ) : null}

      {runtimeError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.slide', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      ) : null}

      <input
        ref={importInputRef}
        type="file"
        accept=".pptx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {presenting ? <PresentOverlay onClose={() => setPresenting(false)} /> : null}
    </div>
  );
}

/** 方向键微调：整体平移当前选中的所有元素 */
function moveBy(dx: number, dy: number): void {
  const state = useSlideStore.getState();
  const slide = state.doc.slides[state.slideIndex];
  if (!slide || state.selection.length === 0) return;
  state.commit();
  useSlideStore.setState((current) => ({
    doc: {
      ...current.doc,
      slides: current.doc.slides.map((item, index) =>
        index === current.slideIndex
          ? {
              ...item,
              elements: item.elements.map((element) =>
                current.selection.includes(element.id)
                  ? { ...element, x: element.x + dx, y: element.y + dy }
                  : element,
              ),
            }
          : item,
      ),
      version: current.doc.version + 1,
    },
  }));
}
