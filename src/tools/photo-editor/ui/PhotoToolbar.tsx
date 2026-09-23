import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { clampBrushSize } from '../core';
import { SHAPE_KINDS } from '../core';
import { Button, IconTextButton, Slider } from './controls';
import { usePhotoStore } from '../store';
import type { ShapeKind } from '../model/types';

const SWATCHES = [
  '#111827',
  '#FFFFFF',
  '#DC2626',
  '#F59E0B',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#EC4899',
];

/**
 * 顶部工具参数条：随当前工具切换控件，右侧固定为缩放控件。
 * 滑杆拖动即时生效（历史在松手时由调用方补一次 commit，见各 onChange）。
 */
export function PhotoToolbar({
  onFit,
  onZoom,
  onActual,
}: {
  onFit: () => void;
  onZoom: (delta: number) => void;
  onActual: () => void;
}) {
  const { t } = useTranslation();
  const tool = usePhotoStore((s) => s.tool);
  const brush = usePhotoStore((s) => s.brush);
  const eraserSize = usePhotoStore((s) => s.eraserSize);
  const shapeKind = usePhotoStore((s) => s.shapeKind);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const cropRect = usePhotoStore((s) => s.cropRect);
  const patchBrush = usePhotoStore((s) => s.patchBrush);
  const setEraserSize = usePhotoStore((s) => s.setEraserSize);
  const setShapeKind = usePhotoStore((s) => s.setShapeKind);
  const setSelection = usePhotoStore((s) => s.setSelection);
  const applyCrop = usePhotoStore((s) => s.applyCrop);
  const setCropRect = usePhotoStore((s) => s.setCropRect);

  const zoomPercent = Math.round((scale || 1) * 100);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {tool === 'brush' || tool === 'eraser' || tool === 'fill' ? (
        <div className="flex items-center gap-1">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              onClick={() => patchBrush({ color })}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                brush.color.toUpperCase() === color
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            aria-label={t('tools.photo.color')}
            value={brush.color}
            onChange={(event) => patchBrush({ color: event.target.value.toUpperCase() })}
            className="ml-1 h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
          />
        </div>
      ) : null}

      {tool === 'brush' ? (
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Slider
              label={t('tools.photo.size')}
              value={brush.size}
              min={1}
              max={200}
              onChange={(value) => patchBrush({ size: clampBrushSize(value) })}
            />
          </div>
          <div className="w-28">
            <Slider
              label={t('tools.photo.hardness')}
              value={Math.round(brush.hardness * 100)}
              min={0}
              max={100}
              onChange={(value) => patchBrush({ hardness: value / 100 })}
              suffix="%"
            />
          </div>
          <div className="w-28">
            <Slider
              label={t('tools.photo.opacity')}
              value={Math.round(brush.opacity * 100)}
              min={0}
              max={100}
              onChange={(value) => patchBrush({ opacity: value / 100 })}
              suffix="%"
            />
          </div>
        </div>
      ) : null}

      {tool === 'eraser' ? (
        <div className="w-32">
          <Slider
            label={t('tools.photo.size')}
            value={eraserSize}
            min={1}
            max={200}
            onChange={(value) => setEraserSize(clampBrushSize(value))}
          />
        </div>
      ) : null}

      {tool === 'shape' ? (
        <div className="flex flex-wrap items-center gap-1">
          {SHAPE_KINDS.map((item) => (
            <IconTextButton
              key={item.id}
              icon="shapes"
              label={item.label}
              active={shapeKind === item.id}
              onClick={() => setShapeKind(item.id as ShapeKind)}
            />
          ))}
        </div>
      ) : null}

      {tool === 'rectSelect' || tool === 'ellipseSelect' || tool === 'lasso' ? (
        <div className="flex items-center gap-2">
          {selection ? (
            <Button onClick={() => setSelection(null)}>{t('tools.photo.deselect')}</Button>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('tools.photo.toolRectSelect')} / {t('tools.photo.toolLasso')}
            </span>
          )}
        </div>
      ) : null}

      {tool === 'crop' ? (
        <div className="flex items-center gap-2">
          <Button onClick={applyCrop} disabled={!cropRect} primary>
            {t('tools.photo.applyCrop')}
          </Button>
          <Button onClick={() => setCropRect(null)} disabled={!cropRect}>
            {t('tools.photo.cancelCrop')}
          </Button>
        </div>
      ) : null}

      {tool === 'move' || tool === 'hand' || tool === 'text' || tool === 'eyedropper' ? (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {tool === 'move' ? t('tools.photo.toolMove') : null}
          {tool === 'hand' ? t('tools.photo.toolHand') : null}
          {tool === 'text' ? t('tools.photo.openHint') : null}
          {tool === 'eyedropper' ? t('tools.photo.toolEyedropper') : null}
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <IconTextButton
          icon="search"
          title={t('tools.photo.zoomOut')}
          onClick={() => onZoom(-0.1)}
        />
        <span
          data-testid="photo-zoom"
          className="w-14 text-center font-mono text-xs text-gray-500 dark:text-gray-400"
        >
          {zoomPercent}%
        </span>
        <IconTextButton icon="search" title={t('tools.photo.zoomIn')} onClick={() => onZoom(0.1)} />
        <Button onClick={onFit}>{t('tools.photo.zoomFit')}</Button>
        <Button onClick={onActual}>
          <Icon name="globe" className="h-3.5 w-3.5" />
          {t('tools.photo.zoomActual')}
        </Button>
      </div>
    </div>
  );
}
