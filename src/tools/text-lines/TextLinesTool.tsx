import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { processLines, type TextLinesOp } from './core';

const OPS: TextLinesOp[] = ['sort-asc', 'sort-desc', 'unique', 'reverse', 'number', 'trim-empty'];

export default function TextLinesTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', o: 'sort-asc' });
    const handoff = consumeHandoff('text-lines');
    return {
      i: handoff ?? shared.i,
      o: OPS.includes(shared.o as TextLinesOp) ? (shared.o as TextLinesOp) : 'sort-asc',
    };
  }, []);
  const [input, setInput] = useState(init.i);
  const [op, setOp] = useState<TextLinesOp>(init.o);

  const result = useMemo(() => processLines(input, op), [input, op]);
  const output = result.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={op}
            onChange={(e) => setOp(e.target.value as TextLinesOp)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {OPS.map((item) => (
              <option key={item} value={item}>
                {t(`tools.text-lines.ops.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, o: op })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('common.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.text-lines.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {!result.ok && input && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.text-lines', result)}
        </p>
      )}
    </div>
  );
}
