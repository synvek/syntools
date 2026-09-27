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

const smallButton =
  'inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

/** 本地文档库面板：多工作簿列表 + 打开 / 复制 / 删除 / 新建（IndexedDB） */
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
      data-testid="sheet-library"
      className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.sheet.library')}
        </span>
        <button type="button" onClick={onNew} className={`${smallButton} ml-auto`}>
          <Icon name="file" className="h-3.5 w-3.5" />
          {t('tools.sheet.libraryNew')}
        </button>
        <button
          type="button"
          aria-label={t('tools.sheet.libraryClose')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="py-2 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.libraryEmpty')}
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
          {docs.map((doc) => {
            const active = doc.id === currentDocId;
            return (
              <li
                key={doc.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                  active ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(doc.id)}
                  title={doc.title || t('tools.sheet.untitledDoc')}
                  className="min-w-0 flex-1 truncate text-left text-gray-700 dark:text-gray-200"
                >
                  {doc.title || t('tools.sheet.untitledDoc')}
                </button>
                <button
                  type="button"
                  title={t('tools.sheet.duplicateDoc')}
                  aria-label={t('tools.sheet.duplicateDoc')}
                  onClick={() => onDuplicate(doc.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Icon name="copy" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t('tools.sheet.delete')}
                  aria-label={t('tools.sheet.delete')}
                  onClick={() => onDelete(doc.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface VersionHistoryPanelProps {
  versions: StoredVersion[];
  onRestore: (version: StoredVersion) => void;
  onClose: () => void;
}

/** 版本历史面板：快照列表 + 恢复 */
export function VersionHistoryPanel({ versions, onRestore, onClose }: VersionHistoryPanelProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sheet-versions"
      className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.sheet.versions')}
        </span>
        <button
          type="button"
          aria-label={t('tools.sheet.libraryClose')}
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="py-2 text-xs text-gray-500 dark:text-gray-400">
          {t('tools.sheet.noVersions')}
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300">
                {new Date(version.savedAt).toLocaleString()}
              </span>
              <button type="button" onClick={() => onRestore(version)} className={smallButton}>
                {t('tools.sheet.restoreVersion')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
