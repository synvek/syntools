import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { StoredVersion } from './docStore';
import { buildSideBySide, buildVersionDiff, type DiffSideRow } from './versionDiff';

interface VersionDiffPanelProps {
  versions: StoredVersion[];
  /** 默认选中的版本 id（从版本列表点「对比」进入时指定） */
  initialVersionId?: string;
  /** 当前编辑器内容（作为「与当前版本对比」的右侧基准） */
  currentHtml: string;
  currentTitle: string;
  onRestore: (version: StoredVersion) => void;
  onClose: () => void;
}

/** 对比模式：与当前编辑内容对比 / 该快照相对其上一版的变化 */
type CompareMode = 'current' | 'previous';

/** 渲染上限：超长文档只展示前 N 行，避免一次插入过多 DOM 节点 */
const MAX_RENDERED_ROWS = 1500;

const NAME_CLASS: Record<DiffSideRow['kind'], string> = {
  equal: 'border-transparent text-gray-500 dark:text-gray-400',
  change: 'border-amber-400 bg-amber-50/60 text-gray-800 dark:bg-amber-950/30 dark:text-gray-100',
  insert: 'border-green-500 bg-green-50/60 text-gray-800 dark:bg-green-950/30 dark:text-gray-100',
  delete: 'border-red-500 bg-red-50/60 text-gray-800 dark:bg-red-950/30 dark:text-gray-100',
};

const CELL_CLASS: Record<'equal' | 'insert' | 'delete' | 'empty', string> = {
  equal: 'border-transparent text-gray-600 dark:text-gray-300',
  insert: 'border-green-500 bg-green-50/60 dark:bg-green-950/30',
  delete: 'border-red-500 bg-red-50/60 dark:bg-red-950/30',
  empty: 'border-transparent bg-gray-50/60 dark:bg-gray-800/30',
};

