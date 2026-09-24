import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { rescueGarbled } from './core';

export default function EncodingRescueTool() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const result = useMemo(() => rescueGarbled(input), [input]);
  const error =
    !result.ok && input.trim() ? t(`tools.encoding-rescue.errors.${result.error}`) : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
      </OptionBar>
      <IOTextArea
        label={t('tools.encoding-rescue.input')}
        value={input}
        onChange={setInput}
        rows={4}
        placeholder={t('tools.encoding-rescue.placeholder')}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {result.ok && result.value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.value.map((c) => (
            <li
              key={c.encoding}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <div className="min-w-0 flex-1">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {c.encoding}
                </span>
                <code className="ml-2 break-all font-mono text-sm text-gray-900 dark:text-gray-100">
                  {c.text}
                </code>
              </div>
              <CopyButton text={c.text} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
