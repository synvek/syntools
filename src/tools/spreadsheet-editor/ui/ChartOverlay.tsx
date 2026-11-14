import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  CHART_LEGEND_LABEL_KEY,
  CHART_LEGEND_POSITIONS,
  CHART_TYPES,
  CHART_TYPE_LABEL_KEY,
  buildChartOption,
  buildRangeLabel,
  chartText,
  parseRangeLabel,
  supportsAxisTitles,
  supportsSecondaryAxis,
  type ChartConfig,
  type ChartData,
  type ChartLegendPosition,
  type ChartType,
} from '../charts';

/** Minimal ECharts instance interface (avoids a static echarts type import) */
interface ChartInstance {
  setOption: (option: unknown, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
  getDataURL: (options: { type: 'png'; pixelRatio?: number; backgroundColor?: string }) => string;
}

const TYPES: ChartType[] = CHART_TYPES;
const TYPE_LABEL_KEY: Record<ChartType, string> = CHART_TYPE_LABEL_KEY;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 200;

export interface ChartOverlayProps {
  config: ChartConfig;
  data: ChartData | null;
  selected: boolean;
  /** Sheet area size, used to clamp dragging / resizing */
  bounds: { width: number; height: number };
  onSelect: () => void;
  onChange: (patch: Partial<ChartConfig>) => void;
  /** Update the data range from the current sheet selection */
  onPickRange: () => void;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Floating chart on the sheet: sits above the sheet canvas and can be dragged, resized, and have its
 * data range and type changed.
 *
 * Dragging / resizing listens for pointer events on window (rather than setPointerCapture +
 * onPointerMove): pointer capture fails or drops events in some environments (automation, certain
 * browsers), while window listeners are more reliable.
 */
export function ChartOverlay({
  config,
  data,
  selected,
  bounds,
  onSelect,
  onChange,
  onPickRange,
  onClose,
}: ChartOverlayProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ChartInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rangeText, setRangeText] = useState(() => buildRangeLabel(config.range));
  /** P1-8 的格式化面板：与工具栏分开，避免把 7 个类型按钮挤到看不见 */
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Read the latest values inside gesture callbacks (avoids stale closures)
  const latest = useRef({ config, bounds, onChange });
  latest.current = { config, bounds, onChange };

