import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';
import {
  CHEAT_SHEET,
  PRESET_PATTERNS,
  compileRegex,
  findMatches,
  replaceRegex,
} from './core';

const FLAG_OPTIONS = ['g', 'i', 'm', 's', 'u'] as const;
const MAX_PREVIEW_MATCHES = 200;
const MAX_TABLE_ROWS = 50;

/** 正则表达式工具：匹配高亮 + 替换 + 速查 */
export default function RegexTesterTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ p: '', f: 'g', t: '', r: '', m: 'match' }),
    [],
  );
  const [pattern, setPattern] = useState(init.p);
  const [flags, setFlags] = useState(init.f);
  const [text, setText] = useState(init.t);
  const [replacement, setReplacement] = useState(init.r);
  const [mode, setMode] = useState<'match' | 'replace'>(init.m === 'replace' ? 'replace' : 'match');
  const debouncedText = useDebouncedValue(text);

  const compiled = useMemo(() => compileRegex(pattern, flags), [pattern, flags]);
  const matchResult = useMemo(
    () => (compiled.ok ? findMatches(compiled.value, debouncedText) : null),
    [compiled, debouncedText],
  );
  const replaceResult = useMemo(() => {
    if (mode !== 'replace' || !compiled.ok) return null;
    return replaceRegex(compiled.value, debouncedText, replacement, true);
  }, [mode, compiled, debouncedText, replacement]);

  const preview = useMemo(() => {
    if (!matchResult?.ok || !debouncedText) return null;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    for (const m of matchResult.value.matches.slice(0, MAX_PREVIEW_MATCHES)) {
      if (m.index > cursor) nodes.push(debouncedText.slice(cursor, m.index));
      nodes.push(
        <mark
          key={`${m.index}-${nodes.length}`}
          className="rounded bg-amber-200 px-0.5 dark:bg-amber-600/60 dark:text-white"
        >
          {m.value || '∅'}
        </mark>,
      );
      cursor = m.index + m.value.length;
    }
    nodes.push(debouncedText.slice(cursor));
    return nodes;
  }, [matchResult, debouncedText]);

  const toggleFlag = (flag: string) => {
    setFlags(flags.includes(flag) ? flags.replace(flag, '') : flags + flag);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.regex.mode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'match' | 'replace')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="match">{t('tools.regex.modes.match')}</option>
            <option value="replace">{t('tools.regex.modes.replace')}</option>
          </select>
        </label>
        <label className="flex flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.regex.presets')}
          <select
            value=""
            onChange={(e) => {
              const preset = PRESET_PATTERNS.find((p) => p.id === e.target.value);
              if (preset) {
                setPattern(preset.pattern);
                setFlags(preset.flags);
              }
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">{t('tools.regex.presetPlaceholder')}</option>
            {PRESET_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`tools.regex.presetsList.${p.id}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton
          getState={() => ({ p: pattern, f: flags, t: text, r: replacement, m: mode })}
        />
      </OptionBar>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.regex.expression')}
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('tools.regex.expressionPlaceholder')}
            spellCheck={false}
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        {mode === 'replace' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.regex.replacement')}
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={t('tools.regex.replacementPlaceholder')}
              spellCheck={false}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('tools.regex.flags')}</span>
          {FLAG_OPTIONS.map((flag) => (
            <label key={flag} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={flags.includes(flag)}
                onChange={() => toggleFlag(flag)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <code className="font-mono">{flag}</code>
            </label>
          ))}
        </div>
      </div>

      <details className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.regex.cheatSheet')}
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHEAT_SHEET.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPattern((p) => p + (item.token === '(...)' ? '()' : item.token))}
              className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              title={t(`tools.regex.cheat.${item.id}`)}
            >
              <code className="font-mono text-blue-600 dark:text-blue-400">{item.token}</code>
              <span className="truncate text-xs text-gray-500">
                {t(`tools.regex.cheat.${item.id}`)}
              </span>
            </button>
          ))}
        </div>
      </details>

      {!compiled.ok && pattern && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.regex', compiled)}
        </p>
      )}
      {matchResult && !matchResult.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.regex', matchResult)}
        </p>
      )}

      <IOTextArea
        label={t('tools.regex.testText')}
        value={text}
        onChange={setText}
        placeholder={t('tools.regex.testTextPlaceholder')}
        actions={<ClearButton onClick={() => setText('')} disabled={!text} />}
      />

      {mode === 'replace' && replaceResult?.ok && (
        <IOTextArea
          label={t('tools.regex.replaceResult')}
          value={replaceResult.value}
          readOnly
          actions={<CopyButton text={replaceResult.value} disabled={!replaceResult.value} />}
        />
      )}

      {mode === 'match' && matchResult?.ok && (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('tools.regex.matchCount', { count: matchResult.value.matches.length })}
            {matchResult.value.truncated && t('tools.regex.truncated')}
          </p>

          {preview && (
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm dark:border-gray-800 dark:bg-gray-900">
              {preview}
            </div>
          )}

          {matchResult.value.matches.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t('tools.regex.position')}</th>
                    <th className="px-3 py-2">{t('tools.regex.matchContent')}</th>
                    <th className="px-3 py-2">{t('tools.regex.captureGroups')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {matchResult.value.matches.slice(0, MAX_TABLE_ROWS).map((m, i) => (
                    <tr key={`${m.index}-${i}`}>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono">{m.index}</td>
                      <td className="max-w-[16rem] truncate px-3 py-1.5 font-mono">
                        {m.value || t('tools.regex.emptyMatch')}
                      </td>
                      <td className="max-w-[20rem] truncate px-3 py-1.5 font-mono text-gray-500">
                        {[
                          ...m.groups.map((g) => g ?? '∅'),
                          ...Object.entries(m.named).map(([k, v]) => `${k}=${v ?? '∅'}`),
                        ].join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {matchResult.value.matches.length > MAX_TABLE_ROWS && (
                <p className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-800">
                  {t('tools.regex.tableLimit', { count: MAX_TABLE_ROWS })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
