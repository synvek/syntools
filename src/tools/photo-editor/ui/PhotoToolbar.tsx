import { useTranslation } from 'react-i18next';
import { clampBrushSize } from '../core';
import {
  GRADIENT_KINDS,
  GRADIENT_MODES,
  MAX_RETOUCH_STRENGTH,
  REPAIR_TOOLS,
  SHAPE_KINDS,
  TRANSFORM_MODES,
  needsCloneSource,
} from '../core';
import type { RepairTool } from '../core';
import { allBrushPresets } from '../brushes';
import { Button, IconTextButton, Select, Slider, ToggleChip } from './controls';
import { usePhotoStore } from '../store';

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
 * 顶部工具参数条：**最左固定「撤销 / 重做」**，中间随当前工具切换控件，右侧固定缩放控件。
 *
 * 撤销 / 重做放在这里而不是单独一行：它们与当前工具无关、任何时候都要可用，
 * 合并进本行后正好省下一整行高度（省下来的空间全部给画布）。
 * 滑杆拖动即时生效（历史在松手时由调用方补一次 commit，见各 onChange）。
 */
export function PhotoToolbar({
  onFit,
  onZoom,
  onActual,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  onFit: () => void;
  onZoom: (delta: number) => void;
  onActual: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  const setSelectionFeather = usePhotoStore((s) => s.setSelectionFeather);
  const wandTolerance = usePhotoStore((s) => s.wandTolerance);
  const wandContiguous = usePhotoStore((s) => s.wandContiguous);
  const setWand = usePhotoStore((s) => s.setWand);
  const fillTolerance = usePhotoStore((s) => s.fillTolerance);
  const fillContiguous = usePhotoStore((s) => s.fillContiguous);
  const setFill = usePhotoStore((s) => s.setFill);
  const gradientKind = usePhotoStore((s) => s.gradientKind);
  const gradientMode = usePhotoStore((s) => s.gradientMode);
  const setGradient = usePhotoStore((s) => s.setGradient);
  const retouchSize = usePhotoStore((s) => s.retouchSize);
  const retouchStrength = usePhotoStore((s) => s.retouchStrength);
  const setRetouch = usePhotoStore((s) => s.setRetouch);
  const cloneSource = usePhotoStore((s) => s.cloneSource);
  const setCloneSource = usePhotoStore((s) => s.setCloneSource);
  const transformMode = usePhotoStore((s) => s.transformMode);
  const setTransformMode = usePhotoStore((s) => s.setTransformMode);
  const resetMesh = usePhotoStore((s) => s.resetMesh);
  const brushPresets = usePhotoStore((s) => s.brushPresets);
  const applyBrushPreset = usePhotoStore((s) => s.applyBrushPreset);
  const saveBrushPreset = usePhotoStore((s) => s.saveBrushPreset);

  const isRetouchFamily =
    tool === 'dodge' ||
    tool === 'burn' ||
    tool === 'sponge' ||
    REPAIR_TOOLS.includes(tool as RepairTool);

  const presets = allBrushPresets(brushPresets);
  const presetLabel = (id: string, name?: string) =>
    name ?? t(`tools.photo.preset${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  const activePreset =
    presets.find(
      (preset) =>
        preset.size === brush.size &&
        Math.abs(preset.hardness - brush.hardness) < 0.01 &&
        Math.abs(preset.opacity - brush.opacity) < 0.01 &&
        Math.abs(preset.spacing - brush.spacing) < 0.005,
    )?.id ?? '';

  const zoomPercent = Math.round((scale || 1) * 100);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* 固定段：撤销 / 重做（与工具无关，始终可见可点） */}
      <div className="flex shrink-0 items-center gap-1">
        <IconTextButton
          icon="undo"
          title={t('tools.photo.undo')}
          onClick={onUndo}
          disabled={!canUndo}
          testId="photo-undo"
        />
        <IconTextButton
          icon="redo"
          title={t('tools.photo.redo')}
          onClick={onRedo}
          disabled={!canRedo}
          testId="photo-redo"
        />
        <span aria-hidden className="ml-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
      </div>

      {tool === 'brush' || tool === 'eraser' || tool === 'fill' || tool === 'gradient' ? (
        <div className="flex items-center gap-1">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              data-testid={`photo-swatch-${color}`}
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
          <div className="w-28">
            <Slider
              label={t('tools.photo.spacing')}
              value={Math.round(brush.spacing * 100)}
              min={2}
              max={200}
              onChange={(value) => patchBrush({ spacing: value / 100 })}
              suffix="%"
            />
          </div>
          <ToggleChip
            label={t('tools.photo.pressureSize')}
            active={brush.pressureSize}
            onClick={() => patchBrush({ pressureSize: !brush.pressureSize })}
          />
          <ToggleChip
            label={t('tools.photo.pressureOpacity')}
            active={brush.pressureOpacity}
            onClick={() => patchBrush({ pressureOpacity: !brush.pressureOpacity })}
          />
          <div className="w-36">
            <Select
              ariaLabel={t('tools.photo.presets')}
              value={activePreset}
              options={[
                { id: '', label: t('tools.photo.presets') },
                ...presets.map((preset) => ({
                  id: preset.id,
                  label: presetLabel(preset.id, preset.name),
                })),
              ]}
              onChange={(id) => {
                const preset = presets.find((item) => item.id === id);
                if (preset) applyBrushPreset(preset);
              }}
            />
          </div>
          <Button
            onClick={() =>
              saveBrushPreset(`${brush.size}px · ${Math.round(brush.hardness * 100)}%`)
            }
            title={t('tools.photo.savePreset')}
          >
            {t('tools.photo.savePreset')}
          </Button>
        </div>
      ) : null}

      {tool === 'fill' ? (
        <div className="flex items-center gap-3" data-testid="fill-bar">
          <div className="w-32">
            <Slider
              label={t('tools.photo.tolerance')}
              value={fillTolerance}
              min={0}
              max={255}
              onChange={(value) => setFill({ tolerance: value })}
            />
          </div>
          <ToggleChip
            label={t('tools.photo.contiguous')}
            active={fillContiguous}
            onClick={() => setFill({ contiguous: !fillContiguous })}
          />
        </div>
      ) : null}

      {tool === 'gradient' ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="gradient-bar">
          {GRADIENT_KINDS.map((kind) => (
            <ToggleChip
              key={kind}
              label={t(`tools.photo.gradientKind_${kind}`)}
              active={gradientKind === kind}
              onClick={() => setGradient({ kind })}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
          {GRADIENT_MODES.map((mode) => (
            <ToggleChip
              key={mode}
              label={t(`tools.photo.gradientMode_${mode === 'fg-bg' ? 'fgBg' : 'fgTransparent'}`)}
              active={gradientMode === mode}
              onClick={() => setGradient({ mode })}
            />
          ))}
        </div>
      ) : null}

      {isRetouchFamily ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="retouch-bar">
          <div className="w-32">
            <Slider
              label={t('tools.photo.size')}
              value={retouchSize}
              min={1}
              max={200}
              onChange={(value) => setRetouch({ size: clampBrushSize(value) })}
            />
          </div>
          <div className="w-28">
            <Slider
              label={t('tools.photo.strength')}
              value={retouchStrength}
              min={1}
              max={MAX_RETOUCH_STRENGTH}
              onChange={(value) => setRetouch({ strength: value })}
              suffix="%"
            />
          </div>
          {needsCloneSource(tool) ? (
            <>
              <span
                data-testid="clone-source-hint"
                className={`text-xs ${
                  cloneSource ? 'text-gray-500 dark:text-gray-400' : 'text-amber-500'
                }`}
              >
                {cloneSource ? t('tools.photo.cloneSourceSet') : t('tools.photo.cloneSourceHint')}
              </span>
              {cloneSource ? (
                <Button onClick={() => setCloneSource(null)}>
                  {t('tools.photo.cloneSourceClear')}
                </Button>
              ) : null}
            </>
          ) : null}
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
          {SHAPE_KINDS.map((id) => (
            <IconTextButton
              key={id}
              icon="shapes"
              label={t(`tools.photo.shape.${id}`)}
              active={shapeKind === id}
              onClick={() => setShapeKind(id)}
            />
          ))}
        </div>
      ) : null}

      {tool === 'rectSelect' ||
      tool === 'ellipseSelect' ||
      tool === 'lasso' ||
      tool === 'wand' ||
      tool === 'quickSelect' ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="selection-bar">
          {selection ? (
            <Button onClick={() => setSelection(null)}>{t('tools.photo.deselect')}</Button>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('tools.photo.selOpsHint')}
            </span>
          )}
          {selection ? (
            <div className="w-32">
              <Slider
                label={t('tools.photo.feather')}
                value={selection.feather}
                min={0}
                max={100}
                onChange={setSelectionFeather}
              />
            </div>
          ) : null}
          {tool === 'wand' || tool === 'quickSelect' ? (
            <>
              <div className="w-32">
                <Slider
                  label={t('tools.photo.tolerance')}
                  value={wandTolerance}
                  min={0}
                  max={255}
                  onChange={(value) => setWand({ tolerance: value })}
                />
              </div>
              <ToggleChip
                label={t('tools.photo.contiguous')}
                active={wandContiguous}
                onClick={() => setWand({ contiguous: !wandContiguous })}
              />
            </>
          ) : null}
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

      {tool === 'eyedropper' ? (
        <div className="flex items-center gap-2" data-testid="eyedropper-bar">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.photo.foreground')}
          </span>
          <span
            data-testid="foreground-swatch"
            className="h-6 w-6 rounded border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: brush.color }}
          />
          <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{brush.color}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.photo.eyedropperHint')}
          </span>
        </div>
      ) : null}

      {tool === 'transform' ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="transform-bar">
          {TRANSFORM_MODES.map((mode) => (
            <ToggleChip
              key={mode}
              label={t(`tools.photo.transformMode_${mode}`)}
              active={transformMode === mode}
              onClick={() => setTransformMode(mode)}
            />
          ))}
          <Button onClick={() => resetMesh()} title={t('tools.photo.transformReset')}>
            {t('tools.photo.transformReset')}
          </Button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.photo.transformHint')}
          </span>
        </div>
      ) : null}

      {tool === 'move' || tool === 'hand' || tool === 'text' ? (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {tool === 'move' ? t('tools.photo.toolMove') : null}
          {tool === 'hand' ? t('tools.photo.toolHand') : null}
          {tool === 'text' ? t('tools.photo.openHint') : null}
        </span>
      ) : null}

      {/* 缩放控件：全部走图标按钮，文字说明放 tooltip / aria-label */}
      <div className="ml-auto flex items-center gap-1">
        <IconTextButton
          icon="zoomOut"
          title={t('tools.photo.zoomOut')}
          onClick={() => onZoom(-0.1)}
        />
        <span
          data-testid="photo-zoom"
          className="w-14 text-center font-mono text-xs text-gray-500 dark:text-gray-400"
        >
          {zoomPercent}%
        </span>
        <IconTextButton icon="zoomIn" title={t('tools.photo.zoomIn')} onClick={() => onZoom(0.1)} />
        <IconTextButton
          icon="fitScreen"
          title={t('tools.photo.zoomFit')}
          onClick={onFit}
          testId="photo-fit"
        />
        <IconTextButton
          icon="actualSize"
          title={t('tools.photo.zoomActual')}
          onClick={onActual}
          testId="photo-actual"
        />
      </div>
    </div>
  );
}