  // Sync the input when the range changes from outside (e.g. "use selection")
  useEffect(() => {
    setRangeText(buildRangeLabel(config.range));
  }, [config.range]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    void (async () => {
      try {
        const [core, charts, components, renderers] = await Promise.all([
          import('echarts/core'),
          import('echarts/charts'),
          import('echarts/components'),
          import('echarts/renderers'),
        ]);
        if (cancelled) return;
        core.use([
          charts.BarChart,
          charts.LineChart,
          charts.PieChart,
          // 散点 / 雷达必须在 core.use 里注册，否则 setOption 会报"系列未导入"；
          // 面积图没有独立系列类型，复用 LineChart + areaStyle
          charts.ScatterChart,
          charts.RadarChart,
          components.GridComponent,
          components.TooltipComponent,
          components.LegendComponent,
          components.RadarComponent,
          renderers.CanvasRenderer,
        ]);
        const instance = core.init(host) as unknown as ChartInstance;
        instanceRef.current = instance;
        // Let ECharts recompute the canvas after a size change (drag-resize / window resize)
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(host);
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !data) return;
    instanceRef.current?.setOption(
      buildChartOption(data, config.type, {
        secondary: config.secondary,
        title: config.title,
        legend: config.legend,
        axisTitles: config.axisTitles,
        dataLabels: config.dataLabels,
        showGridlines: config.showGridlines,
      }),
      true,
    );
  }, [
    ready,
    data,
    config.type,
    config.secondary,
    config.title,
    config.legend,
    config.axisTitles,
    config.dataLabels,
    config.showGridlines,
  ]);

  /**
   * Attach pointermove / pointerup to window for the duration of a gesture.
   * Movement is computed from "geometry at gesture start + accumulated delta", so per-frame reads of
   * the latest value cannot compound the offset.
   */
  const beginGesture = (
    event: React.PointerEvent<HTMLElement>,
    compute: (total: { x: number; y: number }, start: ChartConfig) => Partial<ChartConfig> | null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const origin = { x: event.clientX, y: event.clientY };
    const start = { ...latest.current.config };
    const onMove = (move: PointerEvent) => {
      const patch = compute({ x: move.clientX - origin.x, y: move.clientY - origin.y }, start);
      if (patch) latest.current.onChange(patch);
    };
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    // Buttons and inputs in the header keep working normally
    if ((event.target as HTMLElement).closest('button, input')) return;
    beginGesture(event, (total, start) => {
      const area = latest.current.bounds;
      // The sheet area is a fixed-height overflow-hidden container, so keep the whole chart inside
      // it — otherwise clipping would put the resize handle out of reach.
      return {
        x: Math.round(clamp(start.x + total.x, 0, Math.max(0, area.width - start.width))),
        y: Math.round(clamp(start.y + total.y, 0, Math.max(0, area.height - start.height))),
      };
    });
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    beginGesture(event, (total, start) => {
      const area = latest.current.bounds;
      return {
        width: Math.round(
          clamp(start.width + total.x, MIN_WIDTH, Math.max(MIN_WIDTH, area.width - start.x)),
        ),
        height: Math.round(
          clamp(start.height + total.y, MIN_HEIGHT, Math.max(MIN_HEIGHT, area.height - start.y)),
        ),
      };
    });
  };

  const commitRange = () => {
    const parsed = parseRangeLabel(rangeText);
    if (!parsed) {
      setRangeText(buildRangeLabel(config.range));
      return;
    }
    onChange({ range: parsed });
  };

  /**
   * 轴标题的写入：两个输入框共用一个 `axisTitles`，清空后要把整个字段去掉，
   * 否则快照里会留下 `{ x: undefined }` 这种空壳（导出侧会当成"没有"，但比较起来很吵）。
   */
  const patchAxisTitles = (patch: { x?: string; y?: string }) => {
    const next = { ...config.axisTitles, ...patch };
    const cleaned =
      next.x || next.y
        ? { ...(next.x ? { x: next.x } : {}), ...(next.y ? { y: next.y } : {}) }
        : undefined;
    onChange({ axisTitles: cleaned });
  };

  const exportPng = () => {
    const instance = instanceRef.current;
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chart-${buildRangeLabel(config.range).replace(/[^\w-]+/g, '_')}.png`;
    anchor.click();
  };

  return (
    <section
      data-testid="sheet-chart-overlay"
      aria-label={t('tools.sheet.insertChart')}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      // z-50: Univer render layers bring their own z-index, so the overlay must sit above them to stay interactive
      className={`absolute z-50 flex flex-col overflow-hidden rounded-lg border bg-white shadow-lg dark:bg-gray-900 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/40'
          : 'border-gray-300 dark:border-gray-600'
      }`}
      style={{ left: config.x, top: config.y, width: config.width, height: config.height }}
    >
      <div
        onPointerDown={startDrag}
        title={t('tools.sheet.chartDragHint')}
        className="flex cursor-move flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-1.5 py-1 dark:border-gray-700 dark:bg-gray-800"
      >
        <span aria-hidden="true" className="px-0.5 text-gray-400">
          ⠿
        </span>
        <input
          type="text"
          aria-label={t('tools.sheet.chartRange')}
          value={rangeText}
          onChange={(event) => setRangeText(event.target.value)}
          onBlur={commitRange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitRange();
            }
          }}
          className="w-20 rounded border border-gray-300 bg-white px-1 py-0.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        />
        <button
          type="button"
          title={t('tools.sheet.chartUseSelection')}
          aria-label={t('tools.sheet.chartUseSelection')}
          onClick={onPickRange}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Icon name="grid" className="h-3.5 w-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          {TYPES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={config.type === item}
              title={t(`tools.sheet.${TYPE_LABEL_KEY[item]}`)}
              onClick={() => onChange({ type: item })}
              className={`h-6 rounded px-1.5 text-[11px] transition-colors ${
                config.type === item
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t(`tools.sheet.${TYPE_LABEL_KEY[item]}`)}
            </button>
          ))}
          {/* 次坐标轴只对柱/线/面积/组合有意义，且至少两个系列才有"主 + 次"可言 */}
          {supportsSecondaryAxis(config.type) && (data?.series.length ?? 0) > 1 ? (
            <button
              type="button"
              aria-pressed={config.secondary === true}
              title={t('tools.sheet.chartSecondaryHint')}
              onClick={() => onChange({ secondary: config.secondary !== true })}
              className={`h-6 rounded border px-1.5 text-[11px] transition-colors ${
                config.secondary
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-200 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t('tools.sheet.chartSecondary')}
            </button>
          ) : null}
          <button
            type="button"
            aria-pressed={settingsOpen}
            title={t('tools.sheet.chartSettings')}
            aria-label={t('tools.sheet.chartSettings')}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`flex h-6 w-6 items-center justify-center rounded ${
              settingsOpen
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span aria-hidden="true" className="text-xs leading-none">
              ⚙
            </span>
          </button>
          <button
            type="button"
            title={t('tools.sheet.chartExportPng')}
            aria-label={t('tools.sheet.chartExportPng')}
            onClick={exportPng}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t('tools.sheet.chartRemove')}
            aria-label={t('tools.sheet.chartRemove')}
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 图表设置（P1-8）：标题 / 图例位置 / 轴标题 / 数据标签 / 网格线 */}
      {settingsOpen ? (
        <div
          data-testid="sheet-chart-settings"
          className="absolute right-1.5 top-9 z-10 w-56 space-y-1.5 rounded-md border border-gray-300 bg-white p-2 text-[11px] text-gray-700 shadow-xl dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          <label className="block">
            <span className="block text-gray-500 dark:text-gray-400">
              {t('tools.sheet.chartTitleLabel')}
            </span>
            <input
              type="text"
              aria-label={t('tools.sheet.chartTitleLabel')}
              value={config.title ?? ''}
              placeholder={t('tools.sheet.chartTitlePlaceholder')}
              onChange={(event) => onChange({ title: chartText(event.target.value) })}
              className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-1">
            <span className="text-gray-500 dark:text-gray-400">
              {t('tools.sheet.chartLegendLabel')}
            </span>
            <select
              aria-label={t('tools.sheet.chartLegendLabel')}
              value={config.legend ?? 'bottom'}
              onChange={(event) => onChange({ legend: event.target.value as ChartLegendPosition })}
              className="rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900"
            >
              {CHART_LEGEND_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {t(`tools.sheet.${CHART_LEGEND_LABEL_KEY[position]}`)}
                </option>
              ))}
            </select>
          </label>
          {/* 饼图没有轴，雷达图的"轴"是各指标名：两者都不给轴标题输入（导出侧同样不写） */}
          {supportsAxisTitles(config.type) ? (
            <>
              <label className="block">
                <span className="block text-gray-500 dark:text-gray-400">
                  {t('tools.sheet.chartAxisX')}
                </span>
                <input
                  type="text"
                  aria-label={t('tools.sheet.chartAxisX')}
                  value={config.axisTitles?.x ?? ''}
                  onChange={(event) => patchAxisTitles({ x: chartText(event.target.value) })}
                  className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900"
                />
              </label>
              <label className="block">
                <span className="block text-gray-500 dark:text-gray-400">
                  {t('tools.sheet.chartAxisY')}
                </span>
                <input
                  type="text"
                  aria-label={t('tools.sheet.chartAxisY')}
                  value={config.axisTitles?.y ?? ''}
                  onChange={(event) => patchAxisTitles({ y: chartText(event.target.value) })}
                  className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-600 dark:bg-gray-900"
                />
              </label>
            </>
          ) : null}
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={config.dataLabels === true}
              onChange={(event) => onChange({ dataLabels: event.target.checked })}
            />
            <span>{t('tools.sheet.chartDataLabels')}</span>
          </label>
          {config.type !== 'pie' ? (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={config.showGridlines !== false}
                onChange={(event) => onChange({ showGridlines: event.target.checked })}
              />
              <span>{t('tools.sheet.chartGridlines')}</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} data-testid="sheet-chart-canvas" className="h-full w-full" />
        {!data || failed ? (
          <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-amber-600 dark:text-amber-400">
            {t('tools.sheet.chartEmpty')}
          </p>
        ) : null}
      </div>

      {/* Resize handle: bottom-right corner */}
      <div
        role="presentation"
        data-testid="sheet-chart-resize"
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize text-gray-400"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
          <path d="M15 9 9 15M15 13l-2 2" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </div>
    </section>
  );
}
