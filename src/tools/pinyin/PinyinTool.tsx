import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  convertPinyin,
  type PinyinCase,
  type PinyinSeparator,
} from './core';

const SEPS = new Set(['space', 'none', 'dash']);
const CASES = new Set(['lower', 'upper']);

/** 汉字转拼音 */
export default function PinyinTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', s: 'space', c: 'lower', ton: 0 }), []);
  const [input, setInput] = useState(init.i);
  const [separator, setSeparator] = useState<PinyinSeparator>(
    SEPS.has(init.s) ? (init.s as PinyinSeparator) : 'space',
  );
  const [letterCase, setLetterCase] = useState<PinyinCase>(
    CASES.has(init.c) ? (init.c as PinyinCase) : 'lower',
  );
  const [tone, setTone] = useState(Number(init.ton) === 1);

  const result = useMemo(
    () => convertPinyin(input, { separator, letterCase, tone }),
    [input, separator, letterCase, tone],
  );
  const output = result.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.pinyin.separator')}
          <select
            value={separator}
            onChange={(e) => setSeparator(e.target.value as PinyinSeparator)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="space">{t('tools.pinyin.separators.space')}</option>
            <option value="none">{t('tools.pinyin.separators.none')}</option>
            <option value="dash">{t('tools.pinyin.separators.dash')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.pinyin.letterCase')}
          <select
            value={letterCase}
            onChange={(e) => setLetterCase(e.target.value as PinyinCase)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="lower">{t('tools.pinyin.cases.lower')}</option>
            <option value="upper">{t('tools.pinyin.cases.upper')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={tone}
            onChange={(e) => setTone(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.pinyin.tone')}
        </label>
        <ShareButton
          getState={() => ({
            i: input,
            s: separator,
            c: letterCase,
            ton: tone ? 1 : 0,
          })}
        />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.pinyin.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.pinyin.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('tools.pinyin.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.pinyin.err.${result.error}`)}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.pinyin.hint')}</p>
    </div>
  );
}
