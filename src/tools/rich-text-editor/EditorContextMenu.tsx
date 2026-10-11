import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';

/**
 * 编辑区右键菜单。
 *
 * 为什么需要它：编辑区此前没有任何 contextmenu 处理，链接只能靠工具栏按钮 + `window.prompt`
 * 创建，创建后既看不到地址也无法修改 / 移除；桌面端（Tauri）连原生右键菜单都不可用，
 * 等于丢掉了复制 / 粘贴这类基本操作。
 *
 * 菜单按命中的对象给出不同动作：链接（打开 / 复制地址 / 编辑 / 移除）、图片（删除）、
 * 文本（剪切 / 复制 / 粘贴 / 常用格式 / 插入链接 / 清除格式）、空白（粘贴 / 全选）。
 */

/** 右键命中的上下文与位置（视口坐标） */
export interface EditorContextTarget {
  x: number;
  y: number;
  kind: 'link' | 'image' | 'text' | 'empty';
  /** kind === 'link'：链接地址 */
  href?: string;
  /** kind === 'image'：图片节点在文档中的位置 */
  imagePos?: number;
}

interface EditorContextMenuProps {
  editor: Editor;
  target: EditorContextTarget;
  onClose: () => void;
}

/** 复制到剪贴板：优先异步 API，失败退回临时 textarea（与 CopyButton 同策略） */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // 继续走降级路径
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

/** 在新标签页 / 系统浏览器打开链接（与站内其它外链一致：原生锚点 + target=_blank） */
function openInNewTab(href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noreferrer noopener';
  anchor.click();
}

