import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { convertKey, type KeyTarget } from './core';

const TARGETS: { value: KeyTarget; label: string }[] = [
  { value: 'pem', label: 'PEM' },
  { value: 'der', label: 'DER (Base64)' },
  { value: 'jwk', label: 'JWK' },
  { value: 'openssh', label: 'OpenSSH' },
];

export default function KeyConverterTool() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<KeyTarget>('jwk');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    const r = await convertKey(input, target);
    if (r.ok) setOutput(r.value);
    else {
      setOutput('');
      setError(t(`tools.key-converter.errors.${r.error}`));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.key-converter.target')}
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as KeyTarget)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {TARGETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <ClearButton
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        />
      </OptionBar>

      <IOTextArea
        label={t('tools.key-converter.input')}
        value={input}
        onChange={setInput}
        rows={8}
        placeholder={t('tools.key-converter.inputPlaceholder')}
      />
      <button
        type="button"
        onClick={run}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        {t('tools.key-converter.convert')}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={t('tools.key-converter.output')}
        value={output}
        readOnly
        rows={8}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
    </div>
  );
}
