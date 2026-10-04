import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { DocMeta, StoredVersion } from './docStore';

interface DocLibraryPanelProps {
  currentDocId: string | null;
  docs: DocMeta[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

/** 本地文档库面板：多文档列表 + 打开/复制/删除/新建（IndexedDB） */
export function DocLibraryPanel({
  currentDocId,
  docs,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
  onClose,
}: DocLibraryPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="rich-text-library"
      className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.library')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="flex h-7 items-center gap-1 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="text" className="h-3.5 w-3.5" />
            {t('tools.richText.libraryNew')}
          </button>
          <button
            type="button"
            aria-label={t('tools.richText.libraryClose')}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="px-1 py-2 text-sm text-gray-400 dark:text-gray-500">
          {t('tools.richText.libraryEmpty')}
        </p>
      ) : (
        <ul className="max-h-56 overflow-auto">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                doc.id === currentDocId ? 'bg-blue-50 dark:bg-blue-950/40' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(doc.id)}
                className="flex min-w-0 flex-1 flex-col items-start text-left"
              >
                <span className="max-w-full truncate text-gray-800 dark:text-gray-100">
                  {doc.title || t('tools.richText.untitledDoc')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t('tools.richText.updatedAt')} {new Date(doc.updatedAt).toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                title={t('tools.richText.duplicateDoc')}
                aria-label={t('tools.richText.duplicateDoc')}
                onClick={() => onDuplicate(doc.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icon name="copy" className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={t('tools.richText.deleteDoc')}
                aria-label={t('tools.richText.deleteDoc')}
                onClick={() => onDelete(doc.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface VersionHistoryPanelProps {
  versions: StoredVersion[];
  /** 是否已有可打快照的文档（新建但未保存的文档没有 id） */
  canSnapshot: boolean;
  onRestore: (version: StoredVersion) => void;
  onCompare: (version: StoredVersion) => void;
  onManualSnapshot: (note: string) => void;
  onClose: () => void;
}

/** 版本历史面板：快照列表 + 手动打快照 + 差异对比 + 恢复 */
export function VersionHistoryPanel({
  versions,
  canSnapshot,
  onRestore,
  onCompare,
  onManualSnapshot,
  onClose,
}: VersionHistoryPanelProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  const submitSnapshot = () => {
    onManualSnapshot(note.trim());
    setNote('');
  };

  return (
    <div
      data-testid="rich-text-versions"
      className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.versionHistory')}
        </span>
        <button
          type="button"
          aria-label={t('tools.richText.libraryClose')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-1">
        <input
          type="text"
          value={note}
          maxLength={40}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitSnapshot();
            }
          }}
          placeholder={t('tools.richText.snapshotNotePlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="button"
          disabled={!canSnapshot}
          onClick={submitSnapshot}
          className="h-7 shrink-0 rounded-md bg-blue-600 px-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('tools.richText.snapshotNow')}
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="px-1 py-2 text-sm text-gray-400 dark:text-gray-500">
          {t('tools.richText.noVersions')}
        </p>
      ) : (
        <ul className="max-h-56 overflow-auto">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm">
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="max-w-full truncate text-gray-800 dark:text-gray-100">
                  {version.note || version.title || t('tools.richText.untitledDoc')}
                </span>
                <span className="max-w-full truncate text-xs text-gray-400 dark:text-gray-500">
                  {new Date(version.savedAt).toLocaleString()} ·{' '}
                  {t('tools.richText.versionChars', { count: version.html.length })}
                </span>
              </span>
              <button
                type="button"
                title={t('tools.richText.versionDiffTitle')}
                aria-label={t('tools.richText.versionDiffTitle')}
                onClick={() => onCompare(version)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icon name="diff" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onRestore(version)}
                className="h-7 shrink-0 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.richText.restoreVersion')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
