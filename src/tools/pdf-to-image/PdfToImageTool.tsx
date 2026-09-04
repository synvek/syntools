import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadDataUrl } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { pdfPagesToImages, type ImageFormat } from './core';

export default function PdfToImageTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImageFormat>('image/png');
  const [scale, setScale] = useState(1.5);
  const [selection, setSelection] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await pdfPagesToImages(file, { format, scale, selection: selection || undefined });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-to-image.errors.${r.error}`));
      return;
    }
    setPreviews(r.value);
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    r.value.forEach((url, i) => downloadDataUrl(url, `page-${i + 1}.${ext}`));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-to-image.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setPreviews([]); setError(null); }} />
      {file && <p className="text-sm">{file.name}</p>}
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" checked={format === 'image/png'} onChange={() => setFormat('image/png')} /> PNG
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" checked={format === 'image/jpeg'} onChange={() => setFormat('image/jpeg')} /> JPG
        </label>
        <PdfField label={t('tools.pdf-to-image.scale')}>
          <input className={pdfInputClass + ' w-24'} type="number" min={0.5} max={3} step={0.25} value={scale} onChange={(e) => setScale(Number(e.target.value) || 1.5)} />
        </PdfField>
      </OptionBar>
      <PdfField label={t('tools.pdf-to-image.pages')}>
        <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} placeholder={t('tools.pdf-to-image.pagesAll')} />
      </PdfField>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-to-image.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setPreviews([]); setError(null); }} disabled={!file} />
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {previews.map((url, i) => (
            <img key={i} src={url} alt={`page ${i + 1}`} className="rounded border border-gray-200 dark:border-gray-700" />
          ))}
        </div>
      )}
    </div>
  );
}
