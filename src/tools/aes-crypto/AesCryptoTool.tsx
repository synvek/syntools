import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { decryptAes, encryptAes, type AesKeyMode } from './core';

type Direction = 'encrypt' | 'decrypt';

export default function AesCryptoTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', d: 'encrypt', m: 'passphrase', k: '', v: '' });
    const handoff = consumeHandoff('aes-crypto');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<Direction>(init.d === 'decrypt' ? 'decrypt' : 'encrypt');
  const [mode, setMode] = useState<AesKeyMode>(init.m === 'raw' ? 'raw' : 'passphrase');
  const [secret, setSecret] = useState(init.k);
  const [ivHex, setIvHex] = useState(init.v);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      if (!input) {
        setOutput('');
        return;
      }
      const r =
        direction === 'encrypt'
          ? await encryptAes({
              plaintext: input,
              mode,
              passphrase: mode === 'passphrase' ? secret : undefined,
              keyHex: mode === 'raw' ? secret : undefined,
              ivHex: ivHex || undefined,
            })
          : await decryptAes({
              ciphertext: input,
              mode,
              passphrase: mode === 'passphrase' ? secret : undefined,
              keyHex: mode === 'raw' ? secret : undefined,
            });
      if (cancelled) return;
      if (r.ok) setOutput(r.value);
      else {
        setOutput('');
        setError(translateToolError('tools.aes-crypto', r));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [input, direction, mode, secret, ivHex, t]);

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
            <option value="encrypt">{t('tools.aes-crypto.encrypt')}</option>
            <option value="decrypt">{t('tools.aes-crypto.decrypt')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.aes-crypto.keyMode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AesKeyMode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="passphrase">{t('tools.aes-crypto.passphrase')}</option>
            <option value="raw">{t('tools.aes-crypto.rawKey')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, d: direction, m: mode, k: secret, v: ivHex })} />
      </OptionBar>

      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder={
          mode === 'passphrase'
            ? t('tools.aes-crypto.passphrasePlaceholder')
            : t('tools.aes-crypto.keyHexPlaceholder')
        }
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      {direction === 'encrypt' && (
        <input
          type="text"
          value={ivHex}
          onChange={(e) => setIvHex(e.target.value)}
          placeholder={t('tools.aes-crypto.ivPlaceholder')}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={
            direction === 'encrypt'
              ? t('tools.aes-crypto.plaintext')
              : t('tools.aes-crypto.ciphertext')
          }
          value={input}
          onChange={setInput}
          placeholder={t('tools.aes-crypto.inputPlaceholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('common.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.aes-crypto.note')}</p>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
