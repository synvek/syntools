import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { atbash, caesar, railFence, railFenceDecode, rot13 } from './core';

type Mode = 'caesar' | 'rot13' | 'atbash' | 'rail';

export default function CaesarCipherTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('caesar');
  const [shift, setShift] = useState(3);
  const [rails, setRails] = useState(3);
  const [railDecrypt, setRailDecrypt] = useState(false);
  const [input, setInput] = useState('');

  const output = useMemo(() => {
    if (!input) return '';
    switch (mode) {
      case 'caesar':
        return caesar(input, shift);
      case 'rot13':
        return rot13(input);
      case 'atbash':
        return atbash(input);
      case 'rail': {
        const r = railDecrypt ? railFenceDecode(input, rails) : railFence(input, rails);
        return r.ok ? r.value : '';
      }
    }
  }, [mode, shift, rails, railDecrypt, input]);

  const error = useMemo(() => {
    if (mode === 'rail' && rails < 2) return t('tools.caesar-cipher.errors.RAILS_TOO_SMALL');
    return null;
  }, [mode, rails, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          aria-label={t('tools.caesar-cipher.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="caesar">Caesar</option>
          <option value="rot13">ROT13</option>
          <option value="atbash">Atbash</option>
          <option value="rail">Rail Fence</option>
        </select>
        {mode === 'caesar' && (
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.caesar-cipher.shift')}
            <input
              type="number"
              value={shift}
              onChange={(e) => setShift(Number(e.target.value) || 0)}
              className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
        {mode === 'rail' && (
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.caesar-cipher.rails')}
            <input
              type="number"
              value={rails}
              min={2}
              onChange={(e) => setRails(Number(e.target.value) || 2)}
              className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
        {mode === 'rail' && (
          <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={railDecrypt}
              onChange={(e) => setRailDecrypt(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-700"
            />
            {t('tools.caesar-cipher.decrypt')}
          </label>
        )}
        <ClearButton onClick={() => setInput('')} disabled={!input} />
      </OptionBar>
      <IOTextArea
        label={t('tools.caesar-cipher.input')}
        value={input}
        onChange={setInput}
        rows={6}
        placeholder={t('tools.caesar-cipher.placeholder')}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <IOTextArea
        label={t('tools.caesar-cipher.output')}
        value={output}
        readOnly
        rows={6}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
    </div>
  );
}
