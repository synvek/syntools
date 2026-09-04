import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import {
  PDF_MAX_BYTES,
  downloadBytes,
  PdfPasswordField,
  shouldShowPdfPassword,
  pdfToolErrorMessage,
  usePdfPassword,
} from '@/core/pdf';
import { PdfRunButton, PdfField, pdfInputClass } from '@/core/pdf/ui';
import { annotatePdfFile, type AnnotateDraft, type AnnotateKind } from './core';

const TOOL_ID = 'pdf-annotate';
const KINDS: AnnotateKind[] = ['highlight', 'line', 'rect'];

export default function PdfAnnotateTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<AnnotateKind>('highlight');
  const [page, setPage] = useState(1);
  const [x, setX] = useState(72);
  const [y, setY] = useState(400);
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(18);
  const [color, setColor] = useState('#facc15');
  const [items, setItems] = useState<AnnotateDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const pdfPwd = usePdfPassword();

  const clear = () => {
    setFile(null);
    setItems([]);
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

  const add = () => {
    setItems((prev) => [...prev, { kind, page, x, y, width, height, color }]);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    const r = await annotatePdfFile(file, items, pdfPwd.password);
    setBusy(false);
    if (!r.ok) {
      pdfPwd.notePdfError(r.error);
      setErrorCode(r.error);
      setError(pdfToolErrorMessage(t, TOOL_ID, r.error));
      return;
    }
    downloadBytes(r.value, 'annotated.pdf');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-annotate.hint')}</p>
      <FileDropZone accept=".pdf,application/pdf" maxBytes={PDF_MAX_BYTES} onFile={(f) => void onFile(f)} />
      <FilePreviewList files={file ? [file] : []} onRemove={clear} />
      {shouldShowPdfPassword(errorCode, pdfPwd.needsPassword) && (
        <PdfPasswordField value={pdfPwd.password} onChange={pdfPwd.setPassword} error={errorCode} autoFocus />
      )}
      <OptionBar>
        {KINDS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} />
            {t(`tools.pdf-annotate.kinds.${k}`)}
          </label>
        ))}
      </OptionBar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <PdfField label={t('tools.pdf-annotate.page')}><input className={pdfInputClass} type="number" min={1} value={page} onChange={(e) => setPage(Number(e.target.value) || 1)} /></PdfField>
        <PdfField label="X"><input className={pdfInputClass} type="number" value={x} onChange={(e) => setX(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label="Y"><input className={pdfInputClass} type="number" value={y} onChange={(e) => setY(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-annotate.width')}><input className={pdfInputClass} type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-annotate.height')}><input className={pdfInputClass} type="number" value={height} onChange={(e) => setHeight(Number(e.target.value) || 0)} /></PdfField>
        <PdfField label={t('tools.pdf-annotate.color')}><input className={pdfInputClass} type="color" value={color} onChange={(e) => setColor(e.target.value)} /></PdfField>
      </div>
      <button type="button" className="self-start rounded border px-3 py-1.5 text-sm" onClick={add}>{t('tools.pdf-annotate.add')}</button>
      {items.length > 0 && (
        <ul className="space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{t(`tools.pdf-annotate.kinds.${it.kind}`)} · p{it.page}</span>
              <button type="button" className="text-xs text-red-600" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>{t('common.remove')}</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-annotate.run')}
          disabled={!file || items.length === 0 || busy || (pdfPwd.needsPassword && !pdfPwd.password)}
          onClick={() => void run()}
        />
        <ClearButton onClick={clear} />
      </div>
    </div>
  );
}
