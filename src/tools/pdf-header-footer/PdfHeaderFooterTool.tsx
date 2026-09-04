import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes, type HAlign } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { applyHeaderFooter } from './core';

const ALIGNS: HAlign[] = ['left', 'center', 'right'];

export default function PdfHeaderFooterTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [align, setAlign] = useState<HAlign>('center');
  const [fontSize, setFontSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await applyHeaderFooter(file, { header, footer, align, fontSize });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-header-footer.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'header-footer.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-header-footer.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      {file && <p className="text-sm">{file.name}</p>}
      <PdfField label={t('tools.pdf-header-footer.header')}>
        <input className={pdfInputClass} value={header} onChange={(e) => setHeader(e.target.value)} />
      </PdfField>
      <PdfField label={t('tools.pdf-header-footer.footer')}>
        <input className={pdfInputClass} value={footer} onChange={(e) => setFooter(e.target.value)} />
      </PdfField>
      <OptionBar>
        {ALIGNS.map((a) => (
          <label key={a} className="flex items-center gap-1 text-sm">
            <input type="radio" checked={align === a} onChange={() => setAlign(a)} />
            {t(`tools.pdf-header-footer.align.${a}`)}
          </label>
        ))}
      </OptionBar>
      <PdfField label={t('tools.pdf-header-footer.fontSize')}>
        <input className={pdfInputClass + ' w-20'} type="number" min={6} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 10)} />
      </PdfField>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-header-footer.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
