import { useTranslation } from 'react-i18next';
import { usePhotoStore } from '../store';
import { maskThumbnail } from '../render/mask';
import { CompactSlider } from './controls';
import type { Layer, MaskRef } from '../model/types';

/**
 * 蒙版小节：挂在「属性」标签页顶部，只作用于当前选中图层。
 *
 * 蒙版本身是灰度画布：画笔涂白 = 显示、涂黑 = 隐藏（`maskEditing` 切换笔迹落点），
 * 参数（启用 / 反相 / 浓度 / 羽化）都是非破坏性的——随时改、随时删。
 */
export function MaskPanel({ layer }: { layer: Layer }) {
  const { t } = useTranslation();
  const addMask = usePhotoStore((s) => s.addMask);
  const removeMask = usePhotoStore((s) => s.removeMask);
  const patchMask = usePhotoStore((s) => s.patchMask);
  const maskEditing = usePhotoStore((s) => s.maskEditing);
  const setMaskEditing = usePhotoStore((s) => s.setMaskEditing);
  const hasSelection = usePhotoStore((s) => s.selection !== null);

  const mask: MaskRef | null = layer.mask ?? null;

  if (!mask) {
    return (
      <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('tools.photo.mask')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MaskButton
            label={t('tools.photo.maskRevealAll')}
            onClick={() => addMask(layer.id, 'show')}
          />
          <MaskButton
            label={t('tools.photo.maskHideAll')}
            onClick={() => addMask(layer.id, 'hide')}
          />
          <MaskButton
            label={t('tools.photo.maskFromSelection')}
            disabled={!hasSelection}
            onClick={() => addMask(layer.id, 'selection')}
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-gray-400 dark:text-gray-500">
          {t('tools.photo.maskHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {t('tools.photo.mask')}
        </span>
        <div className="flex items-center gap-1">
          <MaskButton
            label={maskEditing ? t('tools.photo.maskEditing') : t('tools.photo.maskEdit')}
            active={maskEditing}
            testId="mask-edit-toggle"
            onClick={() => setMaskEditing(!maskEditing)}
          />
          <MaskButton
            label={t('tools.photo.maskRemove')}
            testId="mask-remove"
            danger
            onClick={() => removeMask(layer.id)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
          {maskThumbnail(mask) ? (
            <img
              src={maskThumbnail(mask) ?? undefined}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <MaskButton
            label={t('tools.photo.maskEnable')}
            active={mask.enabled}
            testId="mask-enable"
            onClick={() => patchMask(layer.id, { enabled: !mask.enabled })}
          />
          <MaskButton
            label={t('tools.photo.maskInvert')}
            active={mask.inverted}
            testId="mask-invert"
            onClick={() => patchMask(layer.id, { inverted: !mask.inverted })}
          />
        </div>
      </div>

      <div className="mt-1.5 space-y-1">
        <CompactSlider
          label={t('tools.photo.maskDensity')}
          value={Math.round(mask.density * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => patchMask(layer.id, { density: value / 100 }, false)}
        />
        <CompactSlider
          label={t('tools.photo.maskFeather')}
          value={Math.round(mask.feather)}
          min={0}
          max={64}
          suffix="px"
          onChange={(value) => patchMask(layer.id, { feather: value }, false)}
        />
      </div>
    </div>
  );
}

function MaskButton({
  label,
  onClick,
  disabled,
  active,
  danger,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
          : danger
            ? 'border-gray-200 text-red-500 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-950/40'
            : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
}
