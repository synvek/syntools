import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { Icon } from '@/core/components/Icon';
import { readSharedState } from '@/core/lib/share';
import { COLOR_FORMATS, formatColor, parseColor } from './core';

/** 颜色转换（Tasks T39）：文案全部走 i18n（T29 约定） */
export default function ColorConverterTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '#3b82f6' }), []);
  const [input, setInput] = useState(init.i);

  const result = useMemo(() => parseColor(input), [input]);
  const color = result.ok ? result.value : null;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.color.input')}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('tools.color.placeholder')}
            spellCheck={false}
            className="w-full max-w-sm rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
        <ShareButton getState={() => ({ i: input })} />
      </OptionBar>

      {!result.ok && input.trim() && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.color.err.${result.error}`)}
        </p>
      )}

      {color && (
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* 预览色块 */}
          <div className="flex flex-col items-center gap-1">
            <div
              aria-label={t('tools.color.preview')}
              role="img"
              className="h-32 w-32 rounded-lg border border-gray-300 dark:border-gray-700"
              style={{ backgroundColor: formatColor(color, 'hex') }}
            />
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {formatColor(color, 'hex')}
            </span>
          </div>

          {/* 三种格式输出 */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {COLOR_FORMATS.map((format) => {
              const value = formatColor(color, format);
              return (
                <div
                  key={format}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span className="w-10 shrink-0 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    {format}
                  </span>
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
                    {value}
                  </code>
                  <CopyButton text={value} />
                </div>
              );
            })}
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Icon name="search" className="h-3 w-3" />
              {t('tools.color.supportHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
