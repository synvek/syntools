import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentHeader, HintTip } from '@/core/components/DocumentHeader';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
import { Icon } from '@/core/components/Icon';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { ProgressBar } from '@/core/components/ProgressBar';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes } from '@/core/pdf/download';
import { useSettingsStore } from '@/stores/settings';
import type { ToolResult } from '@/core/types';
import {
  CSV_BOM,
  buildExportFilename,
  buildPresentGrid,
  checkImportFile,
  summarizeWorkbook,
  type PresentGrid,
  type WorkbookSummary,
} from './core';
import { csvToSnapshot, snapshotToCsv } from './csv';
import { buildChartData, type ChartData } from './charts';
import { registerChartStrings } from './chartStrings';
import { registerStoreStrings } from './storeStrings';
import {
  createDocId,
  deleteDocument,
  duplicateDocument,
  initDocStore,
  listDocuments,
  listVersions,
  loadDocument,
  saveDocument,
  setCurrentDocId,
  type DocMeta,
  type StoredVersion,
} from './docStore';
import { DocLibraryPanel, VersionHistoryPanel } from './DocLibraryPanel';
import { registerSpreadsheetStrings } from './strings';
import {
  createEmptySnapshot,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';
import { createUniverInstance, type SheetInfo, type UniverHandle } from './univer';
import { PresentSheet } from './ui/PresentSheet';
import { ChartPanel } from './ui/ChartPanel';
import { SheetTabs } from './SheetTabs';
import './sheet.css';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerSpreadsheetStrings(i18n);
registerChartStrings(i18n);
registerStoreStrings(i18n);

type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type BusyKind = 'import' | 'export' | null;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** 编辑后落盘防抖：避免连续输入时反复全量 save() */
const SAVE_DEBOUNCE_MS = 600;

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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  /** 重建实例（主题/语言切换）时用来接力当前数据 */
  const pendingRef = useRef<WorkbookSnapshot | null>(null);
  const [title, setTitle] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [presentGrid, setPresentGrid] = useState<PresentGrid | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** 图表：当前数据与「选区不合法」提示 */
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartNotice, setChartNotice] = useState(false);

  /**
   * 放映：读取当前工作簿快照 → 转成只读表格。
   * 不走 Univer 实例渲染，因此完全不影响正在编辑的工作簿状态。
   */
  const openPresent = () => {
    setPresentGrid(null);
    setPresentFailed(false);
    setPresenting(true);
    try {
      const handle = handleRef.current;
      const snapshot = handle?.getSnapshot();
      const grid = snapshot
        ? buildPresentGrid(snapshot, handleRef.current?.getActiveSheetId() ?? null)
        : null;
      if (grid) setPresentGrid(grid);
      else setPresentFailed(true);
    } catch {
      setPresentFailed(true);
    }
  };

  /** 用当前选区数据打开图表；选区为空或没有可绘制数值时给出提示 */
  const openChart = () => {
    const handle = handleRef.current;
    if (!handle) return;
    setChartNotice(false);
    const range = handle.getActiveRange();
    const result = range
      ? buildChartData(handle.getSnapshot(), handle.getActiveSheetId(), range)
      : null;
    if (!result || !result.ok) {
      setChartNotice(true);
      return;
    }
    setChartData(result.value);
  };

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
  // 本地文档库（IndexedDB）：多工作簿 + 版本历史；不可用时静默降级
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** 持久化失败提示：体积超限（failed）/ 本地存储不可用（degraded） */
  const [draftNotice, setDraftNotice] = useState<'degraded' | 'failed' | null>(null);
  const docIdRef = useRef<string | null>(null);
  docIdRef.current = docId;
  const titleRef = useRef(title);
  titleRef.current = title;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 统一持久化：localStorage 草稿（同步兜底）+ IndexedDB 文档库（多文档 / 版本历史）。
   * 只在真正编辑过或显式操作后调用，替代原先「每 2 秒全量 save() + stringify」的轮询。
   */
  const persistNow = useCallback((nextTitle?: string): void => {
    const handle = handleRef.current;
    if (!handle) return;
    const snapshot = handle.getSnapshot();
    const result = writeDraftSafe(snapshot);
    setDraftSaved(result.ok);
    setDraftNotice(result.ok ? null : result.degraded ? 'degraded' : 'failed');
    setSummary(summarizeWorkbook(snapshot));
    // 惰性分配文档 id：首次保存时才入库
    let id = docIdRef.current;
    if (!id) {
      id = createDocId();
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
    }
    void saveDocument(id, nextTitle ?? titleRef.current, snapshot).then(() => {
      void listDocuments().then(setDocs);
    });
  }, []);

  /** 编辑事件 → 防抖落盘 */
  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);

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
      // 脏跟踪：仅「会写入快照的修改」触发防抖落盘
      unsubscribeRef.current = handle.onMutation(scheduleSave);
      setSheets(handle.getSheets());
      setActiveSheetId(handle.getActiveSheetId());
      setSummary(summarizeWorkbook(handle.getSnapshot()));
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      const current = handleRef.current;
      if (current) {
        pendingRef.current = current.getSnapshot();
        current.dispose();
        handleRef.current = null;
      }
    };
  }, [univerLocale, dark, scheduleSave]);

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

  /** 装载一份快照并刷新派生状态（文档库 / 版本历史 / 导入共用） */
  const applySnapshot = useCallback(
    (snapshot: WorkbookSnapshot, nextTitle: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      handle.loadSnapshot(snapshot);
      setTitle(nextTitle);
      setFailure(null);
      setChartData(null);
      setChartNotice(false);
      refreshSummary();
      refreshSheets();
    },
    [refreshSummary, refreshSheets],
  );

  // 启动：接管文档库指针（内容已由 localStorage 草稿恢复，避免与实例创建竞态）
  useEffect(() => {
    void initDocStore().then((init) => {
      void listDocuments().then(setDocs);
      if (!init) return;
      docIdRef.current = init.docId;
      setDocId(init.docId);
    });
  }, []);

  // 标题变化同样落盘（首次渲染跳过，避免仅打开页面就建空文档）
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const timer = setTimeout(() => persistNow(), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [title, persistNow]);

  const handleImport = async (file: File) => {
    setBusy('import');
    setFailure(null);
    // 先按扩展名分流：.csv 走纯逻辑解析，.xlsx/.xlsm 交给 exceljs
    const check = checkImportFile(file);
    if (!check.ok) {
      setBusy(null);
      setFailure(check);
      return;
    }
    const result =
      check.value === 'csv'
        ? csvToSnapshot(await file.text(), file.name.replace(/\.csv$/i, ''), univerLocale)
        : await importXlsxToSnapshot(file);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const nextTitle = title.trim() ? title : result.value.name;
    applySnapshot(result.value, nextTitle);
    persistNow(nextTitle);
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

  /** 导出 CSV：取当前工作表；前置 BOM 便于 Excel 正确处理中文 */
  const handleExportCsv = () => {
    const handle = handleRef.current;
    if (!handle) return;
    setFailure(null);
    const result = snapshotToCsv(handle.getSnapshot(), handle.getActiveSheetId());
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const bytes = new TextEncoder().encode(CSV_BOM + result.value);
    downloadBytes(bytes, buildExportFilename(title || 'workbook', 'csv'), 'text/csv;charset=utf-8');
  };

  const loadEmptyWorkbook = () => {
    applySnapshot(createEmptySnapshot('', univerLocale), '');
    clearDraft();
    setDraftSaved(false);
    setDraftNotice(null);
  };

  const handleClear = () => {
    loadEmptyWorkbook();
  };

  const handleNew = () => {
    const hasContent = summary.cells > 0 || title.trim().length > 0;
    if (hasContent && !window.confirm(t('common.discardConfirm'))) return;
    // 新建即建立新文档 id，旧工作簿仍保留在文档库中
    const id = createDocId();
    docIdRef.current = id;
    setDocId(id);
    setCurrentDocId(id);
    loadEmptyWorkbook();
    void listDocuments().then(setDocs);
  };

  const openLibrary = () => {
    setVersionsOpen(false);
    setLibraryOpen(true);
    void listDocuments().then(setDocs);
  };

  const openVersions = () => {
    setLibraryOpen(false);
    setVersionsOpen(true);
    const id = docIdRef.current;
    if (id) void listVersions(id).then(setVersions);
    else setVersions([]);
  };

  const handleOpenDoc = (id: string) => {
    void loadDocument(id).then((doc) => {
      if (!doc) return;
      docIdRef.current = id;
      setDocId(id);
      setCurrentDocId(id);
      applySnapshot(doc.snapshot, doc.title);
      setLibraryOpen(false);
    });
  };

  const handleDuplicateDoc = (id: string) => {
    void duplicateDocument(id).then(() => {
      void listDocuments().then(setDocs);
    });
  };

  const handleDeleteDoc = (id: string) => {
    const target = docs.find((doc) => doc.id === id);
    const label = target?.title || t('tools.sheet.untitledDoc');
    if (!window.confirm(t('tools.sheet.deleteDocConfirm', { title: label }))) return;
    void deleteDocument(id).then(() => {
      void listDocuments().then(setDocs);
      if (id === docIdRef.current) {
        docIdRef.current = null;
        setDocId(null);
        loadEmptyWorkbook();
      }
    });
  };

  const handleRestoreVersion = (version: StoredVersion) => {
    if (!window.confirm(t('tools.sheet.restoreConfirm'))) return;
    applySnapshot(version.snapshot, version.title);
    setVersionsOpen(false);
    persistNow(version.title);
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
        afterNew={
          <>
            <button
              type="button"
              data-testid="sheet-present"
              onClick={openPresent}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="present" className="h-4 w-4" />
              {t('tools.sheet.present')}
            </button>
            <button
              type="button"
              data-testid="sheet-chart"
              onClick={openChart}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="chart" className="h-4 w-4" />
              {t('tools.sheet.insertChart')}
            </button>
            <button
              type="button"
              data-testid="sheet-library-open"
              onClick={openLibrary}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="file" className="h-4 w-4" />
              {t('tools.sheet.library')}
            </button>
            <button
              type="button"
              data-testid="sheet-versions-open"
              onClick={openVersions}
              disabled={!docId}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="clock" className="h-4 w-4" />
              {t('tools.sheet.versions')}
            </button>
          </>
        }
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

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={busy !== null || summary.cells === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="file" className="h-4 w-4" />
              {t('tools.sheet.exportCsv')}
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

      {libraryOpen ? (
        <DocLibraryPanel
          currentDocId={docId}
          docs={docs}
          onOpen={handleOpenDoc}
          onDuplicate={handleDuplicateDoc}
          onDelete={handleDeleteDoc}
          onNew={handleNew}
          onClose={() => setLibraryOpen(false)}
        />
      ) : null}
      {versionsOpen ? (
        <VersionHistoryPanel
          versions={versions}
          onRestore={handleRestoreVersion}
          onClose={() => setVersionsOpen(false)}
        />
      ) : null}

      {chartData ? <ChartPanel data={chartData} onClose={() => setChartData(null)} /> : null}
      {chartNotice ? (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.sheet.chartEmpty')}
        </p>
      ) : null}

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
        accept=".xlsx,.xlsm,.csv"
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

      {draftNotice && (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {draftNotice === 'degraded'
            ? t('tools.sheet.draftDegraded')
            : t('tools.sheet.draftSaveFailed')}
        </p>
      )}

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.sheet', failure)}
        </p>
      )}

      {presenting ? (
        <PresentOverlay
          title={title.trim() || t('tools.sheet.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.sheet.exitPresent')}
          failedLabel={t('tools.sheet.presentFailed')}
          failed={presentFailed}
        >
          {presentGrid ? <PresentSheet grid={presentGrid} /> : null}
        </PresentOverlay>
      ) : null}
    </div>
  );
}
