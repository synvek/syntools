import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { generateIds, ID_TYPES, MAX_ID_BATCH, type IdType } from './core';

export default function IdGeneratorTool() {
  const { t } = useTranslation();
  const [type, setType] = useState<IdType>('ulid');
  const [count, setCount] = useState(10);
  const [nanoidSize, setNanoidSize] = useState(21);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    const r = generateIds({ type, count, nanoidSize });
    if (r.ok) setOutput(r.value.join('\n'));
    else {
      setOutput('');
      setError(t(`tools.id-generator.errors.${r.error}`));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.id-generator.type')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IdType)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {ID_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.id-generator.count')}
          <input
            type="number"
            min={1}
            max={MAX_ID_BATCH}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        {type === 'nanoid' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.id-generator.size')}
            <input
              type="number"
              min={4}
              max={64}
              value={nanoidSize}
              onChange={(e) => setNanoidSize(Number(e.target.value))}
              className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.id-generator.generate')}
        </button>
      </OptionBar>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={t('tools.id-generator.output')}
        value={output}
        readOnly
        rows={12}
        actions={
          <>
            <CopyButton text={output} disabled={!output} />
            <DownloadButton content={output} filename={`${type}.txt`} />
          </>
        }
      />
    </div>
  );
}
