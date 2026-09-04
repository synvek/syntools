import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { OpenInToolButton } from '@/core/components/OpenInToolButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { compressJson, formatJson, validateJson, type IndentSize } from './core';

type Action = 'format' | 'compress' | 'validate';

export default function JsonFormatTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', a: 'format', n: 2 });
    const handoff = consumeHandoff('json-format');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [action, setAction] = useState<Action>(
    init.a === 'compress' || init.a === 'validate' ? init.a : 'format',
  );
  const [indent, setIndent] = useState<IndentSize>(init.n === 4 ? 4 : 2);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    if (action === 'format') return formatJson(input, indent);
    if (action === 'compress') return compressJson(input);
    return validateJson(input);
  }, [input, action, indent]);

  const output =
    result?.ok && result.value === 'VALID' ? t('tools.json.valid') : result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="format">{t('tools.json.actions.format')}</option>
            <option value="compress">{t('tools.json.actions.compress')}</option>
            <option value="validate">{t('tools.json.actions.validate')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.json.indent')}
          <select
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value) as IndentSize)}
            disabled={action !== 'format'}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={2}>{t('tools.json.indent2')}</option>
            <option value={4}>{t('tools.json.indent4')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, a: action, n: indent })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.json.inputLabel')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.json.inputPlaceholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={action === 'validate' ? t('tools.json.validateResult') : t('common.output')}
          value={output}
          readOnly
          actions={
            <div className="flex flex-wrap items-center gap-1">
              <CopyButton text={output} disabled={!output} />
              {action !== 'validate' && (
                <OpenInToolButton targetId="base64" text={output} disabled={!output} />
              )}
            </div>
          }
        />
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.json', result)}
        </p>
      )}
    </div>
  );
}
