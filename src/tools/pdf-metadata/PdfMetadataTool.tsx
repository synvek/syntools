import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocument } from '@cantoo/pdf-lib';
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
import { loadMeta, saveMeta, type PdfMetaFields } from './core';

const TOOL_ID = 'pdf-metadata';
const empty: PdfMetaFields = { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' };

export default function PdfMetadataTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocument | null>(null);
  const [meta, setMeta] = useState<PdfMetaFields>(empty);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setDoc(null);
    setMeta(empty);
    setPageCount(0);
    setError(null);
    setErrorCode(null);
    pdfPwd.resetPassword();
  };

  const applyMeta = async (f: File, password?: string) => {
    const r = await loadMeta(f, password);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      setDoc(null);
      setMeta(empty);
      setPageCount(0);
      return false;
    }
    setDoc(r.value.doc);
    setMeta(r.value.meta);
    setPageCount(r.value.pageCount);
    setError(null);
    setErrorCode(null);
    pdfPwd.setNeedsPassword(false);
    return true;
  };

  const onFile = async (f: File) => {
    setFile(f);
    setDoc(null);
    setMeta(empty);
    setPageCount(0);
    setError(null);
    setErrorCode(null);
    const probe = await pdfPwd.onPdfSelected(f);
    if (!probe.ok) {
      if (probe.error !== 'NEED_PASSWORD') {
        setErrorCode(probe.error);
        setError(pdfToolErrorMessage(t, TOOL_ID, probe.error));
      }
      return;
    }
    await applyMeta(f);
  };

  const unlock = async () => {
    if (!file || !pdfPwd.password) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    await applyMeta(file, pdfPwd.password);
    setBusy(false);
  };

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await saveMeta(doc, meta);
    setBusy(false);
    if (!r.ok) {
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'metadata.pdf');
  };

  const field = (key: keyof PdfMetaFields) => (
    <PdfField key={key} label={t(`tools.pdf-metadata.fields.${key}`)}>
      <input
        className={pdfInputClass}
        value={meta[key]}
        onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
      />
    </PdfField>
  );

  const needsUnlock = pdfPwd.needsPassword && !doc;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-metadata.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <div className="flex flex-col gap-2">
          <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
          {needsUnlock && (
            <PdfRunButton
              label={busy ? t('common.loading') : t('pdf.unlock')}
              disabled={!pdfPwd.password || busy}
              onClick={() => void unlock()}
            />
          )}
        </div>
      )}
      {doc && <p className="text-sm">{t('tools.pdf-metadata.pages', { n: pageCount })}</p>}
      {doc && (
        <div className="grid gap-3 md:grid-cols-2">
          {(['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const).map(field)}
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-metadata.run')}
          disabled={!doc || busy}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} disabled={!file} />
      </div>
    </div>
  );
}
