import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { decodeMorse, encodeMorse } from './core';

export default function MorseCodeTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');

  const output = useMemo(() => {
    if (mode === 'encode') return encodeMorse(input);
    const r = decodeMorse(input);
    return r.ok ? r.value : '';
  }, [mode, input]);
  const error = useMemo(() => {
    if (mode === 'decode' && input) {
      const r = decodeMorse(input);
      if (!r.ok) return t(`tools.morse-code.errors.${r.error}`);
    }
    return null;
  }, [mode, input, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <div className="flex rounded-md border border-gray-300 dark:border-gray-700">
          {(['encode', 'decode'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              {t(`tools.morse-code.modes.${m}`)}
            </button>
          ))}
        </div>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
      </OptionBar>
      <IOTextArea
        label={t('tools.morse-code.input')}
        value={input}
        onChange={setInput}
        rows={6}
        placeholder={t('tools.morse-code.placeholder')}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <IOTextArea
        label={t('tools.morse-code.output')}
        value={output}
        readOnly
        rows={6}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
    </div>
  );
}
