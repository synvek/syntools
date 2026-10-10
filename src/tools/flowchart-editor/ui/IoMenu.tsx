import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { useFlowStore } from '../store';
import {
  DEFAULT_PRINT_OPTIONS,
  DEFAULT_RASTER_OPTIONS,
  EXPORT_KINDS,
  IMPORT_ACCEPT,
  PADDING_MAX,
  PADDING_MIN,
  PAPER_OPTIONS,
  SCALE_OPTIONS,
  capturePage,
  exportPrintPdf,
  exportPrintPdfSet,
  exportRaster,
  exportRasterSet,
  exportText,
  exportVectorSvg,
  pageHasFormula,
  parseImportedFileAsync,
  type CapturedPage,
  type ExportKind,
  type ExportRange,
  type PaperSize,
  type PrintOptions,
  type RasterExportOptions,
  type RasterFormat,
} from '../io';

const TEXT_KINDS: ExportKind[] = ['project', 'drawio', 'mermaid'];

const RANGE_OPTIONS: ExportRange[] = ['selection', 'current', 'all'];

/** 等待一次「画布已按新页面重绘」（两次 rAF + 微延时，覆盖 React 提交与节点测量） */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 30);
      });
    });
  });
}

interface IoMenuProps {
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (message: string | null) => void;
  /** 受控展开态（快捷键 Ctrl+P / Ctrl+E 打开导出面板时使用）；缺省则组件内部自管 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function IoMenu({ busy, setBusy, onError, open: openProp, onOpenChange }: IoMenuProps) {
  const { t } = useTranslation();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [options, setOptions] = useState<RasterExportOptions>(DEFAULT_RASTER_OPTIONS);
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageCount = useFlowStore((s) => s.pageOrder.length);

  const rangeLabel = (range: ExportRange) =>
    range === 'selection'
      ? t('tools.flowchart.onlySelected')
      : range === 'all'
        ? t('tools.flowchart.rangeAll')
        : t('tools.flowchart.rangeCurrent');

  /**
   * 逐页导出：切到每一页 → 等重绘 → 截图；结束后切回原页。
   * 非活动页并未渲染在 DOM 中，只能逐页激活后截图（保证保真度与画布一致）。
   */
  const captureAllPages = async (opts: RasterExportOptions): Promise<CapturedPage[]> => {
    const store = useFlowStore.getState();
    const originalId = store.activePageId;
    const pages = [...store.pageOrder];
    const captured: CapturedPage[] = [];
    try {
      for (const page of pages) {
        if (useFlowStore.getState().activePageId !== page.id) {
          useFlowStore.getState().switchPage(page.id);
          await nextPaint();
        }
        const shot = await capturePage(page.name, useFlowStore.getState().nodes, opts);
        if (shot) captured.push(shot);
      }
    } finally {
      if (useFlowStore.getState().activePageId !== originalId) {
        useFlowStore.getState().switchPage(originalId);
      }
    }
    return captured;
  };

  const reportError = (code: string) => {
    onError(
      code === 'EMPTY' ? t('tools.flowchart.err.EMPTY') : t('tools.flowchart.err.EXPORT_FAILED'),
    );
  };

  const runExport = async (kind: ExportKind) => {
    setOpen(false);
    onError(null);
    const state = useFlowStore.getState();
    // 导出文件名取自工具栏的文档标题
    const filename = state.docName.trim() || 'flowchart';

    if (TEXT_KINDS.includes(kind)) {
      // Mermaid 无栅格概念：导出范围中的「全部页」映射为多段 flowchart
      const ok = exportText(state.getDoc(), kind, filename, {
        mermaidPages: options.range === 'all' ? 'all' : 'current',
      });
      if (!ok) onError(t('tools.flowchart.err.EXPORT_FAILED'));
      return;
    }

    const opts: RasterExportOptions = { ...options, format: kind as RasterFormat };

    // SVG：优先自绘矢量（真矢量、文字可选、无需逐页切换）；
    // 公式节点无法矢量化为 SVG 文本，含公式时回退到 DOM 截图路径。
    if (kind === 'svg') {
      const doc = state.getDoc();
      const selection = opts.range === 'selection' ? [...state.selectedNodes] : undefined;
      const relevant =
        opts.range === 'all'
          ? doc.pages
          : ([doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0]].filter(
              Boolean,
            ) as typeof doc.pages);
      if (!relevant.some(pageHasFormula)) {
        setBusy(true);
        try {
          const result = await exportVectorSvg(doc, filename, {
            range: opts.range,
            padding: opts.padding,
            transparent: opts.transparent,
            selection,
          });
          if (result.ok) return;
        } finally {
          setBusy(false);
        }
      }
    }

