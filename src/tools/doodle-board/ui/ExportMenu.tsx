import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Scene } from '../core';
import { exportScene, type ExportFormat } from '../export';
import { BoardIcon } from './icons';

const ITEMS: { format: ExportFormat; key: string }[] = [
  { format: 'png', key: 'exportPng' },
  { format: 'pngAlpha', key: 'exportPngTransparent' },
  { format: 'jpg', key: 'exportJpg' },
];

/** 导出下拉：把 3 个格式收进一个菜单，避免常驻占用主栏宽度 */
export default function ExportMenu({ scene }: { scene: Scene }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-blue-700"
      >
        <BoardIcon name="download" className="h-4 w-4" />
        {t('tools.doodle.export')}
        <BoardIcon name="chevronDown" className="h-3 w-3" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {ITEMS.map(({ format, key }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void exportScene(scene, format);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 transition-colors duration-150 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t(`tools.doodle.${key}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
