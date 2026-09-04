import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  fromCmyk,
  fromHex,
  fromHsv,
  fromRgb,
  type ColorState,
  type Cmyk,
  type Hsv,
  type Rgb,
} from './core';

const DEFAULT_HEX = '#3b82f6';

function ChannelInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="w-6 shrink-0 font-mono text-xs uppercase">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded-md border border-gray-300 bg-white px-1.5 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
      />
    </label>
  );
}

/** HSV / CMYK 颜色转换 */
export default function HsvCmykTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ h: DEFAULT_HEX }), []);
  const [state, setState] = useState<ColorState>(() => {
    const r = fromHex(String(init.h || DEFAULT_HEX));
    return r.ok ? r.value : fromRgb({ r: 59, g: 130, b: 246 });
  });
  const [hexDraft, setHexDraft] = useState(state.hex);

  const applyRgb = (rgb: Rgb) => {
    const next = fromRgb(rgb);
    setState(next);
    setHexDraft(next.hex);
  };
  const applyHsv = (hsv: Hsv) => {
    const next = fromHsv(hsv);
    setState(next);
    setHexDraft(next.hex);
  };
  const applyCmyk = (cmyk: Cmyk) => {
    const next = fromCmyk(cmyk);
    setState(next);
    setHexDraft(next.hex);
  };

  const onHexChange = (value: string) => {
    setHexDraft(value);
    const r = fromHex(value);
    if (r.ok) setState(r.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ h: state.hex })} />
      </OptionBar>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <div
            role="img"
            aria-label={t('tools.hsvCmyk.preview')}
            className="h-32 w-32 rounded-lg border border-gray-300 dark:border-gray-700"
            style={{ backgroundColor: state.hex }}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={state.hex}
              onChange={(e) => onHexChange(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
            />
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => onHexChange(e.target.value)}
              spellCheck={false}
              className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <CopyButton text={state.hex} />
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              RGB
            </p>
            <ChannelInput
              label="R"
              value={state.rgb.r}
              min={0}
              max={255}
              onChange={(r) => applyRgb({ ...state.rgb, r })}
            />
            <ChannelInput
              label="G"
              value={state.rgb.g}
              min={0}
              max={255}
              onChange={(g) => applyRgb({ ...state.rgb, g })}
            />
            <ChannelInput
              label="B"
              value={state.rgb.b}
              min={0}
              max={255}
              onChange={(b) => applyRgb({ ...state.rgb, b })}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              HSV
            </p>
            <ChannelInput
              label="H"
              value={state.hsv.h}
              min={0}
              max={360}
              step={0.1}
              onChange={(h) => applyHsv({ ...state.hsv, h })}
            />
            <ChannelInput
              label="S"
              value={state.hsv.s}
              min={0}
              max={100}
              step={0.1}
              onChange={(s) => applyHsv({ ...state.hsv, s })}
            />
            <ChannelInput
              label="V"
              value={state.hsv.v}
              min={0}
              max={100}
              step={0.1}
              onChange={(v) => applyHsv({ ...state.hsv, v })}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              CMYK
            </p>
            <ChannelInput
              label="C"
              value={state.cmyk.c}
              min={0}
              max={100}
              step={0.1}
              onChange={(c) => applyCmyk({ ...state.cmyk, c })}
            />
            <ChannelInput
              label="M"
              value={state.cmyk.m}
              min={0}
              max={100}
              step={0.1}
              onChange={(m) => applyCmyk({ ...state.cmyk, m })}
            />
            <ChannelInput
              label="Y"
              value={state.cmyk.y}
              min={0}
              max={100}
              step={0.1}
              onChange={(y) => applyCmyk({ ...state.cmyk, y })}
            />
            <ChannelInput
              label="K"
              value={state.cmyk.k}
              min={0}
              max={100}
              step={0.1}
              onChange={(k) => applyCmyk({ ...state.cmyk, k })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
