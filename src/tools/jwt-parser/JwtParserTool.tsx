import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { translateToolError } from '@/core/i18n/helpers';
import { readSharedState } from '@/core/lib/share';
import { consumeHandoff } from '@/core/lib/handoff';
import { isExpired, parseJwt, readTimeClaim, signJwtHs256, TIME_CLAIMS } from './core';

type Mode = 'parse' | 'sign';

/** JWT 解析 / HS256 签发 */
export default function JwtParserTool() {
  const { t } = useTranslation();
  const init = useMemo(() => {
    const shared = readSharedState({ i: '', m: 'parse', p: '{\n  "sub": "123"\n}', s: '' });
    const handoff = consumeHandoff('jwt-parser');
    return { ...shared, i: handoff ?? shared.i };
  }, []);
  const [mode, setMode] = useState<Mode>(init.m === 'sign' ? 'sign' : 'parse');
  const [input, setInput] = useState(init.i);
  const [payloadJson, setPayloadJson] = useState(init.p);
  const [secret, setSecret] = useState(init.s);
  const [signedToken, setSignedToken] = useState('');
  const [signError, setSignError] = useState<string | null>(null);

  const result = useMemo(() => parseJwt(input), [input]);
  const info = result.ok ? result.value : null;
  const expired = info ? isExpired(info.payload) : null;

  const headerJson = info ? JSON.stringify(info.header, null, 2) : '';
  const payloadOut = info ? JSON.stringify(info.payload, null, 2) : '';
  const showInput = input.trim().length > 0;

  useEffect(() => {
    if (mode !== 'sign') return;
    let cancelled = false;
    const run = async () => {
      setSignError(null);
      if (!payloadJson.trim()) {
        setSignedToken('');
        return;
      }
      const r = await signJwtHs256(payloadJson, secret);
      if (cancelled) return;
      if (r.ok) setSignedToken(r.value);
      else {
        setSignedToken('');
        setSignError(translateToolError('tools.jwt', r));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, payloadJson, secret, t]);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.jwt.mode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="parse">{t('tools.jwt.modes.parse')}</option>
            <option value="sign">{t('tools.jwt.modes.sign')}</option>
          </select>
        </label>
        <ShareButton
          getState={() => ({ i: input, m: mode, p: payloadJson, s: secret })}
        />
      </OptionBar>

      {mode === 'parse' ? (
        <>
          <IOTextArea
            label={t('tools.jwt.inputLabel')}
            value={input}
            onChange={setInput}
            placeholder={t('tools.jwt.inputPlaceholder')}
            actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
          />

          {showInput && !result.ok && result.error !== 'EMPTY' && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.jwt.err.${result.error}`)}
            </p>
          )}

          {info && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {info.alg && (
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {t('tools.jwt.alg')}: {info.alg}
                  </span>
                )}
                {TIME_CLAIMS.map((claim) => {
                  const value = readTimeClaim(info.payload, claim);
                  if (value === null) return null;
                  return (
                    <span
                      key={claim}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {t(`tools.jwt.claims.${claim}`)}: {new Date(value * 1000).toLocaleString()}
                    </span>
                  );
                })}
                {expired !== null && (
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      expired
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    }`}
                  >
                    {expired ? t('tools.jwt.expired') : t('tools.jwt.notExpired')}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4 lg:flex-row">
                <IOTextArea
                  label={t('tools.jwt.header')}
                  value={headerJson}
                  readOnly
                  rows={6}
                  actions={<CopyButton text={headerJson} disabled={!headerJson} />}
                />
                <IOTextArea
                  label={t('tools.jwt.payload')}
                  value={payloadOut}
                  readOnly
                  rows={6}
                  actions={<CopyButton text={payloadOut} disabled={!payloadOut} />}
                />
              </div>

              <IOTextArea
                label={t('tools.jwt.signature')}
                value={info.signature}
                readOnly
                rows={2}
                actions={<CopyButton text={info.signature} disabled={!info.signature} />}
              />

              <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.jwt.note')}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t('tools.jwt.secretPlaceholder')}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
          <IOTextArea
            label={t('tools.jwt.payloadJson')}
            value={payloadJson}
            onChange={setPayloadJson}
            placeholder={t('tools.jwt.payloadPlaceholder')}
            rows={8}
            actions={<ClearButton onClick={() => setPayloadJson('')} disabled={!payloadJson} />}
          />
          <IOTextArea
            label={t('tools.jwt.signedToken')}
            value={signedToken}
            readOnly
            rows={4}
            actions={<CopyButton text={signedToken} disabled={!signedToken} />}
          />
          {signError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {signError}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.jwt.signNote')}</p>
        </>
      )}
    </div>
  );
}
