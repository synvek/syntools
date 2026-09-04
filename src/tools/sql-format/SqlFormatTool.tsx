import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import { formatSqlText, SQL_LANGUAGES, type KeywordCase, type SqlLanguage } from './core';

const isLanguage = (v: string): v is SqlLanguage => SQL_LANGUAGES.includes(v as SqlLanguage);
const KEYWORD_CASES: KeywordCase[] = ['upper', 'lower', 'preserve'];

/** SQL 格式化（Tasks T35）：文案全部走 i18n（T29 约定） */
export default function SqlFormatTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '', l: 'sql', n: 2, k: 'upper' }), []);
  const [input, setInput] = useState(init.i);
  const [language, setLanguage] = useState<SqlLanguage>(isLanguage(init.l) ? init.l : 'sql');
  const [tabWidth, setTabWidth] = useState(init.n === 4 ? 4 : 2);
  const [keywordCase, setKeywordCase] = useState<KeywordCase>(
    KEYWORD_CASES.includes(init.k as KeywordCase) ? (init.k as KeywordCase) : 'upper',
  );

  const result = useMemo(
    () => formatSqlText(input, { language, tabWidth, keywordCase }),
    [input, language, tabWidth, keywordCase],
  );
  const output = result.ok ? result.value : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.sql.dialect')}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as SqlLanguage)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {SQL_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`tools.sql.languages.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.sql.indent')}
          <select
            value={tabWidth}
            onChange={(e) => setTabWidth(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.sql.keywordCase')}
          <select
            value={keywordCase}
            onChange={(e) => setKeywordCase(e.target.value as KeywordCase)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {KEYWORD_CASES.map((c) => (
              <option key={c} value={c}>
                {t(`tools.sql.cases.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <ShareButton getState={() => ({ i: input, l: language, n: tabWidth, k: keywordCase })} />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.sql.input')}
          value={input}
          onChange={setInput}
          placeholder={t('tools.sql.placeholder')}
          actions={<ClearButton onClick={() => setInput('')} disabled={!input} />}
        />
        <IOTextArea
          label={t('tools.sql.output')}
          value={output}
          readOnly
          actions={<CopyButton text={output} disabled={!output} />}
        />
      </div>

      {input.trim() && !result.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.sql.err.${result.error}`)}
        </p>
      )}
    </div>
  );
}
