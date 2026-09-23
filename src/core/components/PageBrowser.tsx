import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';
import { PAGE_THUMB_SIZE } from '@/core/components/pageThumbnail';

/**
 * 多页 / 多画布文档的通用「页面浏览器」（流程图、脑图共用）。
 *
 * - 页签条：上一页 / 下一页 / 页码 / 总览 / 新建，页签双击重命名，支持排序与删除；
 * - 总览浮层：以缩略图网格浏览全部页面（缩略图由各工具用自身数据模型绘制），
 *   点击任意页面即切换，`←/→` 可在总览里连续翻页，`Esc` 关闭；
 * - 组件本身不持有业务状态，只通过回调驱动宿主 store，便于在多个工具间复用。
 */

export interface PageMeta {
  id: string;
  name: string;
}

export interface PageBrowserLabels {
  /** 新建页面 / 新建画布 */
  add: string;
  renameHint: string;
  moveLeft: string;
  moveRight: string;
  remove: string;
  prev: string;
  next: string;
  /** 打开总览 */
  openOverview: string;
  overviewTitle: string;
  close: string;
  /** 空白页提示 */
  empty: string;
  /** 形如「第 2 / 5 页」，由调用方按当前语言生成 */
  counter: string;
}

export interface PageBrowserProps {
  pages: PageMeta[];
  activeId: string;
  labels: PageBrowserLabels;
  /** 页面缩略图：返回 null 表示该页还没有内容 */
  thumbnail: (id: string) => ReactNode;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

export function PageBrowser({
  pages,
  activeId,
  labels,
  thumbnail,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onMove,
}: PageBrowserProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [overviewOpen, setOverviewOpen] = useState(false);

  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activeId),
  );

  const go = (delta: number) => {
    const next = pages[activeIndex + delta];
    if (next) onSelect(next.id);
  };

  // 总览打开时：Esc 关闭，左右方向键连续翻页
  useEffect(() => {
    if (!overviewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOverviewOpen(false);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const next = pages[activeIndex + (event.key === 'ArrowRight' ? 1 : -1)];
        if (next) onSelect(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overviewOpen, pages, activeIndex, onSelect]);

  const pageCount = pages.length;
  const counter = useMemo(
    () =>
      labels.counter
        .replace('{{current}}', String(activeIndex + 1))
        .replace('{{total}}', String(pageCount)),
    [labels.counter, activeIndex, pageCount],
  );

  const commitRename = (id: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <>
      <div
        data-testid="page-strip"
        className="flex items-center gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
      >
        <NavButton
          label={labels.prev}
          testId="page-prev"
          disabled={activeIndex <= 0}
          onClick={() => go(-1)}
        />

        {pages.map((page, index) => {
          const active = page.id === activeId;
          return (
            <div
              key={page.id}
              className={`flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {editingId === page.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitRename(page.id, draft)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(page.id, draft);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                  className="w-20 rounded border border-blue-400 bg-white px-1 text-[12px] outline-none dark:bg-gray-900"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(page.id)}
                  onDoubleClick={() => {
                    setEditingId(page.id);
                    setDraft(page.name);
                  }}
                  title={labels.renameHint}
                  className="max-w-[120px] truncate"
                >
                  {page.name}
                </button>
              )}

              <TabAction
                label={labels.moveLeft}
                disabled={index === 0}
                onClick={() => onMove(page.id, -1)}
                glyph="‹"
              />
              <TabAction
                label={labels.moveRight}
                disabled={index === pages.length - 1}
                onClick={() => onMove(page.id, 1)}
                glyph="›"
              />
              {pages.length > 1 ? (
                <TabAction
                  label={labels.remove}
                  onClick={() => onRemove(page.id)}
                  glyph="✕"
                  danger
                />
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAdd}
          title={labels.add}
          aria-label={labels.add}
          className="shrink-0 rounded-md px-2 py-1 text-[13px] text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          ＋
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
          <span
            data-testid="page-counter"
            className="whitespace-nowrap px-1 font-mono text-[11px] text-gray-500 dark:text-gray-400"
          >
            {counter}
          </span>
          <button
            type="button"
            data-testid="page-overview-open"
            onClick={() => setOverviewOpen(true)}
            title={labels.openOverview}
            aria-label={labels.openOverview}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Icon name="grid" className="h-4 w-4" />
          </button>
          <NavButton
            label={labels.next}
            testId="page-next"
            disabled={activeIndex >= pages.length - 1}
            onClick={() => go(1)}
          />
        </div>
      </div>

      {overviewOpen ? (
        <div
          data-testid="page-overview"
          role="dialog"
          aria-modal="true"
          aria-label={labels.overviewTitle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOverviewOpen(false);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
        >
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {labels.overviewTitle}
              </span>
              <button
                type="button"
                data-testid="page-overview-close"
                onClick={() => setOverviewOpen(false)}
                aria-label={labels.close}
                title={labels.close}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </header>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3 overflow-y-auto p-4">
              {pages.map((page, index) => {
                const active = page.id === activeId;
                const preview = thumbnail(page.id);
                return (
                  <div
                    key={page.id}
                    data-testid={`page-card-${index}`}
                    data-active={active ? 'true' : undefined}
                    className={`group flex flex-col gap-1.5 rounded-lg border p-2 transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-blue-500/60 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`page-card-select-${index}`}
                      onClick={() => {
                        onSelect(page.id);
                        setOverviewOpen(false);
                      }}
                      style={{ height: PAGE_THUMB_SIZE.height }}
                      className="flex w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60"
                    >
                      {preview ?? (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {labels.empty}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-gray-600 dark:text-gray-300">
                        {index + 1}. {page.name}
                      </span>
                      <TabAction
                        label={labels.moveLeft}
                        disabled={index === 0}
                        onClick={() => onMove(page.id, -1)}
                        glyph="‹"
                      />
                      <TabAction
                        label={labels.moveRight}
                        disabled={index === pages.length - 1}
                        onClick={() => onMove(page.id, 1)}
                        glyph="›"
                      />
                      {pages.length > 1 ? (
                        <TabAction
                          label={labels.remove}
                          onClick={() => onRemove(page.id)}
                          glyph="✕"
                          danger
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function NavButton({
  label,
  testId,
  disabled,
  onClick,
}: {
  label: string;
  testId: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <Icon name={testId === 'page-prev' ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
    </button>
  );
}

function TabAction({
  label,
  glyph,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded px-0.5 text-[11px] transition-colors disabled:opacity-30 ${
        danger
          ? 'text-gray-400 hover:text-red-500'
          : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {glyph}
    </button>
  );
}
