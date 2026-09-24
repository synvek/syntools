import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { OptionBar } from '@/core/components/ActionButtons';
import { downloadBlob } from '@/core/lib/download';
import { mergeBytes, splitBytes, type SplitMode } from './core';

type Mode = 'split' | 'merge';

function toBlob(data: Uint8Array): Blob {
  return new Blob([data], { type: 'application/octet-stream' });
}

export default function FileSplitMergeTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('split');
  const [splitMode, setSplitMode] = useState<SplitMode>('size');
  const [sizeKb, setSizeKb] = useState(512);
  const [count, setCount] = useState(3);
  const [fileName, setFileName] = useState('file');
  const [parts, setParts] = useState<Uint8Array[]>([]);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [outputName, setOutputName] = useState('merged.bin');
  const [error, setError] = useState<string | null>(null);

  const onSplitFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    const r = splitBytes(data, { mode: splitMode, size: sizeKb * 1024, count });
    if (r.ok) setParts(r.value);
    else {
      setParts([]);
      setError(t(`tools.file-split-merge.errors.${r.error}`));
    }
  };

  const onMergeFiles = async (files: File[]) => {
    setError(null);
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    setMergeFiles(sorted);
    const buffers = await Promise.all(
      sorted.map(async (f) => new Uint8Array(await f.arrayBuffer())),
    );
    const r = mergeBytes(buffers);
    if (r.ok) setParts([r.value]);
    else {
      setParts([]);
      setError(t(`tools.file-split-merge.errors.${r.error}`));
    }
  };

  const downloadPart = (part: Uint8Array, index: number) => {
    if (mode === 'merge') {
      downloadBlob(toBlob(part), outputName);
      return;
    }
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    const base = ext ? fileName.slice(0, -ext.length) : fileName;
    downloadBlob(toBlob(part), `${base}.part${String(index + 1).padStart(3, '0')}${ext}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setParts([]);
            setError(null);
          }}
          aria-label={t('tools.file-split-merge.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="split">{t('tools.file-split-merge.modes.split')}</option>
          <option value="merge">{t('tools.file-split-merge.modes.merge')}</option>
        </select>
        {mode === 'split' && (
          <>
            <select
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value as SplitMode)}
              aria-label={t('tools.file-split-merge.splitBy')}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="size">{t('tools.file-split-merge.bySize')}</option>
              <option value="count">{t('tools.file-split-merge.byCount')}</option>
            </select>
            {splitMode === 'size' ? (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.file-split-merge.sizeKb')}
                <input
                  type="number"
                  min={1}
                  value={sizeKb}
                  onChange={(e) => setSizeKb(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('tools.file-split-merge.count')}
                <input
                  type="number"
                  min={2}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(2, Number(e.target.value) || 2))}
                  className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            )}
          </>
        )}
        {mode === 'merge' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.file-split-merge.outputName')}
            <input
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
      </OptionBar>

      {mode === 'split' ? (
        <FileDropZone onFile={onSplitFile} hint={t('tools.file-split-merge.splitHint')} />
      ) : (
        <FileDropZone
          multiple
          onFiles={onMergeFiles}
          onFile={() => undefined}
          hint={t('tools.file-split-merge.mergeHint')}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {parts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {mode === 'split'
              ? t('tools.file-split-merge.partsCount', { count: parts.length })
              : t('tools.file-split-merge.mergedSize', { size: parts[0]?.length ?? 0 })}
          </p>
          <ul className="flex flex-col gap-1">
            {parts.map((part, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {mode === 'split' ? `.part${String(i + 1).padStart(3, '0')}` : outputName}
                </span>
                <span className="text-xs text-gray-400">{part.length} B</span>
                <button
                  type="button"
                  onClick={() => downloadPart(part, i)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  {t('common.download')}
                </button>
              </li>
            ))}
          </ul>
          {mode === 'split' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.file-split-merge.mergeTip')}
            </p>
          )}
          {mode === 'merge' && mergeFiles.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.file-split-merge.mergeOrder', { count: mergeFiles.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
