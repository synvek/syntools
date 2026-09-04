import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  probePdfFile,
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton } from '@/core/pdf/ui';
import { mergePdfFiles, isPdfFile } from './core';

const TOOL_ID = 'pdf-merge';

export default function PdfMergeTool() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFiles([]);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const onFiles = async (list: File[]) => {
    const pdfs = list.filter(isPdfFile);
    if (pdfs.length === 0) {
      setErrorCode('NOT_PDF');
      setError(pdfToolErrorMessage(t, TOOL_ID, 'NOT_PDF'));
      return;
    }
    setError(null);
    setErrorCode(null);
    const wasEmpty = files.length === 0;
    setFiles((prev) => [...prev, ...pdfs]);

    if (wasEmpty) {
      const probe = await pdfPwd.onPdfSelected(pdfs[0]!);
      if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
        setErrorCode(probe.error);
        setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
      }
      return;
    }

    const probe = await probePdfFile(pdfs[0]!);
    if (!probe.ok && probe.error === 'NEED_PASSWORD') {
      pdfPwd.setNeedsPassword(true);
    } else if (!probe.ok) {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await mergePdfFiles(files, pdfPwd.password);
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'merged.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-merge.hint')}</p>
      <FileDropZone
        multiple
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        hint={t('tools.pdf-merge.drop')}
        onFile={() => undefined}
        onFiles={(list) => void onFiles(list)}
      />
      <FilePreviewList
        files={files}
        showIndex
        onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
      />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField
          value={pdfPwd.password}
          onChange={pdfPwd.setPassword}
          error={errorCode}
          autoFocus
        />
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-merge.run')}
          disabled={files.length < 2 || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={files.length === 0} />
      </div>
    </div>
  );
}
