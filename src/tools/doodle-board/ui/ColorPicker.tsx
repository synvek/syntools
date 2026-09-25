import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PALETTE } from '../core';
import { BoardIcon } from './icons';

interface ColorPickerProps {
  /** 前景色：左键落笔 / 图标填充 */
  foreground: string;
  /** 背景色：右键落笔 / 形状填充 */
  background: string;
  /** 最近使用的颜色 */
  recent: string[];
  onForeground: (color: string) => void;
  onBackground: (color: string) => void;
  onSwap: () => void;
}

const CHIP =
  'h-6 w-6 rounded-md border transition-transform duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
const ICON_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 transition-colors duration-150 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';

/**
 * 前景 / 背景双色选择器：经典画板语义。
 * - 左键点击色块 → 前景色
 * - 右键点击色块 → 背景色
 * - 弹层内可自定义取色、交换前景背景、复用最近颜色
 */
export default function ColorPicker({
  foreground,
  background,
  recent,
  onForeground,
  onBackground,
  onSwap,
}: ColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fg = foreground.toLowerCase();
  const bg = background.toLowerCase();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const chip = (color: string, size: string) => {
    const selected = fg === color.toLowerCase();
    const isBg = bg === color.toLowerCase();
    return (
      <button
        key={color}
        type="button"
        title={`${color}（${t('tools.doodle.fgColor')} / ${t('tools.doodle.bgColor')}）`}
        aria-label={color}
        onClick={() => onForeground(color)}
        onContextMenu={(e) => {
          e.preventDefault();
          onBackground(color);
        }}
        className={`${CHIP} ${size} ${
          selected
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
            : isBg
              ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950'
              : 'border-gray-200 dark:border-gray-700'
        }`}
        style={{ backgroundColor: color }}
      />
    );
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t('tools.doodle.moreColors')}
        aria-label={t('tools.doodle.moreColors')}
        aria-expanded={open}
        className="relative h-7 w-8 shrink-0"
      >
        <span
          className="absolute bottom-0 right-0 h-5 w-5 rounded-md border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: background }}
        />
        <span
          className="absolute left-0 top-0 h-5 w-5 rounded-md border border-gray-300 shadow-sm dark:border-gray-600"
          style={{ backgroundColor: foreground }}
        />
      </button>
      <button
        type="button"
        onClick={onSwap}
        title={t('tools.doodle.swapColors')}
        aria-label={t('tools.doodle.swapColors')}
        className={ICON_BUTTON}
      >
        <BoardIcon name="swap" className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-max max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="grid grid-cols-10 gap-1">{PALETTE.map((color) => chip(color, ''))}</div>

          {recent.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                {t('tools.doodle.recentColors')}
              </p>
              <div className="flex flex-wrap gap-1">
                {recent.map((color) => chip(color, 'h-5 w-5'))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <ColorField
              label={t('tools.doodle.fgColor')}
              value={foreground}
              onChange={onForeground}
            />
            <ColorField
              label={t('tools.doodle.bgColor')}
              value={background}
              onChange={onBackground}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.doodle.colorHint')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-600"
        aria-label={label}
      />
    </label>
  );
}
