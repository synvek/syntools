import { buildChartOption, type ChartConfig, type ChartData } from './charts';

/**
 * ECharts 的 DOM 适配层。
 *
 * 存在的理由有两个：
 * 1. `ui/ChartOverlay.tsx`（应用内显示）与打印（离屏出图）需要**同一套**按需 import 的
 *    模块注册表——两边各抄一份 `core.use([...])` 迟早会漂移，表现为"应用里能画、打印里缺系列"。
 * 2. 打印是纯模型（`print.ts` 不碰 DOM），图表必须先变成位图才能进模型；这个转换放在这里，
 *    让 `print.ts` 继续保持可单测。
 */

/** ECharts 实例里我们真正用到的方法（不把 echarts 的类型带进调用方） */
export interface ChartRenderer {
  setOption(option: Record<string, unknown>, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
  getDataURL(options: { type: 'png'; pixelRatio: number; backgroundColor: string }): string;
}

export interface RendererSize {
  width: number;
  height: number;
}

/** 加载 echarts（按需动态 import，避免把整包打进首屏）并初始化到给定容器 */
export async function createChartRenderer(
  host: HTMLElement,
  size?: RendererSize,
): Promise<ChartRenderer> {
  const [core, chartModules, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([
    chartModules.BarChart,
    chartModules.LineChart,
    chartModules.PieChart,
    // 散点 / 雷达必须在 core.use 里注册，否则 setOption 会报"系列未导入"；
    // 面积图没有独立系列类型，复用 LineChart + areaStyle
    chartModules.ScatterChart,
    chartModules.RadarChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    // RadarComponent 是雷达图的坐标系，少了它雷达图只剩一个空画布
    components.RadarComponent,
    // TitleComponent 给 P1-8 的图表标题用；不注册则 option.title 被静默忽略
    components.TitleComponent,
    renderers.CanvasRenderer,
  ]);
  const instance = core.init(
    host,
    undefined,
    size ? { width: size.width, height: size.height } : undefined,
  );
  return instance as unknown as ChartRenderer;
}

/** 打印用的图表位图尺寸（px，@2x 输出，A4 正文宽度下不会糊） */
const PRINT_CHART_SIZE: RendererSize = { width: 640, height: 400 };

/**
 * 把图表批量渲染成 PNG dataURL（chartId → dataURL）。
 *
 * 单张失败（数据为空 / canvas 不可用 / 老浏览器）只是少一张图，**不让整次打印失败**；
 * 缺位图的图表在打印模型里会被整块跳过（见 `print.ts` 的 `collectPrintObjects`）。
 */
export async function renderChartImages(
  charts: readonly ChartConfig[],
  dataFor: (config: ChartConfig) => ChartData | null,
  size: RendererSize = PRINT_CHART_SIZE,
): Promise<Record<string, string>> {
  if (charts.length === 0 || typeof document === 'undefined') return {};
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${size.width}px`,
    height: `${size.height}px`,
    pointerEvents: 'none',
  });
  document.body.appendChild(host);
  const images: Record<string, string> = {};
  try {
    for (const config of charts) {
      const data = dataFor(config);
      if (!data) continue;
      let renderer: ChartRenderer | null = null;
      try {
        renderer = await createChartRenderer(host, size);
        renderer.setOption(
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
        images[config.id] = renderer.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
      } catch {
        // 一张图渲染不出来不该拖垮整次打印
      } finally {
        renderer?.dispose();
      }
    }
  } finally {
    host.remove();
  }
  return images;
}
