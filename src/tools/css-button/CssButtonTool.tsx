import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_BUTTON_OPTIONS,
  buildButtonCss,
  buildButtonHtml,
  buildButtonInlineStyle,
  type ButtonStyleOptions,
} from './core';

function clampNum(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** CSS 按钮生成器 */
export default function CssButtonTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        l: DEFAULT_BUTTON_OPTIONS.label,
        bg: DEFAULT_BUTTON_OPTIONS.bg,
        c: DEFAULT_BUTTON_OPTIONS.color,
        hb: DEFAULT_BUTTON_OPTIONS.hoverBg,
        bc: DEFAULT_BUTTON_OPTIONS.borderColor,
        bw: DEFAULT_BUTTON_OPTIONS.borderWidth,
        r: DEFAULT_BUTTON_OPTIONS.radius,
        px: DEFAULT_BUTTON_OPTIONS.paddingX,
        py: DEFAULT_BUTTON_OPTIONS.paddingY,
        fs: DEFAULT_BUTTON_OPTIONS.fontSize,
        fw: DEFAULT_BUTTON_OPTIONS.fontWeight,
        sh: DEFAULT_BUTTON_OPTIONS.shadow ? 1 : 0,
        fw2: DEFAULT_BUTTON_OPTIONS.fullWidth ? 1 : 0,
      }),
    [],
  );

  const [options, setOptions] = useState<ButtonStyleOptions>({
    label: String(init.l || DEFAULT_BUTTON_OPTIONS.label),
    bg: String(init.bg || DEFAULT_BUTTON_OPTIONS.bg),
    color: String(init.c || DEFAULT_BUTTON_OPTIONS.color),
    hoverBg: String(init.hb || DEFAULT_BUTTON_OPTIONS.hoverBg),
    borderColor: String(init.bc || DEFAULT_BUTTON_OPTIONS.borderColor),
    borderWidth: clampNum(Number(init.bw) || 0, 0, 8),
    radius: clampNum(Number(init.r) || 0, 0, 48),
    paddingX: clampNum(Number(init.px) || 0, 0, 64),
    paddingY: clampNum(Number(init.py) || 0, 0, 48),
    fontSize: clampNum(Number(init.fs) || 14, 10, 32),
    fontWeight: clampNum(Number(init.fw) || 600, 400, 800),
    shadow: Number(init.sh) !== 0,
    fullWidth: Number(init.fw2) === 1,
  });
  const [hover, setHover] = useState(false);

  const css = useMemo(() => buildButtonCss(options), [options]);
  const html = useMemo(() => buildButtonHtml(options), [options]);
  const previewStyle = useMemo(() => {
    const base = buildButtonInlineStyle(options) as CSSProperties;
    if (hover) return { ...base, background: options.hoverBg };
    return base;
  }, [options, hover]);

  const patch = (partial: Partial<ButtonStyleOptions>) =>
    setOptions((prev) => ({ ...prev, ...partial }));

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton
          getState={() => ({
            l: options.label,
            bg: options.bg,
            c: options.color,
            hb: options.hoverBg,
            bc: options.borderColor,
            bw: options.borderWidth,
            r: options.radius,
            px: options.paddingX,
            py: options.paddingY,
            fs: options.fontSize,
            fw: options.fontWeight,
            sh: options.shadow ? 1 : 0,
            fw2: options.fullWidth ? 1 : 0,
          })}
        />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.cssButton.label')}
            <input
              type="text"
              value={options.label}
              onChange={(e) => patch({ label: e.target.value })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['bg', 'bg'],
                ['color', 'color'],
                ['hoverBg', 'hoverBg'],
                ['borderColor', 'borderColor'],
              ] as const
            ).map(([key, field]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
              >
                <span className="w-16 shrink-0">{t(`tools.cssButton.${key}`)}</span>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(options[field]) ? options[field] : '#000000'}
                  onChange={(e) => patch({ [field]: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700"
                />
                <input
                  type="text"
                  value={options[field]}
                  onChange={(e) => patch({ [field]: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            ))}
          </div>

          {(
            [
              ['radius', 'radius', 0, 48],
              ['paddingX', 'paddingX', 0, 64],
              ['paddingY', 'paddingY', 0, 48],
              ['fontSize', 'fontSize', 10, 32],
              ['borderWidth', 'borderWidth', 0, 8],
              ['fontWeight', 'fontWeight', 400, 800],
            ] as const
          ).map(([key, field, min, max]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="w-24 shrink-0">{t(`tools.cssButton.${key}`)}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={field === 'fontWeight' ? 100 : 1}
                value={options[field]}
                onChange={(e) => patch({ [field]: Number(e.target.value) })}
                className="min-w-0 flex-1"
              />
              <span className="w-10 text-right font-mono text-xs">{options[field]}</span>
            </label>
          ))}

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={options.shadow}
                onChange={(e) => patch({ shadow: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
              {t('tools.cssButton.shadow')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={options.fullWidth}
                onChange={(e) => patch({ fullWidth: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
              {t('tools.cssButton.fullWidth')}
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900/40">
            <button
              type="button"
              style={previewStyle}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
            >
              {options.label || t('tools.cssButton.previewFallback')}
            </button>
          </div>

          <IOTextArea
            label={t('tools.cssButton.css')}
            value={css}
            readOnly
            actions={<CopyButton text={css} />}
          />
          <IOTextArea
            label={t('tools.cssButton.html')}
            value={html}
            readOnly
            actions={<CopyButton text={html} />}
          />
        </div>
      </div>
    </div>
  );
}
