import { flattenStack } from '../core';
import type { BlendMode, Layer, PhotoDoc } from '../model/types';

/**
 * 层栈 → PSD 结构映射（纯函数，可单测）。
 *
 * PSD 没有「调整图层 / 智能对象 / 矢量文字形状」的概念，导出时必须降级：
 * - 调整图层：折进它下方的内容，合并为一个像素图层（导出后不可再改参）；
 * - 智能对象 / 文字 / 形状：位图化（保留原始像素，尺寸按呈现尺寸）；
 * - 编组：穿透模式导出为 PSD 图层组；整体合成模式导出为单个像素图层；
 * - 蒙版：保留为 PSD 图层蒙版（灰度按 alpha 编码，与 ag-psd 的读取方式一致）。
 */

/** 我们的混合模式名 → ag-psd 的混合模式名（后者直接用可读名，无需四字符键） */
const BLEND_TO_PSD: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
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

export type PsdDegradeReason = 'adjustment' | 'smart' | 'text' | 'shape';

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
  /** 编组展开态 */
  opened: boolean;
  /** 该像素图层要合成的源图层（按层栈顺序） */
  sources: string[];
  mask: PsdPlanMask | null;
  children?: PsdPlanNode[];
}

export interface PsdPlan {
  nodes: PsdPlanNode[];
  degraded: PsdDegrade[];
}

function degradeReasonOf(layer: Layer): PsdDegradeReason | null {
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
 * 把同一层级内的「已产出节点」合并成一个节点（调整图层出现时必须这么做：
 * 它作用于下方全部内容，而 PSD 只能表达为「下方已被烘焙的一张图」）。
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
    // 多个蒙版无法在 PSD 里并存：保留最后一个（导出提示会说明有降级）
    mask: masks.length > 0 ? masks[masks.length - 1] : null,
  };
}

export function buildPsdPlan(doc: PhotoDoc): PsdPlan {
  const degraded: PsdDegrade[] = [];
  const steps = flattenStack(doc);

  /** 当前层级的节点栈（遇到调整图层时整体合并） */
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
          // 调整图层：把已产出的同层节点合并后再折进它
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
        // 找到配对的 group-end
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
          // 空组在 PSD 里没有意义，直接丢弃
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
          // 整体合成：组内所有源图层压成一张像素图层
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

      // group-end（理论上不会单独出现）
      index += 1;
    }
    return { nodes };
  };

  return { nodes: walk(0, steps.length).nodes, degraded };
}
