import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  loadPdfFromFile,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton } from '@/core/pdf/ui';
import { reorderPdfPages, moveIndex } from './core';

const TOOL_ID = 'pdf-reorder';

export default function PdfReorderTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setOrder([]);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
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
    setOrder(loaded.value.getPageIndices());
    setError(null);
    setErrorCode(null);
    pdfPwd.setNeedsPassword(false);
    return true;
  };

  const onFile = async (f: File) => {
    setFile(f);
    setOrder([]);
    setError(null);
    setErrorCode(null);
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
    setError(null);
    setErrorCode(null);
    const r = await reorderPdfPages(file, order, pdfPwd.password);
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'reordered.pdf');
  };

  const needsUnlock = pdfPwd.needsPassword && order.length === 0;

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
        <ol className="space-y-1 text-sm">
          {order.map((pageIndex, i) => (
            <li key={`${pageIndex}-${i}`} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1 dark:border-gray-700">
              <span className="flex-1">{t('tools.pdf-reorder.pageLabel', { n: pageIndex + 1 })}</span>
              <button type="button" className="text-xs" disabled={i === 0} onClick={() => setOrder((o) => moveIndex(o, i, i - 1))}>↑</button>
              <button type="button" className="text-xs" disabled={i === order.length - 1} onClick={() => setOrder((o) => moveIndex(o, i, i + 1))}>↓</button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-reorder.run')}
          disabled={!file || order.length === 0 || busy}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
    </div>
  );
}
