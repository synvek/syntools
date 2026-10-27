import { flattenStack, meshIsIdentity } from '../core';
import type { BlendMode, Layer, PhotoDoc } from '../model/types';

/**
 * Layer stack → PSD structure mapping (pure, unit-testable).
 *
 * PSD has no concept of adjustment layers / smart objects / vector text or shapes, so export degrades:
 * - adjustment layers fold into the content below and merge into one pixel layer (no longer editable);
 * - smart objects / text / shapes: rasterized (source pixels kept, sized by the presentation size);
 * - groups: pass-through exports as a PSD layer group, composited mode as a single pixel layer;
 * - masks: kept as PSD layer masks (grayscale encoded as alpha, matching how ag-psd reads them).
 */

/** Our blend mode names → ag-psd's (the latter takes readable names, no four-char keys) */
const BLEND_TO_PSD: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft light',
  'hard-light': 'hard light',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export function mapBlendMode(mode: BlendMode): string {
  return BLEND_TO_PSD[mode] ?? 'normal';
}

export type PsdDegradeReason = 'adjustment' | 'smart' | 'text' | 'shape' | 'mesh';

export interface PsdDegrade {
  layerId: string;
  reason: PsdDegradeReason;
}

export interface PsdPlanMask {
  assetId: string;
  density: number;
  feather: number;
  inverted: boolean;
}

export interface PsdPlanNode {
  kind: 'group' | 'pixel';
  id: string;
  name: string;
  blend: string;
  /** 0~1 */
  opacity: number;
  hidden: boolean;
  /** Group expansion state */
  opened: boolean;
  /** Source layers this pixel layer composites (in stack order) */
  sources: string[];
  mask: PsdPlanMask | null;
  children?: PsdPlanNode[];
}

export interface PsdPlan {
  nodes: PsdPlanNode[];
  degraded: PsdDegrade[];
}

function degradeReasonOf(layer: Layer): PsdDegradeReason | null {
  // PSD can't express a mesh warp (affine only): pixels are baked to a bitmap, points no longer draggable
  if (!meshIsIdentity(layer.mesh)) return 'mesh';
  if (layer.kind === 'adjustment') return 'adjustment';
  if (layer.kind === 'smart') return 'smart';
  if (layer.kind === 'text') return 'text';
  if (layer.kind === 'shape') return 'shape';
  return null;
}

function maskOf(layer: Layer): PsdPlanMask | null {
  const mask = layer.mask;
  if (!mask || !mask.enabled) return null;
  return {
    assetId: mask.assetId,
    density: mask.density,
    feather: mask.feather,
    inverted: mask.inverted,
  };
}

function pixelNode(layer: Layer, sources: string[]): PsdPlanNode {
  return {
    kind: 'pixel',
    id: layer.id,
    name: layer.name,
    blend: mapBlendMode(layer.blend),
    opacity: layer.opacity,
    hidden: !layer.visible,
    opened: true,
    sources,
    mask: maskOf(layer),
  };
}

/**
 * Merge the "produced nodes" at one level into a single node (unavoidable when an adjustment layer
 * appears: it acts on everything below, and PSD can only express that as one pre-baked image).
 */
function mergeNodes(nodes: PsdPlanNode[], id: string, name: string): PsdPlanNode {
  const sources: string[] = [];
  const masks: PsdPlanMask[] = [];
  for (const node of nodes) {
    sources.push(...node.sources);
    if (node.mask) masks.push(node.mask);
  }
  return {
    kind: 'pixel',
    id,
    name: name || nodes[0]?.name || '',
    blend: 'normal',
    opacity: 1,
    hidden: false,
    opened: true,
    sources,
    // PSD can't hold several masks: keep the last one (the export notice reports the degradation)
    mask: masks.length > 0 ? masks[masks.length - 1] : null,
  };
}

export function buildPsdPlan(doc: PhotoDoc): PsdPlan {
  const degraded: PsdDegrade[] = [];
  const steps = flattenStack(doc);

  /** Node stack for the current level (merged wholesale when an adjustment layer shows up) */
  const walk = (from: number, to: number): { nodes: PsdPlanNode[] } => {
    const nodes: PsdPlanNode[] = [];
    let index = from;
    while (index < to) {
      const step = steps[index];
      if (step.kind === 'layer') {
        const layer = step.layer;
        if (layer.kind === 'adjustment') {
          if (!layer.visible) {
            index += 1;
            continue;
          }
          // Adjustment layer: merge the nodes produced so far, then fold them into it
          if (nodes.length > 0) {
            const merged = mergeNodes(nodes, layer.id, '');
            merged.sources.push(layer.id);
            degraded.push({ layerId: layer.id, reason: 'adjustment' });
            nodes.length = 0;
            nodes.push(merged);
          } else {
            degraded.push({ layerId: layer.id, reason: 'adjustment' });
          }
          index += 1;
          continue;
        }
        const reason = degradeReasonOf(layer);
        if (reason) degraded.push({ layerId: layer.id, reason });
        nodes.push(pixelNode(layer, [layer.id]));
        index += 1;
        continue;
      }

      if (step.kind === 'group-begin') {
        const group = step.layer;
        // Find the matching group-end
        let depth = 0;
        let end = index;
        for (let cursor = index; cursor < to; cursor += 1) {
          const item = steps[cursor];
          if (item.kind === 'group-begin') depth += 1;
          else if (item.kind === 'group-end') {
            depth -= 1;
            if (depth === 0) {
              end = cursor;
              break;
            }
          }
        }
        const inner = walk(index + 1, end);
        if (group.passThrough) {
          // An empty group means nothing in PSD, so drop it
          if (inner.nodes.length === 0) {
            index = end + 1;
            continue;
          }
          nodes.push({
            kind: 'group',
            id: group.id,
            name: group.name,
            blend: mapBlendMode(group.blend),
            opacity: group.opacity,
            hidden: !group.visible,
            opened: group.expanded ?? true,
            sources: [],
            mask: maskOf(group),
            children: inner.nodes,
          });
        } else {
          // Composited mode: flatten every source layer in the group into one pixel layer
          const sources: string[] = [];
          for (const node of inner.nodes) sources.push(...node.sources);
          nodes.push({
            ...pixelNode(group, sources),
            blend: mapBlendMode(group.blend),
            opacity: group.opacity,
          });
        }
        index = end + 1;
        continue;
      }

      // group-end (should never appear on its own)
      index += 1;
    }
    return { nodes };
  };

  return { nodes: walk(0, steps.length).nodes, degraded };
}
