import { useTranslation } from 'react-i18next';
import { formatBytes } from '../core';
import { estimateMemoryBytes } from '../model/assets';
import { usePhotoStore } from '../store';
import { layerDisplayName } from './layerName';

/**
 * Bottom status bar: sections for color mode / zoom / cursor / selection / current layer / canvas info / memory.
 * Like desktop retouching apps, document-level info is pinned to the bottom so it does not eat canvas or panel space.
 */
export function StatusBar({ cursor }: { cursor: { x: number; y: number } | null }) {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const scale = usePhotoStore((s) => s.viewport.scale);
  const selection = usePhotoStore((s) => s.selection);
  const activeId = usePhotoStore((s) => s.doc.activeLayerId);
  const layer = doc.layers.find((item) => item.id === activeId);

  return (
    <div
      data-editor-statusbar
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-mono text-[11px] text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
    >
      <span data-testid="photo-mode" className="text-gray-400 dark:text-gray-500">
        RGB · 8-bit
      </span>
      <span>{t('tools.photo.statusZoom', { scale: Math.round((scale || 1) * 100) })}</span>
      {cursor ? <span>{t('tools.photo.statusCursor', { x: cursor.x, y: cursor.y })}</span> : null}
      {selection ? (
        <span>
          {t('tools.photo.statusSelection', {
            width: Math.round(selection.width),
            height: Math.round(selection.height),
          })}
        </span>
      ) : null}
      <span className="truncate">
        {layer ? layerDisplayName(layer, doc.layers, t) : t('tools.photo.noLayer')}
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span data-testid="photo-stats">
          {t('tools.photo.stats', {
            width: doc.width,
            height: doc.height,
            count: doc.layers.length,
          })}
        </span>
        <span>{t('tools.photo.statusMemory', { size: formatBytes(estimateMemoryBytes()) })}</span>
      </span>
    </div>
  );
}
