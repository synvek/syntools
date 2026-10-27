import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { Icon } from '@/core/components/Icon';

/**
 * Editor context menu.
 *
 * Why it exists: the editor had no contextmenu handling at all, so links could only be created via a
 * toolbar button + `window.prompt` and then couldn't be inspected, edited or removed; on desktop
 * (Tauri) even the native context menu is unavailable, which drops basics like copy / paste.
 *
 * The menu offers different actions per hit target: link (open / copy address / edit / remove),
 * image (delete), text (cut / copy / paste / common formats / insert link / clear formatting),
 * empty space (paste / select all).
 */

/** Context and position of the right-click hit (viewport coordinates) */
export interface EditorContextTarget {
  x: number;
  y: number;
  kind: 'link' | 'image' | 'text' | 'empty';
  /** kind === 'link': link address */
  href?: string;
  /** kind === 'image': document position of the image node */
  imagePos?: number;
}

interface EditorContextMenuProps {
  editor: Editor;
  target: EditorContextTarget;
  onClose: () => void;
}

/** Copy to clipboard: prefer the async API, fall back to a temporary textarea (same strategy as CopyButton) */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Continue to the fallback path
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

/** Open a link in a new tab / system browser (like other external links here: native anchor + target=_blank) */
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
       * Preserve the editor's focus and selection: once the menu steals focus,
       * execCommand('copy' / 'cut') operates on an empty selection. Positioning and closing of the
       * menu are handled by the pointerdown listener, unaffected by preventDefault here.
       */
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {/* The glyph is decorative only: the accessible name stays plain action text, avoiding "B bold" */}
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
  /** Fallback position before measuring (keeps the first frame from appearing in the wrong place) */
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  /** Link address input state: edit an existing link / insert a link for the selected text */
  const [linkEdit, setLinkEdit] = useState<{
    mode: 'edit' | 'insert';
    value: string;
    from: number;
    to: number;
  } | null>(null);
  /** Whether the link input is open: driven by a boolean so side effects don't re-fire while typing */
  const editing = linkEdit !== null;

  // Keep the menu inside the viewport using measured size (entering the link input changes it, so re-clamp)
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
   * Focus and select-all only when entering the input state, so the old address can be overwritten directly.
   * The dependency must be the boolean: depending on object state that changes per keystroke would
   * re-select on every character, and the next character would replace everything typed so far.
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
      // Intercept in the capture phase: once the menu closes, Esc no longer reaches the editor
      event.stopPropagation();
      onClose();
    };
    const onViewportChange = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    // Scrolling / zooming invalidates the coordinates; closing beats leaving a misplaced menu
    window.addEventListener('wheel', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [onClose]);

  /** Close the menu before running the action, so action-triggered re-renders don't hit a stale menu */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const chain = () => editor.chain().focus();
  const { from, to } = editor.state.selection;
  const hasSelection = from !== to;

  /** Submit the link input: for edits it applies to the whole link, for inserts to the text selected at right-click; empty removes it */
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
                  // Clipboard unreadable (permissions / environment): stay silent, the user can still paste with a shortcut
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
