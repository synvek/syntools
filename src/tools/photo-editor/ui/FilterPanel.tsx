import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { FILTERS } from '../core';
import { usePhotoStore } from '../store';
import type { FilterId } from '../model/types';

const HINT_KEYS: Record<FilterId, string> = {
  grayscale: 'hintGrayscale',
  sepia: 'hintSepia',
  invert: 'hintInvert',
  blur: 'hintBlur',
  sharpen: 'hintSharpen',
  emboss: 'hintEmboss',
  edge: 'hintEdge',
  noise: 'hintNoise',
  pixelate: 'hintPixelate',
  posterize: 'hintPosterize',
};

/** 滤镜面板：可多选叠加，顺序即应用顺序（与 `render/filters.ts` 的管线一致）。 */
export function FilterPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  // 双模式：既可调「位图图层自带的调整」，也可调「调整图层」（后者作用于其下方全部内容）
  const adjustable =
    layer && (layer.kind === 'raster' || layer.kind === 'adjustment') ? layer : null;
  if (!adjustable) {
    return (
      <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.photo.noLayer')}
      </p>
    );
  }

  const active = adjustable.filters;

  const toggle = (id: FilterId) => {
    const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id];
    patchActive({ filters: next } as never);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {FILTERS.map((id) => {
        const on = active.includes(id);
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
                {t(`tools.photo.filter${id.charAt(0).toUpperCase()}${id.slice(1)}`)}
              </span>
            </span>
            <span className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">
              {t(`tools.photo.${HINT_KEYS[id]}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
