import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton, OptionBar } from '@/core/components/ActionButtons';
import { Icon } from '@/core/components/Icon';
import { pbkdf2, type HashEncoding, type Pbkdf2Hash } from './core';

export default function PasswordHashTool() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [salt, setSalt] = useState('');
  const [iterations, setIterations] = useState(100_000);
  const [hash, setHash] = useState<Pbkdf2Hash>('SHA-256');
  const [encoding, setEncoding] = useState<HashEncoding>('hex');
  const [reveal, setReveal] = useState(false);
  const [output, setOutput] = useState('');
  const [format, setFormat] = useState('');
  const [saltOut, setSaltOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    const r = await pbkdf2({ password, salt, iterations, hash, encoding });
    if (r.ok) {
      setOutput(r.value.hash);
      setFormat(r.value.format);
      setSaltOut(r.value.salt);
    } else {
      setOutput('');
      setFormat('');
      setSaltOut('');
      setError(t(`tools.password-hash.errors.${r.error}`));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.password-hash.hash')}
          <select
            value={hash}
            onChange={(e) => setHash(e.target.value as Pbkdf2Hash)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.password-hash.encoding')}
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as HashEncoding)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="hex">HEX</option>
            <option value="base64">Base64</option>
          </select>
        </label>
      </OptionBar>

      <div className="flex items-center gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('tools.password-hash.passwordPlaceholder')}
          aria-label={t('tools.password-hash.password')}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={t('tools.password-hash.toggleReveal')}
          className="rounded-md border border-gray-300 px-2 py-2 text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <Icon name={reveal ? 'view-off' : 'view'} className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.password-hash.salt')}
          <input
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            placeholder={t('tools.password-hash.saltPlaceholder')}
            className="w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.password-hash.iterations')}
          <input
            type="number"
            min={1}
            value={iterations}
            onChange={(e) => setIterations(Math.max(1, Number(e.target.value) || 1))}
            className="w-36 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          type="button"
          onClick={run}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t('tools.password-hash.run')}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <IOTextArea
        label={t('tools.password-hash.result')}
        value={output}
        readOnly
        rows={3}
        actions={output ? <CopyButton text={output} /> : undefined}
      />
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{t('tools.password-hash.saltLabel')}</span>
        <code className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{saltOut}</code>
        {format && (
          <DownloadButton content={format} filename="pbkdf2.txt" label={t('common.download')} />
        )}
      </div>
    </div>
  );
}
