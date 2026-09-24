import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { OptionBar } from '@/core/components/ActionButtons';
import { downloadBlob } from '@/core/lib/download';
import { createZip, extractZipEntry, listZip, type ZipEntryInfo } from './core';

type Mode = 'create' | 'extract';

export default function ZipManagerTool() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('create');
  const [archiveName, setArchiveName] = useState('archive.zip');
  const [zipOut, setZipOut] = useState<Uint8Array | null>(null);
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null);
  const [entries, setEntries] = useState<ZipEntryInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setZipOut(null);
    setZipBytes(null);
    setEntries([]);
    setError(null);
  };

  const onCreate = async (files: File[]) => {
    setError(null);
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
    );
    const r = await createZip(payload);
    if (r.ok) setZipOut(r.value);
    else {
      setZipOut(null);
      setError(t(`tools.zip-manager.errors.${r.error}`));
    }
  };

  const onExtract = async (file: File) => {
    setError(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setZipBytes(bytes);
    const r = await listZip(bytes);
    if (r.ok) setEntries(r.value);
    else {
      setEntries([]);
      setError(t(`tools.zip-manager.errors.${r.error}`));
    }
  };

  const downloadEntry = async (name: string) => {
    if (!zipBytes) return;
    const r = await extractZipEntry(zipBytes, name);
    if (r.ok) downloadBlob(new Blob([r.value]), name.split('/').pop() ?? name);
    else setError(t(`tools.zip-manager.errors.${r.error}`));
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            reset();
          }}
          aria-label={t('tools.zip-manager.mode')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="create">{t('tools.zip-manager.modes.create')}</option>
          <option value="extract">{t('tools.zip-manager.modes.extract')}</option>
        </select>
        {mode === 'create' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {t('tools.zip-manager.archiveName')}
            <input
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              className="w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
        )}
      </OptionBar>

      {mode === 'create' ? (
        <>
          <FileDropZone
            multiple
            onFiles={onCreate}
            onFile={() => undefined}
            hint={t('tools.zip-manager.createHint')}
          />
          {zipOut && (
            <button
              type="button"
              onClick={() => downloadBlob(new Blob([zipOut]), archiveName || 'archive.zip')}
              className="inline-flex items-center gap-1 self-start rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              <Icon name="download" className="h-4 w-4" />
              {t('tools.zip-manager.downloadZip')}
            </button>
          )}
        </>
      ) : (
        <>
          <FileDropZone
            onFile={onExtract}
            accept=".zip,application/zip"
            hint={t('tools.zip-manager.extractHint')}
          />
          {entries.length > 0 && (
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li key={entry.name} className="flex items-center gap-2 text-sm">
                  <Icon name={entry.dir ? 'grid' : 'file'} className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{entry.name}</span>
                  {!entry.dir && (
                    <span className="ml-auto text-xs text-gray-400">{entry.size} B</span>
                  )}
                  {!entry.dir && (
                    <button
                      type="button"
                      onClick={() => downloadEntry(entry.name)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Icon name="download" className="h-3.5 w-3.5" />
                      {t('common.download')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
