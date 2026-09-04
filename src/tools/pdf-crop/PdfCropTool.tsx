import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { cropPdfFile } from './core';

export default function PdfCropTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [top, setTop] = useState(20);
  const [right, setRight] = useState(20);
  const [bottom, setBottom] = useState(20);
  const [left, setLeft] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await cropPdfFile(file, { top, right, bottom, left });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-crop.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'cropped.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-crop.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PdfField label={t('tools.pdf-crop.top')}><input className={pdfInputClass} type="number" min={0} value={top} onChange={(e) => setTop(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.right')}><input className={pdfInputClass} type="number" min={0} value={right} onChange={(e) => setRight(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.bottom')}><input className={pdfInputClass} type="number" min={0} value={bottom} onChange={(e) => setBottom(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.left')}><input className={pdfInputClass} type="number" min={0} value={left} onChange={(e) => setLeft(Number(e.target.value) || 0)} /></PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-crop.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
