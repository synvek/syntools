import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { generateTotp, verifyTotp, type TotpDigits } from './core';

export default function TotpTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ s: '', d: 6, v: '' });
    const handoff = consumeHandoff('totp');
    return { ...shared, s: handoff ?? shared.s };
  }, []);
  const [secret, setSecret] = useState(init.s);
  const [digits, setDigits] = useState<TotpDigits>(init.d === 8 ? 8 : 6);
  const [verifyInput, setVerifyInput] = useState(init.v);
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!secret.trim()) {
        setCode('');
        setRemaining(0);
        setError(null);
        return;
      }
      const r = await generateTotp(secret, digits);
      if (cancelled) return;
      if (r.ok) {
        setCode(r.value.code);
        setRemaining(r.value.remaining);
        setError(null);
      } else {
        setCode('');
        setError(translateToolError('tools.totp', r));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [secret, digits, t]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!verifyInput.trim() || !secret.trim()) {
        setVerifyResult(null);
        return;
      }
      const r = await verifyTotp(secret, verifyInput, digits);
      if (cancelled) return;
      if (r.ok) setVerifyResult(r.value);
      else setVerifyResult(null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [verifyInput, secret, digits]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.totp.digits')}
          <select
            value={digits}
            onChange={(e) => setDigits(Number(e.target.value) as TotpDigits)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={6}>6</option>
            <option value={8}>8</option>
          </select>
        </label>
        <ShareButton getState={() => ({ s: secret, d: digits, v: verifyInput })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.totp.secret')}
        value={secret}
        onChange={setSecret}
        rows={2}
        placeholder={t('tools.totp.secretPlaceholder')}
        actions={<ClearButton onClick={() => setSecret('')} disabled={!secret} />}
      />

      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('tools.totp.code')}</p>
            <p className="font-mono text-3xl font-semibold tracking-widest text-gray-900 dark:text-gray-100">
              {code || '------'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('tools.totp.remaining')}</p>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">{remaining}s</p>
          </div>
          <CopyButton text={code} disabled={!code} />
        </div>
      </div>

      <IOTextArea
        label={t('tools.totp.verify')}
        value={verifyInput}
        onChange={setVerifyInput}
        rows={2}
        placeholder={t('tools.totp.verifyPlaceholder')}
      />
      {verifyResult !== null && (
        <p
          className={`text-sm ${
            verifyResult
              ? 'text-green-700 dark:text-green-300'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {verifyResult ? t('tools.totp.verifyOk') : t('tools.totp.verifyFail')}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
