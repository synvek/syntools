import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { queryJsonPath } from './core';

export default function JsonPathTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', p: '' });
    const handoff = consumeHandoff('json-path');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [path, setPath] = useState(init.p);

  const result = useMemo(() => {
    if (!input.trim() && !path.trim()) return null;
    return queryJsonPath(input, path);
  }, [input, path]);
  const output = result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input, p: path })} />
      </OptionBar>

      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder={t('tools.json-path.pathPlaceholder')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.json-path.json')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.json-path.jsonPlaceholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {result && !result.ok && (input.trim() || path.trim()) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.json-path', result)}
        </p>
      )}
    </div>
  );
}
