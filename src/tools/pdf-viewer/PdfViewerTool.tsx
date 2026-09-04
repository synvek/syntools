import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES } from '@/core/pdf';
import { PdfField, pdfInputClass } from '@/core/pdf/ui';
import { openViewerDoc, renderViewerPage } from './core';

export default function PdfViewerTool() {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [error, setError] = useState<string | null>(null);
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

  const onFile = async (f: File) => {
    setError(null);
    if (docRef.current) await docRef.current.cleanup();
    const r = await openViewerDoc(f);
    if (!r.ok) {
      setError(t(`tools.pdf-viewer.errors.${r.error}`));
      setDoc(null);
      docRef.current = null;
      return;
    }
    docRef.current = r.value;
    setDoc(r.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-viewer.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
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
            <ClearButton onClick={() => { void doc.cleanup(); docRef.current = null; setDoc(null); }} />
          </OptionBar>
          <div className="overflow-auto rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-950">
            <canvas ref={canvasRef} className="mx-auto max-w-full" />
          </div>
        </>
      )}
    </div>
  );
}
