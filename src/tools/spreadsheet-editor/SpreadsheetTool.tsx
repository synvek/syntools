import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { clearDraft, readDraft, writeDraft } from './draft';
import { Icon } from '@/core/components/Icon';
import { ProgressBar } from '@/core/components/ProgressBar';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import { useSettingsStore } from '@/stores/settings';
import type { ToolResult } from '@/core/types';
import { buildExportFilename, summarizeWorkbook, type WorkbookSummary } from './core';
import { registerSpreadsheetStrings } from './strings';
import {
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { createUniverInstance, type SheetInfo, type UniverHandle } from './univer';
import { SheetTabs } from './SheetTabs';
import './sheet.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerSpreadsheetStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type BusyKind = 'import' | 'export' | null;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const STATS_INTERVAL_MS = 2000;

/**
 * 电子表格编辑器：Univer 提供编辑界面，导入/导出全部在浏览器内完成。
 * 所有 Univer 相关副作用（CSS、实例化）都限制在本懒加载模块内，
 * 避免被 scripts/prerender.ts 的 SSR 载入触发。
 */
export default function SpreadsheetTool() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<UniverHandle | null>(null);
  /** 重建实例（主题/语言切换）时用来接力当前数据 */
  const pendingRef = useRef<WorkbookSnapshot | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState<WorkbookSummary>({
    sheets: 0,
    rows: 0,
    columns: 0,
    cells: 0,
    formulas: 0,
  });
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);

  const lang = useSettingsStore((s) => s.lang);
  const theme = useSettingsStore((s) => s.theme);
  const dark =
    theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));
  const univerLocale: 'zhCN' | 'enUS' = lang === 'zh' || lang === 'zh-TW' ? 'zhCN' : 'enUS';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    // 延后一拍创建：StrictMode 下 effect 会同步挂载→卸载→再挂载，
    // 若在 effect 内同步实例化，卸载阶段会在 React 渲染中同步 unmount Univer 的 React root，
    // 导致第二次实例渲染不出来（开发环境表格空白）。
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      let handle: UniverHandle;
      try {
        handle = createUniverInstance(container, { locale: univerLocale, dark });
      } catch {
        setRuntimeError(true);
        return;
      }
      const pending = pendingRef.current ?? readDraft();
      if (pending) handle.loadSnapshot(pending);
      handleRef.current = handle;
      const syncSheets = () => {
        setSheets(handle.getSheets());
        setActiveSheetId(handle.getActiveSheetId());
      };
      syncSheets();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const current = handleRef.current;
      if (current) {
        pendingRef.current = current.getSnapshot();
        current.dispose();
        handleRef.current = null;
      }
    };
  }, [univerLocale, dark]);

  const refreshSummary = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setSummary(summarizeWorkbook(handle.getSnapshot()));
  }, []);

  const refreshSheets = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setSheets(handle.getSheets());
    setActiveSheetId(handle.getActiveSheetId());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const handle = handleRef.current;
      if (!handle) return;
      const snapshot = handle.getSnapshot();
      setSummary(summarizeWorkbook(snapshot));
      setDraftSaved(writeDraft(snapshot));
    }, STATS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    const result = await importXlsxToSnapshot(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    handleRef.current?.loadSnapshot(result.value);
    if (!title.trim()) setTitle(result.value.name);
    refreshSummary();
    refreshSheets();
  };

  const handleAddSheet = () => {
    handleRef.current?.addSheet();
    refreshSheets();
    setFailure(null);
  };

  const handleSelectSheet = (id: string) => {
    handleRef.current?.setActiveSheet(id);
    refreshSheets();
  };

  const handleRenameSheet = (id: string, name: string) => {
    handleRef.current?.renameSheet(id, name);
    refreshSheets();
  };

  const handleDeleteSheet = (id: string) => {
    handleRef.current?.deleteSheet(id);
    refreshSheets();
  };

  const handleDuplicateSheet = (id: string) => {
    handleRef.current?.duplicateSheet(id);
    refreshSheets();
  };

  const handleExport = async () => {
    const handle = handleRef.current;
    if (!handle) return;
    setBusy('export');
    setFailure(null);
    const snapshot = handle.getSnapshot();
    const result = await exportSnapshotToBytes(snapshot);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBytes(result.value, buildExportFilename(title || 'workbook', 'xlsx'), XLSX_MIME);
  };

  const loadEmptyWorkbook = () => {
    handleRef.current?.loadSnapshot(createEmptySnapshot('', univerLocale));
    setTitle('');
    clearDraft();
    setDraftSaved(false);
    refreshSummary();
    refreshSheets();
  };

  const handleClear = () => {
    loadEmptyWorkbook();
  };

  const handleNew = () => {
    const hasContent = summary.cells > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    loadEmptyWorkbook();
  };

  const stats = useMemo(
    () => [
      { label: t('tools.sheet.sheets'), value: summary.sheets },
      { label: t('tools.sheet.rows'), value: summary.rows },
      { label: t('tools.sheet.columns'), value: summary.columns },
      { label: t('tools.sheet.cells'), value: summary.cells },
      { label: t('tools.sheet.formulas'), value: summary.formulas },
    ],
    [summary, t],
  );

  return (
    <div className="flex flex-col gap-4">
      <DocumentHeader
        titleLabel={t('tools.sheet.docTitle')}
        titlePlaceholder={t('tools.sheet.titlePlaceholder')}
        title={title}
        onTitleChange={setTitle}
        newLabel={t('common.newDoc')}
        newIcon="sheet"
        onNew={handleNew}
        io={
          <>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              title={t('tools.sheet.importHint')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="upload" className="h-4 w-4" />
              {t('tools.sheet.importXlsx')}
            </button>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={busy !== null || summary.cells === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {busy === 'export' ? t('tools.sheet.exporting') : t('tools.sheet.exportXlsx')}
            </button>

            {/* 兼容性说明改为 tooltip，避免占用行内空间 */}
            <HintTip text={t('tools.sheet.unsupportedTip')} />
          </>
        }
        stats={stats.map((item) => (
          <span key={item.label}>
            {item.label}: {item.value}
          </span>
        ))}
        status={draftSaved ? t('common.saved') : t('common.saving')}
        onClear={handleClear}
        clearDisabled={summary.cells === 0 && !title.trim()}
      />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div ref={containerRef} className="sheet-canvas" />
      </div>

      <SheetTabs
        sheets={sheets}
        activeId={activeSheetId}
        onSelect={handleSelectSheet}
        onAdd={handleAddSheet}
        onRename={handleRenameSheet}
        onDelete={handleDeleteSheet}
        onDuplicate={handleDuplicateSheet}
      />

      {busy !== null && <ProgressBar indeterminate label={t('tools.sheet.exporting')} />}

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {runtimeError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      )}

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', failure)}
        </p>
      )}
    </div>
  );
}
