/**
 * Pure functions behind the render performance policy (no React / DOM dependency, easy to unit-test).
 */

/**
 * Lower bound on the node count for enabling large-graph virtualization.
 * Measurements show full rendering is faster and flicker-free up to 150 nodes; above that, rendering only the viewport pays off clearly.
 */
export const VIRTUALIZE_THRESHOLD = 150;

/**
 * Coefficient for estimating how many nodes fit in the viewport: one node takes roughly 12000 px² (spacing included).
 * Large screens fit more nodes at once and full rendering is actually faster (no virtualization measurement cost);
 * small screens switch to virtualization sooner. The result is clamped to [80, 600] to avoid jitter at extreme resolutions.
 */
export const VIEWPORT_NODE_AREA = 12_000;

/** Adaptive virtualization threshold: enabled only when the node count exceeds the larger of the lower bound and the viewport capacity */
export function virtualizeThresholdOf(viewportArea: number): number {
  const capacity = Math.round(viewportArea / VIEWPORT_NODE_AREA);
  return Math.max(VIRTUALIZE_THRESHOLD, Math.min(600, Math.max(80, capacity)));
}
