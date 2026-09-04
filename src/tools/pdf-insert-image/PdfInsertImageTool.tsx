import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { insertImageIntoPdf } from './core';

export default function PdfInsertImageTool() {
  const { t } = useTranslation();
  const [pdf, setPdf] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [allPages, setAllPages] = useState(true);
  const [selection, setSelection] = useState('1');
  const [x, setX] = useState(48);
  const [y, setY] = useState(48);
  const [width, setWidth] = useState(160);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!pdf || !image) return;
    setBusy(true);
    setError(null);
    const r = await insertImageIntoPdf(pdf, image, { selection, allPages, x, y, width });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-insert-image.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'with-image.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-insert-image.hint')}</p>
      <PdfField label={t('tools.pdf-insert-image.pdf')}>
        <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setPdf(f); setError(null); }} />
      </PdfField>
      <PdfField label={t('tools.pdf-insert-image.image')}>
        <FileDropZone accept="image/png,image/jpeg" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setImage(f); setError(null); }} />
      </PdfField>
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
          {t('tools.pdf-insert-image.allPages')}
        </label>
      </OptionBar>
      {!allPages && (
        <PdfField label={t('tools.pdf-insert-image.pages')}>
          <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} />
        </PdfField>
      )}
      <div className="flex flex-wrap gap-3">
        <PdfField label="X"><input className={pdfInputClass + ' w-24'} type="number" value={x} onChange={(e) => setX(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label="Y"><input className={pdfInputClass + ' w-24'} type="number" value={y} onChange={(e) => setY(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-insert-image.width')}><input className={pdfInputClass + ' w-24'} type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 100)} /></PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-insert-image.run')} disabled={!pdf || !image || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setPdf(null); setImage(null); setError(null); }} />
      </div>
    </div>
  );
}
