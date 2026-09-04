import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocument } from '@cantoo/pdf-lib';
import { FileDropZone } from '@/core/components/FileDropZone';
import { ClearButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES, downloadBytes } from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { loadMeta, saveMeta, type PdfMetaFields } from './core';

const empty: PdfMetaFields = { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' };

export default function PdfMetadataTool() {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PDFDocument | null>(null);
  const [meta, setMeta] = useState<PdfMetaFields>(empty);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setError(null);
    const r = await loadMeta(f);
    if (!r.ok) {
      setError(t(`tools.pdf-metadata.errors.${r.error}`));
      return;
    }
    setDoc(r.value.doc);
    setMeta(r.value.meta);
    setPageCount(r.value.pageCount);
  };

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    const r = await saveMeta(doc, meta);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-metadata.errors.${r.error}`));
      return;
    }
    downloadBytes(r.value, 'metadata.pdf');
  };

  const field = (key: keyof PdfMetaFields) => (
    <PdfField key={key} label={t(`tools.pdf-metadata.fields.${key}`)}>
      <input className={pdfInputClass} value={meta[key]} onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))} />
    </PdfField>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-metadata.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      {doc && <p className="text-sm">{t('tools.pdf-metadata.pages', { n: pageCount })}</p>}
      {doc && (
        <div className="grid gap-3 md:grid-cols-2">
          {(['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const).map(field)}
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton label={busy ? t('common.loading') : t('tools.pdf-metadata.run')} disabled={!doc || busy} onClick={() => void run()} />
        <ClearButton onClick={() => { setDoc(null); setMeta(empty); setError(null); }} disabled={!doc} />
      </div>
    </div>
  );
}
