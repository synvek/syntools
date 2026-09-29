import { useTranslation } from 'react-i18next';
import {
  CHART_TYPES,
  resizeChartCategories,
  resizeChartSeries,
  setChartLabel,
  setChartValue,
} from '../model/chart';
import type { ChartElement, ChartType } from '../model/types';
import { useSlideStore } from '../store';
import { ActionRow, Field, NumberInput, Section, SelectInput, TextInput } from './controls';

/**
 * 图表数据编辑器（属性面板内嵌）。
 *
 * 直接改模型里的 categories / series，导出 PPTX 时写成原生图表，
 * 因此在 PowerPoint 里拿到的是**可编辑数据**的图表而不是图片。
 */

const BTN =
  'h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

export function ChartEditor({ element }: { element: ChartElement }) {
  const { t } = useTranslation();
  const patchElement = useSlideStore((s) => s.patchElement);

  const apply = (next: ChartElement) =>
    patchElement(element.id, next as unknown as Partial<ChartElement>);

  return (
    <Section title={t('tools.slide.panelChart')}>
      <Field label={t('tools.slide.chartType')}>
        <SelectInput
          ariaLabel={t('tools.slide.chartType')}
          value={element.chartType}
          options={CHART_TYPES.map((item) => item.id)}
          labels={CHART_TYPES.map((item) => t(`tools.slide.${item.labelKey}`))}
          onChange={(value) => apply({ ...element, chartType: value as ChartType })}
        />
      </Field>
      <Field label={t('tools.slide.chartTitle')}>
        <TextInput
          ariaLabel={t('tools.slide.chartTitle')}
          value={element.title ?? ''}
          onChange={(title) => apply({ ...element, title })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.slide.chartCategories')}>
          <NumberInput
            ariaLabel={t('tools.slide.chartCategories')}
            value={element.categories.length}
            min={1}
            max={24}
            onChange={(count) => apply(resizeChartCategories(element, count))}
          />
        </Field>
        <Field label={t('tools.slide.chartSeries')}>
          <NumberInput
            ariaLabel={t('tools.slide.chartSeries')}
            value={element.series.length}
            min={1}
            max={12}
            onChange={(count) => apply(resizeChartSeries(element, count))}
          />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-gray-200 px-1 py-1 text-left font-medium dark:border-gray-600">
                {t('tools.slide.chartCategories')}
              </th>
              {element.series.map((series, index) => (
                <th
                  key={`head-${index}`}
                  className="border border-gray-200 px-1 py-1 font-medium dark:border-gray-600"
                >
                  <input
                    aria-label={`${t('tools.slide.chartSeries')} ${index + 1}`}
                    value={series.name}
                    onChange={(event) =>
                      apply(setChartLabel(element, 'series', index, event.target.value))
                    }
                    className="w-full bg-transparent text-center outline-none focus:text-blue-600"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {element.categories.map((category, categoryIndex) => (
              <tr key={`row-${categoryIndex}`}>
                <td className="border border-gray-200 px-1 py-1 dark:border-gray-600">
                  <input
                    aria-label={`${t('tools.slide.chartCategories')} ${categoryIndex + 1}`}
                    value={category}
                    onChange={(event) =>
                      apply(setChartLabel(element, 'category', categoryIndex, event.target.value))
                    }
                    className="w-full bg-transparent outline-none focus:text-blue-600"
                  />
                </td>
                {element.series.map((series, seriesIndex) => (
                  <td
                    key={`cell-${categoryIndex}-${seriesIndex}`}
                    className="border border-gray-200 px-1 py-1 dark:border-gray-600"
                  >
                    <input
                      type="number"
                      aria-label={`${series.name} ${category}`}
                      value={series.values[categoryIndex] ?? 0}
                      onChange={(event) =>
                        apply(
                          setChartValue(
                            element,
                            seriesIndex,
                            categoryIndex,
                            Number.parseFloat(event.target.value) || 0,
                          ),
                        )
                      }
                      className="w-full bg-transparent text-center outline-none focus:text-blue-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionRow>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            apply({
              ...element,
              options: { ...element.options, legend: !(element.options?.legend ?? true) },
            })
          }
        >
          {t('tools.slide.chartLegend')}: {(element.options?.legend ?? true) ? '✓' : '—'}
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            apply({
              ...element,
              options: { ...element.options, dataLabels: !element.options?.dataLabels },
            })
          }
        >
          {t('tools.slide.chartDataLabels')}: {element.options?.dataLabels ? '✓' : '—'}
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() =>
            apply({
              ...element,
              options: { ...element.options, gridLines: !(element.options?.gridLines ?? true) },
            })
          }
        >
          {t('tools.slide.chartGridLines')}: {(element.options?.gridLines ?? true) ? '✓' : '—'}
        </button>
      </ActionRow>
    </Section>
  );
}
