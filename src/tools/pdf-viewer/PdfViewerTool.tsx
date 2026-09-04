import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfField, pdfInputClass, PdfRunButton } from '@/core/pdf/ui';
import { openViewerDoc, renderViewerPage } from './core';

const TOOL_ID = 'pdf-viewer';

export default function PdfViewerTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => () => { void docRef.current?.cleanup(); }, []);

  useEffect(() => {
    if (!doc) return;
    void (async () => {
      const r = await renderViewerPage(doc, page, scale);
      if (!r.ok || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      canvasRef.current.width = r.value.width;
      canvasRef.current.height = r.value.height;
      ctx.drawImage(r.value, 0, 0);
    })();
  }, [doc, page, scale]);

  const clearDoc = async () => {
    if (docRef.current) await docRef.current.cleanup();
    docRef.current = null;
    setDoc(null);
  };

  const clear = () => {
    void clearDoc();
    setFile(null);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const openDoc = async (f: File, password?: string) => {
    await clearDoc();
    const r = await openViewerDoc(f, password);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return false;
    }
    docRef.current = r.value;
    setDoc(r.value);
    setPage(1);
    setError(null);
    setErrorCode(null);
    pdfPwd.setNeedsPassword(false);
    return true;
  };

  const onFile = async (f: File) => {
    setFile(f);
    setError(null);
    setErrorCode(null);
    await clearDoc();
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok) {
      if (probe.error !== 'NEED_PASSWORD') {
        setErrorCode(probe.error);
        setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
      }
      return;
    }
    await openDoc(f);
  };

  const unlock = async () => {
    if (!file || !pdfPwd.password) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    await openDoc(file, pdfPwd.password);
    setBusy(false);
  };

  const needsUnlock = pdfPwd.needsPassword && !doc;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-viewer.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
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
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {doc && (
        <>
          <OptionBar>
            <button type="button" className="rounded border px-2 py-1 text-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('tools.pdf-viewer.prev')}</button>
            <span className="text-sm">{page} / {doc.numPages}</span>
            <button type="button" className="rounded border px-2 py-1 text-sm" disabled={page >= doc.numPages} onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))}>{t('tools.pdf-viewer.next')}</button>
            <PdfField label={t('tools.pdf-viewer.scale')}>
              <input className={pdfInputClass + ' w-24'} type="number" min={0.5} max={3} step={0.25} value={scale} onChange={(e) => setScale(Number(e.target.value) || 1)} />
            </PdfField>
            <ClearButton onClick={clear} />
          </OptionBar>
          <div className="overflow-auto rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-950">
            <canvas ref={canvasRef} className="mx-auto max-w-full" />
          </div>
        </>
      )}
      {!doc && file && (
        <ClearButton onClick={clear} />
      )}
    </div>
  );
}
