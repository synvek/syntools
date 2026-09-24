import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfField, PdfRunButton, pdfInputClass } from '@/core/pdf/ui';
import { decryptPdf } from './core';

export default function PdfDecryptTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await decryptPdf(file, password);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-decrypt.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value.bytes, file.name.replace(/\.pdf$/i, '') + '-unlocked.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-decrypt.hint')}</p>
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={(f) => {
          setFile(f);
          setError(null);
        }}
      />
      <FilePreviewList files={file ? [file] : []} onRemove={() => setFile(null)} />
      <PdfField label={t('tools.pdf-decrypt.password')}>
        <input
          className={pdfInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('tools.pdf-decrypt.passwordHint')}
        />
      </PdfField>
      <OptionBar>
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-decrypt.run')}
          disabled={!file || busy}
          onClick={() => void run()}
        />
        <ClearButton
          onClick={() => {
            setFile(null);
            setError(null);
          }}
          disabled={!file}
        />
      </OptionBar>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
