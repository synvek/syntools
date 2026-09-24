import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CSV_DELIMITERS, csvToJson, jsonToCsv, type CsvDelimiter } from './core';

type Direction = 'csv2json' | 'json2csv';

export default function CsvTool() {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<Direction>('csv2json');
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    const r =
      direction === 'csv2json'
        ? csvToJson(input, { delimiter, hasHeader })
        : jsonToCsv(input, delimiter);
    if (r.ok) setOutput(r.value);
    else {
      setOutput('');
      setError(t(`tools.csv-tool.errors.${r.error}`));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.csv-tool.direction')}
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as Direction);
              setOutput('');
              setError(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="csv2json">CSV → JSON</option>
            <option value="json2csv">JSON → CSV</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.csv-tool.delimiter')}
          <select
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value as CsvDelimiter)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CSV_DELIMITERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {direction === 'csv2json' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t('tools.csv-tool.hasHeader')}
          </label>
        )}
        <button
          type="button"
          onClick={run}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.csv-tool.convert')}
        </button>
        <ClearButton
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        />
      </OptionBar>

      <IOTextArea
        label={direction === 'csv2json' ? 'CSV' : 'JSON'}
        value={input}
        onChange={setInput}
        rows={10}
        placeholder={t('tools.csv-tool.inputPlaceholder')}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={direction === 'csv2json' ? 'JSON' : 'CSV'}
        value={output}
        readOnly
        rows={10}
        actions={<CopyButton text={output} disabled={!output} />}
      />
    </div>
  );
}
