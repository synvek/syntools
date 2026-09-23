import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { Icon } from '@/core/components/Icon';
import { OptionBar } from '@/core/components/ActionButtons';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { buildExportFilename, checkImageFile, checkProjectFile } from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { attachKeyboard } from './interaction/keyboard';
import { loadImageFile } from './model/assets';
import { createDoc } from './model/factory';
import { buildProjectJson, projectFilename, readProjectFile } from './project';
import { downloadCanvas, exportDoc, type ExportFormat } from './render/export';
import { registerPhotoStrings } from './strings';
import { usePhotoStore } from './store';
import { AdjustPanel } from './ui/AdjustPanel';
import { ExportDialog, NewCanvasDialog } from './ui/Dialogs';
import { FilterPanel } from './ui/FilterPanel';
import { LayerPanel } from './ui/LayerPanel';
import { PhotoCanvas } from './ui/PhotoCanvas';
import { PhotoToolbar } from './ui/PhotoToolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { StatusBar } from './ui/StatusBar';
import { ToolPalette } from './ui/ToolPalette';
import { Button, IconTextButton } from './ui/controls';
import type { CanvasBackground, PhotoDoc } from './model/types';
import './photo.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerPhotoStrings(i18n);

type Failure = { error: string; params?: Record<string, string | number> };
type RightTab = 'layers' | 'property' | 'adjust' | 'filter';
type DialogKind = 'new' | 'export' | null;

const DRAFT_DEBOUNCE_MS = 1200;

/**
 * 照片编辑器：Konva 画布 + 浏览器本地的多图层图像编辑。
 * 所有 Konva / DOM 副作用都收在懒加载模块内（PhotoCanvas），避免被 prerender 的 SSR 载入触发。
 */
export default function PhotoTool() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const setDocName = usePhotoStore((s) => s.setDocName);
  const loadDoc = usePhotoStore((s) => s.loadDoc);
  const setScale = usePhotoStore((s) => s.setScale);
  const setViewport = usePhotoStore((s) => s.setViewport);
  const undo = usePhotoStore((s) => s.undo);
  const redo = usePhotoStore((s) => s.redo);
  const canUndo = usePhotoStore((s) => s.past.length > 0);
  const canRedo = usePhotoStore((s) => s.future.length > 0);

  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [rightTab, setRightTab] = useState<RightTab>('layers');
  const [draftSaved, setDraftSaved] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [restored, setRestored] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const fail = useCallback((result: Failure) => setFailure(result), []);

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

  /* ------------------------------ 快捷键 ------------------------------ */

  useEffect(() => {
    return attachKeyboard({ onExport: () => setDialog('export') });
  }, []);

  /* ------------------------------ 导入 / 导出 ------------------------------ */

  const handleImage = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImageFile(file);
      if (!check.ok) {
        fail(check as Failure);
        return;
      }
      const result = await loadImageFile(file);
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

  const handleExportImage = useCallback(
    (format: ExportFormat, quality: number, selectionOnly: boolean) => {
      setFailure(null);
      const current = usePhotoStore.getState().doc;
      try {
        const canvas = exportDoc(current, {
          format,
          quality,
          clip: selectionOnly ? selection : null,
        });
        downloadCanvas(canvas, buildExportFilename(current.name || 'photo', format), {
          format,
          quality,
        });
        setDialog(null);
      } catch {
        fail({ error: 'EXPORT_FAILED' });
      }
    },
    [fail, selection],
  );

  const handleExportProject = useCallback(() => {
    const current = usePhotoStore.getState().doc;
    const blob = new Blob([buildProjectJson(current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFilename(current.name || 'photo');
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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

  const tabs: { id: RightTab; label: string }[] = [
    { id: 'layers', label: t('tools.photo.tabLayers') },
    { id: 'property', label: t('tools.photo.tabProperty') },
    { id: 'adjust', label: t('tools.photo.tabAdjust') },
    { id: 'filter', label: t('tools.photo.tabFilter') },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DocumentHeader
        titleLabel={t('tools.photo.docTitle')}
        titlePlaceholder={t('tools.photo.titlePlaceholder')}
        title={doc.name}
        onTitleChange={setDocName}
        newLabel={t('tools.photo.newCanvas')}
        newIcon="photoEditor"
        onNew={() => setDialog('new')}
        io={
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImage(file);
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
            <Button onClick={() => imageInputRef.current?.click()}>
              <Icon name="upload" className="h-3.5 w-3.5" />
              {t('tools.photo.importImage')}
            </Button>
            <Button onClick={() => projectInputRef.current?.click()}>
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
            <span className="text-amber-600 dark:text-amber-400">{t('tools.photo.degraded')}</span>
          ) : draftSaved ? (
            <span className="text-green-600 dark:text-green-400">{t('tools.photo.saved')}</span>
          ) : (
            <span>{t('tools.photo.saving')}</span>
          )
        }
        onClear={handleClear}
      />

      <OptionBar>
        <IconTextButton
          icon="swap"
          label={t('tools.photo.undo')}
          onClick={undo}
          disabled={!canUndo}
        />
        <IconTextButton
          icon="swap"
          label={t('tools.photo.redo')}
          onClick={redo}
          disabled={!canRedo}
        />
      </OptionBar>

      <PhotoToolbar onFit={fitToWindow} onZoom={zoomBy} onActual={zoomActual} />

      <div className="flex min-h-[520px] gap-3">
        <ToolPalette />
        <div ref={canvasHostRef} className="flex min-w-0 flex-1 flex-col">
          <PhotoCanvas onRuntimeFailure={() => setRuntimeError(true)} onCursorMove={setCursor} />
        </div>
        <aside className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRightTab(tab.id)}
                aria-pressed={rightTab === tab.id}
                className={`h-8 flex-1 rounded-md text-xs transition-colors ${
                  rightTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {rightTab === 'layers' ? <LayerPanel /> : null}
            {rightTab === 'property' ? <PropertyPanel /> : null}
            {rightTab === 'adjust' ? <AdjustPanel /> : null}
            {rightTab === 'filter' ? <FilterPanel /> : null}
          </div>
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

      {dialog === 'new' ? (
        <NewCanvasDialog onClose={() => setDialog(null)} onCreate={handleNewCanvas} />
      ) : null}
      {dialog === 'export' ? (
        <ExportDialog
          hasSelection={Boolean(selection)}
          onClose={() => setDialog(null)}
          onExport={handleExportImage}
        />
      ) : null}
    </div>
  );
}
