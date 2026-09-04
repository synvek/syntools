import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  MAX_COUNT,
  MAX_LENGTH,
  generateRandomStrings,
  type RandomStringPreset,
} from './core';

const PRESETS: RandomStringPreset[] = ['alnum', 'alpha', 'hex', 'base64', 'custom'];

/** 随机字符串生成器 */
export default function RandomStringTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ l: 16, c: 5, p: 'alnum', x: '' }),
    [],
  );
  const [length, setLength] = useState(Number(init.l) || 16);
  const [count, setCount] = useState(Number(init.c) || 5);
  const [preset, setPreset] = useState<RandomStringPreset>(
    PRESETS.includes(init.p as RandomStringPreset) ? (init.p as RandomStringPreset) : 'alnum',
  );
  const [custom, setCustom] = useState(String(init.x || ''));
  const [tick, setTick] = useState(0);

  const result = useMemo(() => {
    void tick;
    return generateRandomStrings({ length, count, preset, custom });
  }, [length, count, preset, custom, tick]);

  const output = result.ok ? result.value.join('\n') : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomString.length')}
          <input
            type="number"
            min={1}
            max={MAX_LENGTH}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomString.count')}
          <input
            type="number"
            min={1}
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.randomString.preset')}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RandomStringPreset)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(`tools.randomString.presets.${p}`)}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <label className="flex min-w-0 flex-1 items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.randomString.custom')}
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={t('tools.randomString.customPlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setTick((n) => n + 1)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.randomString.generate')}
        </button>
        <ShareButton getState={() => ({ l: length, c: count, p: preset, x: custom })} />
      </OptionBar>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.randomString.err.${result.error}`)}
        </p>
      )}

      <IOTextArea
        label={t('common.result')}
        value={output}
        readOnly
        actions={<CopyButton text={output} disabled={!output} />}
      />
    </div>
  );
}
