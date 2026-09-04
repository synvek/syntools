import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { CASE_MODES, convertCase, type CaseMode } from './core';

/** 字母大小写 / 命名风格转换 */
export default function CaseConvertTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', m: 'upper' }), []);
  const [input, setInput] = useState(String(init.i || ''));
  const [mode, setMode] = useState<CaseMode>(
    CASE_MODES.includes(init.m as CaseMode) ? (init.m as CaseMode) : 'upper',
  );

  const result = useMemo(() => convertCase(input, mode), [input, mode]);
  const output = result.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.caseConvert.mode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CaseMode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {CASE_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`tools.caseConvert.modes.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, m: mode })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('common.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.caseConvert.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.result')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {!result.ok && input && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.caseConvert.err.${result.error}`)}
        </p>
      )}
    </div>
  );
}
