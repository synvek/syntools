import { useCallback, useRef, useState } from 'react';
import { createFidelityReport, isFidelityMuted, type FidelityReport } from '@/core/fidelity';
import { downloadBytes } from '@/core/pdf/download';
import type { ToolResult } from '@/core/types';
import { exportSheetPdf, printSheet, type CellRange, type PrintModelOptions } from '../print';
import { renderChartImages } from '../chartRender';
import { CSV_BOM, buildExportFilename, checkImportFile, sanitizeFilename } from '../core';
import { csvToSnapshot, snapshotToCsv } from '../csv';
import { odsToSnapshot } from '../ods';
import { exportSnapshotToBytes, importXlsxToSnapshot, type ImportOutcome } from '../xlsx-io';
import type { WorkbookSnapshot } from '../xlsx-io';
import { collectExportIssues } from '../fidelity';
import { appendPivotSheets } from '../pivotSheet';
import type { PivotBlock, PivotConfig } from '../pivot';
import type { ChartConfig, ChartData } from '../charts';
import type { SheetPrintOptions } from '../print';
import type { UniverHandle } from '../univer';

/**
 * 文件进出（P2-4 第 3 片）：导入 / 导出 xlsx·csv / 打印·导出 PDF，以及三者的"忙 / 失败 / 保真报告"。
 *
 * 这一块原来散在组件里、和"文档库""透视表""图表"互相伸手：光是 `handlePrint` 就同时读
 * `printTarget`、`printModelOptions`、`chartDataMap`、`title`。搬到 hook 后边界很清楚——
 *
 * - **不要**自己决定"这台机器上能不能落盘"：`downloadBytes` 是唯一的出口；
 * - **不要**自己造快照：进（`importXlsxToSnapshot`）出（`withDocOwnedContent` + `appendPivotSheets`）
 *   都走组件传进来的同一条路，否则打印与导出的内容会不一致；
 * - 失败一律回 `setFailure`（顶部的 `role="alert"`），不静默 catch。
 */

type BusyKind = 'import' | 'export' | null;
type Failure = Extract<ToolResult<unknown>, { ok: false }>;

/** 打印对话框打开时固定下来的那份内容：打开之后单元格再改也不影响这次打印 */
export interface SheetPrintTarget {
  snapshot: WorkbookSnapshot;
  sheetId: string | null;
  selection: CellRange | null;
}

export interface UseFileIoOptions {
  handleRef: { current: UniverHandle | null };
  /** 当前文档名：导出文件名与打印件标题都用它 */
  title: string;
  /** CSV 导入用的工作簿语言 */
  locale: 'zhCN' | 'enUS';
  /** 隐藏的 file input：`openImport` 只负责设置 accept 并点一下 */
  importInputRef: { current: HTMLInputElement | null };
  setBusy: (kind: BusyKind) => void;
  setFailure: (failure: Failure | null) => void;
  /** 把工具自有对象（图表 / 形状 / 图片 / 透视 …）合进快照 */
  withDocOwnedContent: (base: WorkbookSnapshot) => WorkbookSnapshot;
  applySnapshot: (snapshot: WorkbookSnapshot, title: string) => void;
  persistNow: (title?: string) => void;
  flushDocSave: () => void;
  /** 导出时把透视表写成额外工作表 */
  pivotConfigsRef: { current: PivotConfig[] };
  pivotValueLabelOf: (block: PivotBlock) => string;
  /** 图表位图：打印模型只吃位图，数据要和应用内渲染同源 */
  chartDataMap: Record<string, ChartData | null>;
  /** 透视表工作表的两处文案（空白值 / 值区标题），由调用方从 i18n 取 */
  pivotBlankLabel: string;
  pivotValuesCaption: string;
}

export interface FileIoApi {
  printTarget: SheetPrintTarget | null;
  /** 导入 / 导出的保真报告（同一个对话框，两个方向） */
  fidelity: FidelityReport | null;
  closeFidelity: () => void;
  closePrint: () => void;
  openImport: (accept: string) => void;
  importFile: (file: File) => Promise<void>;
  exportXlsx: () => Promise<void>;
  exportCsv: () => void;
  openPrint: () => void;
  print: (options: SheetPrintOptions, range: CellRange | null) => Promise<void>;
  exportPdf: (options: SheetPrintOptions, range: CellRange | null) => Promise<void>;
}

