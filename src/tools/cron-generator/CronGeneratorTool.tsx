import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { encodeShareState, readSharedState } from '@/core/lib/share';
import {
  CRON_PRESETS,
  FIELD_BOUNDS,
  buildCronExpression,
  defaultFields,
  type CronFieldKey,
  type CronFieldMode,
  type CronFieldState,
} from './core';

const FIELD_KEYS: CronFieldKey[] = ['minute', 'hour', 'day', 'month', 'weekday'];
const MODES: CronFieldMode[] = ['every', 'value', 'range', 'step', 'list'];

function parseSharedFields(raw: string): Record<CronFieldKey, CronFieldState> {
  const base = defaultFields();
  if (!raw) return base;
  try {
    const obj = JSON.parse(raw) as Record<string, Partial<CronFieldState>>;
    if (!obj || typeof obj !== 'object') return base;
    for (const key of FIELD_KEYS) {
      const part = obj[key];
      if (!part || typeof part !== 'object') continue;
      base[key] = {
        ...base[key],
        ...part,
        mode: MODES.includes(part.mode as CronFieldMode)
          ? (part.mode as CronFieldMode)
          : base[key].mode,
      };
    }
  } catch {
    /* ignore */
  }
  return base;
}

/** Crontab 生成器 */
export default function CronGeneratorTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ f: '' }), []);
  const [fields, setFields] = useState(() => parseSharedFields(String(init.f || '')));

  const result = useMemo(() => buildCronExpression(fields), [fields]);
  const expression = result.ok ? result.value : '';

  const patchField = (key: CronFieldKey, partial: Partial<CronFieldState>) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  };

  const applyPreset = (id: string) => {
    const preset = CRON_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const next = defaultFields();
    for (const [k, v] of Object.entries(preset.fields)) {
      next[k as CronFieldKey] = { ...next[k as CronFieldKey], ...v };
    }
    setFields(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.cronGen.preset')}
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.target.value = '';
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="" disabled>
              {t('tools.cronGen.presetPick')}
            </option>
            {CRON_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`tools.cronGen.presets.${p.id}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ f: JSON.stringify(fields) })} />
      </OptionBar>

      <div className="flex flex-col gap-3">
        {FIELD_KEYS.map((key) => {
          const state = fields[key];
          const bounds = FIELD_BOUNDS[key];
          return (
            <div
              key={key}
              className="grid gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700 sm:grid-cols-[7rem_8rem_1fr]"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t(`tools.cronGen.fields.${key}`)}
              </span>
              <select
                value={state.mode}
                onChange={(e) => patchField(key, { mode: e.target.value as CronFieldMode })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`tools.cronGen.modes.${m}`)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {state.mode === 'value' && (
                  <input
                    type="number"
                    min={bounds.min}
                    max={bounds.max}
                    value={state.value}
                    onChange={(e) => patchField(key, { value: Number(e.target.value) })}
                    className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                )}
                {state.mode === 'range' && (
                  <>
                    <input
                      type="number"
                      min={bounds.min}
                      max={bounds.max}
                      value={state.from}
                      onChange={(e) => patchField(key, { from: Number(e.target.value) })}
                      className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                    />
                    <span>–</span>
                    <input
                      type="number"
                      min={bounds.min}
                      max={bounds.max}
                      value={state.to}
                      onChange={(e) => patchField(key, { to: Number(e.target.value) })}
                      className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                    />
                  </>
                )}
                {state.mode === 'step' && (
                  <label className="flex items-center gap-1">
                    */{' '}
                    <input
                      type="number"
                      min={1}
                      max={bounds.max}
                      value={state.step}
                      onChange={(e) => patchField(key, { step: Number(e.target.value) })}
                      className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                    />
                  </label>
                )}
                {state.mode === 'list' && (
                  <input
                    type="text"
                    value={state.list}
                    onChange={(e) => patchField(key, { list: e.target.value })}
                    placeholder={t('tools.cronGen.listPlaceholder')}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                )}
                {state.mode === 'every' && (
                  <span className="text-xs text-gray-400">{t('tools.cronGen.everyHint')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.cronGen.err.${result.error}`)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('tools.cronGen.expression')}</span>
        <code className="font-mono text-lg text-gray-900 dark:text-gray-50">
          {expression || '—'}
        </code>
        <CopyButton text={expression} disabled={!expression} />
        {expression && (
          <Link
            to={`/tools/cron-parser?s=${encodeShareState({ e: expression, c: 5 })}`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('tools.cronGen.openParser')}
          </Link>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.cronGen.hint')}</p>
    </div>
  );
}
