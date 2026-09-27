import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { buildChartOption, type ChartData, type ChartType } from '../charts';

interface ChartPanelProps {
  data: ChartData;
  onClose: () => void;
}

/** ECharts 实例的最小接口（避免静态引入 echarts 类型） */
interface ChartInstance {
  setOption: (option: unknown, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
  getDataURL: (options: { type: 'png'; pixelRatio?: number; backgroundColor?: string }) => string;
}

const TYPES: ChartType[] = ['bar', 'line', 'pie'];

/**
 * 图表面板：按需加载 ECharts（独立 chunk，只有打开图表时才拉取），
 * 用选区的「分类 + 系列」渲染柱状 / 折线 / 饼图，支持导出 PNG。
 */
export function ChartPanel({ data, onClose }: ChartPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ChartInstance | null>(null);
  const [type, setType] = useState<ChartType>('bar');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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
        const instance = core.init(container) as unknown as ChartInstance;
        instanceRef.current = instance;
        observer = new ResizeObserver(() => instance.resize());
        observer.observe(container);
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

  // 数据 / 类型变化时整体替换配置（notMerge）
  useEffect(() => {
    if (!ready) return;
    instanceRef.current?.setOption(buildChartOption(data, type), true);
  }, [data, type, ready]);

  const exportPng = () => {
    const instance = instanceRef.current;
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chart-${data.rangeLabel.replace(/[^\w-]+/g, '_')}.png`;
    anchor.click();
  };

  return (
    <section
      data-testid="sheet-chart-panel"
      aria-label={t('tools.sheet.insertChart')}
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.sheet.insertChart')}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.chartRange')}: {data.rangeLabel}
        </span>

        <div className="ml-2 flex items-center gap-1">
          {TYPES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={type === item}
              onClick={() => setType(item)}
              className={`h-7 rounded-md border px-2 text-xs transition-colors ${
                type === item
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {t(`tools.sheet.chart${item === 'bar' ? 'Bar' : item === 'line' ? 'Line' : 'Pie'}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={exportPng}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name="download" className="h-3.5 w-3.5" />
          {t('tools.sheet.chartExportPng')}
        </button>
        <button
          type="button"
          aria-label={t('tools.sheet.chartBar')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        data-testid="sheet-chart-canvas"
        className="h-72 w-full"
        role="img"
        aria-label={`${t('tools.sheet.insertChart')} ${data.rangeLabel}`}
      />
      {failed ? (
        <p role="alert" className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {t('tools.sheet.chartEmpty')}
        </p>
      ) : null}
    </section>
  );
}