export function useSheetFileIo(options: UseFileIoOptions): FileIoApi {
  const [printTarget, setPrintTarget] = useState<SheetPrintTarget | null>(null);
  const [fidelity, setFidelity] = useState<FidelityReport | null>(null);

  // 回调与"最新的标题 / 图表数据"都走 ref：这些动作是异步的，await 之后不能再用旧的闭包
  const latest = useRef(options);
  latest.current = options;

  const closeFidelity = useCallback(() => setFidelity(null), []);
  const closePrint = useCallback(() => setPrintTarget(null), []);

  /** 只负责"把文件对话框限制到下拉里选的那一种"，真正的类型校验仍在 `checkImportFile` */
  const openImport = useCallback((accept: string) => {
    const input = latest.current.importInputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  }, []);

  const importFile = useCallback(async (file: File) => {
    const { setBusy, setFailure } = latest.current;
    setBusy('import');
    setFailure(null);
    // 先按扩展名分流：.csv 走纯逻辑解析器，.ods 走 OpenDocument 解析器，.xlsx/.xlsm 走 exceljs
    const check = checkImportFile(file);
    if (!check.ok) {
      setBusy(null);
      setFailure(check);
      return;
    }
    // 导入侧保真（P0-4）：这份"回收站"由 xlsx / ods 两条路径填，CSV 没有可报告的内容
    const outcome: ImportOutcome = { issues: [] };
    const result =
      check.value === 'csv'
        ? csvToSnapshot(await file.text(), file.name.replace(/\.csv$/i, ''), latest.current.locale)
        : check.value === 'ods'
          ? await odsToSnapshot(file, outcome)
          : await importXlsxToSnapshot(file, outcome);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const nextTitle = latest.current.title.trim() ? latest.current.title : result.value.name;
    latest.current.applySnapshot(result.value, nextTitle);
    latest.current.persistNow(nextTitle);
    // 导入是显式动作：库里的条目现在就要在，不等防抖
    latest.current.flushDocSave();
    // 和导出侧同一个对话框、相反方向：告诉用户这个文件里有什么是本编辑器留不住的
    if (outcome.issues.length > 0 && !isFidelityMuted()) {
      setFidelity(createFidelityReport('sheet', 'import', outcome.issues));
    }
  }, []);

  const exportXlsx = useCallback(async () => {
    const handle = latest.current.handleRef.current;
    // 实例还没建好：不是错误，什么都不做（也不要点亮进度条又立刻熄灭）
    if (!handle) return;
    const { setBusy, setFailure } = latest.current;
    setBusy('export');
    setFailure(null);
    const base = latest.current.withDocOwnedContent(handle.getSnapshot());
    // 透视表写进额外工作表：导出层会再注入原生 pivotTable part，
    // 支持不了的形态（多级列头 / 筛选 / 截断）保留静态值并由保真报告告警
    const snapshot = appendPivotSheets(
      base,
      latest.current.pivotConfigsRef.current,
      latest.current.pivotBlankLabel,
      latest.current.pivotValueLabelOf,
      latest.current.pivotValuesCaption,
    );
    const result = await exportSnapshotToBytes(snapshot);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    downloadBytes(
      result.value,
      buildExportFilename(latest.current.title || 'workbook', 'xlsx'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    setFidelity(
      isFidelityMuted()
        ? null
        : createFidelityReport('sheet', 'export', collectExportIssues(snapshot)),
    );
  }, []);

  /** 活动工作表 → CSV；开头的 BOM 让 Excel 正确识别中文 */
  const exportCsv = useCallback(() => {
    const handle = latest.current.handleRef.current;
    if (!handle) return;
    const { setFailure } = latest.current;
    setFailure(null);
    const result = snapshotToCsv(handle.getSnapshot(), handle.getActiveSheetId());
    if (!result.ok) {
      setFailure(result);
      return;
    }
    const bytes = new TextEncoder().encode(CSV_BOM + result.value);
    downloadBytes(
      bytes,
      buildExportFilename(latest.current.title || 'workbook', 'csv'),
      'text/csv;charset=utf-8',
    );
  }, []);

  /** 打开打印对话框：快照与选区在这里定格，之后编辑不影响这次打印 */
  const openPrint = useCallback(() => {
    const handle = latest.current.handleRef.current;
    if (!handle) return;
    const range = handle.getActiveRange();
    setPrintTarget({
      // 图片 / 图表 / 形状只存在于本工具自己的字段里，`getSnapshot()` 拿不到——
      // 不合并进来的话，打印与 PDF 永远是"只有格子"（P1-6）
      snapshot: latest.current.withDocOwnedContent(handle.getSnapshot()),
      sheetId: handle.getActiveSheetId(),
      selection: range
        ? {
            startRow: range.startRow,
            startColumn: range.startColumn,
            endRow: range.endRow,
            endColumn: range.endColumn,
          }
        : null,
    });
  }, []);

  /**
   * 打印用的图表位图：图表在应用内是 ECharts 画布，打印模型只吃位图，
   * 所以先离屏渲染一遍（同一份 `ChartConfig` + 同一份图表数据，和应用里看到的一致）。
   */
  const printModelOptions = useCallback(
    async (target: SheetPrintTarget): Promise<PrintModelOptions> => {
      const owner = (chart: ChartConfig): string =>
        chart.sheetId && target.snapshot.sheets?.[chart.sheetId]
          ? chart.sheetId
          : (target.snapshot.sheetOrder?.[0] ?? '');
      const charts = (target.snapshot.syntoolsCharts ?? []).filter(
        (chart) => owner(chart) === target.sheetId,
      );
      const chartImages = await renderChartImages(
        charts,
        (chart) => latest.current.chartDataMap[chart.id] ?? null,
      );
      return { chartImages };
    },
    [],
  );

  /** 打印；浏览器拦截弹窗时退回 PDF 导出（同一份模型，用户至少能拿到东西） */
  const print = useCallback(
    async (printOptions: SheetPrintOptions, range: CellRange | null) => {
      if (!printTarget) return;
      const { setBusy, setFailure } = latest.current;
      setFailure(null);
      setBusy('export');
      const modelOptions = await printModelOptions(printTarget);
      const result = await printSheet(
        printTarget.snapshot,
        printTarget.sheetId,
        printOptions,
        range,
        modelOptions,
      );
      if (result.ok) {
        setBusy(null);
        setPrintTarget(null);
        return;
      }
      if (result.error === 'PRINT_BLOCKED' || result.error === 'PRINT_UNSUPPORTED') {
        const pdf = await exportSheetPdf(
          printTarget.snapshot,
          printTarget.sheetId,
          printOptions,
          range,
          modelOptions,
        );
        setBusy(null);
        if (!pdf.ok) {
          setFailure(pdf);
          return;
        }
        downloadBytes(
          pdf.value,
          `${sanitizeFilename(latest.current.title || 'workbook')}.pdf`,
          'application/pdf',
        );
        setPrintTarget(null);
        return;
      }
      setBusy(null);
      setFailure(result);
    },
    [printModelOptions, printTarget],
  );

  /** 直接导出打印版式 PDF（纸张 / 方向 / 区域） */
  const exportPdf = useCallback(
    async (printOptions: SheetPrintOptions, range: CellRange | null) => {
      if (!printTarget) return;
      const { setBusy, setFailure } = latest.current;
      setFailure(null);
      setBusy('export');
      const modelOptions = await printModelOptions(printTarget);
      const result = await exportSheetPdf(
        printTarget.snapshot,
        printTarget.sheetId,
        printOptions,
        range,
        modelOptions,
      );
      setBusy(null);
      if (!result.ok) {
        setFailure(result);
        return;
      }
      downloadBytes(
        result.value,
        `${sanitizeFilename(latest.current.title || 'workbook')}.pdf`,
        'application/pdf',
      );
      setPrintTarget(null);
    },
    [printModelOptions, printTarget],
  );

  return {
    printTarget,
    fidelity,
    closeFidelity,
    closePrint,
    openImport,
    importFile,
    exportXlsx,
    exportCsv,
    openPrint,
    print,
    exportPdf,
  };
}
