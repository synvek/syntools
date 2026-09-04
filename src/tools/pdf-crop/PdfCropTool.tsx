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
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { cropPdfFile } from './core';

const TOOL_ID = 'pdf-crop';

export default function PdfCropTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [top, setTop] = useState(20);
  const [right, setRight] = useState(20);
  const [bottom, setBottom] = useState(20);
  const [left, setLeft] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const onFile = async (f: File) => {
    setFile(f);
    setError(null);
    setErrorCode(null);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok && probe.error !== 'NEED_PASSWORD') {
      setErrorCode(probe.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await cropPdfFile(file, { top, right, bottom, left }, pdfPwd.password);
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'cropped.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-crop.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PdfField label={t('tools.pdf-crop.top')}><input className={pdfInputClass} type="number" min={0} value={top} onChange={(e) => setTop(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.right')}><input className={pdfInputClass} type="number" min={0} value={right} onChange={(e) => setRight(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.bottom')}><input className={pdfInputClass} type="number" min={0} value={bottom} onChange={(e) => setBottom(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-crop.left')}><input className={pdfInputClass} type="number" min={0} value={left} onChange={(e) => setLeft(Number(e.target.value) || 0)} /></PdfField>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-crop.run')}
          disabled={!file || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
    </div>
  );
}
