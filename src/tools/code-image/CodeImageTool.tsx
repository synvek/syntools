import { useMemo, useRef, useState } from 'react';
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
import { toPng } from 'html-to-image';
import { IOTextArea } from '@/core/components/IOTextArea';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  CODE_LANGUAGES,
  DEFAULT_CODE_IMAGE,
  THEME_COLORS,
  lineCount,
  type CodeLanguage,
  type CodeTheme,
} from './core';

const LANG_SET = new Set<string>(CODE_LANGUAGES);

function highlight(code: string, language: CodeLanguage): string {
  const grammar = Prism.languages[language] ?? Prism.languages.javascript;
  return Prism.highlight(code, grammar, language);
}

/** 代码生成图片：高亮预览并导出 PNG */
export default function CodeImageTool() {
  const { t } = useTranslation();
  const init = useMemo(
    () =>
      readSharedState({
        i: 'function hello() {\n  return "world";\n}',
        l: DEFAULT_CODE_IMAGE.language,
        th: DEFAULT_CODE_IMAGE.theme,
        n: 1,
        p: DEFAULT_CODE_IMAGE.padding,
      }),
    [],
  );
  const [code, setCode] = useState(init.i);
  const [language, setLanguage] = useState<CodeLanguage>(
    LANG_SET.has(init.l) ? (init.l as CodeLanguage) : 'javascript',
  );
  const [theme, setTheme] = useState<CodeTheme>(init.th === 'light' ? 'light' : 'dark');
  const [showLineNumbers, setShowLineNumbers] = useState(Number(init.n) !== 0);
  const [padding, setPadding] = useState(Number(init.p) || 24);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const colors = THEME_COLORS[theme];
  const html = useMemo(() => highlight(code || ' ', language), [code, language]);
  const lines = lineCount(code || ' ');

  const download = async () => {
    const node = cardRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: colors.bg,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `code-${language}-${Date.now()}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeImage.language')}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeImage.theme')}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as CodeTheme)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="dark">{t('tools.codeImage.themes.dark')}</option>
            <option value="light">{t('tools.codeImage.themes.light')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeImage.lineNumbers')}
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeImage.padding')}
          <input
            type="range"
            min={12}
            max={48}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => void download()}
          disabled={exporting || !code.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t('tools.codeImage.exporting') : t('tools.codeImage.download')}
        </button>
        <ShareButton
          getState={() => ({
            i: code,
            l: language,
            th: theme,
            n: showLineNumbers ? 1 : 0,
            p: padding,
          })}
        />
      </OptionBar>

      <div className="flex flex-col gap-4 lg:flex-row">
        <IOTextArea
          label={t('tools.codeImage.input')}
          value={code}
          onChange={setCode}
          placeholder={t('tools.codeImage.placeholder')}
          actions={<ClearButton onClick={() => setCode('')} disabled={!code} />}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.codeImage.preview')}
          </span>
          <div className="overflow-auto rounded-md border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-950">
            <div
              ref={cardRef}
              data-theme={theme}
              className="code-image-card mx-auto max-w-full overflow-hidden rounded-xl shadow-lg"
              style={{
                background: colors.bg,
                color: colors.fg,
                padding,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs opacity-60">
                  {language === 'markup' ? 'html' : language}
                </span>
              </div>
              <div className="flex gap-3 font-mono text-sm leading-6">
                {showLineNumbers && (
                  <pre
                    className="select-none text-right"
                    style={{ color: colors.gutter }}
                  >
                    {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
                  </pre>
                )}
                <pre className="code-image-pre min-w-0 flex-1 overflow-x-auto whitespace-pre">
                  <code dangerouslySetInnerHTML={{ __html: html }} />
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
