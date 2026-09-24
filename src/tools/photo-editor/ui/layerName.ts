import type { TFunction } from 'i18next';
import type { Layer } from '../model/types';

/**
 * 图层显示名：文档里的 `name` 为空表示「自动命名」，
 * 这里按类型 + 同类型序号用当前语言渲染（如「图层 2」/「Layer 2」），
 * 这样默认名称不会在创建时被写死成某一种语言。
 */
export function layerDisplayName(layer: Layer, layers: Layer[], t: TFunction): string {
  const name = layer.name.trim();
  if (name) return name;
  const sameKind = layers.filter((item) => item.kind === layer.kind);
  const index = Math.max(1, sameKind.indexOf(layer) + 1);
  const key =
    layer.kind === 'text'
      ? 'layerText'
      : layer.kind === 'shape'
        ? 'layerShape'
        : layer.kind === 'group'
          ? 'layerGroup'
          : layer.kind === 'adjustment'
            ? 'layerAdjust'
            : layer.kind === 'smart'
              ? 'layerSmart'
              : 'layerRaster';
  return t(`tools.photo.${key}`, { n: index });
}

/** 画布名的显示值：空名称用当前语言的「未命名画布」 */
export function docDisplayName(name: string, t: TFunction): string {
  return name.trim() || t('tools.photo.titlePlaceholder');
}
