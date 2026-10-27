import type { TFunction } from 'i18next';
import type { Layer } from '../model/types';

/**
 * Layer display names: an empty `name` in the document means "auto-name",
 * so it is rendered here from the type + index within that type in the current language (English shows "Layer 2"),
 * which keeps default names from being frozen into one language at creation time.
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

/** Display value for the canvas name: an empty name uses the current language's "untitled canvas" */
export function docDisplayName(name: string, t: TFunction): string {
  return name.trim() || t('tools.photo.titlePlaceholder');
}
