import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** PDF 导出模式：文字（可检索）/ 快照（高保真图片） */
export type PdfMode = 'text' | 'snapshot';

interface PdfModeDialogProps {
  open: boolean;
  initialMode: PdfMode;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (mode: PdfMode) => void;
}

/**
 * 导出 PDF 前的模式选择对话框：
 * 点「导出 PDF」时弹出，选择导出方式（文字可检索 / 高保真快照）后再执行导出。
 */
export function PdfModeDialog({
  open,
  initialMode,
  busy,
  onCancel,
  onConfirm,
}: PdfModeDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PdfMode>(initialMode);
  const firstRef = useRef<HTMLButtonElement | null>(null);

  // 每次打开时同步最近一次选择，并把焦点移到第一个选项
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    const timer = window.setTimeout(() => firstRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const options: { value: PdfMode; title: string; hint: string }[] = [
    { value: 'text', title: t('tools.richText.modeText'), hint: t('tools.richText.modeTextHint') },
    {
      value: 'snapshot',
      title: t('tools.richText.modeSnapshot'),
      hint: t('tools.richText.modeSnapshotHint'),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rte-pdf-dialog-title"
        data-testid="rich-text-pdf-dialog"
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="rte-pdf-dialog-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {t('tools.richText.pdfDialogTitle')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('tools.richText.pdfDialogDesc')}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {options.map((option, index) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                ref={index === 0 ? firstRef : undefined}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(option.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      active ? 'border-blue-600' : 'border-gray-400'
                    }`}
                  >
                    {active ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {option.title}
                  </span>
                </span>
                <span className="mt-1 block pl-6 text-xs text-gray-500 dark:text-gray-400">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.pdfDialogCancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(mode)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tools.richText.exportPdf')}
          </button>
        </div>
      </div>
    </div>
  );
}
