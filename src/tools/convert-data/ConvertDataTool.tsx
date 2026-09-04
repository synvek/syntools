import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { convert, FORMATS, type DataFormat } from './core';

const isFormat = (v: string): v is DataFormat => FORMATS.includes(v as DataFormat);

/** YAML ⇄ JSON ⇄ TOML 互转（Tasks T32）：文案全部走 i18n（T29 约定） */
export default function ConvertDataTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '', f: 'yaml', t: 'json' }), []);
  const [input, setInput] = useState(init.i);
  const [from, setFrom] = useState<DataFormat>(isFormat(init.f) ? init.f : 'yaml');
  const [to, setTo] = useState<DataFormat>(isFormat(init.t) ? init.t : 'json');

  // 输入输出格式不允许相同：改一侧时自动调整另一侧
  const changeFrom = (next: DataFormat) => {
    setFrom(next);
    if (next === to) setTo(FORMATS.find((f) => f !== next)!);
  };
  const changeTo = (next: DataFormat) => {
    setTo(next);
    if (next === from) setFrom(FORMATS.find((f) => f !== next)!);
  };

  const result = useMemo(() => (input.trim() ? convert(input, from, to) : null), [input, from, to]);
  const output = result?.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.convert.from')}
          <select
            value={from}
            onChange={(e) => changeFrom(e.target.value as DataFormat)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`tools.convert.formats.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.convert.to')}
          <select
            value={to}
            onChange={(e) => changeTo(e.target.value as DataFormat)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`tools.convert.formats.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, f: from, t: to })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={`${t('tools.convert.input')}（${t(`tools.convert.formats.${from}`)}）`}
          value={input}
          onChange={setInput}
          placeholder={t('tools.convert.placeholder')}
          actions={
            <>
              <SwapButton
                onSwap={() => {
                  setInput(output);
                  setFrom(to);
                  setTo(from);
                }}
                disabled={!output}
              />
              <ClearButton onClick={() => setInput('')} disabled={!input} />
            </>
          }
        />
        <IOTextArea
          label={`${t('tools.convert.output')}（${t(`tools.convert.formats.${to}`)}）`}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {result && !result.ok && result.error !== 'EMPTY' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.convert.err.${result.error}`)}
        </p>
      )}
    </div>
  );
}
