import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { resolvePresetGeometry } from '../core';
import { CHART_TYPES, themePalette } from '../model/chart';
import {
  createChartElement,
  createFormulaElement,
  createIconElement,
  createShapeElement,
} from '../model/factory';
import { ICON_CATEGORIES, SLIDE_ICONS, iconSvg, type SlideIcon } from '../model/icons';
import { SHAPE_PRESETS } from '../model/shapes';
import { useSlideStore } from '../store';

/**
 * 插入面板：形状库 / 图表 / 图标 / 公式。
 *
 * 工具栏只放得下几个按钮，形状库（30+ prstGeom）与素材库需要一个宫格面板承载。
 * 面板本身不持有文档状态，插入动作一律走 store 的 addElement，撤销/重做与
 * 工具栏插入完全等价。
 */

export type InsertPanelTab = 'shape' | 'chart' | 'icon' | 'formula';
type Tab = InsertPanelTab;

const CARD =
  'flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white p-2 text-[11px] text-gray-600 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:text-blue-600 hover:shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300';
const TAB_BASE = 'h-7 flex-1 rounded-md text-[12px] transition-colors';

export function InsertPanel({
  initialTab = 'shape',
  onClose,
}: {
  initialTab?: InsertPanelTab;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const addElement = useSlideStore((s) => s.addElement);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [chartType, setChartType] = useState<string>('bar');
  const [iconCategory, setIconCategory] = useState<string>(ICON_CATEGORIES[0]);
  const [iconQuery, setIconQuery] = useState('');
  const [latex, setLatex] = useState('E = mc^2');

  const icons = useMemo<SlideIcon[]>(() => {
    const query = iconQuery.trim().toLowerCase();
    return SLIDE_ICONS.filter(
      (icon) =>
        icon.category === iconCategory &&
        (!query ||
          icon.label.toLowerCase().includes(query) ||
          icon.id.toLowerCase().includes(query)),
    );
  }, [iconCategory, iconQuery]);

  const insertShape = (prst: string) => {
    addElement({
      ...createShapeElement(doc, resolvePresetGeometry(prst)),
    });
    onClose();
  };

  const insertChart = () => {
    const type = CHART_TYPES.find((item) => item.id === chartType)?.id ?? 'bar';
    addElement(createChartElement(doc, type, themePalette(doc.theme.colors)));
    onClose();
  };

  const insertIcon = (iconId: string) => {
    addElement(createIconElement(doc, iconId));
    onClose();
  };

  const insertFormula = () => {
    addElement(createFormulaElement(doc, latex.trim() || 'E = mc^2'));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('tools.slide.insertPanelTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('tools.slide.outlineCancel')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {(['shape', 'chart', 'icon', 'formula'] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`${TAB_BASE} ${
                tab === item
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {item === 'shape'
                ? t('tools.slide.insertShape')
                : item === 'chart'
                  ? t('tools.slide.insertChart')
                  : item === 'icon'
                    ? t('tools.slide.insertIcon')
                    : t('tools.slide.insertFormula')}
            </button>
          ))}
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {tab === 'shape' ? (
            <div className="grid grid-cols-6 gap-2">
              {SHAPE_PRESETS.map((preset) => (
                <button
                  key={preset.prst}
                  type="button"
                  onClick={() => insertShape(preset.prst)}
                  className={CARD}
                  title={t(`tools.slide.${preset.labelKey}`)}
                >
                  <ShapeThumb prst={preset.prst} />
                  <span className="truncate">{t(`tools.slide.${preset.labelKey}`)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'chart' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {CHART_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChartType(item.id)}
                    className={`${CARD} ${
                      chartType === item.id
                        ? 'border-blue-500 text-blue-600 ring-1 ring-blue-200'
                        : ''
                    }`}
                  >
                    <ChartThumb type={item.id} />
                    <span className="truncate">{t(`tools.slide.${item.labelKey}`)}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={insertChart}
                className="h-9 self-end rounded-md bg-blue-600 px-4 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t('tools.slide.insertChart')}
              </button>
            </div>
          ) : null}

          {tab === 'icon' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {ICON_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setIconCategory(category)}
                    className={`h-7 rounded-md border px-2 text-[11px] transition-colors ${
                      iconCategory === category
                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950'
                        : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
                <input
                  value={iconQuery}
                  onChange={(event) => setIconQuery(event.target.value)}
                  aria-label={t('tools.slide.iconSearch')}
                  placeholder={t('tools.slide.iconSearch')}
                  className="h-7 flex-1 rounded-md border border-gray-300 bg-white px-2 text-[12px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-8 gap-2">
                {icons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => insertIcon(icon.id)}
                    className={CARD}
                    title={icon.label}
                  >
                    <span
                      className="h-6 w-6"
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: iconSvg(icon) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'formula' ? (
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-gray-600 dark:text-gray-300">
                {t('tools.slide.formulaLabel')}
              </label>
              <textarea
                value={latex}
                onChange={(event) => setLatex(event.target.value)}
                rows={3}
                aria-label={t('tools.slide.formulaLabel')}
                className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-[12px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('tools.slide.formulaHint')}
              </p>
              <button
                type="button"
                onClick={insertFormula}
                className="h-9 self-end rounded-md bg-blue-600 px-4 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t('tools.slide.insertFormula')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 形状缩略图：用内联 SVG 画一个 24×24 的简化轮廓 */
function ShapeThumb({ prst }: { prst: string }) {
  const geometry = resolvePresetGeometry(prst);
  const common = { fill: 'currentColor', stroke: 'none' } as const;
  let inner: JSX.Element;
  if (geometry.kind === 'ellipse') {
    inner = <ellipse cx="12" cy="12" rx="11" ry="9" {...common} />;
  } else if (geometry.kind === 'star') {
    const points = Array.from({ length: 10 }, (_, index) => {
      const radius = index % 2 === 0 ? 11 : 11 * (geometry.innerRatio ?? 0.382);
      const angle = (Math.PI * index) / 5 - Math.PI / 2;
      return `${(12 + Math.cos(angle) * radius).toFixed(2)},${(12 + Math.sin(angle) * radius).toFixed(2)}`;
    }).join(' ');
    inner = <polygon points={points} {...common} />;
  } else if (geometry.kind === 'polygon' && geometry.points) {
    const points: string[] = [];
    for (let i = 0; i < geometry.points.length; i += 2) {
      points.push(
        `${(geometry.points[i]! * 24).toFixed(2)},${(geometry.points[i + 1]! * 24).toFixed(2)}`,
      );
    }
    inner = <polygon points={points.join(' ')} {...common} />;
  } else {
    inner = (
      <rect
        x="1"
        y="3"
        width="22"
        height="18"
        rx={geometry.radius ? geometry.radius * 24 : 2}
        {...common}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-500" aria-hidden>
      {inner}
    </svg>
  );
}

/** 图表类型缩略图 */
function ChartThumb({ type }: { type: string }) {
  const bars = (
    <>
      <rect x="2" y="12" width="4" height="10" />
      <rect x="8" y="7" width="4" height="15" />
      <rect x="14" y="3" width="4" height="19" />
    </>
  );
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-blue-500" fill="currentColor" aria-hidden>
      {type === 'line' ? (
        <polyline points="2,18 8,10 14,14 22,4" fill="none" stroke="currentColor" strokeWidth="2" />
      ) : type === 'area' ? (
        <polygon points="2,18 8,10 14,14 22,4 22,20 2,20" opacity="0.35" />
      ) : type === 'pie' || type === 'doughnut' ? (
        <>
          <path d="M12 3a9 9 0 1 0 9 9h-9z" />
          {type === 'doughnut' ? <circle cx="12" cy="12" r="4" fill="#fff" /> : null}
        </>
      ) : type === 'scatter' ? (
        <>
          <circle cx="5" cy="17" r="2" />
          <circle cx="11" cy="10" r="2" />
          <circle cx="17" cy="6" r="2" />
          <circle cx="20" cy="15" r="2" />
        </>
      ) : type === 'radar' ? (
        <polygon
          points="12,3 21,10 17,20 7,20 3,10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : (
        bars
      )}
    </svg>
  );
}
