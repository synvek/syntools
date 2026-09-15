import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { ProgressBar } from '@/core/components/ProgressBar';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import { useSettingsStore } from '@/stores/settings';
import type { ToolResult } from '@/core/types';
import {
  MAX_IMPORT_BYTES,
  buildExportFilename,
  summarizeWorkbook,
  type WorkbookSummary,
} from './core';
import { registerSpreadsheetStrings } from './strings';
import {
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { createUniverInstance, type UniverHandle } from './univer';
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
  const [busy, setBusy] = useState<BusyKind>(null);
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
    let handle: UniverHandle;
    try {
      handle = createUniverInstance(container, { locale: univerLocale, dark });
    } catch {
      setRuntimeError(true);
      return;
    }
    if (pendingRef.current) handle.loadSnapshot(pendingRef.current);
    handleRef.current = handle;
    return () => {
      pendingRef.current = handle.getSnapshot();
      handle.dispose();
      handleRef.current = null;
    };
  }, [univerLocale, dark]);

  const refreshSummary = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setSummary(summarizeWorkbook(handle.getSnapshot()));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refreshSummary, STATS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshSummary]);

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
  };

  const handleNew = () => {
    const snapshot = createEmptySnapshot(t('tools.sheet.titlePlaceholder'), univerLocale);
    handleRef.current?.loadSnapshot(snapshot);
    setTitle('');
    setFailure(null);
    refreshSummary();
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
      <OptionBar>
        <label className="flex min-w-[220px] flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="shrink-0">{t('tools.sheet.docTitle')}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('tools.sheet.titlePlaceholder')}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <FileDropZone
          accept=".xlsx"
          maxBytes={MAX_IMPORT_BYTES}
          onFile={(file) => void handleImport(file)}
          hint={t('tools.sheet.importHint')}
        />
      </OptionBar>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap gap-3">
          {stats.map((item) => (
            <span key={item.label}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
        <span>{t('tools.sheet.ready')}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div ref={containerRef} className="sheet-canvas" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="sheet" className="h-4 w-4" />
          {t('tools.sheet.newSheet')}
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
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.unsupportedTip')}
        </p>
      </div>

      {busy !== null && <ProgressBar indeterminate label={t('tools.sheet.exporting')} />}

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
