import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { BLEND_MODES } from '../core';
import { layerThumbnail } from '../render/export';
import { CompactSlider, Select } from './controls';
import { layerDisplayName } from './layerName';
import { usePhotoStore } from '../store';
import type { BlendMode, Layer, PhotoDoc } from '../model/types';

/**
 * 图层面板。
 *
 * 布局刻意保持「一行一图层」的紧凑密度：
 * 1. 顶部一行是「仅作用于当前选中图层」的混合模式 + 不透明度（不再塞进每条图层里展开）；
 * 2. 每条图层右侧的 ⋯ 弹窗菜单承载重命名、新建各类图层与复制 / 合并 / 删除等操作。
 * 列表顺序与文档一致（数组尾部为最上层），展示时倒序呈现。
 */

const MENU_WIDTH = 208;

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string | null; left: number; top: number } | null>(null);

  const reversed = [...doc.layers].reverse();
  const active = doc.layers.find((item) => item.id === activeId) ?? null;
  const menuLayer = menu?.id ? (doc.layers.find((item) => item.id === menu.id) ?? null) : null;

  // 菜单：点外部 / 按 Esc / 视口变化时关闭。
  // 用 DOM 包含关系判断内外——靠 stopPropagation 会在 pointerdown 阶段就把菜单卸载，
  // 紧随其后的 click 落不到菜单项上（触发按钮单独用 ref 放行，以便切换开关）。
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenu(null);
    };
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const openMenu = (id: string | null, event: React.MouseEvent<HTMLElement>) => {
    triggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu((prev) =>
      prev?.id === id
        ? null
        : {
            id,
            left: Math.max(
              8,
              Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
            ),
            top: Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - 300)),
          },
    );
  };

  const toOriginalIndex = (reversedIndex: number) => doc.layers.length - 1 - reversedIndex;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {/* 顶部一行：混合模式 + 不透明度，只作用于当前选中图层 */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 dark:border-gray-800">
        <div className="min-w-0 flex-1">
          <Select
            ariaLabel={t('tools.photo.blend')}
            value={active?.blend ?? 'normal'}
            options={BLEND_MODES.map((id) => ({ id, label: t(`tools.photo.blendMode.${id}`) }))}
            disabled={!active}
            onChange={(blend: BlendMode) => active && patchLayer(active.id, { blend })}
          />
        </div>
        <CompactSlider
          label={t('tools.photo.opacity')}
          value={Math.round((active?.opacity ?? 1) * 100)}
          min={0}
          max={100}
          suffix="%"
          disabled={!active}
          onChange={(value) => active && patchLayer(active.id, { opacity: value / 100 }, false)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {reversed.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 px-2 py-3 dark:border-gray-700">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('tools.photo.noLayer')}
            </span>
            <MenuTrigger
              label={t('tools.photo.layerMenu')}
              onClick={(event) => openMenu(null, event)}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {reversed.map((layer, reversedIndex) => {
              const index = toOriginalIndex(reversedIndex);
              const isActive = layer.id === activeId;
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
                    isActive
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${dropIndex === index ? 'ring-1 ring-blue-400' : ''}`}
                >
                  <div className="flex items-center gap-1.5 p-1.5">
                    <button
                      type="button"
                      onClick={() => selectLayer(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <LayerThumb doc={doc} layer={layer} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                          {layerDisplayName(layer, doc.layers, t)}
                        </span>
                        <span className="block text-[10px] uppercase text-gray-400">
                          {layer.kind === 'raster'
                            ? `${Math.round(layer.width)}×${Math.round(layer.height)}`
                            : layer.kind === 'text'
                              ? 'T'
                              : t(`tools.photo.shape.${layer.shape}`)}
                        </span>
                      </span>
                    </button>
                    <RowIconButton
                      label={layer.visible ? t('tools.photo.visible') : t('tools.photo.hidden')}
                      icon={layer.visible ? 'eye' : 'eyeOff'}
                      onClick={() => patchLayer(layer.id, { visible: !layer.visible })}
                    />
                    <RowIconButton
                      label={layer.locked ? t('tools.photo.unlock') : t('tools.photo.lock')}
                      icon={layer.locked ? 'lock' : 'unlock'}
                      onClick={() => patchLayer(layer.id, { locked: !layer.locked })}
                    />
                    <MenuTrigger
                      label={t('tools.photo.layerMenu')}
                      onClick={(event) => openMenu(layer.id, event)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('tools.photo.layerMenu')}
          style={{ left: menu.left, top: menu.top, width: MENU_WIDTH }}
          className="fixed z-40 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {menuLayer ? (
            <div className="px-1 pb-1">
              <input
                type="text"
                aria-label={t('tools.photo.rename')}
                placeholder={layerDisplayName(menuLayer, doc.layers, t)}
                value={menuLayer.name}
                onChange={(event) => patchLayer(menuLayer.id, { name: event.target.value }, false)}
                onBlur={() => usePhotoStore.getState().commit()}
                className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          ) : null}

          <MenuSection label={t('tools.photo.newLayer')} />
          <MenuItem
            icon="placeholder"
            label={t('tools.photo.addRaster')}
            onClick={() => {
              ensurePaintLayer();
              setMenu(null);
            }}
          />
          <MenuItem
            icon="text"
            label={t('tools.photo.addText')}
            onClick={() => {
              addTextLayer(
                Math.round(doc.width * 0.1),
                Math.round(doc.height * 0.4),
                t('tools.photo.textPlaceholder'),
              );
              setMenu(null);
            }}
          />
          <MenuItem
            icon="shapes"
            label={t('tools.photo.addShape')}
            onClick={() => {
              addShapeLayer({
                x: Math.round(doc.width * 0.2),
                y: Math.round(doc.height * 0.2),
                width: Math.round(doc.width * 0.3),
                height: Math.round(doc.height * 0.3),
              });
              setMenu(null);
            }}
          />

          {menuLayer ? (
            <>
              <MenuSection label={t('tools.photo.layerOps')} />
              <MenuItem
                icon="copy"
                label={t('tools.photo.duplicate')}
                onClick={() => {
                  duplicateLayer(menuLayer.id, t('tools.photo.copySuffix'));
                  setMenu(null);
                }}
              />
              <MenuItem
                icon="layers"
                label={t('tools.photo.mergeDown')}
                onClick={() => {
                  mergeDown(menuLayer.id);
                  setMenu(null);
                }}
              />
              <MenuItem
                icon="imageMerge"
                label={t('tools.photo.flatten')}
                onClick={() => {
                  flattenVisible();
                  setMenu(null);
                }}
              />
              <MenuItem
                icon="close"
                label={t('tools.photo.delete')}
                danger
                onClick={() => {
                  removeLayer(menuLayer.id);
                  setMenu(null);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 行内图标按钮（可见性 / 锁定）：尺寸与间距保持一致 */
function RowIconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

/** 菜单触发按钮：固定在锁定按钮右侧 */
function MenuTrigger({
  label,
  onClick,
}: {
  label: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      data-testid="layer-menu-trigger"
      onClick={onClick}
      className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    >
      <Icon name="more" className="h-4 w-4" />
    </button>
  );
}

function MenuSection({ label }: { label: string }) {
  return (
    <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {label}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
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
