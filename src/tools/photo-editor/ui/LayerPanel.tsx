import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { BLEND_MODES, SHAPE_KINDS } from '../core';
import { layerThumbnail } from '../render/export';
import { Button, IconTextButton, Select, Slider } from './controls';
import { usePhotoStore } from '../store';
import type { BlendMode, Layer, PhotoDoc } from '../model/types';

/**
 * 图层面板：缩略图 + 可见性 / 锁定 + 拖拽排序 + 混合模式 / 不透明度 + 合并操作。
 * 列表顺序与文档一致（数组尾部为最上层），展示时倒序呈现。
 */
export function LayerPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const activeId = usePhotoStore((s) => s.doc.activeLayerId);
  const selectLayer = usePhotoStore((s) => s.selectLayer);
  const patchLayer = usePhotoStore((s) => s.patchLayer);
  const removeLayer = usePhotoStore((s) => s.removeLayer);
  const duplicateLayer = usePhotoStore((s) => s.duplicateLayer);
  const reorderLayer = usePhotoStore((s) => s.reorderLayer);
  const mergeDown = usePhotoStore((s) => s.mergeDown);
  const flattenVisible = usePhotoStore((s) => s.flattenVisible);
  const ensurePaintLayer = usePhotoStore((s) => s.ensurePaintLayer);
  const addTextLayer = usePhotoStore((s) => s.addTextLayer);
  const addShapeLayer = usePhotoStore((s) => s.addShapeLayer);

  const dragIndex = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const reversed = [...doc.layers].reverse();

  const toOriginalIndex = (reversedIndex: number) => doc.layers.length - 1 - reversedIndex;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {reversed.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            {t('tools.photo.noLayer')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {reversed.map((layer, reversedIndex) => {
              const index = toOriginalIndex(reversedIndex);
              const active = layer.id === activeId;
              return (
                <li
                  key={layer.id}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropIndex(index);
                  }}
                  onDragLeave={() => setDropIndex(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = dragIndex.current;
                    setDropIndex(null);
                    dragIndex.current = null;
                    if (from !== null && from !== index) reorderLayer(layer.id, index);
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                    setDropIndex(null);
                  }}
                  className={`rounded-lg border transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${dropIndex === index ? 'ring-1 ring-blue-400' : ''}`}
                >
                  <div className="flex items-center gap-2 p-1.5">
                    <button
                      type="button"
                      onClick={() => selectLayer(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <LayerThumb doc={doc} layer={layer} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                          {layer.name}
                        </span>
                        <span className="block text-[10px] uppercase text-gray-400">
                          {layer.kind === 'raster'
                            ? `${Math.round(layer.width)}×${Math.round(layer.height)}`
                            : layer.kind === 'text'
                              ? 'T'
                              : (SHAPE_KINDS.find((item) => item.id === layer.shape)?.label ??
                                layer.shape)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        layer.visible ? t('tools.photo.visible') : t('tools.photo.hidden')
                      }
                      title={layer.visible ? t('tools.photo.visible') : t('tools.photo.hidden')}
                      onClick={() => patchLayer(layer.id, { visible: !layer.visible })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
                    >
                      <Icon name={layer.visible ? 'eye' : 'eyeOff'} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={layer.locked ? t('tools.photo.unlock') : t('tools.photo.lock')}
                      title={layer.locked ? t('tools.photo.unlock') : t('tools.photo.lock')}
                      onClick={() => patchLayer(layer.id, { locked: !layer.locked })}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
                    >
                      <Icon name={layer.locked ? 'lock' : 'unlock'} className="h-4 w-4" />
                    </button>
                  </div>
                  {active ? (
                    <div className="flex flex-col gap-2 border-t border-gray-200 px-2 py-2 dark:border-gray-700">
                      <input
                        type="text"
                        aria-label={t('tools.photo.rename')}
                        value={layer.name}
                        onChange={(event) =>
                          patchLayer(layer.id, { name: event.target.value }, false)
                        }
                        onBlur={() => usePhotoStore.getState().commit()}
                        className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                      />
                      <Select
                        ariaLabel={t('tools.photo.blend')}
                        value={layer.blend}
                        options={BLEND_MODES}
                        onChange={(blend: BlendMode) => patchLayer(layer.id, { blend })}
                      />
                      <Slider
                        label={t('tools.photo.opacity')}
                        value={Math.round(layer.opacity * 100)}
                        min={0}
                        max={100}
                        suffix="%"
                        onChange={(value) => patchLayer(layer.id, { opacity: value / 100 }, false)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-gray-200 pt-2 dark:border-gray-800">
        <IconTextButton
          icon="placeholder"
          label={t('tools.photo.addRaster')}
          onClick={() => ensurePaintLayer()}
        />
        <IconTextButton
          icon="text"
          label={t('tools.photo.addText')}
          onClick={() => addTextLayer(Math.round(doc.width * 0.1), Math.round(doc.height * 0.4))}
        />
        <IconTextButton
          icon="shapes"
          label={t('tools.photo.addShape')}
          onClick={() =>
            addShapeLayer({
              x: Math.round(doc.width * 0.2),
              y: Math.round(doc.height * 0.2),
              width: Math.round(doc.width * 0.3),
              height: Math.round(doc.height * 0.3),
            })
          }
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <IconTextButton
          icon="copy"
          label={t('tools.photo.duplicate')}
          onClick={() => activeId && duplicateLayer(activeId)}
          disabled={!activeId}
        />
        <IconTextButton
          icon="layers"
          label={t('tools.photo.mergeDown')}
          onClick={() => activeId && mergeDown(activeId)}
          disabled={!activeId}
        />
        <IconTextButton
          icon="imageMerge"
          label={t('tools.photo.flatten')}
          onClick={() => flattenVisible()}
          disabled={doc.layers.length === 0}
        />
        <Button
          onClick={() => activeId && removeLayer(activeId)}
          disabled={!activeId}
          title={t('tools.photo.delete')}
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** 图层缩略图：只合成该图层，随 rev / 尺寸变化重算 */
function LayerThumb({ doc, layer }: { doc: PhotoDoc; layer: Layer }) {
  const [url, setUrl] = useState<string | null>(null);
  const signature = `${layer.id}:${layer.kind === 'raster' ? layer.rev : 0}:${Math.round(layer.width)}:${Math.round(layer.height)}`;

  useEffect(() => {
    const single: PhotoDoc = { ...doc, layers: [layer], background: 'transparent' };
    try {
      setUrl(
        layerThumbnail(
          single,
          {
            x: layer.x,
            y: layer.y,
            width: Math.max(1, layer.width),
            height: Math.max(1, layer.height),
          },
          44,
        ),
      );
    } catch {
      setUrl(null);
    }
    // 只在图层内容 / 尺寸变化时重算，避免每次拖动滑杆都重新合成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px] dark:border-gray-700">
      {url ? (
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <Icon
          name={layer.kind === 'text' ? 'text' : layer.kind === 'shape' ? 'shapes' : 'image'}
          className="h-4 w-4 text-gray-400"
        />
      )}
    </span>
  );
}