    setBusy(true);
    try {
      if (opts.range === 'all' && state.pageOrder.length > 1) {
        const captured = await captureAllPages(opts);
        if (captured.length === 0) {
          reportError('EMPTY');
          return;
        }
        const result = await exportRasterSet(captured, opts, filename);
        if (!result.ok) reportError(result.error);
        return;
      }

      const nodes =
        opts.range === 'selection'
          ? state.nodes.filter((n) => state.selectedNodes.includes(n.id))
          : state.nodes;
      const result = await exportRaster(nodes, opts, filename);
      if (!result.ok) reportError(result.error);
    } finally {
      setBusy(false);
    }
  };

  /** 分页打印：整图按纸张切片导出多页 PDF；范围=全部页时逐页切片合并 */
  const runPrint = async () => {
    setOpen(false);
    onError(null);
    const state = useFlowStore.getState();
    const filename = state.docName.trim() || 'flowchart';
    setBusy(true);
    try {
      if (options.range === 'all' && state.pageOrder.length > 1) {
        // 打印截图参数固定为 PNG（print.ts 内部按 PNG 贴图），倍率取打印清晰度
        const captured = await captureAllPages({
          ...options,
          format: 'png',
          scale: printOptions.scale,
          transparent: false,
          padding: 8,
          range: 'current',
        });
        if (captured.length === 0) {
          reportError('EMPTY');
          return;
        }
        const result = await exportPrintPdfSet(captured, printOptions, filename);
        if (!result.ok) reportError(result.error);
        return;
      }
      const result = await exportPrintPdf(state.nodes, printOptions, filename);
      if (!result.ok) reportError(result.error);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onError(null);
    const text = await file.text();
    const doc = await parseImportedFileAsync(file.name, text);
    if (!doc) {
      onError(t('tools.flowchart.err.IMPORT_FAILED'));
      return;
    }
    useFlowStore.getState().load(doc);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" />
          {busy ? t('tools.flowchart.exporting') : t('tools.flowchart.exportPanel')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title={t('tools.flowchart.importHint')}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="upload" className="h-4 w-4" />
          {t('tools.flowchart.importFile')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={IMPORT_ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {open ? (
        <div className="absolute right-0 top-9 z-30 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="px-1 pb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {t('tools.flowchart.exportPanel')}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {EXPORT_KINDS.map((meta) => (
              <button
                key={meta.kind}
                type="button"
                data-testid={`flowchart-export-${meta.kind}`}
                onClick={() => void runExport(meta.kind)}
                className="rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-500/10"
              >
                {meta.ext}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
            <label className="flex items-center justify-between px-1 text-[12px] text-gray-600 dark:text-gray-300">
              <span>{t('tools.flowchart.exportRange')}</span>
              <select
                data-testid="flowchart-export-range"
                value={options.range}
                onChange={(e) => setOptions({ ...options, range: e.target.value as ExportRange })}
                className="h-7 rounded-md border border-gray-200 bg-white px-1 text-[12px] dark:border-gray-700 dark:bg-gray-800"
              >
                {RANGE_OPTIONS.map((r) => (
                  <option key={r} value={r} disabled={r === 'all' && pageCount < 2}>
                    {rangeLabel(r)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between px-1 text-[12px] text-gray-600 dark:text-gray-300">
              <span>{t('tools.flowchart.scale')}</span>
              <select
                value={options.scale}
                onChange={(e) => setOptions({ ...options, scale: Number(e.target.value) })}
                className="h-7 rounded-md border border-gray-200 bg-white px-1 text-[12px] dark:border-gray-700 dark:bg-gray-800"
              >
                {SCALE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 px-1 text-[12px] text-gray-600 dark:text-gray-300">
              <span className="flex items-center justify-between">
                <span>{t('tools.flowchart.padding')}</span>
                <span className="tabular-nums text-gray-400">{options.padding}px</span>
              </span>
              <input
                type="range"
                min={PADDING_MIN}
                max={PADDING_MAX}
                step={4}
                value={options.padding}
                onChange={(e) => setOptions({ ...options, padding: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </label>

            <label className="flex items-center gap-2 px-1 text-[12px] text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={options.transparent}
                onChange={(e) => setOptions({ ...options, transparent: e.target.checked })}
              />
              {t('tools.flowchart.transparentBg')}
            </label>

            {/* 分页打印：按纸张尺寸切分成多页 PDF */}
            <div className="flex items-center gap-1.5 border-t border-gray-100 px-1 pt-2 dark:border-gray-800">
              <select
                data-testid="flowchart-print-paper"
                value={printOptions.paper}
                onChange={(e) =>
                  setPrintOptions({ ...printOptions, paper: e.target.value as PaperSize })
                }
                className="h-7 rounded-md border border-gray-200 bg-white px-1 text-[12px] dark:border-gray-700 dark:bg-gray-800"
              >
                {PAPER_OPTIONS.map((paper) => (
                  <option key={paper} value={paper}>
                    {paper.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title={t('tools.flowchart.printLandscape')}
                aria-label={t('tools.flowchart.printLandscape')}
                onClick={() =>
                  setPrintOptions({ ...printOptions, landscape: !printOptions.landscape })
                }
                className="h-7 w-8 rounded-md border border-gray-200 bg-white text-[12px] dark:border-gray-700 dark:bg-gray-800"
              >
                {printOptions.landscape ? '↔' : '↕'}
              </button>
              <button
                type="button"
                data-testid="flowchart-print-pdf"
                onClick={() => void runPrint()}
                className="h-7 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[12px] text-gray-700 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-blue-500/10"
              >
                {t('tools.flowchart.exportPrintPdf')}
              </button>
            </div>

            <p className="px-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
              {t('tools.flowchart.importHint')}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
