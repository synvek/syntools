import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton } from '@/core/components/ActionButtons';
import { PdfNextSteps } from '@/core/components/PdfNextSteps';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  downloadPdfZip,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfProgress, PdfRunButton } from '@/core/pdf/ui';
import { splitPdfFile } from './core';

const TOOL_ID = 'pdf-split';

export default function PdfSplitTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [asZip, setAsZip] = useState(true);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setError(null);
    setErrorCode(null);
    setDone(false);
    setProgress(null);
    pdfPwd.resetPassword();
  };

  const onFile = async (f: File) => {
    setFile(f);
    setError(null);
    setErrorCode(null);
    setDone(false);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setError(null);
    setErrorCode(null);
    setProgress({ current: 0, total: 1 });
    const r = await splitPdfFile(file, pdfPwd.password);
    if (!r.ok) {
      setBusy(false);
      setProgress(null);
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    const parts = r.value;
    setProgress({ current: parts.length, total: parts.length });
    if (asZip && parts.length > 1) {
      await downloadPdfZip(
        parts.map((bytes, i) => ({ name: `page-${i + 1}.pdf`, bytes })),
        'split-pages.zip',
      );
    } else {
      parts.forEach((bytes, i) => downloadBytes(bytes, `page-${i + 1}.pdf`));
    }
    setBusy(false);
    setProgress(null);
    setDone(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-split.hint')}</p>
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        hint={t('tools.pdf-split.drop')}
        onFile={(f) => void onFile(f)}
      />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField
          value={pdfPwd.password}
          onChange={pdfPwd.setPassword}
          error={errorCode}
          autoFocus
        />
      )}
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={asZip}
          onChange={(e) => setAsZip(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        {t('tools.pdf-split.asZip')}
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {progress && (
        <PdfProgress
          current={progress.current}
          total={progress.total}
          label={t('tool.progress', { current: progress.current, total: progress.total })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-split.run')}
          disabled={!file || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
      {done && <PdfNextSteps toolIds={['pdf-merge', 'pdf-extract-pages', 'images-to-pdf', 'pdf-encrypt']} />}
    </div>
  );
}
