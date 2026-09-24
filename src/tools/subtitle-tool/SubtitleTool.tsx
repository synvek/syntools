import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { convertSubtitle, parseSubtitle, type SubFormat } from './core';

export default function SubtitleTool() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<SubFormat>('vtt');
  const [offset, setOffset] = useState(0);

  const result = useMemo(
    () => (input.trim() ? convertSubtitle(input, target, offset) : null),
    [input, target, offset],
  );
  const cues = useMemo(() => (input.trim() ? parseSubtitle(input) : null), [input]);
  const output = result?.ok ? result.value : '';
  const error = result && !result.ok ? result.error : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.subtitle-tool.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as SubFormat)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="srt">SRT</option>
            <option value="vtt">WebVTT</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.subtitle-tool.offset')}
          <input
            type="number"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        {cues?.ok && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.subtitle-tool.cueCount', { count: cues.value.cues.length })}
          </span>
        )}
      </OptionBar>

      <IOTextArea
        label={t('tools.subtitle-tool.input')}
        value={input}
        onChange={setInput}
        rows={12}
        placeholder={'1\n00:00:01,000 --> 00:00:03,500\nHello world'}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.subtitle-tool.errors.${error}`)}
        </p>
      )}

      <IOTextArea
        label={t('tools.subtitle-tool.output')}
        value={output}
        readOnly
        rows={12}
        actions={
          <>
            <CopyButton text={output} disabled={!output} />
            <DownloadButton content={output} filename={`subtitle.${target}`} />
          </>
        }
      />
    </div>
  );
}
