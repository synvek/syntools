import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearButton, DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  CHART_TYPES,
  COLOR_SCHEME_IDS,
  DEFAULT_CHART_CSV,
  DEFAULT_CHART_OPTIONS,
  LEGEND_POSITIONS,
  generateChartSvg,
  getSchemeColors,
  isChartType,
  isColorSchemeId,
  isLegendPosition,
  parseChartData,
  svgToDataUrl,
  type ChartType,
  type ColorSchemeId,
  type LegendPosition,
} from './core';

/** 在线图表生成器（自研 SVG） */
export default function ChartGeneratorTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        d: DEFAULT_CHART_CSV,
        t: DEFAULT_CHART_OPTIONS.type,
        title: '',
        sl: DEFAULT_CHART_OPTIONS.seriesLabel,
        xl: '',
        yl: '',
        lg: DEFAULT_CHART_OPTIONS.legend,
        cs: DEFAULT_CHART_OPTIONS.colorScheme,
        w: DEFAULT_CHART_OPTIONS.width,
        h: DEFAULT_CHART_OPTIONS.height,
      }),
    [],
  );
  const [data, setData] = useState(String(init.d || DEFAULT_CHART_CSV));
  const [type, setType] = useState<ChartType>(
    isChartType(String(init.t)) ? (init.t as ChartType) : 'bar',
  );
  const [title, setTitle] = useState(String(init.title || ''));
  const [seriesLabel, setSeriesLabel] = useState(
    String(init.sl || DEFAULT_CHART_OPTIONS.seriesLabel),
  );
  const [xLabel, setXLabel] = useState(String(init.xl || ''));
  const [yLabel, setYLabel] = useState(String(init.yl || ''));
  const [legend, setLegend] = useState<LegendPosition>(
    isLegendPosition(String(init.lg)) ? (init.lg as LegendPosition) : 'top',
  );
  const [colorScheme, setColorScheme] = useState<ColorSchemeId>(
    isColorSchemeId(String(init.cs)) ? (init.cs as ColorSchemeId) : 'vibrant',
  );
  const [width, setWidth] = useState(Number(init.w) || 640);
  const [height, setHeight] = useState(Number(init.h) || 400);
  const previewRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseChartData(data), [data]);
  const svgResult = useMemo(() => {
    if (!parsed.ok) return parsed;
    return generateChartSvg(parsed.value, {
      type,
      width,
      height,
      title,
      seriesLabel,
      xLabel,
      yLabel,
      legend,
      colorScheme,
    });
  }, [parsed, type, width, height, title, seriesLabel, xLabel, yLabel, legend, colorScheme]);

  const svg = svgResult.ok ? svgResult.value : '';
  const schemePreview = getSchemeColors(colorScheme);
  const showAxes = type !== 'pie' && type !== 'doughnut';

  const downloadPng = async () => {
    if (!svg) return;
    const img = new Image();
    const url = svgToDataUrl(svg);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('load'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `chart-${type}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.type')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChartType)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CHART_TYPES.map((id) => (
              <option key={id} value={id}>
                {t(`tools.chartGenerator.types.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.title')}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-32 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.seriesLabel')}
          <input
            type="text"
            value={seriesLabel}
            onChange={(e) => setSeriesLabel(e.target.value)}
            className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.legend')}
          <select
            value={legend}
            onChange={(e) => setLegend(e.target.value as LegendPosition)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {LEGEND_POSITIONS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.chartGenerator.legends.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.colorScheme')}
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value as ColorSchemeId)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {COLOR_SCHEME_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.chartGenerator.schemes.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1" aria-hidden>
          {schemePreview.slice(0, 6).map((c) => (
            <span
              key={c}
              className="h-4 w-4 rounded-sm border border-black/10"
              style={{ background: c }}
            />
          ))}
        </div>
        <ClearButton onClick={() => setData('')} disabled={!data} />
        <ShareButton
          getState={() => ({
            d: data.slice(0, 1500),
            t: type,
            title,
            sl: seriesLabel,
            xl: xLabel,
            yl: yLabel,
            lg: legend,
            cs: colorScheme,
            w: width,
            h: height,
          })}
        />
      </OptionBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showAxes && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {t('tools.chartGenerator.xLabel')}
              <input
                type="text"
                value={xLabel}
                onChange={(e) => setXLabel(e.target.value)}
                placeholder={t('tools.chartGenerator.xLabelPlaceholder')}
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {t('tools.chartGenerator.yLabel')}
              <input
                type="text"
                value={yLabel}
                onChange={(e) => setYLabel(e.target.value)}
                placeholder={t('tools.chartGenerator.yLabelPlaceholder')}
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          </>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.width')}
          <input
            type="number"
            min={200}
            max={2000}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.chartGenerator.height')}
          <input
            type="number"
            min={160}
            max={2000}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IOTextArea
          label={t('tools.chartGenerator.data')}
          value={data}
          onChange={setData}
          placeholder={t('tools.chartGenerator.dataPlaceholder')}
          rows={14}
          actions={<CopyButton text={data} />}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.chartGenerator.preview')}
            </span>
            <div className="flex flex-wrap gap-2">
              <DownloadButton
                content={svg}
                filename={`chart-${type}.svg`}
                label={t('tools.chartGenerator.downloadSvg')}
              />
              <button
                type="button"
                onClick={() => void downloadPng()}
                disabled={!svg}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('tools.chartGenerator.downloadPng')}
              </button>
              {svg && <CopyButton text={svg} label={t('tools.chartGenerator.copySvg')} />}
            </div>
          </div>
          {data.trim() && !svgResult.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.chartGenerator.err.${svgResult.error}`)}
            </p>
          )}
          {svg && (
            <div
              ref={previewRef}
              className="overflow-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
