import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { xmlToJson, type IndentSize } from './core';

/** XML → JSON */
export default function XmlJsonTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', n: 2 }), []);
  const [input, setInput] = useState(init.i);
  const [indent, setIndent] = useState<IndentSize>(init.n === 4 ? 4 : 2);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    return xmlToJson(input, indent);
  }, [input, indent]);

  const output = result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.xmlJson.indent')}
          <select
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value) as IndentSize)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={2}>{t('tools.xmlJson.indent2')}</option>
            <option value={4}>{t('tools.xmlJson.indent4')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, n: indent })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.xmlJson.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.xmlJson.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('tools.xmlJson.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.xmlJson', result)}
        </p>
      )}
    </div>
  );
}
