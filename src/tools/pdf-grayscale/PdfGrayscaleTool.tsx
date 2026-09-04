import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton } from '@/core/pdf/ui';
import { grayscalePdfFile } from './core';

export default function PdfGrayscaleTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await grayscalePdfFile(file);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-grayscale.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'grayscale.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-grayscale.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      {file && <p className="text-sm">{file.name}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-grayscale.run')} disabled={!file || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
