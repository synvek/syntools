import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

interface FileDropZoneProps {
  onFile: (file: File) => void;
  /** Multi-file callback (takes precedence when multiple is enabled) */
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  /** Max allowed bytes; larger files are rejected with a message (default 10MB) */
  maxBytes?: number;
  /** Passed through to input[type=file].accept, e.g. ".txt,.json" */
  accept?: string;
  hint?: string;
  /** Supported-format note (shown between hint and size limit) so users know what they can drop */
  formats?: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/** File drop / pick zone: size validation plus drag highlight (tech design §7.2) */
export function FileDropZone({
  onFile,
  onFiles,
  multiple = false,
  maxBytes = DEFAULT_MAX_BYTES,
  accept,
  hint,
  formats,
}: FileDropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    const oversized = files.find((f) => f.size > maxBytes);
    if (oversized) {
      setError(t('file.over', { max: formatBytes(maxBytes), size: formatBytes(oversized.size) }));
      return;
    }
    setError(null);
    if (multiple && onFiles) {
      onFiles(files);
      return;
    }
    onFile(files[0]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    acceptFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('file.uploadAria')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950'
            : 'border-gray-300 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700'
        }`}
      >
        <Icon name="upload" className="h-6 w-6 text-gray-400" />
        <span className="text-gray-600 dark:text-gray-300">{hint ?? t('file.hint')}</span>
        {formats && (
          <span className="text-center text-xs text-gray-500 dark:text-gray-400">{formats}</span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t('file.max', { size: formatBytes(maxBytes) })}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) acceptFiles(e.target.files);
          // Allow picking the same file again
          e.target.value = '';
        }}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
