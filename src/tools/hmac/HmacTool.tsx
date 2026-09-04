import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { computeHmac, type HmacAlgorithm, type HmacEncoding } from './core';

export default function HmacTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', k: '', a: 'SHA-256', e: 'hex' });
    const handoff = consumeHandoff('hmac');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [message, setMessage] = useState(init.i);
  const [secret, setSecret] = useState(init.k);
  const [algorithm, setAlgorithm] = useState<HmacAlgorithm>(
    init.a === 'SHA-512' ? 'SHA-512' : 'SHA-256',
  );
  const [encoding, setEncoding] = useState<HmacEncoding>(init.e === 'base64' ? 'base64' : 'hex');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      if (!message) {
        setOutput('');
        return;
      }
      const r = await computeHmac(message, secret, algorithm, encoding);
      if (cancelled) return;
      if (r.ok) setOutput(r.value);
      else {
        setOutput('');
        setError(translateToolError('tools.hmac', r));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [message, secret, algorithm, encoding, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.hmac.algorithm')}
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as HmacAlgorithm)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.hmac.encoding')}
          <select
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as HmacEncoding)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="hex">hex</option>
            <option value="base64">base64</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: message, k: secret, a: algorithm, e: encoding })} />
      </OptionBar>

      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder={t('tools.hmac.secretPlaceholder')}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.hmac.message')}
          value={message}
          onChange={setMessage}
          placeholder={t('tools.hmac.messagePlaceholder')}
          actions={<ClearButton onClick={() => setMessage('')} disabled={!message} />}
        />
        <IOTextArea
          label={t('common.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