interface RowProps {
  label: string;
  glyph?: ReactNode;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function Row({ label, glyph, icon, active = false, disabled = false, onClick }: RowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      /*
       * 保持编辑器的焦点与选区：菜单一旦抢走焦点，execCommand('copy' / 'cut') 就会落在空选区上。
       * 菜单自身的定位与关闭由 pointerdown 监听负责，不受这里 preventDefault 影响。
       */
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {/* 字形只是装饰：可访问名称保持为纯动作文字，避免读出「B 加粗」 */}
      <span
        aria-hidden="true"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center opacity-70"
      >
        {glyph ?? (icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : null)}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-gray-100 dark:border-gray-800" />;
}

export function EditorContextMenu({ editor, target, onClose }: EditorContextMenuProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 实测尺寸前的兜底定位（避免首帧出现在错误位置） */
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  /** 链接地址输入态：编辑已有链接 / 为选中文本插入链接 */
  const [linkEdit, setLinkEdit] = useState<{
    mode: 'edit' | 'insert';
    value: string;
    from: number;
    to: number;
  } | null>(null);
  /** 是否处于链接输入态：用布尔量驱动副作用，避免输入过程中被反复触发 */
  const editing = linkEdit !== null;

  // 按实测尺寸把菜单收敛在视口内（进入链接输入态后尺寸会变，需重新收敛）
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const availW = document.documentElement.clientWidth;
    const availH = document.documentElement.clientHeight;
    setPos({
      left: Math.max(8, Math.min(target.x, availW - width - 8)),
      top: Math.max(8, Math.min(target.y, availH - height - 8)),
    });
  }, [target, editing]);

  /*
   * 只在「进入输入态」时聚焦并全选一次，方便直接覆盖旧地址。
   * 依赖必须是布尔量：若依赖每次输入都会变化的对象状态，每敲一个字母都会重新全选，
   * 下一个字母就会把已输入的内容整段替换掉。
   */
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 捕获阶段拦下：菜单关闭后不再把 Esc 传给编辑器
      event.stopPropagation();
      onClose();
    };
    const onViewportChange = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    // 滚动 / 缩放会让坐标失效，直接关闭比留着错位菜单更好
    window.addEventListener('wheel', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [onClose]);

  /** 先关菜单再执行动作，避免动作引起的重渲染作用在已失效的菜单上 */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const chain = () => editor.chain().focus();
  const { from, to } = editor.state.selection;
  const hasSelection = from !== to;

  /** 提交链接输入：编辑已有链接时作用于整段链接，插入时作用于右键时选中的文本；留空即移除 */
  const submitLink = () => {
    if (!linkEdit) return;
    const href = linkEdit.value.trim();
    const next = chain().setTextSelection({ from: linkEdit.from, to: linkEdit.to });
    if (linkEdit.mode === 'edit') next.extendMarkRange('link');
    if (href) next.setLink({ href }).run();
    else next.unsetLink().run();
    setLinkEdit(null);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      data-testid="rich-text-context-menu"
      role="menu"
      aria-label={t('tools.richText.contextMenu')}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-[60] max-h-[calc(100vh-1rem)] w-52 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {linkEdit ? (
        <form
          className="flex flex-col gap-1.5 p-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitLink();
          }}
        >
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {t('tools.richText.linkAddress')}
          </span>
          <input
            ref={inputRef}
            aria-label={t('tools.richText.linkAddress')}
            value={linkEdit.value}
            onChange={(event) => {
              const { value } = event.target;
              setLinkEdit((prev) => (prev ? { ...prev, value } : prev));
            }}
            placeholder="https://"
            className="h-7 rounded-md border border-gray-300 bg-white px-2 text-[12px] text-gray-700 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setLinkEdit(null)}
              className="h-6 rounded border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('tools.richText.cancel')}
            </button>
            <button
              type="submit"
              className="h-6 rounded bg-blue-600 px-2 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t('tools.richText.apply')}
            </button>
          </div>
        </form>
      ) : target.kind === 'link' ? (
        <>
          <Row
            icon="link"
            label={t('tools.richText.openLink')}
            onClick={run(() => openInNewTab(target.href ?? ''))}
          />
          <Row
            icon="copy"
            label={t('tools.richText.copyLink')}
            onClick={run(() => void copyText(target.href ?? ''))}
          />
          <Row
            icon="pen"
            label={t('tools.richText.editLink')}
            onClick={() => setLinkEdit({ mode: 'edit', value: target.href ?? '', from, to })}
          />
          <Separator />
          <Row
            icon="close"
            label={t('tools.richText.removeLink')}
            onClick={run(() => chain().extendMarkRange('link').unsetLink().run())}
          />
        </>
      ) : target.kind === 'image' ? (
        <Row
          icon="close"
          label={t('tools.richText.deleteImage')}
          onClick={run(() => {
            const pos = target.imagePos;
            if (typeof pos !== 'number' || editor.state.doc.nodeAt(pos)?.type.name !== 'image')
              return;
            chain().setNodeSelection(pos).deleteSelection().run();
          })}
        />
      ) : (
        <>
          <Row
            label={t('tools.richText.cut')}
            disabled={!hasSelection}
            onClick={run(() => document.execCommand('cut'))}
          />
          <Row
            label={t('common.copy')}
            disabled={!hasSelection}
            onClick={run(() => document.execCommand('copy'))}
          />
          <Row
            label={t('tools.richText.paste')}
            onClick={run(() => {
              void navigator.clipboard
                .readText()
                .then((text) => {
                  if (text) chain().insertContent(text).run();
                })
                .catch(() => {
                  // 剪贴板不可读（权限 / 环境限制）：保持静默，用户仍可用快捷键粘贴
                });
            })}
          />
          {hasSelection ? (
            <>
              <Separator />
              <Row
                glyph={<span className="text-[12px] font-bold">B</span>}
                label={t('tools.richText.bold')}
                active={editor.isActive('bold')}
                onClick={run(() => chain().toggleBold().run())}
              />
              <Row
                glyph={<span className="text-[12px] italic">I</span>}
                label={t('tools.richText.italic')}
                active={editor.isActive('italic')}
                onClick={run(() => chain().toggleItalic().run())}
              />
              <Row
                glyph={<span className="text-[12px] underline">U</span>}
                label={t('tools.richText.underline')}
                active={editor.isActive('underline')}
                onClick={run(() => chain().toggleUnderline().run())}
              />
              <Row
                glyph={<span className="text-[12px] line-through">S</span>}
                label={t('tools.richText.strike')}
                active={editor.isActive('strike')}
                onClick={run(() => chain().toggleStrike().run())}
              />
              <Row
                label={t('tools.richText.highlight')}
                active={editor.isActive('highlight')}
                onClick={run(() => chain().toggleHighlight({ color: '#FEF08A' }).run())}
              />
              <Separator />
              <Row
                icon="link"
                label={t('tools.richText.insertLink')}
                onClick={() => setLinkEdit({ mode: 'insert', value: '', from, to })}
              />
              <Row
                label={t('tools.richText.clearFormat')}
                onClick={run(() => chain().unsetAllMarks().run())}
              />
            </>
          ) : (
            <>
              <Separator />
              <Row
                label={t('tools.richText.selectAll')}
                onClick={run(() => chain().selectAll().run())}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
