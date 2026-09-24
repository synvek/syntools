import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { MINIFY_LANGS, minifyCode, type MinifyLang } from './core';

export default function CodeMinifyTool() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<MinifyLang>('css');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError(null);
    setBusy(true);
    const r = await minifyCode(lang, input);
    setBusy(false);
    if (r.ok) setOutput(r.value);
    else {
      setOutput('');
      setError(t(`tools.code-minify.errors.${r.error}`));
    }
  };

  const saved =
    input.length > 0 && output.length > 0
      ? Math.max(0, Math.round((1 - output.length / input.length) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.code-minify.language')}
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value as MinifyLang);
              setOutput('');
              setError(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {MINIFY_LANGS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? t('tools.code-minify.working') : t('tools.code-minify.minify')}
        </button>
        <ClearButton
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        />
      </OptionBar>

      {(lang === 'js' || lang === 'html') && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t('tools.code-minify.conservativeHint')}
        </p>
      )}

      <IOTextArea
        label={t('tools.code-minify.input')}
        value={input}
        onChange={setInput}
        rows={10}
        placeholder={t('tools.code-minify.placeholder')}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={t('tools.code-minify.output')}
        value={output}
        readOnly
        rows={10}
        actions={
          <>
            <CopyButton text={output} disabled={!output} />
            {output && (
              <span className="self-center text-xs text-gray-500 dark:text-gray-400">
                {t('tools.code-minify.saved', { percent: saved })}
              </span>
            )}
          </>
        }
      />
    </div>
  );
}
