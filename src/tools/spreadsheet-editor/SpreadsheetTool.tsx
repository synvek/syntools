import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HintTip } from '@/core/components/DocumentHeader';
import { clearDraft, readDraft, writeDraftSafe } from './draft';
import { Icon } from '@/core/components/Icon';
import { EditorMenuBar } from '@/core/components/EditorMenuBar';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_ICON_BUTTON_CLASS,
  EDITOR_TITLE_INPUT_CLASS,
  editorMenuItem,
  estimateJsonBytes,
  formatBytes,
  type EditorMenu,
} from '@/core/components/editorChrome';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { ProgressBar } from '@/core/components/ProgressBar';
import { useViewportFill } from '@/core/hooks/useViewportFill';
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
  type WorkbookSnapshotLite,
  type WorkbookSummary,
} from './core';
import { csvToSnapshot, snapshotToCsv } from './csv';
import { buildChartData, type ChartConfig, type ChartData } from './charts';
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
import { ChartOverlay } from './ui/ChartOverlay';
import { readWorkbookExtras, withWorkbookExtras, type WorkbookExtras } from './xlsx-extras';
import type { RawChartParts } from './rawChartParts';
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
  /** 表格区高度 = 首屏剩余空间（底部标签栏 / 状态栏可见，「相关工具」推到首屏之外） */
  const sheetHeight = useViewportFill(containerRef, { min: 460 });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<UniverHandle | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  /** 重建实例（主题/语言切换）时用来接力当前数据 */
  const pendingRef = useRef<WorkbookSnapshot | null>(null);
  const [title, setTitle] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [presentGrid, setPresentGrid] = useState<PresentGrid | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** 工作表内浮动图表：配置（随快照持久化）+ 派生数据 + 选区提示 */
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const chartsRef = useRef<ChartConfig[]>([]);
  chartsRef.current = charts;
  const [chartDataMap, setChartDataMap] = useState<Record<string, ChartData | null>>({});
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [chartNotice, setChartNotice] = useState(false);
  /** 工作表区域尺寸：图表拖拽 / 缩放的边界 */
  const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });
  const chartSeqRef = useRef(0);
  /**
   * 持久化触发器：图表的新增 / 移动 / 缩放 / 删除都不是 Univer MUTATION，
   * 不会走脏跟踪，需要主动触发防抖落盘。（在 scheduleSave 创建后赋值）
   */
  const scheduleSaveRef = useRef<() => void>(() => {});
  /** 条件格式 / 数据验证等「随快照往返保留、未做语义映射」的内容 */
  const extrasRef = useRef<WorkbookExtras | null>(null);
  /** 导入文件里原有的 Excel 原生图表部件（原样回填，不解析） */
  const rawPartsRef = useRef<RawChartParts | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

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

  const setChartList = useCallback((next: ChartConfig[]) => {
    chartsRef.current = next;
    setCharts(next);
  }, []);

  /** 按当前工作簿内容重算所有图表的派生数据（单元格改动后调用） */
  const applyChartData = useCallback((snapshot: WorkbookSnapshotLite, sheetId: string | null) => {
    const configs = chartsRef.current;
    if (configs.length === 0) {
      setChartDataMap({});
      return;
    }
    const next: Record<string, ChartData | null> = {};
    for (const config of configs) {
      const result = buildChartData(snapshot, config.sheetId ?? sheetId, config.range);
      next[config.id] = result.ok ? result.value : null;
    }
    setChartDataMap(next);
  }, []);

  /** 在表格区域内插入浮动图表：数据取当前选区，位置/尺寸给默认值 */
  const openChart = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const range = handle.getActiveRange();
    if (!range) {
      setChartNotice(true);
      return;
    }
    const sheetId = handle.getActiveSheetId();
    const result = buildChartData(handle.getSnapshot(), sheetId, range);
    if (!result.ok) {
      setChartNotice(true);
      return;
    }
    setChartNotice(false);
    chartSeqRef.current += 1;
    const offset = (chartsRef.current.length % 5) * 24;
    const config: ChartConfig = {
      id: `chart-${Date.now().toString(36)}-${chartSeqRef.current}`,
      type: 'bar',
      range,
      sheetId: sheetId ?? undefined,
      x: 24 + offset,
      y: 24 + offset,
      width: Math.max(260, Math.min(420, (chartBounds.width || 460) - 48)),
      height: Math.max(200, Math.min(280, (chartBounds.height || 320) - 48)),
    };
    setChartList([...chartsRef.current, config]);
    setSelectedChartId(config.id);
    setChartDataMap((prev) => ({ ...prev, [config.id]: result.value }));
    scheduleSaveRef.current();
  }, [chartBounds.height, chartBounds.width, setChartList]);

  /** 更新图表配置；数据区域变化时立即重算数据 */
  const updateChart = useCallback(
    (id: string, patch: Partial<ChartConfig>) => {
      setChartList(
        chartsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      if (patch.range) {
        const handle = handleRef.current;
        if (handle) applyChartData(handle.getSnapshot(), handle.getActiveSheetId());
      }
      scheduleSaveRef.current();
    },
    [applyChartData, setChartList],
  );

  const removeChart = useCallback(
    (id: string) => {
      setChartList(chartsRef.current.filter((item) => item.id !== id));
      setSelectedChartId((prev) => (prev === id ? null : prev));
      setChartDataMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      scheduleSaveRef.current();
    },
    [setChartList],
  );

  /** 用当前表格选区更新某个图表的数据区域 */
  const pickRangeForChart = useCallback(
    (id: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      const range = handle.getActiveRange();
      if (!range) {
        setChartNotice(true);
        return;
      }
      setChartNotice(false);
      updateChart(id, { range, sheetId: handle.getActiveSheetId() ?? undefined });
    },
    [updateChart],
  );

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
   * 把「本工具自有、Univer 不认识」的内容并入快照：
   * 条件格式 / 数据验证（往返保留）+ 工作表内图表配置。
   */
  const withDocOwnedContent = useCallback((base: WorkbookSnapshot): WorkbookSnapshot => {
    let next: WorkbookSnapshot = base;
    if (chartsRef.current.length) next = { ...next, syntoolsCharts: chartsRef.current };
    if (rawPartsRef.current) next = { ...next, syntoolsRawParts: rawPartsRef.current };
    return withWorkbookExtras(next, extrasRef.current);
  }, []);

  /**
   * 统一持久化：localStorage 草稿（同步兜底）+ IndexedDB 文档库（多文档 / 版本历史）。
   * 只在真正编辑过或显式操作后调用，替代原先「每 2 秒全量 save() + stringify」的轮询。
   */
  const persistNow = useCallback(
    (nextTitle?: string): void => {
      const handle = handleRef.current;
      if (!handle) return;
      const base = handle.getSnapshot();
      // 图表数据跟随单元格内容变化
      applyChartData(base, handle.getActiveSheetId());
      const snapshot = withDocOwnedContent(base);
      const result = writeDraftSafe(snapshot);
      setDraftSaved(result.ok);
      setDraftNotice(result.ok ? null : result.degraded ? 'degraded' : 'failed');
      setSummary(summarizeWorkbook(base));
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
    },
    [applyChartData, withDocOwnedContent],
  );

  /** 编辑事件 → 防抖落盘 */
  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);
  // 图表等「非 Univer 变更」通过该 ref 触发落盘（避免回调声明顺序依赖）
  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

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
      if (pending) {
        handle.loadSnapshot(pending);
        // 自有内容（条件格式 / 数据验证 + 图表）：
        // 仅在「首次从草稿恢复」时读取。实例重建（StrictMode 二次挂载、主题/语言切换）
        // 时 pending 是 Univer 原始快照、并不含这些字段，覆盖会直接丢内容。
        if (!extrasRef.current) extrasRef.current = readWorkbookExtras(pending);
        if (!rawPartsRef.current) rawPartsRef.current = pending.syntoolsRawParts ?? null;
        if (chartsRef.current.length === 0) {
          const configs = pending.syntoolsCharts ?? [];
          if (configs.length > 0) {
            chartsRef.current = configs;
            setCharts(configs);
            setSelectedChartId(configs[0]?.id ?? null);
          }
        }
      }
      handleRef.current = handle;
      // 脏跟踪：仅「会写入快照的修改」触发防抖落盘
      unsubscribeRef.current = handle.onMutation(scheduleSave);
      setSheets(handle.getSheets());
      setActiveSheetId(handle.getActiveSheetId());
      const initial = handle.getSnapshot();
      setSummary(summarizeWorkbook(initial));
      applyChartData(initial, handle.getActiveSheetId());
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
  }, [univerLocale, dark, scheduleSave, applyChartData]);

  // 工作表区域尺寸：图表拖拽 / 缩放需要边界
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () => setChartBounds({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  /** 当前工作表上可见的图表（图表绑定所属工作表） */
  const visibleCharts = useMemo(
    () => charts.filter((item) => !item.sheetId || item.sheetId === activeSheetId),
    [charts, activeSheetId],
  );

  /** 装载一份快照并刷新派生状态（文档库 / 版本历史 / 导入共用） */
  const applySnapshot = useCallback(
    (snapshot: WorkbookSnapshot, nextTitle: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      handle.loadSnapshot(snapshot);
      setTitle(nextTitle);
      setFailure(null);
      setChartNotice(false);
      // 随快照保存的自有内容：条件格式 / 数据验证 + 图表 + 原生图表部件
      extrasRef.current = readWorkbookExtras(snapshot);
      rawPartsRef.current = snapshot.syntoolsRawParts ?? null;
      const configs = snapshot.syntoolsCharts ?? [];
      chartsRef.current = configs;
      setCharts(configs);
      setSelectedChartId(configs[0]?.id ?? null);
      applyChartData(handle.getSnapshot(), handle.getActiveSheetId());
      refreshSummary();
      refreshSheets();
    },
    [applyChartData, refreshSummary, refreshSheets],
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

  /** 按下拉所选格式限定文件对话框的默认过滤（仍可切到「所有文件」，类型校验在 handleImport 内） */
  const openImport = (accept: string) => {
    const input = importInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  };

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
    const result = await exportSnapshotToBytes(withDocOwnedContent(handle.getSnapshot()));
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

  const menus: EditorMenu[] = [
    {
      id: 'file',
      label: t('common.menuFile'),
      entries: [
        editorMenuItem('file-new', t('common.newDoc'), handleNew, { shortcut: '⌘N' }),
        editorMenuItem(
          'file-import-xlsx',
          t('tools.sheet.importXlsx'),
          () => openImport('.xlsx,.xlsm'),
          { disabled: busy !== null },
        ),
        editorMenuItem('file-import-csv', t('tools.sheet.importCsv'), () => openImport('.csv'), {
          disabled: busy !== null,
        }),
        { type: 'separator' },
        editorMenuItem('file-export-xlsx', t('tools.sheet.exportXlsx'), () => void handleExport(), {
          disabled: summary.cells === 0,
        }),
        editorMenuItem('file-export-csv', t('tools.sheet.exportCsv'), handleExportCsv, {
          disabled: summary.cells === 0,
        }),
        { type: 'separator' },
        editorMenuItem('file-library', t('tools.sheet.library'), openLibrary),
        editorMenuItem('file-versions', t('tools.sheet.versions'), openVersions, {
          disabled: !docId,
        }),
        { type: 'separator' },
        editorMenuItem('file-clear', t('common.clear'), handleClear, {
          danger: true,
          disabled: summary.cells === 0 && !title.trim(),
        }),
      ],
    },
    {
      id: 'insert',
      label: t('common.menuInsert'),
      entries: [editorMenuItem('insert-chart', t('tools.sheet.insertChart'), openChart)],
    },
  ];

  const statusText = draftSaved ? t('common.saved') : t('common.saving');
  const memory = useMemo(() => {
    let snapshot: unknown = null;
    try {
      snapshot = handleRef.current?.getSnapshot() ?? null;
    } catch {
      snapshot = null;
    }
    return formatBytes(estimateJsonBytes({ summary, snapshot }));
  }, [summary]);

  return (
    <div className="flex flex-col gap-4" data-tool-root>
      <EditorMenuBar
        menus={menus}
        ariaLabel={t('common.menuBar')}
        actions={
          <>
            <span
              role="status"
              title={statusText}
              aria-label={statusText}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                draftSaved
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={draftSaved ? 'check' : 'clock'} className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={summary.cells === 0 && !title.trim()}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
            <HintTip text={t('tools.sheet.unsupportedTip')} />
          </>
        }
        center={
          <input
            type="text"
            value={title}
            aria-label={t('tools.sheet.docTitle')}
            placeholder={t('tools.sheet.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
            className={EDITOR_TITLE_INPUT_CLASS}
          />
        }
        right={
          <>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('common.newDoc')}
              title={t('common.newDoc')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="sheet" className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="sheet-present"
              onClick={openPresent}
              aria-label={t('tools.sheet.present')}
              title={t('tools.sheet.present')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="present" className="h-4 w-4" />
            </button>
          </>
        }
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

      {chartNotice ? (
        <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
          {t('tools.sheet.chartEmpty')}
        </p>
      ) : null}

      {/* 工作表区域：图表以浮层形式贴在同一区域内，可拖动 / 缩放 / 改数据 */}
      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div
          ref={containerRef}
          className="sheet-canvas"
          style={sheetHeight ? { height: `${sheetHeight}px` } : undefined}
        />
        {visibleCharts.map((config) => (
          <ChartOverlay
            key={config.id}
            config={config}
            data={chartDataMap[config.id] ?? null}
            selected={config.id === selectedChartId}
            bounds={chartBounds}
            onSelect={() => setSelectedChartId(config.id)}
            onChange={(patch) => updateChart(config.id, patch)}
            onPickRange={() => pickRangeForChart(config.id)}
            onClose={() => removeChart(config.id)}
          />
        ))}
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

      <EditorStatusBar
        left={stats.map((item) => (
          <span key={item.label}>
            {item.label}: {item.value}
          </span>
        ))}
        right={<span>{t('common.memoryUsage', { size: memory })}</span>}
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
