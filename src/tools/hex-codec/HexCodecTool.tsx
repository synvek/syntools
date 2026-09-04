import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { decodeHex, encodeHex } from './core';

type Direction = 'encode' | 'decode';

export default function HexCodecTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', d: 'encode', s: false });
    const handoff = consumeHandoff('hex-codec');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<Direction>(init.d === 'decode' ? 'decode' : 'encode');
  const [spaced, setSpaced] = useState(!!init.s);

  const result = useMemo(
    () => (direction === 'encode' ? encodeHex(input, spaced) : decodeHex(input)),
    [input, direction, spaced],
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
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="encode">{t('common.encode')}</option>
            <option value="decode">{t('common.decode')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={spaced}
            disabled={direction !== 'encode'}
            onChange={(e) => setSpaced(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          {t('tools.hex-codec.spaced')}
        </label>
        <SwapButton onSwap={swap} disabled={!result.ok} />
        <ShareButton getState={() => ({ i: input, d: direction, s: spaced })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('common.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.hex-codec.placeholder')}
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
          {translateToolError('tools.hex-codec', result)}
        </p>
      )}
    </div>
  );
}
