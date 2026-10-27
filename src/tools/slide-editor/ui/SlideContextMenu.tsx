import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { containerElements, useSlideStore } from '../store';

/**
 * Slide context menu.
 *
 * The canvas, the thumbnail rail and the property panel share one panel: positioning (clamped to the
 * viewport after measuring) and closing (outside click / Esc / scroll / zoom) exist once, and only the
 * content switches by hit target, so each hit type doesn't need its own menu.
 *
 * - `element`: right-click an element — clipboard, edit text, z-order, group, lock/hide, promote to master, delete;
 * - `canvas`: right-click blank canvas — paste, select all, slide actions, snap and ruler toggles, fit to window;
 * - `slide`: right-click a thumbnail — new / duplicate / delete this slide and move it up or down.
 */

export interface SlideContextTarget {
  kind: 'element' | 'canvas' | 'slide';
  /** Viewport coordinates (clientX / clientY) */
  x: number;
  y: number;
  /** Id of the hit element when `kind === 'element'` */
  elementId?: string | null;
  /** Target slide index when `kind === 'slide'` */
  slideIndex?: number;
}

export function SlideContextMenu({
  target,
  onClose,
  onEditText,
}: {
  target: SlideContextTarget | null;
  onClose: () => void;
  /** Enter inline text editing; not needed by the thumbnail menu, hence optional */
  onEditText?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  /** Fallback position before measuring (off-screen, so it doesn't flash in the wrong place on the first frame) */
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  const doc = useSlideStore((s) => s.doc);
  const viewMode = useSlideStore((s) => s.viewMode);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const clipboard = useSlideStore((s) => s.clipboard);
  const gridSnap = useSlideStore((s) => s.gridSnap);
  const showRulers = useSlideStore((s) => s.showRulers);

  // Subscribe only to these stable values and derive arrays inside useMemo: returning a new array from
  // a selector makes useSyncExternalStore think the snapshot changed every time, and React errors out
  const elements = useMemo(
    () => containerElements({ doc, viewMode, slideIndex, masterKind, masterIndex }),
    [doc, viewMode, slideIndex, masterKind, masterIndex],
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!target || !panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const viewportW = document.documentElement.clientWidth;
    const viewportH = document.documentElement.clientHeight;
    setPos({
      left: Math.max(8, Math.min(target.x, Math.max(8, viewportW - width - 8))),
      top: Math.max(8, Math.min(target.y, Math.max(8, viewportH - height - 8))),
    });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const outside = (node: EventTarget | null) => !panelRef.current?.contains(node as Node | null);
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Intercept in the capture phase: once the menu is closed, the editor's global Esc (clear selection) doesn't fire
      event.stopPropagation();
      onClose();
    };
    // The menu is anchored with fixed coordinates, so scrolling / wheel / zoom invalidate it; closing is more reliable
    const onScrollLike = (event: Event) => {
      if (outside(event.target)) onClose();
    };
    const close = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('wheel', onScrollLike, { passive: true });
    window.addEventListener('scroll', onScrollLike, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', onScrollLike);
      window.removeEventListener('scroll', onScrollLike, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [target, onClose]);

  if (!target) return null;

  const store = useSlideStore.getState;
  const targetIndex = target.slideIndex ?? slideIndex;
  const picked = elements.filter((element) => selection.includes(element.id));
  const hasSelection = picked.length > 0;
  const hit = target.elementId
    ? elements.find((element) => element.id === target.elementId)
    : undefined;
  const canEditText =
    Boolean(onEditText) && (hit?.type === 'text' || (hit?.type === 'shape' && Boolean(hit.body)));
  const canUngroup = picked.some((element) => element.type === 'group');
  const allLocked = hasSelection && picked.every((element) => element.locked);
  const allHidden = hasSelection && picked.every((element) => element.visible === false);

  /** Close the menu before running the action: actions change the store and the menu shouldn't linger on a stale selection */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      data-testid="slide-context-menu"
      aria-label={t('tools.slide.contextMenu')}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-[60] max-h-[min(70vh,34rem)] w-52 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {target.kind === 'element' ? (
        <>
          <Row
            label={t('tools.slide.cut')}
            hint="Ctrl+X"
            disabled={!hasSelection}
            onClick={run(() => store().cutSelected())}
          />
          <Row
            label={t('common.copy')}
            hint="Ctrl+C"
            disabled={!hasSelection}
            onClick={run(() => store().copySelected())}
          />
          <Row
            label={t('tools.slide.paste')}
            hint="Ctrl+V"
            disabled={clipboard.length === 0}
            onClick={run(() => store().pasteClipboard())}
          />
          <Row
            label={t('tools.slide.duplicateElement')}
            hint="Ctrl+D"
            disabled={!hasSelection}
            onClick={run(() => store().duplicateSelected())}
          />

          {canEditText ? (
            <>
              <Separator />
              <Row
                label={t('tools.slide.editText')}
                onClick={run(() => onEditText?.(target.elementId as string))}
              />
            </>
          ) : null}

          <Separator />
          <Row
            label={t('tools.slide.bringToFront')}
            disabled={!hasSelection}
            onClick={run(() => store().bringToFront())}
          />
          <Row
            label={t('tools.slide.bringForward')}
            disabled={!hasSelection}
            onClick={run(() => store().bringForward())}
          />
          <Row
            label={t('tools.slide.sendBackward')}
            disabled={!hasSelection}
            onClick={run(() => store().sendBackward())}
          />
          <Row
            label={t('tools.slide.sendToBack')}
            disabled={!hasSelection}
            onClick={run(() => store().sendToBack())}
          />

          <Separator />
          <Row
            label={t('tools.slide.group')}
            disabled={selection.length < 2}
            onClick={run(() => store().groupSelected())}
          />
          <Row
            label={t('tools.slide.ungroup')}
            disabled={!canUngroup}
            onClick={run(() => store().ungroupSelected())}
          />

          <Separator />
          <Row
            label={t(allLocked ? 'tools.slide.unlock' : 'tools.slide.lock')}
            disabled={!hasSelection}
            onClick={run(() => store().toggleLockSelected())}
          />
          <Row
            label={t(allHidden ? 'tools.slide.show' : 'tools.slide.hide')}
            disabled={!hasSelection}
            onClick={run(() => store().toggleVisibleSelected())}
          />

          {/* Promoting to a master element only makes sense in normal view (in master view they're already on the master) */}
          {viewMode === 'normal' ? (
            <>
              <Separator />
              <Row
                label={t('tools.slide.promoteToMaster')}
                disabled={!hasSelection}
                onClick={run(() => store().promoteSelectedToMaster())}
              />
            </>
          ) : null}

          <Separator />
          <Row
            label={t('tools.slide.deleteElement')}
            hint="Delete"
            danger
            disabled={!hasSelection}
            onClick={run(() => store().removeSelected())}
          />
        </>
      ) : null}

      {target.kind === 'canvas' ? (
        <>
          <Row
            label={t('tools.slide.paste')}
            hint="Ctrl+V"
            disabled={clipboard.length === 0}
            onClick={run(() => store().pasteClipboard())}
          />
          <Row
            label={t('tools.slide.selectAll')}
            hint="Ctrl+A"
            onClick={run(() =>
              store().select(containerElements(store()).map((element) => element.id)),
            )}
          />

          <Separator />
          <Row label={t('tools.slide.addSlide')} onClick={run(() => store().addSlide())} />
          <Row
            label={t('tools.slide.duplicate')}
            onClick={run(() => store().duplicateSlide(store().slideIndex))}
          />
          <Row
            label={t('tools.slide.deleteSlide')}
            disabled={doc.slides.length <= 1}
            onClick={run(() => store().removeSlide(store().slideIndex))}
          />

          <Separator />
          <Row
            label={t('tools.slide.gridSnap')}
            checked={gridSnap}
            onClick={run(() => store().toggleGridSnap())}
          />
          <Row
            label={t('tools.slide.showRulers')}
            checked={showRulers}
            onClick={run(() => store().toggleRulers())}
          />

          <Separator />
          <Row
            label={t('tools.slide.zoomFit')}
            onClick={run(() => store().setViewport({ scale: 0, panX: 0, panY: 0 }))}
          />
        </>
      ) : null}

      {target.kind === 'slide' ? (
        <>
          <Row
            label={t('tools.slide.addSlide')}
            onClick={run(() => {
              // addSlide inserts after the current slide, so make the target current first to match "new slide after this one"
              store().selectSlide(targetIndex);
              store().addSlide();
            })}
          />
          <Row
            label={t('tools.slide.duplicate')}
            onClick={run(() => store().duplicateSlide(targetIndex))}
          />
          <Row
            label={t('tools.slide.deleteSlide')}
            danger
            disabled={doc.slides.length <= 1}
            onClick={run(() => store().removeSlide(targetIndex))}
          />

          <Separator />
          <Row
            label={t('tools.slide.moveUp')}
            disabled={targetIndex <= 0}
            onClick={run(() => store().moveSlide(targetIndex, targetIndex - 1))}
          />
          <Row
            label={t('tools.slide.moveDown')}
            disabled={targetIndex >= doc.slides.length - 1}
            onClick={run(() => store().moveSlide(targetIndex, targetIndex + 1))}
          />
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  hint,
  checked,
  disabled,
  danger,
  onClick,
}: {
  label: string;
  hint?: string;
  /** Toggle item: leaves a check slot on the left, showing a checkmark when on */
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-red-600 hover:bg-red-50 disabled:hover:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10'
          : 'text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      <span className="flex w-3.5 shrink-0 justify-center">
        {checked ? <Icon name="check" className="h-3 w-3" /> : null}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        // The shortcut is only a visual hint: keep it out of the accessible name (or a screen reader reads "Copy Ctrl+C")
        <span aria-hidden="true" className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
}
