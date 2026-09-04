import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton } from '@/core/pdf/ui';
import { convertImagesToPdf, isImageFile } from './core';

export default function ImagesToPdfTool() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await convertImagesToPdf(files);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.images-to-pdf.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'images.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.images-to-pdf.hint')}</p>
      <FileDropZone
        multiple
        accept="image/*"
        maxBytes={PDF_MAX_BYTES}
        hint={t('tools.images-to-pdf.drop')}
        onFile={() => undefined}
        onFiles={(list) => {
          const imgs = list.filter(isImageFile);
          if (imgs.length === 0) {
            setError(t('tools.images-to-pdf.errors.NOT_IMAGE'));
            return;
          }
          setFiles((prev) => [...prev, ...imgs]);
          setError(null);
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">{i + 1}. {f.name}</span>
              <button type="button" className="text-xs text-red-600" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>{t('common.remove')}</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.images-to-pdf.run')} disabled={files.length === 0 || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFiles([]); setError(null); }} disabled={files.length === 0} />
      </div>
    </div>
  );
}
