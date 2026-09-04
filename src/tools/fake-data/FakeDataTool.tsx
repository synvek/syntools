import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import {
  FAKE_MAX,
  FAKE_MIN,
  generateFakeData,
  type FakeKind,
  type FakeLocale,
} from './core';

const KINDS: FakeKind[] = ['name', 'email', 'uuid', 'lorem'];

export default function FakeDataTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () => readSharedState({ k: 'name', c: 5, l: 'zh' }),
    [],
  );
  const [kind, setKind] = useState<FakeKind>(
    KINDS.includes(init.k as FakeKind) ? (init.k as FakeKind) : 'name',
  );
  const [count, setCount] = useState(
    Math.min(Math.max(Math.floor(init.c) || 5, FAKE_MIN), FAKE_MAX),
  );
  const [locale, setLocale] = useState<FakeLocale>(init.l === 'en' ? 'en' : 'zh');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const r = generateFakeData(kind, count, locale);
    if (r.ok) {
      setOutput(r.value);
      setError(null);
    } else {
      setOutput('');
      setError(translateToolError('tools.fake-data', r));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.fake-data.kind')}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FakeKind)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`tools.fake-data.kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.fake-data.locale')}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as FakeLocale)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="zh">zh</option>
            <option value="en">en</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.fake-data.count')}
          <input
            type="number"
            min={FAKE_MIN}
            max={FAKE_MAX}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.fake-data.generate')}
        </button>
        <ShareButton getState={() => ({ k: kind, c: count, l: locale })} />
      </OptionBar>

      <IOTextArea
        label={t('common.output')}
        value={output}
        readOnly
        rows={10}
        actions={<CopyButton text={output} disabled={!output} />}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
