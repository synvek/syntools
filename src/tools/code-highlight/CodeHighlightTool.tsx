import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  DEFAULT_HIGHLIGHT,
  HIGHLIGHT_LANGUAGES,
  THEME_COLORS,
  buildHighlightSnippet,
  isHighlightLanguage,
  languageLabel,
  lineCount,
  type HighlightLanguage,
  type HighlightTheme,
} from './core';

function highlight(code: string, language: HighlightLanguage): string {
  const grammar = Prism.languages[language] ?? Prism.languages.javascript;
  return Prism.highlight(code || ' ', grammar, language);
}

/** 代码在线高亮 */
export default function CodeHighlightTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        i: 'function hello() {\n  return "world";\n}',
        l: DEFAULT_HIGHLIGHT.language,
        th: DEFAULT_HIGHLIGHT.theme,
        n: 1,
      }),
    [],
  );
  const [code, setCode] = useState(String(init.i || ''));
  const [language, setLanguage] = useState<HighlightLanguage>(
    isHighlightLanguage(String(init.l)) ? (init.l as HighlightLanguage) : 'javascript',
  );
  const [theme, setTheme] = useState<HighlightTheme>(init.th === 'light' ? 'light' : 'dark');
  const [showLineNumbers, setShowLineNumbers] = useState(Number(init.n) !== 0);

  const colors = THEME_COLORS[theme];
  const html = useMemo(() => highlight(code, language), [code, language]);
  const lines = lineCount(code || ' ');
  const snippet = useMemo(
    () => buildHighlightSnippet(html, language),
    [html, language],
  );

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeHighlight.language')}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as HighlightLanguage)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {HIGHLIGHT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {languageLabel(l)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeHighlight.theme')}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as HighlightTheme)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="dark">{t('tools.codeHighlight.themes.dark')}</option>
            <option value="light">{t('tools.codeHighlight.themes.light')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeHighlight.lineNumbers')}
        </label>
        <ShareButton
          getState={() => ({
            i: code,
            l: language,
            th: theme,
            n: showLineNumbers ? 1 : 0,
          })}
        />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.codeHighlight.input')}
          value={code}
          onChange={setCode}
          placeholder={t('tools.codeHighlight.placeholder')}
          actions={<ClearButton onClick={() => setCode('')} disabled={!code} />}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.codeHighlight.preview')}
            </span>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={code} disabled={!code.trim()} label={t('tools.codeHighlight.copyCode')} />
              <CopyButton
                text={snippet}
                disabled={!code.trim()}
                label={t('tools.codeHighlight.copyHtml')}
              />
            </div>
          </div>
          <div className="overflow-auto rounded-md border border-gray-200 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-950">
            <div
              data-theme={theme}
              className="code-highlight-panel code-image-card overflow-hidden rounded-lg"
              style={{
                background: colors.bg,
                color: colors.fg,
                border: `1px solid ${colors.border}`,
                padding: 16,
              }}
            >
              <div className="mb-2 text-xs opacity-60">{languageLabel(language)}</div>
              <div className="flex gap-3 font-mono text-sm leading-6">
                {showLineNumbers && (
                  <pre
                    className="select-none text-right"
                    style={{ color: colors.gutter }}
                  >
                    {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
                  </pre>
                )}
                <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre">
                  <code dangerouslySetInnerHTML={{ __html: html }} />
                </pre>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.codeHighlight.hint')}
          </p>
        </div>
      </div>
    </div>
  );
}
