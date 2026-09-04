import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { convertZh, type ZhConvertDirection } from './core';

/** 简繁体转换 */
export default function ZhConvertTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', d: 's2t' }), []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<ZhConvertDirection>(
    init.d === 't2s' ? 't2s' : 's2t',
  );

  const result = useMemo(() => convertZh(input, direction), [input, direction]);
  const output = result.ok ? result.value : '';

  const swap = () => {
    if (!result.ok) return;
    setInput(result.value);
    setDirection(direction === 's2t' ? 't2s' : 's2t');
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as ZhConvertDirection)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="s2t">{t('tools.zhConvert.s2t')}</option>
            <option value="t2s">{t('tools.zhConvert.t2s')}</option>
          </select>
        </label>
        <SwapButton onSwap={swap} disabled={!result.ok || !input} />
        <ShareButton getState={() => ({ i: input, d: direction })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={direction === 's2t' ? t('tools.zhConvert.simplified') : t('tools.zhConvert.traditional')}
          value={input}
          onChange={setInput}
          placeholder={
            direction === 's2t'
              ? t('tools.zhConvert.placeholderS2t')
              : t('tools.zhConvert.placeholderT2s')
          }
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.result')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.zhConvert.err.${result.error}`)}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.zhConvert.hint')}</p>
    </div>
  );
}
