import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { gzipCompress, gzipDecompress } from './core';

type Direction = 'compress' | 'decompress';

export default function GzipTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', d: 'compress' });
    const handoff = consumeHandoff('gzip-tool');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<Direction>(
    init.d === 'decompress' ? 'decompress' : 'compress',
  );

  const result = useMemo(
    () => (direction === 'compress' ? gzipCompress(input) : gzipDecompress(input)),
    [input, direction],
  );
  const output = result.ok ? result.value : '';

  const swap = () => {
    if (!result.ok) return;
    setInput(result.value);
    setDirection(direction === 'compress' ? 'decompress' : 'compress');
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
            <option value="compress">{t('tools.gzip-tool.compress')}</option>
            <option value="decompress">{t('tools.gzip-tool.decompress')}</option>
          </select>
        </label>
        <SwapButton onSwap={swap} disabled={!result.ok} />
        <ShareButton getState={() => ({ i: input, d: direction })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('common.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.gzip-tool.placeholder')}
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
          {translateToolError('tools.gzip-tool', result)}
        </p>
      )}
    </div>
  );
}
