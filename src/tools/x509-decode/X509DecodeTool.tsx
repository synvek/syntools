import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { decodeX509, type X509Info } from './core';

export default function X509DecodeTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '' });
    const handoff = consumeHandoff('x509-decode');
    return { i: handoff ?? shared.i };
  }, []);
  const [input, setInput] = useState(init.i);
  const [info, setInfo] = useState<X509Info | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      if (!input.trim()) {
        setInfo(null);
        return;
      }
      const r = await decodeX509(input);
      if (cancelled) return;
      if (r.ok) setInfo(r.value);
      else {
        setInfo(null);
        setError(translateToolError('tools.x509-decode', r));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [input, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      <IOTextArea
        label={t('tools.x509-decode.input')}
        value={input}
        onChange={setInput}
        placeholder={t('tools.x509-decode.placeholder')}
        actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
      />

      {info && (
        <div className="grid gap-2">
          {(
            [
              ['pemType', info.pemType],
              ['derLength', String(info.derLength)],
              ['sha256', info.sha256],
              ['sha1', info.sha1],
              ['subject', info.subject ?? '—'],
              ['issuer', info.issuer ?? '—'],
            ] as const
          ).map(([key, value]) => (
            <div
              key={key}
              className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="w-28 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                {t(`tools.x509-decode.fields.${key}`)}
              </span>
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-gray-900 dark:text-gray-100">
                {value}
              </code>
              <CopyButton text={value === '—' ? '' : value} disabled={value === '—'} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
