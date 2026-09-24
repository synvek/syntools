import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { encodeBase, decodeBase, type BaseAlphabet } from './core';

const ALPHABETS: BaseAlphabet[] = [
  'base16',
  'base32',
  'base32hex',
  'base64',
  'base64url',
  'base58',
];

export default function BaseEncodingTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [alphabet, setAlphabet] = useState<BaseAlphabet>('base64');
  const [input, setInput] = useState('');

  const result = useMemo(
    () => (mode === 'encode' ? encodeBase(alphabet, input) : decodeBase(alphabet, input)),
    [mode, alphabet, input],
  );
  const output = result.ok ? result.value : '';
  const error = result.ok ? null : t(`tools.base-encoding.errors.${result.error}`);

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
              {t(`tools.base-encoding.modes.${m}`)}
            </button>
          ))}
        </div>
        <select
          value={alphabet}
          onChange={(e) => setAlphabet(e.target.value as BaseAlphabet)}
          aria-label={t('tools.base-encoding.alphabet')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {ALPHABETS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </OptionBar>

      <IOTextArea
        label={t(`tools.base-encoding.input`)}
        value={input}
        onChange={setInput}
        rows={6}
        placeholder={t('tools.base-encoding.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <IOTextArea
        label={t('tools.base-encoding.output')}
        value={output}
        readOnly
        rows={6}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
    </div>
  );
}
