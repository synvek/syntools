import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import 'katex/dist/katex.min.css';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  CLASSIC_FORMULAS,
  LATEX_CATEGORIES,
  formatSnippetTooltip,
  insertAtCursor,
  isLatexCategoryId,
  renderLatex,
  wrapLatexHtml,
  type LatexCategory,
  type LatexExportFormat,
} from './core';

const DEFAULT_TEX = 'E = mc^2';
const DEFAULT_CATEGORY: LatexCategory['id'] = 'operators';

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** LaTeX 数学公式编辑器 */
export default function LatexEditorTool() {
  const { t, i18n } = useTranslation();
  const init = useMemo(
    () => readSharedState({ i: DEFAULT_TEX, d: 1, c: DEFAULT_CATEGORY }),
    [],
  );
  const [input, setInput] = useState(String(init.i || DEFAULT_TEX));
  const [displayMode, setDisplayMode] = useState(Number(init.d) !== 0);
  const [categoryId, setCategoryId] = useState<LatexCategory['id']>(() =>
    isLatexCategoryId(String(init.c)) ? (init.c as LatexCategory['id']) : DEFAULT_CATEGORY,
  );
  const [exporting, setExporting] = useState<LatexExportFormat | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const result = useMemo(
    () => renderLatex(input, { displayMode }),
    [input, displayMode],
  );

  const htmlSnippet = result.ok ? wrapLatexHtml(result.value, displayMode) : '';
  const category = LATEX_CATEGORIES.find((c) => c.id === categoryId) ?? LATEX_CATEGORIES[0];

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const applyInsert = (snippet: string, replaceAll = false) => {
    if (replaceAll) {
      setInput(snippet);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(snippet.length, snippet.length);
      });
      return;
    }
    const el = textareaRef.current;
    const start = el ? el.selectionStart : selectionRef.current.start;
    const end = el ? el.selectionEnd : selectionRef.current.end;
    const { value, cursor } = insertAtCursor(input, start, end, snippet);
    setInput(value);
    requestAnimationFrame(() => {
      const box = textareaRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
  };

  const exportImage = async (format: LatexExportFormat) => {
    const node = previewRef.current;
    if (!node || !result.ok) return;
    setExporting(format);
    try {
      const opts = {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      };
      if (format === 'png') {
        downloadDataUrl(await toPng(node, opts), 'latex.png');
      } else if (format === 'jpg') {
        downloadDataUrl(await toJpeg(node, { ...opts, quality: 0.95 }), 'latex.jpg');
      } else {
        const dataUrl = await toSvg(node, { cacheBust: true, backgroundColor: '#ffffff' });
        // data:image/svg+xml;charset=utf-8,... → 下载为文件
        const comma = dataUrl.indexOf(',');
        const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        const svgText = decodeURIComponent(encoded);
        downloadBlob(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }), 'latex.svg');
      }
    } finally {
      setExporting(null);
    }
  };

  const bytes = new TextEncoder().encode(input).length;

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={displayMode}
            onChange={(e) => setDisplayMode(e.target.checked)}
          />
          {t('tools.latex.displayMode')}
        </label>
        <ShareButton
          getState={() => ({
            i: input.slice(0, 1600),
            d: displayMode ? 1 : 0,
            c: categoryId,
          })}
        />
        <button
          type="button"
          onClick={() => exportImage('png')}
          disabled={!result.ok || exporting !== null}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {exporting === 'png' ? t('tools.latex.exporting') : t('tools.latex.downloadPng')}
        </button>
        <button
          type="button"
          onClick={() => exportImage('jpg')}
          disabled={!result.ok || exporting !== null}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {exporting === 'jpg' ? t('tools.latex.exporting') : t('tools.latex.downloadJpg')}
        </button>
        <button
          type="button"
          onClick={() => exportImage('svg')}
          disabled={!result.ok || exporting !== null}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting === 'svg' ? t('tools.latex.exporting') : t('tools.latex.downloadSvg')}
        </button>
      </OptionBar>

      <section className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('tools.latex.symbols')}
          </span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value as LatexCategory['id'])}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            aria-label={t('tools.latex.symbols')}
          >
            {LATEX_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(`tools.latex.categories.${c.id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto">
          {category.items.map((item) => (
            <button
              key={`${category.id}-${item.latex}-${item.label}`}
              type="button"
              title={formatSnippetTooltip(item, i18n.language)}
              aria-label={formatSnippetTooltip(item, i18n.language)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyInsert(item.latex)}
              className="min-h-11 min-w-11 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xl leading-none text-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-blue-500 dark:hover:bg-gray-800"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.latex.formulasTitle')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CLASSIC_FORMULAS.map((f) => (
            <button
              key={f.id}
              type="button"
              title={`${t(`tools.latex.formulas.${f.id}`)}\n${f.latex}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyInsert(f.latex, true)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-gray-800"
            >
              {t(`tools.latex.formulas.${f.id}`)}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {t('tools.latex.input')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t('io.stats', { chars: input.length, bytes })}
              </span>
              <ClearButton onClick={() => setInput('')} disabled={!input} />
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
            placeholder={t('tools.latex.placeholder')}
            rows={12}
            aria-label={t('tools.latex.input')}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        <div className="flex min-h-[12rem] flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('tools.latex.preview')}
            </span>
            <CopyButton text={htmlSnippet} disabled={!htmlSnippet} label={t('tools.latex.copyHtml')} />
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto rounded-md border border-gray-200 bg-white p-6 dark:border-gray-700">
            {result.ok ? (
              <div
                ref={previewRef}
                className="inline-block max-w-full overflow-x-auto bg-white p-4 text-gray-900"
                // KaTeX 输出为受信库生成的静态 HTML
                dangerouslySetInnerHTML={{ __html: result.value }}
              />
            ) : input.trim() ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {result.error === 'RENDER'
                  ? t('tools.latex.err.RENDER', {
                      message: String(result.params?.message || ''),
                    })
                  : t(`tools.latex.err.${result.error}`)}
              </p>
            ) : (
              <p className="text-sm text-gray-400">{t('tools.latex.empty')}</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.latex.hint')}</p>
    </div>
  );
}
