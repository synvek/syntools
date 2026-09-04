import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { rotatePdfPages, type RotateAngle } from './core';

const ANGLES: RotateAngle[] = [90, 180, 270];

export default function PdfRotateTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState('1');
  const [allPages, setAllPages] = useState(true);
  const [angle, setAngle] = useState<RotateAngle>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await rotatePdfPages(file, selection, angle, allPages);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-rotate.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'rotated.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-rotate.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      {file && <p className="text-sm">{file.name}</p>}
      <OptionBar>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={allPages} onChange={(e) => setAllPages(e.target.checked)} />
          {t('tools.pdf-rotate.allPages')}
        </label>
        {ANGLES.map((a) => (
          <label key={a} className="flex items-center gap-1 text-sm">
            <input type="radio" name="angle" checked={angle === a} onChange={() => setAngle(a)} />
            {a}°
          </label>
        ))}
      </OptionBar>
      {!allPages && (
        <PdfField label={t('tools.pdf-rotate.pages')}>
          <input className={pdfInputClass} value={selection} onChange={(e) => setSelection(e.target.value)} placeholder="1,3-5" />
        </PdfField>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-rotate.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
