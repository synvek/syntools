import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import { isOmmlSupported } from './latex';

interface MathDialogProps {
  /** null 表示未打开 */
  mode: 'insert' | 'edit' | null;
  initialLatex: string;
  initialDisplay: boolean;
  onCancel: () => void;
  onConfirm: (latex: string, display: boolean) => void;
  /** 编辑模式下的删除回调 */
  onRemove?: () => void;
}

/** 常用公式简称：一键填入，降低输入门槛 */
const PRESETS: { label: string; latex: string; display: boolean }[] = [
  { label: '分数', latex: '\\frac{a}{b}', display: false },
  { label: '根号', latex: '\\sqrt{x}', display: false },
  { label: '上下标', latex: 'x_i^2', display: false },
  { label: '求和', latex: '\\sum_{i=1}^{n} a_i', display: true },
  { label: '积分', latex: '\\int_a^b f(x)\\,dx', display: true },
  { label: '极限', latex: '\\lim_{x \\to 0} \\frac{\\sin x}{x}', display: true },
  { label: '矩阵式方程', latex: '\\left( a + b \\right)^2 = a^2 + 2ab + b^2', display: true },
];

/**
 * 公式编辑弹窗：上为 LaTeX 输入（等宽字体 + 行内/块级切换），下为 KaTeX 实时预览。
 * 解析失败时输入框描红并在预览位展示错误文案。
 */
export function MathDialog({
  mode,
  initialLatex,
  initialDisplay,
  onCancel,
  onConfirm,
  onRemove,
}: MathDialogProps) {
  const { t } = useTranslation();
  const [latex, setLatex] = useState(initialLatex);
  const [display, setDisplay] = useState(initialDisplay);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!mode) return;
    setLatex(initialLatex);
    setDisplay(initialDisplay);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [mode, initialLatex, initialDisplay]);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, onCancel]);

  const preview = useMemo(() => {
    const source = latex.trim();
    if (!source) return { html: '', error: false };
    try {
      return {
        html: katex.renderToString(source, {
          displayMode: display,
          throwOnError: true,
          strict: false,
        }),
        error: false,
      };
    } catch {
      return { html: '', error: true };
    }
  }, [latex, display]);

  if (!mode) return null;

  const supported = latex.trim() ? isOmmlSupported(latex) : true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-math-dialog-title"
        data-testid="rich-text-math-dialog"
        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-math-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {mode === 'insert' ? t('tools.richText.mathInsert') : t('tools.richText.mathEdit')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.mathDialogDesc')}
        </p>

        <div className="mt-3 flex gap-1">
          {(['inline', 'block'] as const).map((option) => {
            const active = display === (option === 'block');
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setDisplay(option === 'block')}
                className={`h-7 rounded-md border px-2 text-xs transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {option === 'inline'
                  ? t('tools.richText.mathInline')
                  : t('tools.richText.mathBlock')}
              </button>
            );
          })}
        </div>

        <textarea
          ref={inputRef}
          rows={3}
          value={latex}
          spellCheck={false}
          onChange={(event) => setLatex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (latex.trim() && !preview.error) onConfirm(latex.trim(), display);
            }
          }}
          placeholder={t('tools.richText.mathPlaceholder')}
          className={`mt-2 w-full resize-y rounded-md border bg-white px-2 py-1.5 font-mono text-sm text-gray-800 outline-none dark:bg-gray-800 dark:text-gray-100 ${
            preview.error
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-blue-500 dark:border-gray-600'
          }`}
        />

        <div className="mt-2 flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setLatex(preset.latex);
                setDisplay(preset.display);
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div
          data-testid="rich-text-math-preview"
          className="mt-3 min-h-16 overflow-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40"
        >
          {preview.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('tools.richText.mathPreviewError')}
            </p>
          ) : preview.html ? (
            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t('tools.richText.mathPreviewEmpty')}
            </p>
          )}
        </div>

        {!supported ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {t('tools.richText.mathNotNative')}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {mode === 'edit' && onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="mr-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {t('tools.richText.mathRemove')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.mathCancel')}
          </button>
          <button
            type="button"
            disabled={!latex.trim() || preview.error}
            onClick={() => onConfirm(latex.trim(), display)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tools.richText.mathSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
