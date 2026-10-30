import type { GlowStyle, ShadowStyle } from '../model/types';

/**
 * Element effects → canvas properties (P2-S3).
 *
 * Kept pure and Konva-free at the type level so it can be unit tested in jsdom (no 2D context) and
 * reused by any renderer that takes the same prop names. Currently the slide canvas, thumbnails and
 * PNG export all go through `createElementNode`, so one place decides how an effect looks.
 */

/** Konva-compatible shadow props (the canvas + thumbnail + PNG path all read these) */
export interface ShadowNodeProps {
  shadowColor: string;
  /**
   * Konva blur has no exact DrawingML equivalent: `a:outerShdw@blurRad` is a radius while Konva
   * treats the value as a Gaussian sigma-like spread, so the same number reads slightly softer.
   * Kept 1:1 on purpose — a magic factor would make the panel's numbers lie.
   */
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  shadowEnabled: boolean;
  shadowForStrokeEnabled: boolean;
}

/**
 * Outer shadow → Konva props.
 *
 * Returns `undefined` when there is nothing worth drawing:
 * - no shadow at all;
 * - zero blur **and** zero offset, which is a perfectly overlapping dark copy (the shape just looks
 *   dirty, and PowerPoint renders a hard darkedge that we cannot reproduce anyway);
 * - zero/negative opacity.
 *
 * The caller resets the node with `NO_SHADOW_PROPS` when this returns `undefined`, otherwise a
 * removed shadow would stay painted on a reused node.
 */
export function outerShadowProps(
  shadow: ShadowStyle | undefined,
  options: { fromStroke?: boolean } = {},
): ShadowNodeProps | undefined {
  if (!shadow) return undefined;
  const opacity = shadow.opacity ?? 1;
  if (!(opacity > 0)) return undefined;
  const blur = Math.max(0, shadow.blur);
  if (blur === 0 && shadow.offsetX === 0 && shadow.offsetY === 0) return undefined;
  return {
    shadowColor: shadow.color,
    shadowBlur: blur,
    shadowOffsetX: shadow.offsetX,
    shadowOffsetY: shadow.offsetY,
    shadowOpacity: opacity,
    shadowEnabled: true,
    // Filled shapes must not cast from the stroke too (it doubles the shadow along thick outlines);
    // a line has no fill, so there the stroke *is* the silhouette and must be allowed to cast.
    shadowForStrokeEnabled: options.fromStroke ?? false,
  };
}

/** Props that remove a previously applied shadow from a reused Konva node */
export const NO_SHADOW_PROPS = { shadowEnabled: false } as const;

/**
 * Glow → Konva props, meant for a **duplicate** node placed behind the real one.
 *
 * Konva has a single shadow slot per shape, so a glow cannot coexist with an outer shadow on the
 * same node: the caller clones the shape, paints the clone with these zero-offset shadow props and
 * keeps the clone non-listening (it is a halo, not a click target).
 */
export function glowShadowProps(
  glow: GlowStyle | undefined,
  options: { fromStroke?: boolean } = {},
): ShadowNodeProps | undefined {
  if (!glow) return undefined;
  const opacity = glow.opacity ?? 1;
  if (!(opacity > 0)) return undefined;
  const radius = Math.max(0, glow.radius);
  // A zero-radius halo is just the shape again — nothing to draw
  if (radius === 0) return undefined;
  return {
    shadowColor: glow.color,
    shadowBlur: radius,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowOpacity: opacity,
    shadowEnabled: true,
    shadowForStrokeEnabled: options.fromStroke ?? false,
  };
}
