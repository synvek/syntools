import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { isExpired, parseJwt, readTimeClaim, TIME_CLAIMS } from './core';

/** JWT 解析（Tasks T33）：文案全部走 i18n（T29 约定） */
export default function JwtParserTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '' }), []);
  const [input, setInput] = useState(init.i);

  const result = useMemo(() => parseJwt(input), [input]);
  const info = result.ok ? result.value : null;
  const expired = info ? isExpired(info.payload) : null;

  const headerJson = info ? JSON.stringify(info.header, null, 2) : '';
  const payloadJson = info ? JSON.stringify(info.payload, null, 2) : '';
  const showInput = input.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

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
          {/* 算法与时间类声明（exp 附带过期状态） */}
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
              value={payloadJson}
              readOnly
              rows={6}
              actions={<CopyButton text={payloadJson} disabled={!payloadJson} />}
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
    </div>
  );
}
