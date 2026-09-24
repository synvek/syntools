import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionBar } from '@/core/components/ActionButtons';
import { FileDropZone } from '@/core/components/FileDropZone';
import { Icon } from '@/core/components/Icon';
import { downloadBlob } from '@/core/lib/download';
import { computeGrid, type GridCell } from './core';

interface Tile {
  cell: GridCell;
  url: string;
}

export default function ImageGridCutTool() {
  const { t } = useTranslation();
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [gap, setGap] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const process = (file: File) => {
    setError(null);
    setTiles((prev) => {
      prev.forEach((tile) => URL.revokeObjectURL(tile.url));
      return [];
    });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const grid = computeGrid(img.naturalWidth, img.naturalHeight, cols, rows, gap);
      if (!grid.ok) {
        setError(t(`tools.image-grid-cut.errors.${grid.error}`));
        URL.revokeObjectURL(url);
        return;
      }
      const next: Tile[] = grid.value.map((cell) => {
        const canvas = document.createElement('canvas');
        canvas.width = cell.width;
        canvas.height = cell.height;
        const ctx = canvas.getContext('2d');
        if (ctx)
          ctx.drawImage(
            img,
            cell.x,
            cell.y,
            cell.width,
            cell.height,
            0,
            0,
            cell.width,
            cell.height,
          );
        return { cell, url: canvas.toDataURL('image/png') };
      });
      setTiles(next);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError(t('tools.image-grid-cut.errors.LOAD'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const downloadTile = async (tile: Tile) => {
    const res = await fetch(tile.url);
    const blob = await res.blob();
    downloadBlob(blob, `tile-${tile.cell.row + 1}-${tile.cell.col + 1}.png`);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image-grid-cut.cols')}
          <input
            type="number"
            min={1}
            max={20}
            value={cols}
            onChange={(e) => setCols(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image-grid-cut.rows')}
          <input
            type="number"
            min={1}
            max={20}
            value={rows}
            onChange={(e) => setRows(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.image-grid-cut.gap')}
          <input
            type="number"
            min={0}
            max={100}
            value={gap}
            onChange={(e) => setGap(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
      </OptionBar>

      <FileDropZone onFile={process} accept="image/*" hint={t('tools.image-grid-cut.dropHint')} />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {tiles.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(cols, 6)}, minmax(0, 1fr))` }}
        >
          {tiles.map((tile) => (
            <button
              key={`${tile.cell.row}-${tile.cell.col}`}
              type="button"
              onClick={() => downloadTile(tile)}
              className="group relative overflow-hidden rounded border border-gray-200 dark:border-gray-700"
              aria-label={t('tools.image-grid-cut.downloadTile', {
                row: tile.cell.row + 1,
                col: tile.cell.col + 1,
              })}
            >
              <img src={tile.url} alt="" className="block w-full" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                <Icon name="download" className="h-5 w-5 text-white" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
