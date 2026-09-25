import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { runMarkdownAction, type MarkdownAction, type MarkdownJarLike } from './editor';

interface MarkdownToolbarProps {
  getJar: () => MarkdownJarLike | null;
}

interface ToolbarItem {
  id: MarkdownAction;
  label: string;
  tipKey: string;
}

/** 按「强调 → 标题 → 块级 → 插入」分组，分组之间留分隔线，便于扫读 */
const GROUPS: ToolbarItem[][] = [
  [
    { id: 'bold', label: 'B', tipKey: 'tools.markdown.toolbar.bold' },
    { id: 'italic', label: 'I', tipKey: 'tools.markdown.toolbar.italic' },
    { id: 'strike', label: 'S', tipKey: 'tools.markdown.toolbar.strike' },
    { id: 'code', label: '`', tipKey: 'tools.markdown.toolbar.code' },
  ],
  [
    { id: 'h1', label: 'H1', tipKey: 'tools.markdown.toolbar.h1' },
    { id: 'h2', label: 'H2', tipKey: 'tools.markdown.toolbar.h2' },
    { id: 'h3', label: 'H3', tipKey: 'tools.markdown.toolbar.h3' },
    { id: 'h4', label: 'H4', tipKey: 'tools.markdown.toolbar.h4' },
    { id: 'h5', label: 'H5', tipKey: 'tools.markdown.toolbar.h5' },
    { id: 'h6', label: 'H6', tipKey: 'tools.markdown.toolbar.h6' },
  ],
  [
    { id: 'quote', label: '>', tipKey: 'tools.markdown.toolbar.quote' },
    { id: 'ul', label: '•', tipKey: 'tools.markdown.toolbar.ul' },
    { id: 'ol', label: '1.', tipKey: 'tools.markdown.toolbar.ol' },
    { id: 'task', label: '☑', tipKey: 'tools.markdown.toolbar.task' },
  ],
  [
    { id: 'link', label: '[]', tipKey: 'tools.markdown.toolbar.link' },
    { id: 'image', label: '![]', tipKey: 'tools.markdown.toolbar.image' },
    { id: 'codeBlock', label: '```', tipKey: 'tools.markdown.toolbar.codeBlock' },
    { id: 'table', label: 'tbl', tipKey: 'tools.markdown.toolbar.table' },
    { id: 'hr', label: '—', tipKey: 'tools.markdown.toolbar.hr' },
  ],
];

/** Markdown 快捷工具栏：点击按钮对选区应用语法 */
export function MarkdownToolbar({ getJar }: MarkdownToolbarProps) {
  const { t } = useTranslation();

  const run = (action: MarkdownAction) => {
    const jar = getJar();
    if (!jar) return;
    runMarkdownAction(jar, action);
  };

  return (
    <div
      role="toolbar"
      aria-label={t('tools.markdown.toolbar.aria')}
      className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
    >
      {GROUPS.map((group, index) => (
        <Fragment key={group[0].id}>
          {index > 0 ? (
            <span
              className="mx-0.5 h-4 w-px shrink-0 self-center bg-gray-300 dark:bg-gray-600"
              aria-hidden="true"
            />
          ) : null}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              title={t(item.tipKey)}
              aria-label={t(item.tipKey)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(item.id)}
              className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 font-mono text-xs font-semibold text-gray-700 hover:bg-white hover:text-blue-600 dark:text-gray-200 dark:hover:bg-gray-900 dark:hover:text-blue-400"
            >
              {item.label}
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
