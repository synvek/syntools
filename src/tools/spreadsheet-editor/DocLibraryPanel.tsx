import { useTranslation } from 'react-i18next';
import { formatBytes } from '@/core/components/editorChrome';
import { Icon } from '@/core/components/Icon';
import type { DocMeta, DocStorageEstimate, DocStoreStatus, StoredVersion } from './docStore';
import type { SheetTemplate, TemplateId } from './templates';

interface DocLibraryPanelProps {
  currentDocId: string | null;
  docs: DocMeta[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  /** 浏览器给的占用（拿不到就不显示这一行，不显示 0） */
  usage?: DocStorageEstimate | null;
  /** 内置模板（P2-6）：列表由 `templates.ts` 提供，面板只负责渲染与回调 */
  templates?: readonly SheetTemplate[];
  onTemplate?: (id: TemplateId) => void;
}

const smallButton =
  'inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 文档库不可用 / 空间不足的横幅（P2-3）。
 *
 * 以前 IndexedDB 用不了是完全静默的：文档列表空着，用户以为"我从来没保存过"。
 * 现在说清楚原因，并给一个真的能重开的"重试"。
 */
export function StorageNotice({
  status,
  onRetry,
  onFreeSpace,
}: {
  status: DocStoreStatus;
  onRetry: () => void;
  /** 空间不足时打开历史版本面板删旧版本；只有配额这一种情况能靠删版本救回来 */
  onFreeSpace?: () => void;
}) {
  const { t } = useTranslation();
  if (status.ok) return null;
  const quota = status.code === 'quota';
  return (
    <div
      role="alert"
      data-testid="sheet-store-notice"
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <span className="min-w-0 flex-1">
        {quota ? t('tools.sheet.storeQuota') : t('tools.sheet.storeUnavailable')}
      </span>
      {quota && onFreeSpace && (
        <button type="button" onClick={onFreeSpace} className={smallButton}>
          {t('tools.sheet.deleteOldVersions')}
        </button>
      )}
      <button type="button" onClick={onRetry} className={smallButton}>
        {t('tools.sheet.storeRetry')}
      </button>
    </div>
  );
}

/** Local document library panel: workbook list + open / duplicate / delete / new (IndexedDB) */
export function DocLibraryPanel({
  currentDocId,
  docs,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
  onClose,
  usage = null,
  templates = [],
  onTemplate,
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

      {/* P2-6：模板放在"新建"旁边——新用户第一件想做的事是"看个例子"，不是"从空格子开始" */}
      {templates.length > 0 && onTemplate && (
        <div data-testid="sheet-templates" className="mb-2">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('tools.sheet.templates')}
          </p>
          <div className="flex flex-wrap gap-1">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onTemplate(template.id)}
                className={smallButton}
              >
                {t(template.titleKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {usage && (
        <p
          data-testid="sheet-storage-usage"
          className="mb-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {t('tools.sheet.storageUsage', {
            used: formatBytes(usage.used),
            quota: formatBytes(usage.quota),
          })}
        </p>
      )}

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
  /** 删单个版本（P2-3：空间不足时"腾地方"的最小单位） */
  onDeleteVersion?: (version: StoredVersion) => void;
  /** 清空本文档的全部历史版本 */
  onClearVersions?: () => void;
}

/** Version history panel: snapshot list + restore / delete */
export function VersionHistoryPanel({
  versions,
  onRestore,
  onClose,
  onDeleteVersion,
  onClearVersions,
}: VersionHistoryPanelProps) {
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
        {onClearVersions && versions.length > 0 && (
          <button type="button" onClick={onClearVersions} className={`${smallButton} ml-auto mr-2`}>
            {t('tools.sheet.clearVersions')}
          </button>
        )}
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
              {onDeleteVersion && (
                <button
                  type="button"
                  title={t('tools.sheet.deleteVersion')}
                  aria-label={t('tools.sheet.deleteVersion')}
                  onClick={() => onDeleteVersion(version)}
                  className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
