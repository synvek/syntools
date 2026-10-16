import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { hexToHsv, hsvToHex } from '../core';
import type { HsvColor } from '../core';
import { Button, PanelSection } from './controls';
import { usePhotoStore } from '../store';

/** 常用色板：与顶部工具条保持一致，另外给出常用中性色 */
const PALETTE = [
  '#000000',
  '#404040',
  '#808080',
  '#C0C0C0',
  '#FFFFFF',
  '#DC2626',
  '#EA580C',
  '#F59E0B',
  '#16A34A',
  '#0D9488',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#78350F',
  '#1E293B',
];

type Target = 'foreground' | 'background';

/**
 * 颜色面板：前景 / 背景双色 + HSV 拾色器 + 色板 + 最近使用 + 画笔预设。
 *
 * 状态归属：颜色写在 `store.brush.color / background`（会话态），
 * 拾色器只维护一份 HSV，避免「灰阶颜色丢失色相」导致拖动时滑块跳位。
 */
export function ColorPanel() {
  const { t } = useTranslation();
  const brush = usePhotoStore((s) => s.brush);
  const patchBrush = usePhotoStore((s) => s.patchBrush);
  const swapColors = usePhotoStore((s) => s.swapColors);
  const resetColors = usePhotoStore((s) => s.resetColors);
  const recentColors = usePhotoStore((s) => s.recentColors);
  const pushRecentColor = usePhotoStore((s) => s.pushRecentColor);
  const brushPresets = usePhotoStore((s) => s.brushPresets);
  const applyBrushPreset = usePhotoStore((s) => s.applyBrushPreset);
  const removeBrushPreset = usePhotoStore((s) => s.removeBrushPreset);

  const [target, setTarget] = useState<Target>('foreground');
  const active = target === 'foreground' ? brush.color : brush.background;
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(active));
  /** 记录「由本组件产生」的颜色，避免 effect 把拖动中的色相重置掉 */
  const emitted = useRef('');

  useEffect(() => {
    if (emitted.current === active.toUpperCase()) return;
    setHsv(hexToHsv(active));
  }, [active]);

  const setColor = (hex: string) => {
    emitted.current = hex.toUpperCase();
    patchBrush(target === 'foreground' ? { color: hex } : { background: hex });
  };

  const commitRecent = () => {
    pushRecentColor(target === 'foreground' ? brush.color : brush.background);
  };

  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  /** 统一的「按下 + 拖动 + 松手」取值逻辑：坐标归一化后交给回调 */
  const beginDrag =
    (ref: RefObject<HTMLDivElement | null>, onPick: (nx: number, ny: number) => void) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const apply = (clientX: number, clientY: number) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        onPick(
          Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
          Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
        );
      };
      apply(event.clientX, event.clientY);
      const onMove = (move: PointerEvent) => apply(move.clientX, move.clientY);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        commitRecent();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

  return (
    <div className="flex flex-col gap-3">
      <PanelSection>
        {/* 前景 / 背景双色：点击选择编辑目标 */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-12">
            <button
              type="button"
              title={t('tools.photo.bgColor')}
              aria-label={t('tools.photo.bgColor')}
              aria-pressed={target === 'background'}
              onClick={() => setTarget('background')}
              className={`absolute bottom-0 right-0 h-6 w-6 rounded border-2 ${
                target === 'background' ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: brush.background }}
            />
            <button
              type="button"
              title={t('tools.photo.foreground')}
              aria-label={t('tools.photo.foreground')}
              aria-pressed={target === 'foreground'}
              onClick={() => setTarget('foreground')}
              className={`absolute left-0 top-0 h-6 w-6 rounded border-2 ${
                target === 'foreground' ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: brush.color }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Button onClick={swapColors} title={t('tools.photo.swapColors')}>
              {t('tools.photo.swapColors')}
            </Button>
            <Button onClick={resetColors} title={t('tools.photo.resetColors')}>
              {t('tools.photo.resetColors')}
            </Button>
          </div>
        </div>

        {/* 色相条 */}
        <div
          ref={hueRef}
          role="slider"
          aria-label={t('tools.photo.hue')}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          tabIndex={0}
          data-testid="color-hue"
          onPointerDown={beginDrag(hueRef, (nx) => {
            const next = { ...hsv, h: nx * 360 };
            setHsv(next);
            setColor(hsvToHex(next));
          })}
          className="relative h-4 w-full cursor-pointer touch-none rounded border border-gray-200 dark:border-gray-700"
          style={{
            background:
              'linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)',
          }}
        >
          <span
            aria-hidden
            className="absolute top-[-2px] h-5 w-1.5 -translate-x-1/2 rounded-sm border border-white bg-transparent shadow"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: hsvToHex({ h: hsv.h, s: 100, v: 100 }),
            }}
          />
        </div>

        {/* 饱和度 / 明度方块 */}
        <div
          ref={svRef}
          role="slider"
          aria-label={t('tools.photo.saturation')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s)}
          tabIndex={0}
          data-testid="color-sv"
          onPointerDown={beginDrag(svRef, (nx, ny) => {
            const next = { ...hsv, s: nx * 100, v: (1 - ny) * 100 };
            setHsv(next);
            setColor(hsvToHex(next));
          })}
          className="relative h-24 w-full cursor-crosshair touch-none rounded border border-gray-200 dark:border-gray-700"
          style={{
            background: `linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #FFFFFF, ${hsvToHex(
              { h: hsv.h, s: 100, v: 100 },
            )})`,
          }}
        >
          <span
            aria-hidden
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: active }}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label={t('tools.photo.hexValue')}
            value={active}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
                setColor(raw.startsWith('#') ? raw.toUpperCase() : `#${raw.toUpperCase()}`);
              }
            }}
            className="h-8 w-28 rounded-md border border-gray-300 bg-white px-2 font-mono text-xs uppercase text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <input
            type="color"
            aria-label={t('tools.photo.color')}
            value={active}
            onChange={(event) => setColor(event.target.value.toUpperCase())}
            onBlur={commitRecent}
            className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
          />
        </div>
      </PanelSection>

      <PanelSection title={t('tools.photo.palette')}>
        <div className="grid grid-cols-8 gap-1">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              onClick={() => {
                setColor(color);
                pushRecentColor(color);
              }}
              className="h-5 w-5 rounded border border-gray-200 transition-transform hover:scale-110 dark:border-gray-700"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {recentColors.length > 0 ? (
          <div className="grid grid-cols-8 gap-1" data-testid="recent-colors">
            {recentColors.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={color}
                onClick={() => setColor(color)}
                className="h-5 w-5 rounded border border-gray-200 transition-transform hover:scale-110 dark:border-gray-700"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ) : null}
      </PanelSection>

      <PanelSection title={t('tools.photo.presets')}>
        {brushPresets.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.photo.noPresets')}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {brushPresets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyBrushPreset(preset)}
                  className="flex h-7 flex-1 items-center justify-between rounded border border-gray-200 px-2 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <span className="truncate">{preset.name ?? preset.id}</span>
                  <span className="font-mono text-[10px] text-gray-400">
                    {preset.size}px · {Math.round(preset.hardness * 100)}%
                  </span>
                </button>
                <button
                  type="button"
                  title={t('tools.photo.delete')}
                  aria-label={`${t('tools.photo.delete')} ${preset.name ?? preset.id}`}
                  onClick={() => removeBrushPreset(preset.id)}
                  className="h-7 w-7 rounded border border-gray-200 text-[11px] text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  );
}
