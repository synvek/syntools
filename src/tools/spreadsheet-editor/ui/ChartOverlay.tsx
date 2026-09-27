import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  buildChartOption,
  buildRangeLabel,
  parseRangeLabel,
  type ChartConfig,
  type ChartData,
  type ChartType,
} from '../charts';

/** ECharts 实例的最小接口（避免静态引入 echarts 类型） */
interface ChartInstance {
  setOption: (option: unknown, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
  getDataURL: (options: { type: 'png'; pixelRatio?: number; backgroundColor?: string }) => string;
}

const TYPES: ChartType[] = ['bar', 'line', 'pie'];
const TYPE_LABEL_KEY: Record<ChartType, string> = {
  bar: 'chartBar',
  line: 'chartLine',
  pie: 'chartPie',
};
const MIN_WIDTH = 260;
const MIN_HEIGHT = 200;

export interface ChartOverlayProps {
  config: ChartConfig;
  data: ChartData | null;
  selected: boolean;
  /** 工作表区域尺寸，用于拖拽 / 缩放的边界钳制 */
  bounds: { width: number; height: number };
  onSelect: () => void;
  onChange: (patch: Partial<ChartConfig>) => void;
  /** 用当前表格选区更新数据区域 */
  onPickRange: () => void;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * 工作表内的浮动图表：贴在工作表画布之上，可拖动、可缩放、可改数据区域与类型。
 *
 * 拖动 / 缩放用 window 级指针监听（而不是 setPointerCapture + onPointerMove）：
 * 指针捕获在部分环境（自动化、部分浏览器）下会失败或丢事件，window 监听更可靠。
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

  // 手势回调里读取最新值（避免闭包过期）
  const latest = useRef({ config, bounds, onChange });
  latest.current = { config, bounds, onChange };

  // 外部（如「用当前选区」）改动数据区域时同步输入框
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
          components.GridComponent,
          components.TooltipComponent,
          components.LegendComponent,
          renderers.CanvasRenderer,
        ]);
        const instance = core.init(host) as unknown as ChartInstance;
        instanceRef.current = instance;
        // 尺寸变化（拖拽缩放 / 窗口变化）后让 ECharts 重算画布
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
    instanceRef.current?.setOption(buildChartOption(data, config.type), true);
  }, [ready, data, config.type]);

  /**
   * 手势期间把 pointermove / pointerup 挂到 window。
   * 位移基于「手势开始时的几何 + 累计位移」计算，避免每帧读最新值导致位移叠加放大。
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
    // 头部内的按钮 / 输入框照常交互
    if ((event.target as HTMLElement).closest('button, input')) return;
    beginGesture(event, (total, start) => {
      const area = latest.current.bounds;
      // 工作表区域是固定高度的滚动容器（overflow-hidden），
      // 因此整块图表保持在区域内，避免被裁掉后缩放手柄不可达。
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
      // z-50：Univer 的渲染层自带 z-index，浮层必须显式高于它们才可交互
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

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} data-testid="sheet-chart-canvas" className="h-full w-full" />
        {!data || failed ? (
          <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-amber-600 dark:text-amber-400">
            {t('tools.sheet.chartEmpty')}
          </p>
        ) : null}
      </div>

      {/* 缩放手柄：右下角 */}
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
