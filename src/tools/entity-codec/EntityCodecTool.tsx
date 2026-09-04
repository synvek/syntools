import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar, SwapButton } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  decodeEntities,
  encodeEntities,
  type Direction,
  type EncodeMode,
  type EncodeScope,
} from './core';

const MODES: EncodeMode[] = ['named', 'decimal', 'hex', 'unicode'];

/** HTML 实体 / Unicode 编解码（Tasks T36）：文案全部走 i18n（T29 约定） */
export default function EntityCodecTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '', d: 'encode', m: 'named', s: 'special' }), []);
  const [input, setInput] = useState(init.i);
  const [direction, setDirection] = useState<Direction>(init.d === 'decode' ? 'decode' : 'encode');
  const [mode, setMode] = useState<EncodeMode>(
    MODES.includes(init.m as EncodeMode) ? (init.m as EncodeMode) : 'named',
  );
  const [scope, setScope] = useState<EncodeScope>(init.s === 'nonascii' ? 'nonascii' : 'special');

  const encoded = useMemo(
    () => (direction === 'encode' && input ? encodeEntities(input, mode, scope) : null),
    [direction, input, mode, scope],
  );
  const decoded = useMemo(
    () => (direction === 'decode' && input ? decodeEntities(input) : null),
    [direction, input],
  );

  const output = encoded?.ok ? encoded.value : decoded?.ok ? decoded.value.output : '';
  const unknown = decoded?.ok ? decoded.value.unknown : [];

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.entity.direction')}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="encode">{t('tools.entity.encode')}</option>
            <option value="decode">{t('tools.entity.decode')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.entity.mode')}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as EncodeMode)}
            disabled={direction !== 'encode'}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`tools.entity.modes.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.entity.scope')}
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as EncodeScope)}
            disabled={direction !== 'encode'}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="special">{t('tools.entity.scopes.special')}</option>
            <option value="nonascii">{t('tools.entity.scopes.nonascii')}</option>
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, d: direction, m: mode, s: scope })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.entity.input')}
          value={input}
          onChange={setInput}
          placeholder={
            direction === 'encode'
              ? t('tools.entity.inputEncodePlaceholder')
              : t('tools.entity.inputDecodePlaceholder')
          }
          actions={
            <>
              <SwapButton onSwap={() => setInput(output)} disabled={!output} />
              <ClearButton onClick={() => setInput('')} disabled={!input} />
            </>
          }
        />
        <IOTextArea
          label={t('tools.entity.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {unknown.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t('tools.entity.unknown')}: {unknown.join(' ')}
        </p>
      )}
    </div>
  );
}
