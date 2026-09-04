import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openPdfjsDoc, renderPageDataUrl } from '@/core/pdf';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function ImageThumb({ file }: { file: File }) {
  const { t } = useTranslation();
  const url = useObjectUrl(file);
  if (!url) {
    return <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }
  return (
    <img
      src={url}
      alt={t('file.previewAlt', { name: file.name })}
      className="h-full w-full object-contain"
    />
  );
}

function PdfThumb({ file }: { file: File }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [encrypted, setEncrypted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setPages(null);
    setFailed(false);
    setEncrypted(false);

    void (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const docResult = await openPdfjsDoc(bytes);
        if (cancelled) return;
        if (!docResult.ok) {
          if (docResult.error === 'NEED_PASSWORD' || docResult.error === 'WRONG_PASSWORD') {
            setEncrypted(true);
          } else {
            setFailed(true);
          }
          return;
        }
        const doc = docResult.value;
        setPages(doc.numPages);
        const thumb = await renderPageDataUrl(doc, 1, 0.4);
        await doc.cleanup();
        if (cancelled) return;
        if (!thumb.ok) {
          setFailed(true);
          return;
        }
        setSrc(thumb.value);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div className="relative h-full w-full">
      {src ? (
        <img
          src={src}
          alt={t('file.previewAlt', { name: file.name })}
          className="h-full w-full object-contain"
        />
      ) : encrypted ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-amber-50 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <span className="text-base">🔒</span>
          <span className="font-medium">{t('file.encrypted')}</span>
        </div>
      ) : failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-xs text-gray-400 dark:bg-gray-900">
          <span className="font-semibold tracking-wide">PDF</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-50 text-xs text-gray-400 dark:bg-gray-900">
          {t('common.loading')}…
        </div>
      )}
      {pages != null && (
        <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
          {t('file.pages', { n: pages })}
        </span>
      )}
    </div>
  );
}

function GenericThumb({ file }: { file: File }) {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : '?';
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
      <span className="font-semibold tracking-wide">{ext || 'FILE'}</span>
    </div>
  );
}

function PreviewThumb({ file }: { file: File }) {
  if (isImageFile(file)) return <ImageThumb file={file} />;
  if (isPdfFile(file)) return <PdfThumb file={file} />;
  return <GenericThumb file={file} />;
}

export function FilePreviewCard({
  file,
  index,
  onRemove,
}: {
  file: File;
  /** 1-based order badge */
  index?: number;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
      <div className="relative aspect-[4/3] bg-gray-50 dark:bg-gray-900">
        <PreviewThumb file={file} />
        {index != null && (
          <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {index}
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('common.remove')}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm leading-none text-white hover:bg-red-700"
          >
            ×
          </button>
        )}
      </div>
      <div className="space-y-0.5 px-2 py-1.5">
        <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-100" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatSize(file.size)}</p>
      </div>
    </div>
  );
}

/**
 * 上传文件预览网格：图片显示内容缩略图，PDF 渲染首页缩略图，便于确认是否传错。
 */
export function FilePreviewList({
  files,
  onRemove,
  showIndex = false,
}: {
  files: File[];
  onRemove?: (index: number) => void;
  showIndex?: boolean;
}) {
  if (files.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-3">
      {files.map((file, index) => (
        <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="w-36 sm:w-40">
          <FilePreviewCard
            file={file}
            index={showIndex ? index + 1 : undefined}
            onRemove={onRemove ? () => onRemove(index) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
