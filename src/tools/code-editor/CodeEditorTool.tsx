import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import type { ToolResult } from '@/core/types';
import { i18n } from '@/core/i18n';
import { translateToolError } from '@/core/i18n/helpers';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ShareButton } from '@/core/components/ShareButton';
import { downloadBlob } from '@/core/lib/download';
import { SHARE_PARAM, readSharedState } from '@/core/lib/share';
import { CodeSurface } from './CodeSurface';
import {
  DEFAULT_FILENAME,
  DEFAULT_LANG_ID,
  DEFAULT_THEME,
  IMPORT_ACCEPT,
  LANG_SPECS,
  buildExportFilename,
  buildSnippet,
  buildStandaloneHtml,
  checkImportFile,
  countStats,
  detectLanguageByExt,
  getLangSpec,
  isLangId,
  sanitizeFilename,
} from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { formatCode, isPrettierLanguage, type IndentOption } from './format';
import { highlightCode } from './prism';
import { registerCodeEditorStrings } from './strings';
import { CODE_THEMES, getTheme, isThemeId, themeCssVars, themeStyleBlock } from './themes';

// 工具文案随本 chunk 懒加载注册，不占用首屏语言包体积
registerCodeEditorStrings(i18n);

const SAMPLE_CODE = `public class HelloWorld {
  public static void main(String[] args) {
    System.out.println("Hello, SynTools!");
  }
}`;

const DRAFT_DEBOUNCE_MS = 1000;
type BusyKind = 'format' | 'png' | 'jpg' | 'svg' | null;
type Failure = Extract<ToolResult<unknown>, { ok: false }>;
type ImageKind = 'png' | 'jpg' | 'svg';

function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

