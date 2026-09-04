import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { encryptPdfFile } from './core';

export default function PdfEncryptTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [printing, setPrinting] = useState(true);
  const [copying, setCopying] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await encryptPdfFile(file, userPassword, ownerPassword, {
      printing,
      copying,
      modifying,
      annotating,
    });
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-encrypt.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'encrypted.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-encrypt.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => { setFile(f); setError(null); }} />
      <PdfField label={t('tools.pdf-encrypt.userPassword')}>
        <input className={pdfInputClass} type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
      </PdfField>
      <PdfField label={t('tools.pdf-encrypt.ownerPassword')}>
        <input className={pdfInputClass} type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder={t('tools.pdf-encrypt.ownerHint')} />
      </PdfField>
      <OptionBar>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={printing} onChange={(e) => setPrinting(e.target.checked)} />{t('tools.pdf-encrypt.perm.printing')}</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={copying} onChange={(e) => setCopying(e.target.checked)} />{t('tools.pdf-encrypt.perm.copying')}</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={modifying} onChange={(e) => setModifying(e.target.checked)} />{t('tools.pdf-encrypt.perm.modifying')}</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={annotating} onChange={(e) => setAnnotating(e.target.checked)} />{t('tools.pdf-encrypt.perm.annotating')}</label>
      </OptionBar>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-encrypt.run')} disabled={!file || !userPassword || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setFile(null); setError(null); }} disabled={!file} />
      </div>
    </div>
  );
}
