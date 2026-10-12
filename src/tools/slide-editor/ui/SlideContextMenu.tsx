import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { containerElements, useSlideStore } from '../store';

/**
 * 幻灯片右键菜单。
 *
 * 画布、左侧页缩略图、属性面板上的右键共用同一个面板：
 * 定位（按实测尺寸收敛在视口内）与关闭时机（点击外部 / Esc / 滚动 / 缩放）只有一份实现，
 * 内容按命中对象切换，避免每种命中各写一套菜单。
 *
 * - `element`：右键元素 —— 剪贴板、编辑文字、层级、组合、锁定隐藏、提升母版、删除；
 * - `canvas`：右键画布空白 —— 粘贴、全选、页操作、吸附与标尺开关、适应窗口；
 * - `slide`：右键页缩略图 —— 新建 / 复制 / 删除该页与上下移动。
 */

export interface SlideContextTarget {
  kind: 'element' | 'canvas' | 'slide';
  /** 视口坐标（clientX / clientY） */
  x: number;
  y: number;
  /** `kind === 'element'` 时命中的元素 id */
  elementId?: string | null;
  /** `kind === 'slide'` 时的目标页下标 */
  slideIndex?: number;
}

export function SlideContextMenu({
  target,
  onClose,
  onEditText,
}: {
  target: SlideContextTarget | null;
  onClose: () => void;
  /** 进入行内文字编辑；缩略图菜单不需要，故为可选 */
  onEditText?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  /** 实测尺寸前的兜底定位（先摆在视口外，避免首帧闪现在错误位置） */
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

  // 只订阅上面这些稳定值，派生数组在 useMemo 里算：选择器里返回新数组会让
  // useSyncExternalStore 认为快照每次都变，React 会直接报错
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
      // 捕获阶段拦下：菜单关闭后不再触发编辑器的全局 Esc（取消选择）
      event.stopPropagation();
      onClose();
    };
    // 菜单已用 fixed 坐标锚定，滚动 / 滚轮 / 缩放后位置会失效，直接收起更稳
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

  /** 先关菜单再执行动作：动作会改 store，菜单不该停在已失效的选中态上 */
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

          {/* 提升为母版元素只在普通视图有意义（母版视图里元素本来就在母版上） */}
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
              // addSlide 插入到当前页之后，先把目标页设为当前页，语义才符合「在这一页后面新建」
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
  /** 开关型条目：左侧留出勾选位，选中时显示对勾 */
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
        // 快捷键只是视觉提示：不进可访问名（否则读屏会把「复制 Ctrl+C」整串念出来）
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
