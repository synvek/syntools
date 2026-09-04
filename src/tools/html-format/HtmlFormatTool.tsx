import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { processHtml, type HtmlAction, type IndentSize } from './core';

/** HTML 压缩 / 格式化 */
export default function HtmlFormatTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', a: 'format', n: 2 }), []);
  const [input, setInput] = useState(init.i);
  const [action, setAction] = useState<HtmlAction>(init.a === 'compress' ? 'compress' : 'format');
  const [indent, setIndent] = useState<IndentSize>(init.n === 4 ? 4 : 2);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    return processHtml(input, action, indent);
  }, [input, action, indent]);

  const output = result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as HtmlAction)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="format">{t('tools.html.actions.format')}</option>
            <option value="compress">{t('tools.html.actions.compress')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.html.indent')}
          <select
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value) as IndentSize)}
            disabled={action !== 'format'}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={2}>{t('tools.html.indent2')}</option>
            <option value={4}>{t('tools.html.indent4')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, a: action, n: indent })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.html.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.html.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.html', result)}
        </p>
      )}
    </div>
  );
}