function lineNo(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * 版本差异面板：左侧版本列表（时间 / 字数 / 备注），右侧行级左右对照。
 * 差异计算走 versionDiff.ts 纯逻辑，面板只负责选择与渲染。
 */
export function VersionDiffPanel({
  versions,
  initialVersionId,
  currentHtml,
  currentTitle,
  onRestore,
  onClose,
}: VersionDiffPanelProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!initialVersionId) return 0;
    const index = versions.findIndex((version) => version.id === initialVersionId);
    return index >= 0 ? index : 0;
  });
  const [mode, setMode] = useState<CompareMode>('current');

  const selected = versions[selectedIndex] ?? null;
  const previous = versions[selectedIndex + 1] ?? null;

  const diff = useMemo(() => {
    if (!selected) return null;
    if (mode === 'previous') {
      if (!previous) return null;
      return buildVersionDiff(previous.html, selected.html);
    }
    return buildVersionDiff(selected.html, currentHtml);
  }, [selected, previous, mode, currentHtml]);

  const sideRows = useMemo(() => {
    if (!diff || !diff.ok) return [];
    return buildSideBySide(diff.value.rows);
  }, [diff]);

  const visibleRows = sideRows.slice(0, MAX_RENDERED_ROWS);
  const truncated = sideRows.length > MAX_RENDERED_ROWS;

  return (
    <div
      data-testid="rich-text-version-diff"
      className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-2 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.versionDiffTitle')}
        </span>
        <div className="flex rounded-md border border-gray-300 p-0.5 dark:border-gray-600">
          {(['current', 'previous'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              disabled={option === 'previous' && !previous}
              onClick={() => setMode(option)}
              className={`h-6 rounded px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === option
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {option === 'current'
                ? t('tools.richText.diffVsCurrent')
                : t('tools.richText.diffVsPrevious')}
            </button>
          ))}
        </div>
        {diff && diff.ok ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {diff.value.identical ? (
              <span>{t('tools.richText.diffIdentical')}</span>
            ) : (
              <>
                <span className="text-green-600 dark:text-green-400">
                  +{diff.value.addedLines} {t('tools.richText.diffLinesUnit')}
                </span>
                <span className="text-red-600 dark:text-red-400">
                  −{diff.value.removedLines} {t('tools.richText.diffLinesUnit')}
                </span>
                <span>
                  {t('tools.richText.diffSimilarity', {
                    percent: Math.round(diff.value.similarity * 100),
                  })}
                </span>
              </>
            )}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={t('tools.richText.diffClose')}
          onClick={onClose}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2 xl:flex-row">
        <ul className="max-h-40 w-full shrink-0 overflow-auto xl:max-h-96 xl:w-56">
          {versions.map((version, index) => (
            <li key={version.id}>
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-950/40'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="block truncate text-gray-800 dark:text-gray-100">
                  {version.note || t('tools.richText.versionAuto')}
                </span>
                <span className="block text-gray-400 dark:text-gray-500">
                  {new Date(version.savedAt).toLocaleString()}
                </span>
                <span className="block text-gray-400 dark:text-gray-500">
                  {t('tools.richText.versionChars', { count: version.html.length })}
                  {index === 0 ? ` · ${t('tools.richText.versionLatest')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 flex-1">
          <div className="mb-1 grid grid-cols-2 gap-px text-xs text-gray-400 dark:text-gray-500">
            <span className="truncate px-1">
              {mode === 'current'
                ? selected?.note || t('tools.richText.versionAuto')
                : previous?.note || t('tools.richText.versionAuto')}
            </span>
            <span className="truncate px-1">
              {mode === 'current'
                ? currentTitle || t('tools.richText.untitledDoc')
                : selected?.note || t('tools.richText.versionAuto')}
            </span>
          </div>
          <div
            data-testid="rich-text-version-diff-body"
            className="max-h-96 overflow-auto rounded-md border border-gray-200 font-mono text-xs leading-relaxed dark:border-gray-700"
          >
            {!diff ? (
              <p className="p-3 font-sans text-gray-400 dark:text-gray-500">
                {t('tools.richText.diffNoBaseline')}
              </p>
            ) : !diff.ok ? (
              <p className="p-3 font-sans text-amber-600 dark:text-amber-400">
                {t('tools.richText.err.EMPTY')}
              </p>
            ) : (
              visibleRows.map((row, index) => (
                <div
                  key={`${index}-${row.kind}`}
                  className={`grid grid-cols-2 border-l-2 ${NAME_CLASS[row.kind]}`}
                >
                  <span
                    className={`flex gap-1 border-l-2 px-1 py-0.5 ${
                      CELL_CLASS[row.left ? row.left.kind : 'empty']
                    }`}
                  >
                    <span className="w-8 shrink-0 select-none text-right text-gray-300 dark:text-gray-600">
                      {lineNo(row.left?.beforeLine ?? null)}
                    </span>
                    <span className="min-w-0 whitespace-pre-wrap break-all">
                      {row.left?.text ?? ''}
                    </span>
                  </span>
                  <span
                    className={`flex gap-1 border-l-2 px-1 py-0.5 ${
                      CELL_CLASS[row.right ? row.right.kind : 'empty']
                    }`}
                  >
                    <span className="w-8 shrink-0 select-none text-right text-gray-300 dark:text-gray-600">
                      {lineNo(row.right?.afterLine ?? null)}
                    </span>
                    <span className="min-w-0 whitespace-pre-wrap break-all">
                      {row.right?.text ?? ''}
                    </span>
                  </span>
                </div>
              ))
            )}
            {truncated ? (
              <p className="p-2 font-sans text-gray-400 dark:text-gray-500">
                {t('tools.richText.diffTruncated', { count: MAX_RENDERED_ROWS })}
              </p>
            ) : null}
          </div>

          {selected ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onRestore(selected)}
                className="h-7 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.richText.restoreThisVersion')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
