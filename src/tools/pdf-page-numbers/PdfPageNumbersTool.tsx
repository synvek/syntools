import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes, type PageNumberPosition } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { addNumbersToPdf } from './core';

const POSITIONS: PageNumberPosition[] = ['bottom-center', 'bottom-left', 'bottom-right', 'top-center'];

export default function PdfPageNumbersTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('{n} / {total}');
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [fontSize, setFontSize] = useState(10);
  const [startFrom, setStartFrom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await addNumbersToPdf(file, { format, position, fontSize, startFrom });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-page-numbers.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'page-numbers.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-page-numbers.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      {file && <p className="text-sm">{file.name}</p>}
      <PdfField label={t('tools.pdf-page-numbers.format')}>
        <input className={pdfInputClass} value={format} onChange={(e) => setFormat(e.target.value)} />
      </PdfField>
      <OptionBar>
        {POSITIONS.map((p) => (
          <label key={p} className="flex items-center gap-1 text-sm">
            <input type="radio" checked={position === p} onChange={() => setPosition(p)} />
            {t(`tools.pdf-page-numbers.pos.${p}`)}
          </label>
        ))}
      </OptionBar>
      <div className="flex flex-wrap gap-3">
        <PdfField label={t('tools.pdf-page-numbers.fontSize')}>
          <input className={pdfInputClass + ' w-20'} type="number" min={6} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 10)} />
        </PdfField>
        <PdfField label={t('tools.pdf-page-numbers.startFrom')}>
          <input className={pdfInputClass + ' w-20'} type="number" min={1} value={startFrom} onChange={(e) => setStartFrom(Number(e.target.value) || 1)} />
        </PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-page-numbers.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
