import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  UNICODE_FORMATS,
  processUnicode,
  type UnicodeDirection,
  type UnicodeFormat,
} from './core';

const FORMAT_SET = new Set<string>(UNICODE_FORMATS);

/** Unicode 在线编码 / 解码 */
export default function UnicodeCodecTool() {
  const { t } = useTranslation();
  const init = useMemo(() => readSharedState({ i: '', d: 'encode', f: 'js' }), []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<UnicodeDirection>(
    init.d === 'decode' ? 'decode' : 'encode',
  );
  const [format, setFormat] = useState<UnicodeFormat>(
    FORMAT_SET.has(init.f) ? (init.f as UnicodeFormat) : 'js',
  );

  const result = useMemo(
    () => processUnicode(input, direction, format),
    [input, direction, format],
  );
  const output = result.ok ? result.value : '';

  const swap = () => {
    if (!result.ok) return;
    setInput(result.value);
    setDirection(direction === 'encode' ? 'decode' : 'encode');
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('common.operation')}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as UnicodeDirection)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="encode">{t('common.encode')}</option>
            <option value="decode">{t('common.decode')}</option>
          </select>
        </label>
        {direction === 'encode' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.unicode.format')}
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as UnicodeFormat)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            >
              {UNICODE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`tools.unicode.formats.${f}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <SwapButton onSwap={swap} disabled={!result.ok || !input} />
        <ShareButton getState={() => ({ i: input, d: direction, f: format })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={direction === 'encode' ? t('tools.unicode.raw') : t('tools.unicode.encoded')}
          value={input}
          onChange={setInput}
          placeholder={
            direction === 'encode'
              ? t('tools.unicode.placeholderEncode')
              : t('tools.unicode.placeholderDecode')
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
          {t(`tools.unicode.err.${result.error}`)}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.unicode.hint')}</p>
    </div>
  );
}
