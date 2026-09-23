import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { buildExportFilename } from '../core';
import { downloadCanvas, exportDoc, rasterizeSelection } from '../render/export';
import { usePhotoStore } from '../store';

/**
 * 画布右键菜单。
 *
 * 有选区时给出「选区能做什么」的后续操作（填充 / 清除 / 通过拷贝新建图层 / 反选 / 导出…），
 * 没有选区时给出画布级操作（全选 / 粘贴 / 新建图层 / 视图控制）。
 */

const MENU_WIDTH = 208;

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export function CanvasContextMenu({
  position,
  onClose,
  onFit,
  onActual,
}: {
  position: ContextMenuPosition;
  onClose: () => void;
  onFit: () => void;
  onActual: () => void;
}) {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const selection = usePhotoStore((s) => s.selection);
  const clipboard = usePhotoStore((s) => s.clipboard);
  const selectAll = usePhotoStore((s) => s.selectAll);
  const invertSelection = usePhotoStore((s) => s.invertSelection);
  const setSelection = usePhotoStore((s) => s.setSelection);
  const fillSelectionArea = usePhotoStore((s) => s.fillSelectionArea);
  const copySelectionToLayer = usePhotoStore((s) => s.copySelectionToLayer);
  const pasteLayer = usePhotoStore((s) => s.pasteLayer);
  const ensurePaintLayer = usePhotoStore((s) => s.ensurePaintLayer);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // 用「DOM 包含关系」判断内外：不能靠 stopPropagation，
    // 否则 pointerdown 就把菜单卸载了，紧随其后的 click 根本落不到菜单项上
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const close = () => onClose();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [onClose]);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  const exportSelection = run(() => {
    if (!selection) return;
    // 按选区形状遮罩导出（矩形 / 椭圆 / 套索 / 反选的洞都正确挖空）
    const canvas = rasterizeSelection(doc, selection);
    if (!canvas) return;
    downloadCanvas(canvas, buildExportFilename(`${doc.name || 'photo'}-selection`, 'png'), {
      format: 'png',
      quality: 1,
    });
  });

  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(position.y, window.innerHeight - 320));

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('tools.photo.canvasMenu')}
      data-testid="canvas-context-menu"
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-50 flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {selection ? (
        <>
          <MenuHeader label={t('tools.photo.selectionOps')} />
          <MenuItem
            icon="bucket"
            label={t('tools.photo.ctxFill')}
            onClick={run(() => fillSelectionArea('fill'))}
          />
          <MenuItem
            icon="eraser"
            label={t('tools.photo.ctxClear')}
            hint="Delete"
            onClick={run(() => fillSelectionArea('clear'))}
          />
          <MenuItem
            icon="copy"
            label={t('tools.photo.ctxLayerViaCopy')}
            onClick={run(() => copySelectionToLayer())}
          />
          <MenuItem
            icon="diff"
            label={t('tools.photo.ctxInvert')}
            onClick={run(() => invertSelection())}
          />
          <MenuItem
            icon="download"
            label={t('tools.photo.ctxExportSelection')}
            onClick={exportSelection}
          />
          <MenuItem
            icon="close"
            label={t('tools.photo.deselect')}
            hint="Ctrl+D"
            onClick={run(() => setSelection(null))}
          />
        </>
      ) : null}

      <MenuHeader label={t('tools.photo.canvasOps')} />
      <MenuItem
        icon="imageFrame"
        label={t('tools.photo.ctxSelectAll')}
        hint="Ctrl+A"
        onClick={run(() => selectAll())}
      />
      <MenuItem
        icon="copy"
        label={t('tools.photo.ctxPaste')}
        disabled={!clipboard}
        onClick={run(() => pasteLayer())}
      />
      <MenuItem
        icon="placeholder"
        label={t('tools.photo.addRaster')}
        onClick={run(() => ensurePaintLayer())}
      />
      <MenuItem
        icon="download"
        label={t('tools.photo.exportImage')}
        hint="Ctrl+S"
        onClick={run(() => exportCurrent(doc))}
      />
      <MenuDivider />
      <MenuItem icon="search" label={t('tools.photo.zoomFit')} onClick={run(() => onFit())} />
      <MenuItem icon="globe" label={t('tools.photo.zoomActual')} onClick={run(() => onActual())} />
    </div>
  );
}

/** 画布右键的「导出图片」：按 PNG 直接下载当前合成结果 */
function exportCurrent(doc: Parameters<typeof exportDoc>[0]): void {
  const canvas = exportDoc(doc, { format: 'png', quality: 1 });
  downloadCanvas(canvas, buildExportFilename(doc.name || 'photo', 'png'), {
    format: 'png',
    quality: 1,
  });
}

function MenuHeader({ label }: { label: string }) {
  return (
    <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {label}
    </div>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
}

function MenuItem({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-md px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">{label}</span>
      {hint ? (
        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">{hint}</span>
      ) : null}
    </button>
  );
}
