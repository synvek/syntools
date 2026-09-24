import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { FilePreviewList } from '@/core/components/FilePreviewList';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { CopyButton } from '@/core/components/CopyButton';
import { DownloadButton } from '@/core/components/ActionButtons';
import { PDF_MAX_BYTES } from '@/core/pdf';
import { PdfField, PdfRunButton, pdfInputClass } from '@/core/pdf/ui';
import { extractPdfText } from './core';

export default function PdfExtractTextTool() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pages, setPages] = useState(0);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await extractPdfText(file, password || undefined);
    setBusy(false);
    if (!r.ok) {
      setError(t(`tools.pdf-extract-text.errors.${r.error}`));
      setText('');
      return;
    }
    setText(r.value.text);
    setPages(r.value.pages);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('tools.pdf-extract-text.hint')}</p>
      <FileDropZone
        accept=".pdf,application/pdf"
        maxBytes={PDF_MAX_BYTES}
        onFile={(f) => {
          setFile(f);
          setText('');
          setError(null);
        }}
      />
      <FilePreviewList files={file ? [file] : []} onRemove={() => setFile(null)} />
      <PdfField label={t('tools.pdf-extract-text.password')}>
        <input
          className={pdfInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('tools.pdf-extract-text.passwordHint')}
        />
      </PdfField>
      <OptionBar>
        <PdfRunButton
          label={busy ? t('common.loading') : t('tools.pdf-extract-text.run')}
          disabled={!file || busy}
          onClick={() => void run()}
        />
        <ClearButton
          onClick={() => {
            setFile(null);
            setText('');
            setError(null);
          }}
          disabled={!file}
        />
      </OptionBar>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {text && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{t('tools.pdf-extract-text.pages', { count: pages })}</span>
            <CopyButton text={text} />
            <DownloadButton content={text} filename="extracted.txt" label={t('common.download')} />
          </div>
          <textarea
            readOnly
            value={text}
            className="h-72 w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
      )}
    </div>
  );
}
