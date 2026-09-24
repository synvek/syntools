import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton } from '@/core/components/ActionButtons';
import { generateAll } from './core';

export default function UaGeneratorTool() {
  const { t } = useTranslation();
  const [items, setItems] = useState(() => generateAll(Math.random));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setItems(generateAll(Math.random))}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('tools.ua-generator.generate')}
        </button>
        <DownloadButton
          content={items.map((i) => `${i.ua}`).join('\n')}
          filename="user-agents.txt"
          label={t('tools.ua-generator.copyAll')}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.id}</div>
              <code className="break-all font-mono text-sm text-gray-900 dark:text-gray-100">
                {item.ua}
              </code>
            </div>
            <CopyButton text={item.ua} />
          </li>
        ))}
      </ul>
    </div>
  );
}
