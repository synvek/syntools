import { useTranslation } from 'react-i18next';
import { STYLE_EFFECTS, isEffectActive } from '../core';
import type { StyleEffectId } from '../core';
import { usePhotoStore } from '../store';
import { Button, PanelSection, Slider, ToggleChip } from './controls';
import type {
  ColorOverlayStyle,
  DropShadowStyle,
  InnerShadowStyle,
  OuterGlowStyle,
  StrokePosition,
  StrokeStyle,
} from '../model/types';

/**
 * Layer style panel: drop shadow / inner shadow / outer glow / stroke / color overlay.
 *
 * Interaction conventions:
 * - the checkbox toggles an effect and `×` removes it (both are separate history steps);
 * - while dragging a slider pass `history = false` (as in AdjustPanel) so no history entry is pushed per frame.
 */

type Patch = Record<string, string | number | boolean>;
type Setter = (patch: Patch, history?: boolean) => void;

const STROKE_POSITIONS: StrokePosition[] = ['outside', 'center', 'inside'];

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
      />
    </div>
  );
}

function OpacitySlider({ value, set }: { value: number; set: Setter }) {
  const { t } = useTranslation();
  return (
    <Slider
      label={t('tools.photo.fxOpacity')}
      value={Math.round(value * 100)}
      min={0}
      max={100}
      suffix="%"
      onChange={(next) => set({ opacity: next / 100 })}
    />
  );
}

function ShadowRows({
  effect,
  set,
  withSpread,
}: {
  effect: DropShadowStyle | InnerShadowStyle;
  set: Setter;
  withSpread: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ColorRow
        label={t('tools.photo.fxColor')}
        value={effect.color}
        onChange={(color) => set({ color }, true)}
      />
      <OpacitySlider value={effect.opacity} set={set} />
      <Slider
        label={t('tools.photo.fxAngle')}
        value={effect.angle}
        min={-180}
        max={180}
        suffix="°"
        onChange={(value) => set({ angle: value })}
      />
      <Slider
        label={t('tools.photo.fxDistance')}
        value={effect.distance}
        min={0}
        max={200}
        onChange={(value) => set({ distance: value })}
      />
      {withSpread ? (
        <Slider
          label={t('tools.photo.fxSpread')}
          value={(effect as DropShadowStyle).spread}
          min={0}
          max={100}
          onChange={(value) => set({ spread: value })}
        />
      ) : null}
      <Slider
        label={t('tools.photo.fxSize')}
        value={effect.size}
        min={0}
        max={200}
        onChange={(value) => set({ size: value })}
      />
    </>
  );
}

function GlowRows({ effect, set }: { effect: OuterGlowStyle; set: Setter }) {
  const { t } = useTranslation();
  return (
    <>
      <ColorRow
        label={t('tools.photo.fxColor')}
        value={effect.color}
        onChange={(color) => set({ color }, true)}
      />
      <OpacitySlider value={effect.opacity} set={set} />
      <Slider
        label={t('tools.photo.fxSize')}
        value={effect.size}
        min={0}
        max={200}
        onChange={(value) => set({ size: value })}
      />
    </>
  );
}

function StrokeRows({ effect, set }: { effect: StrokeStyle; set: Setter }) {
  const { t } = useTranslation();
  return (
    <>
      <ColorRow
        label={t('tools.photo.fxColor')}
        value={effect.color}
        onChange={(color) => set({ color }, true)}
      />
      <Slider
        label={t('tools.photo.fxSize')}
        value={effect.size}
        min={0}
        max={100}
        onChange={(value) => set({ size: value })}
      />
      <OpacitySlider value={effect.opacity} set={set} />
      <div className="flex flex-wrap items-center gap-1">
        {STROKE_POSITIONS.map((position) => (
          <ToggleChip
            key={position}
            label={t(`tools.photo.fxPos_${position}`)}
            active={effect.position === position}
            onClick={() => set({ position }, true)}
          />
        ))}
      </div>
    </>
  );
}

function OverlayRows({ effect, set }: { effect: ColorOverlayStyle; set: Setter }) {
  const { t } = useTranslation();
  return (
    <>
      <ColorRow
        label={t('tools.photo.fxColor')}
        value={effect.color}
        onChange={(color) => set({ color }, true)}
      />
      <OpacitySlider value={effect.opacity} set={set} />
    </>
  );
}

export function LayerStylePanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const setLayerStyle = usePhotoStore((s) => s.setLayerStyle);
  const toggleLayerStyle = usePhotoStore((s) => s.toggleLayerStyle);
  const removeLayerStyle = usePhotoStore((s) => s.removeLayerStyle);
  const clearLayerStyle = usePhotoStore((s) => s.clearLayerStyle);

  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);
  if (!layer) {
    return (
      <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.photo.noLayer')}
      </p>
    );
  }

  const style = layer.style;
  const setterFor =
    (id: StyleEffectId): Setter =>
    (patch, history = false) =>
      setLayerStyle(layer.id, id, patch, history);

  return (
    <div className="flex flex-col gap-3">
      {STYLE_EFFECTS.map((id) => {
        const effect = style?.[id];
        const active = isEffectActive(effect);
        return (
          <div key={id} data-testid={`style-${id}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
              <label className="flex flex-1 cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={active}
                  aria-label={t(`tools.photo.fx_${id}`)}
                  onChange={() => toggleLayerStyle(layer.id, id)}
                  className="h-3.5 w-3.5 accent-blue-600"
                />
                {t(`tools.photo.fx_${id}`)}
              </label>
              {effect ? (
                <button
                  type="button"
                  title={t('tools.photo.fxRemove')}
                  aria-label={`${t('tools.photo.fxRemove')} ${t(`tools.photo.fx_${id}`)}`}
                  onClick={() => removeLayerStyle(layer.id, id)}
                  className="h-6 w-6 rounded border border-gray-200 text-[11px] text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  ×
                </button>
              ) : null}
            </div>

            {active ? (
              <div className="flex flex-col gap-2 pl-1">
                {id === 'dropShadow' && style?.dropShadow ? (
                  <ShadowRows effect={style.dropShadow} set={setterFor('dropShadow')} withSpread />
                ) : null}
                {id === 'innerShadow' && style?.innerShadow ? (
                  <ShadowRows
                    effect={style.innerShadow}
                    set={setterFor('innerShadow')}
                    withSpread={false}
                  />
                ) : null}
                {id === 'outerGlow' && style?.outerGlow ? (
                  <GlowRows effect={style.outerGlow} set={setterFor('outerGlow')} />
                ) : null}
                {id === 'stroke' && style?.stroke ? (
                  <StrokeRows effect={style.stroke} set={setterFor('stroke')} />
                ) : null}
                {id === 'colorOverlay' && style?.colorOverlay ? (
                  <OverlayRows effect={style.colorOverlay} set={setterFor('colorOverlay')} />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {style ? (
        <PanelSection>
          <Button onClick={() => clearLayerStyle(layer.id)}>{t('tools.photo.fxClear')}</Button>
        </PanelSection>
      ) : null}
    </div>
  );
}