/** 语法高亮代码编辑器：多语言格式化 + 10 套风格 + 源码 / HTML / 图片导出 */
export default function CodeEditorTool() {
  const { t } = useTranslation();
  const draft = useMemo(() => readDraft(), []);
  const hasShared = useMemo(() => new URLSearchParams(window.location.search).has(SHARE_PARAM), []);
  const init = useMemo(
    () =>
      readSharedState({
        i: SAMPLE_CODE,
        l: DEFAULT_LANG_ID,
        th: DEFAULT_THEME,
        ind: 2,
        n: 1,
        w: 0,
        f: DEFAULT_FILENAME,
      }),
    [],
  );
  const shared = hasShared ? init : null;
  const source = shared
    ? { code: init.i, lang: init.l, theme: init.th, ind: String(init.ind), file: init.f }
    : draft
      ? {
          code: draft.code,
          lang: draft.language,
          theme: draft.theme,
          ind: draft.indent,
          file: draft.filename,
        }
      : { code: init.i, lang: init.l, theme: init.th, ind: String(init.ind), file: init.f };

  const [code, setCode] = useState(source.code);
  const [languageId, setLanguageId] = useState(
    isLangId(source.lang) ? source.lang : DEFAULT_LANG_ID,
  );
  const [themeId, setThemeId] = useState(isThemeId(source.theme) ? source.theme : DEFAULT_THEME);
  const [indent, setIndent] = useState<IndentOption>(
    source.ind === 'tab' ? 'tab' : source.ind === '4' ? 4 : 2,
  );
  const [showLineNumbers, setShowLineNumbers] = useState(
    shared ? Number(init.n) !== 0 : (draft?.lineNumbers ?? true),
  );
  const [wordWrap, setWordWrap] = useState(
    shared ? Number(init.w) !== 0 : (draft?.wordWrap ?? false),
  );
  const [filename, setFilename] = useState((shared ? init.f : draft?.filename) || DEFAULT_FILENAME);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const spec = getLangSpec(languageId);
  const theme = getTheme(themeId);
  const themeVars = useMemo(() => themeCssVars(theme), [theme]);
  const highlighted = useMemo(() => highlightCode(code, spec.prism), [code, spec.prism]);
  const snippet = useMemo(() => buildSnippet(highlighted, spec), [highlighted, spec]);
  const stats = useMemo(() => countStats(code), [code]);
  const baseName = sanitizeFilename(filename);
  const exportName = buildExportFilename(filename, spec);
  const indentUnit = indent === 'tab' ? '\t' : ' '.repeat(indent);
  const canAct = Boolean(code.trim());

  // 停止输入后写入本地草稿
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSaved(
        writeDraft({
          code,
          language: languageId,
          theme: themeId,
          indent: String(indent),
          filename,
          lineNumbers: showLineNumbers,
          wordWrap,
        }),
      );
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [code, languageId, themeId, indent, filename, showLineNumbers, wordWrap]);

  const importFile = useCallback(async (file: File) => {
    const check = checkImportFile(file);
    if (!check.ok) {
      setFailure(check);
      return;
    }
    try {
      const text = await file.text();
      const detected = detectLanguageByExt(file.name);
      if (detected) setLanguageId(detected);
      setFilename(sanitizeFilename(file.name.replace(/\.[^.]+$/, '')));
      setCode(text);
      setFailure(null);
      setNotice(null);
    } catch {
      setFailure({ ok: false, error: 'READ_FAILED' });
    }
  }, []);

  const runFormat = useCallback(async () => {
    setBusy('format');
    const result = await formatCode(code, spec, indent);
    setBusy(null);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setCode(result.value.code);
    setFailure(null);
    setNotice(
      result.value.engine === 'fallback' && isPrettierLanguage(spec)
        ? t('tools.codeEditor.formatFallback')
        : t('tools.codeEditor.formatDone'),
    );
  }, [code, indent, spec, t]);

  const exportSource = useCallback(() => {
    if (!canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    downloadBlob(code, exportName, 'text/plain;charset=utf-8');
    setFailure(null);
  }, [canAct, code, exportName]);

  const exportHtml = useCallback(() => {
    if (!canAct) {
      setFailure({ ok: false, error: 'EMPTY' });
      return;
    }
    const html = buildStandaloneHtml(highlighted, spec, themeStyleBlock(theme), baseName);
    downloadBlob(html, `${baseName}.html`, 'text/html;charset=utf-8');
    setFailure(null);
  }, [baseName, canAct, highlighted, spec, theme]);

  const exportImage = useCallback(
    async (kind: ImageKind) => {
      const node = cardRef.current;
      if (!node || !canAct) {
        setFailure({ ok: false, error: 'EMPTY' });
        return;
      }
      setBusy(kind);
      try {
        const options = { cacheBust: true, pixelRatio: 2, backgroundColor: theme.bg };
        if (kind === 'png') {
          downloadDataUrl(await toPng(node, options), `${baseName}.png`);
        } else if (kind === 'jpg') {
          downloadDataUrl(await toJpeg(node, { ...options, quality: 0.95 }), `${baseName}.jpg`);
        } else {
          const dataUrl = await toSvg(node, options);
          const comma = dataUrl.indexOf(',');
          const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
          downloadBlob(
            decodeURIComponent(encoded),
            `${baseName}.svg`,
            'image/svg+xml;charset=utf-8',
          );
        }
        setFailure(null);
      } catch {
        setFailure({ ok: false, error: 'EXPORT_FAILED' });
      } finally {
        setBusy(null);
      }
    },
    [baseName, canAct, theme.bg],
  );

  const reset = useCallback(() => {
    setCode('');
    clearDraft();
    setFailure(null);
    setNotice(null);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.language')}
          <select
            value={languageId}
            onChange={(e) => setLanguageId(e.target.value)}
            aria-label={t('tools.codeEditor.language')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {LANG_SPECS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.theme')}
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            aria-label={t('tools.codeEditor.theme')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CODE_THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.indent')}
          <select
            value={String(indent)}
            onChange={(e) =>
              setIndent(e.target.value === 'tab' ? 'tab' : (Number(e.target.value) as 2 | 4))
            }
            aria-label={t('tools.codeEditor.indent')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="2">{t('tools.codeEditor.indent2')}</option>
            <option value="4">{t('tools.codeEditor.indent4')}</option>
            <option value="tab">{t('tools.codeEditor.indentTab')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeEditor.lineNumbers')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={(e) => setWordWrap(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          {t('tools.codeEditor.wordWrap')}
        </label>
        <button
          type="button"
          onClick={() => void runFormat()}
          disabled={busy !== null || !canAct}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === 'format' ? t('tools.codeEditor.formatting') : t('tools.codeEditor.format')}
        </button>
        <ShareButton
          getState={() => ({
            i: code,
            l: languageId,
            th: themeId,
            ind: String(indent),
            n: showLineNumbers ? 1 : 0,
            w: wordWrap ? 1 : 0,
            f: filename,
          })}
        />
      </OptionBar>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.codeEditor.editor')}
            </span>
            <ClearButton onClick={reset} disabled={!code} label={t('tools.codeEditor.clear')} />
          </div>
          <CodeSurface
            value={code}
            onChange={setCode}
            prismKey={spec.prism}
            themeVars={themeVars}
            indentUnit={indentUnit}
            showLineNumbers={showLineNumbers}
            wordWrap={wordWrap}
            placeholder={t('tools.codeEditor.placeholder')}
            ariaLabel={t('tools.codeEditor.editor')}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{t('tools.codeEditor.stats', stats)}</span>
            <span>{saved ? t('tools.codeEditor.saved') : t('tools.codeEditor.saving')}</span>
          </div>
          {wordWrap && <p className="text-xs text-gray-400">{t('tools.codeEditor.wrapHint')}</p>}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.codeEditor.preview')}
            </span>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={code} disabled={!canAct} label={t('tools.codeEditor.copyCode')} />
              <CopyButton
                text={snippet}
                disabled={!canAct}
                label={t('tools.codeEditor.copyHtml')}
              />
            </div>
          </div>
          <div
            ref={cardRef}
            className="ce-card"
            style={themeVars}
            data-theme={theme.mode}
            aria-label={t('tools.codeEditor.preview')}
          >
            <div className="ce-card-title">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-1">{spec.label}</span>
            </div>
            {canAct ? (
              <pre>
                <code dangerouslySetInnerHTML={{ __html: highlighted }} />
              </pre>
            ) : (
              <p style={{ color: theme.gutter }}>{t('tools.codeEditor.empty')}</p>
            )}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.codeEditor.import')}
        </span>
        <FileDropZone
          onFile={(file) => void importFile(file)}
          accept={IMPORT_ACCEPT}
          hint={t('tools.codeEditor.importHint')}
          formats={t('tools.codeEditor.importFormats')}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.codeEditor.filename')}
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={DEFAULT_FILENAME}
            aria-label={t('tools.codeEditor.filename')}
            className="w-40 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.codeEditor.finalName', { name: exportName })}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportSource}
            disabled={!canAct}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {t('tools.codeEditor.exportSource', { ext: spec.ext })}
          </button>
          <button
            type="button"
            onClick={exportHtml}
            disabled={!canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.codeEditor.exportHtml')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('png')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'png' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportPng')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('jpg')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'jpg' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportJpg')}
          </button>
          <button
            type="button"
            onClick={() => void exportImage('svg')}
            disabled={busy !== null || !canAct}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {busy === 'svg' ? t('tools.codeEditor.exporting') : t('tools.codeEditor.exportSvg')}
          </button>
        </div>
      </section>

      {failure && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.codeEditor', failure)}
        </p>
      )}
      {notice && !failure && (
        <p className="text-xs text-gray-500 dark:text-gray-400" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
