import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { FILTER_GROUPS, FILTER_PARAMS, defaultFilterParams, filterParam } from '../core';
import { IconTextButton, PanelSection, Slider, ToggleChip } from './controls';
import { usePhotoStore } from '../store';
import type { FilterId, FilterSpec } from '../model/types';

const HINT_KEYS: Record<FilterId, string> = {
  grayscale: 'hintGrayscale',
  sepia: 'hintSepia',
  invert: 'hintInvert',
  blur: 'hintBlur',
  gaussianBlur: 'hintGaussianBlur',
  motionBlur: 'hintMotionBlur',
  sharpen: 'hintSharpen',
  unsharp: 'hintUnsharp',
  emboss: 'hintEmboss',
  edge: 'hintEdge',
  noise: 'hintNoise',
  pixelate: 'hintPixelate',
  posterize: 'hintPosterize',
  twirl: 'hintTwirl',
  spherize: 'hintSpherize',
  pinch: 'hintPinch',
  findEdges: 'hintFindEdges',
  traceContour: 'hintTraceContour',
  clouds: 'hintClouds',
  lensFlare: 'hintLensFlare',
  reduceNoise: 'hintReduceNoise',
};

/** 分组标题的 i18n 键 */
const GROUP_KEYS: Record<string, string> = {
  basic: 'filterGroupBasic',
  blur: 'filterGroupBlur',
  sharpen: 'filterGroupSharpen',
  stylize: 'filterGroupStylize',
  distort: 'filterGroupDistort',
  render: 'filterGroupRender',
};

const cap = (id: string) => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/**
 * 滤镜面板：可多选叠加，顺序即应用顺序（与 `render/filters.ts` 的管线一致）。
 *
 * 「智能滤镜」栈：
 * - 每个滤镜可**单独停用**（`enabled: false`，保留参数）与**上移 / 下移**、删除；
 * - 智能对象（`kind: 'smart'`）同样携带这套滤镜栈，并且滤镜作用在**呈现尺寸**上，
 *   所以缩放智能对象不会让模糊半径等参数跟着缩放。
 */
export function FilterPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  // 位图 / 调整图层复用同一套滤镜栈；智能对象则是「智能滤镜」
  const target =
    layer && (layer.kind === 'raster' || layer.kind === 'adjustment' || layer.kind === 'smart')
      ? layer
      : null;
  if (!target) {
    return (
      <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.photo.noLayer')}
      </p>
    );
  }

  const active: FilterSpec[] = target.filters ?? [];

  const toggle = (id: FilterId) => {
    const exists = active.some((spec) => spec.id === id);
    const next = exists
      ? active.filter((spec) => spec.id !== id)
      : [...active, { id, params: defaultFilterParams(id) }];
    patchActive({ filters: next } as never);
  };

  const setParam = (index: number, key: string, value: number) => {
    patchActive(
      {
        filters: active.map((spec, i) =>
          i === index ? { ...spec, params: { ...spec.params, [key]: value } } : spec,
        ),
      } as never,
      false,
    );
  };

  const setEnabled = (index: number, enabled: boolean) => {
    patchActive({
      filters: active.map((spec, i) => (i === index ? { ...spec, enabled } : spec)),
    } as never);
  };

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= active.length) return;
    const next = [...active];
    [next[index], next[to]] = [next[to], next[index]];
    patchActive({ filters: next } as never);
  };

  const remove = (index: number) => {
    patchActive({ filters: active.filter((_, i) => i !== index) } as never);
  };

  return (
    <div className="flex flex-col gap-3">
      {FILTER_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t(`tools.photo.${GROUP_KEYS[group.id] ?? 'filterGroupBasic'}`)}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((id) => {
              const on = active.some((spec) => spec.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  title={t(`tools.photo.${HINT_KEYS[id]}`)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all duration-100 active:scale-[0.98] ${
                    on
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon
                      name={on ? 'check' : 'imageAdjust'}
                      className={`h-3.5 w-3.5 ${on ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {t(`tools.photo.filter${cap(id)}`)}
                    </span>
                  </span>
                  <span className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                    {t(`tools.photo.${HINT_KEYS[id]}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <PanelSection
        title={
          target.kind === 'smart' ? t('tools.photo.smartFilters') : t('tools.photo.filterStack')
        }
      >
        {target.kind === 'smart' ? (
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.smartFilterHint')}
          </p>
        ) : null}

        {active.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.photo.noFilters')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((spec, index) => {
              const name = t(`tools.photo.filter${cap(spec.id)}`);
              return (
                <li
                  key={`${spec.id}-${index}`}
                  data-testid={`filter-row-${spec.id}`}
                  className="rounded-lg border border-gray-200 p-2 dark:border-gray-800"
                >
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={spec.enabled !== false}
                      aria-label={`${t('tools.photo.filterToggle')} ${name}`}
                      onChange={() => setEnabled(index, spec.enabled === false)}
                      className="h-3.5 w-3.5 shrink-0 accent-blue-600"
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-xs font-medium ${
                        spec.enabled === false
                          ? 'text-gray-400 line-through dark:text-gray-500'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {name}
                    </span>
                    <IconTextButton
                      icon="chevron"
                      title={`${t('tools.photo.up')} ${name}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconTextButton
                      icon="chevron"
                      title={`${t('tools.photo.down')} ${name}`}
                      disabled={index === active.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <IconTextButton
                      icon="close"
                      title={`${t('tools.photo.delete')} ${name}`}
                      onClick={() => remove(index)}
                    />
                  </div>

                  {FILTER_PARAMS[spec.id].length > 0 ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {FILTER_PARAMS[spec.id].map((param) =>
                        param.key === 'mono' ? (
                          <ToggleChip
                            key={param.key}
                            label={t(`tools.photo.${param.label}`)}
                            active={filterParam(spec, param.key) >= 0.5}
                            onClick={() =>
                              setParam(
                                index,
                                param.key,
                                filterParam(spec, param.key) >= 0.5 ? 0 : 1,
                              )
                            }
                          />
                        ) : (
                          <Slider
                            key={param.key}
                            label={t(`tools.photo.${param.label}`)}
                            value={filterParam(spec, param.key)}
                            min={param.min}
                            max={param.max}
                            step={param.step ?? 1}
                            onChange={(value) => setParam(index, param.key, value)}
                          />
                        ),
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>
    </div>
  );
}
