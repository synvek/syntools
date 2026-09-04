import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes, loadPdfFromFile } from '@/core/pdf';
import { PdfRunButton } from '@/core/pdf/ui';
import { reorderPdfPages, moveIndex } from './core';

export default function PdfReorderTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setError(null);
    const loaded = await loadPdfFromFile(f);
    if (!loaded.ok) {
      setError(t(`tools.pdf-reorder.errors.${loaded.error}`));
      return;
    }
    setFile(f);
    setOrder(loaded.value.getPageIndices());
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await reorderPdfPages(file, order);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-reorder.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'reordered.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-reorder.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      {file && <p className="text-sm">{file.name} · {order.length} {t('tools.pdf-reorder.pagesUnit')}</p>}
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
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-reorder.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setOrder([]); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
