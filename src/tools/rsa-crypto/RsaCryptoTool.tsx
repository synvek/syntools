import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  generateRsaKeyPair,
  rsaDecrypt,
  rsaEncrypt,
  rsaSign,
  rsaVerify,
  type RsaKeyBits,
} from './core';

type Mode = 'generate' | 'encrypt' | 'decrypt' | 'sign' | 'verify';

export default function RsaCryptoTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('generate');
  const [bits, setBits] = useState<RsaKeyBits>(2048);
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    const r = await generateRsaKeyPair(bits);
    if (r.ok) {
      setPublicKey(r.value.publicKey);
      setPrivateKey(r.value.privateKey);
    } else {
      setError(t('tools.rsa-crypto.errors.GENERATE_FAILED'));
    }
  };

  const run = async () => {
    setError(null);
    if (mode === 'encrypt') {
      const r = await rsaEncrypt(publicKey, input);
      if (r.ok) setOutput(r.value);
      else setError(t(`tools.rsa-crypto.errors.${r.error}`));
    } else if (mode === 'decrypt') {
      const r = await rsaDecrypt(privateKey, input);
      if (r.ok) setOutput(r.value);
      else setError(t(`tools.rsa-crypto.errors.${r.error}`));
    } else if (mode === 'sign') {
      const r = await rsaSign(privateKey, input);
      if (r.ok) setOutput(r.value);
      else setError(t(`tools.rsa-crypto.errors.${r.error}`));
    } else if (mode === 'verify') {
      const r = await rsaVerify(publicKey, input, output);
      if (r.ok)
        setError(r.value ? t('tools.rsa-crypto.verified') : t('tools.rsa-crypto.notVerified'));
      else setError(t(`tools.rsa-crypto.errors.${r.error}`));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setOutput('');
            setError(null);
          }}
          aria-label={t('tools.rsa-crypto.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="generate">{t('tools.rsa-crypto.modes.generate')}</option>
          <option value="encrypt">{t('tools.rsa-crypto.modes.encrypt')}</option>
          <option value="decrypt">{t('tools.rsa-crypto.modes.decrypt')}</option>
          <option value="sign">{t('tools.rsa-crypto.modes.sign')}</option>
          <option value="verify">{t('tools.rsa-crypto.modes.verify')}</option>
        </select>
        {mode === 'generate' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.rsa-crypto.bits')}
            <select
              value={bits}
              onChange={(e) => setBits(Number(e.target.value) as RsaKeyBits)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
            </select>
          </label>
        )}
        <ClearButton
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        />
      </OptionBar>

      {mode === 'generate' ? (
        <>
          <button
            type="button"
            onClick={generate}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {t('tools.rsa-crypto.generate')}
          </button>
          <IOTextArea
            label={t('tools.rsa-crypto.publicKey')}
            value={publicKey}
            onChange={setPublicKey}
            rows={5}
            actions={publicKey ? <CopyButton text={publicKey} /> : undefined}
          />
          <IOTextArea
            label={t('tools.rsa-crypto.privateKey')}
            value={privateKey}
            onChange={setPrivateKey}
            rows={9}
            actions={privateKey ? <CopyButton text={privateKey} /> : undefined}
          />
        </>
      ) : (
        <>
          {(mode === 'encrypt' || mode === 'verify') && (
            <IOTextArea
              label={t('tools.rsa-crypto.publicKey')}
              value={publicKey}
              onChange={setPublicKey}
              rows={5}
              actions={publicKey ? <CopyButton text={publicKey} /> : undefined}
            />
          )}
          {(mode === 'decrypt' || mode === 'sign') && (
            <IOTextArea
              label={t('tools.rsa-crypto.privateKey')}
              value={privateKey}
              onChange={setPrivateKey}
              rows={9}
              actions={privateKey ? <CopyButton text={privateKey} /> : undefined}
            />
          )}
          <IOTextArea
            label={mode === 'verify' ? t('tools.rsa-crypto.message') : t('tools.rsa-crypto.input')}
            value={input}
            onChange={setInput}
            rows={4}
            actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
          />
          {mode === 'verify' && (
            <IOTextArea
              label={t('tools.rsa-crypto.signature')}
              value={output}
              onChange={setOutput}
              rows={4}
              placeholder={t('tools.rsa-crypto.signaturePlaceholder')}
            />
          )}
          <button
            type="button"
            onClick={run}
            className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {t('tools.rsa-crypto.run')}
          </button>
          {mode !== 'verify' && (
            <IOTextArea
              label={t('tools.rsa-crypto.output')}
              value={output}
              readOnly
              rows={4}
              actions={output ? <CopyButton text={output} /> : undefined}
            />
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}
    </div>
  );
}
