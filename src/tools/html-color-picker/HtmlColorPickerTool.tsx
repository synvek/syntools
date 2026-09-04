import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { buildColorPicker, toColorInputValue } from './core';

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** HTML 取色器：系统色盘 + 可选 EyeDropper + CSS/HTML 片段 */
export default function HtmlColorPickerTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '#3b82f6' }), []);
  const [input, setInput] = useState(init.i);
  const [canDropper, setCanDropper] = useState(false);

  useEffect(() => {
    setCanDropper(typeof window !== 'undefined' && 'EyeDropper' in window);
  }, []);

  const result = useMemo(() => buildColorPicker(input), [input]);
  const data = result.ok ? result.value : null;
  const colorInputValue = data ? toColorInputValue(data.hex) : '#000000';

  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const eye = new Ctor();
      const { sRGBHex } = await eye.open();
      setInput(sRGBHex);
    } catch {
      // 用户取消取色，忽略
    }
  };

  const rows = data
    ? [
        { key: 'hex', value: data.hex },
        { key: 'rgb', value: data.rgb },
        { key: 'hsl', value: data.hsl },
        { key: 'cssColor', value: data.cssColor },
        { key: 'cssBg', value: data.cssBg },
        { key: 'htmlInline', value: data.htmlInline },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.colorPicker.picker')}
          <input
            type="color"
            value={colorInputValue}
            onChange={(e) => setInput(e.target.value)}
            aria-label={t('tools.colorPicker.picker')}
            className="h-9 w-14 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.colorPicker.input')}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('tools.colorPicker.placeholder')}
            spellCheck={false}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        {canDropper && (
          <button
            type="button"
            onClick={() => void pickFromScreen()}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.colorPicker.eyedropper')}
          </button>
        )}
        <ClearButton onClick={() => setInput('#000000')} disabled={!input} />
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.colorPicker.err.${result.error}`)}
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div
            aria-label={t('tools.colorPicker.preview')}
            role="img"
            className="h-36 w-36 shrink-0 rounded-lg border border-gray-300 dark:border-gray-700"
            style={{ backgroundColor: data.hex }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="w-24 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t(`tools.colorPicker.fields.${row.key}`)}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
                  {row.value}
                </code>
                <CopyButton text={row.value} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
