import { useTranslation } from 'react-i18next';
import { createAdjustments } from '../model/factory';
import { Button, PanelSection, Slider } from './controls';
import { usePhotoStore } from '../store';
import type { Adjustments } from '../model/types';

const ROWS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'exposure', min: -100, max: 100 },
  { key: 'brightness', label: 'brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'saturation', min: -100, max: 100 },
  { key: 'temperature', label: 'temperature', min: -100, max: 100 },
  { key: 'hue', label: 'hue', min: -180, max: 180 },
  { key: 'sharpen', label: 'sharpen', min: 0, max: 100 },
];

/**
 * 调整面板：非破坏性参数，写回图层后由 `render/filters.ts` 统一烘焙，
 * 预览与导出共用同一条管线（所见即所得）。
 */
export function AdjustPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  if (!layer || layer.kind !== 'raster') {
    return (
      <div className="flex flex-col gap-2">
        <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('tools.photo.noLayer')}
        </p>
      </div>
    );
  }

  const value = layer.adjustments;

  return (
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => (
        <Slider
          key={row.key}
          label={t(`tools.photo.${row.label}`)}
          value={value[row.key]}
          min={row.min}
          max={row.max}
          onChange={(next) =>
            patchActive({ adjustments: { ...value, [row.key]: next } } as never, false)
          }
        />
      ))}
      <PanelSection>
        <Button
          onClick={() => patchActive({ adjustments: createAdjustments() } as never)}
          title={t('tools.photo.resetAdjust')}
        >
          {t('tools.photo.resetAdjust')}
        </Button>
      </PanelSection>
    </div>
  );
}
