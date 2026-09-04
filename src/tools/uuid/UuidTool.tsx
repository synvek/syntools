import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_FORMAT,
  generateBatch,
  MAX_BATCH,
  type UuidFormatOptions,
  type UuidVersion,
} from './core';

export default function UuidTool() {
  const { t } = useTranslation();
  const init = readSharedState({ v: 'v4', c: 1, u: false, h: true, b: false });
  const [version, setVersion] = useState<UuidVersion>(init.v === 'v7' ? 'v7' : 'v4');
  const [count, setCount] = useState(Math.min(Math.max(Math.floor(init.c) || 1, 1), MAX_BATCH));
  const [options, setOptions] = useState<UuidFormatOptions>({
    ...DEFAULT_FORMAT,
    uppercase: init.u,
    hyphens: init.h,
    braces: init.b,
  });
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: keyof UuidFormatOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generate = () => {
    const r = generateBatch(version, count, options);
    if (r.ok) {
      setError(null);
      setOutput(r.value.join('\n'));
    } else {
      setError(translateToolError('tools.uuid', r));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.uuid.version')}
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value as UuidVersion)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="v4">{t('tools.uuid.versions.v4')}</option>
            <option value="v7">{t('tools.uuid.versions.v7')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.uuid.count')}
          <input
            type="number"
            min={1}
            max={MAX_BATCH}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => toggle('uppercase')}
            className="h-4 w-4 rounded border-gray-300"
          />
          {t('tools.uuid.uppercase')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={options.hyphens}
            onChange={() => toggle('hyphens')}
            className="h-4 w-4 rounded border-gray-300"
          />
          {t('tools.uuid.hyphens')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={options.braces}
            onChange={() => toggle('braces')}
            className="h-4 w-4 rounded border-gray-300"
          />
          {t('tools.uuid.braces')}
        </label>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {t('tools.uuid.generate')}
        </button>
        <ShareButton
          getState={() => ({
            v: version,
            c: count,
            u: options.uppercase,
            h: options.hyphens,
            b: options.braces,
          })}
        />
      </OptionBar>

      <IOTextArea
        label={t('tools.uuid.output')}
        value={output}
        readOnly
        rows={10}
        actions={
          <>
            <CopyButton text={output} disabled={!output} />
            <DownloadButton content={output} filename={`uuid-${version}.txt`} />
          </>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
