import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton } from '@/core/components/ActionButtons';
import { PdfNextSteps } from '@/core/components/PdfNextSteps';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  fileToBytes,
  loadPdfFromFile,
  openPdfjsDoc,
  renderPageDataUrl,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfProgress, PdfRunButton } from '@/core/pdf/ui';
import { reorderPdfPages, moveIndex } from './core';

const TOOL_ID = 'pdf-reorder';

export default function PdfReorderTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setOrder([]);
    setThumbs({});
    setError(null);
    setErrorCode(null);
    setDone(false);
    setProgress(null);
    pdfPwd.resetPassword();
  };

  const loadThumbs = async (f: File, password?: string, pageIndices?: number[]) => {
    const bytes = await fileToBytes(f);
    const opened = await openPdfjsDoc(bytes, { password });
    if (!opened.ok) return;
    const doc = opened.value;
    const indices = pageIndices ?? Array.from({ length: doc.numPages }, (_, i) => i);
    const next: Record<number, string> = {};
    for (let i = 0; i < indices.length; i++) {
      const pageIndex = indices[i]!;
      const url = await renderPageDataUrl(doc, pageIndex + 1, 0.35);
      if (url.ok) next[pageIndex] = url.value;
      setProgress({ current: i + 1, total: indices.length });
    }
    setThumbs(next);
    setProgress(null);
    // pdf.js destroy 在部分类型定义中缺失
    void (doc as { destroy?: () => Promise<void> }).destroy?.();
  };

  const applyLoadedOrder = async (f: File, password?: string) => {
    const loaded = await loadPdfFromFile(f, { password });
    if (!loaded.ok) {
      pdfPwd.notePdfError(loaded.error);
      setErrorCode(loaded.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, loaded.error));
      setOrder([]);
      return false;
    }
    const indices = loaded.value.getPageIndices();
    setOrder(indices);
    setError(null);
    setErrorCode(null);
    pdfPwd.setNeedsPassword(false);
    setBusy(true);
    await loadThumbs(f, password, indices);
    setBusy(false);
    return true;
  };

  const onFile = async (f: File) => {
    setFile(f);
    setOrder([]);
    setThumbs({});
    setError(null);
    setErrorCode(null);
    setDone(false);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok) {
      if (probe.error !== 'NEED_PASSWORD') {
        setErrorCode(probe.error);
        setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
      }
      return;
    }
    await applyLoadedOrder(f);
  };

  const unlock = async () => {
    if (!file || !pdfPwd.password) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    await applyLoadedOrder(file, pdfPwd.password);
    setBusy(false);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setError(null);
    setErrorCode(null);
    setProgress({ current: 0, total: 1 });
    const r = await reorderPdfPages(file, order, pdfPwd.password);
    setBusy(false);
    setProgress(null);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'reordered.pdf');
    setDone(true);
  };

  const needsUnlock = pdfPwd.needsPassword && order.length === 0;

  const onDropAt = (to: number) => {
    if (dragFrom === null || dragFrom === to) {
      setDragFrom(null);
      return;
    }
    setOrder((o) => moveIndex(o, dragFrom, to));
    setDragFrom(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-reorder.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <div className="flex flex-col gap-2">
          <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
          {needsUnlock && (
            <PdfRunButton
              label={busy ? t('common.loading') : t('pdf.unlock')}
              disabled={!pdfPwd.password || busy}
              onClick={() => void unlock()}
            />
          )}
        </div>
      )}
      {order.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {order.map((pageIndex, i) => (
            <li
              key={`${pageIndex}-${i}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropAt(i)}
              className="flex cursor-grab flex-col gap-1 rounded border border-gray-200 bg-white p-2 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-900"
            >
              {thumbs[pageIndex] ? (
                <img
                  src={thumbs[pageIndex]}
                  alt={t('tools.pdf-reorder.pageLabel', { n: pageIndex + 1 })}
                  className="aspect-[3/4] w-full rounded object-contain bg-gray-50 dark:bg-gray-950"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center bg-gray-50 text-xs text-gray-400 dark:bg-gray-950">
                  {t('common.loading')}
                </div>
              )}
              <div className="flex items-center gap-1 text-xs">
                <span className="flex-1 truncate">{t('tools.pdf-reorder.pageLabel', { n: pageIndex + 1 })}</span>
                <button type="button" disabled={i === 0} onClick={() => setOrder((o) => moveIndex(o, i, i - 1))}>
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === order.length - 1}
                  onClick={() => setOrder((o) => moveIndex(o, i, i + 1))}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {progress && (
        <PdfProgress
          current={progress.current}
          total={progress.total}
          label={t('tool.progress', { current: progress.current, total: progress.total })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-reorder.run')}
          disabled={!file || order.length === 0 || busy}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
      {done && <PdfNextSteps toolIds={['pdf-rotate', 'pdf-merge', 'pdf-split', 'pdf-to-image']} />}
    </div>
  );
}
