import {
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_TRANSITION_DURATION,
  normalizeAnimationStep,
} from '../model/animation';
import type { AnimationEffect, AnimationStep, SlideTransition } from '../model/types';
import {
  attr,
  childOf,
  childrenNamed,
  childrenOf,
  collect,
  findFirst,
  localNameOf,
  numAttr,
  type XmlNode,
} from './xml';

/**
 * `p:transition` / `p:timing` 回读（P2-5.5）。
 *
 * 只认模型真正能表达的子集：fade/push 切换 + fadeIn/flyIn 入场；其余一律**记进 `unsupported`
 * 交给保真报告**，不静默丢弃——"导入后动画没了但文档看着没问题"是最难被发现的一类降级。
 *
 * 结构上容忍两种写法：PowerPoint 自己产出的 `seq > par > par > par` 深层嵌套，
 * 以及只有一层 `par` 的极简实现。效果节点统一按 `nodeType` 判定，不按嵌套层数判定。
 */

export interface MotionImport {
  transition?: SlideTransition;
  animations: AnimationStep[];
  /** 未能还原的效果，形如 `transition:cover` / `anim:preset22` / `anim:target` */
  unsupported: string[];
}

const SPEED_TO_MS: Record<string, number> = { fast: 200, med: 400, slow: 800 };

function transitionOf(slideXml: XmlNode, unsupported: string[]): SlideTransition | undefined {
  const transitionNode = childOf(slideXml, 'transition');
  if (!transitionNode) return undefined;
  const effect = childrenOf(transitionNode)[0];
  const kind = localNameOf(effect);
  const duration = SPEED_TO_MS[attr(transitionNode, 'spd') ?? ''] ?? DEFAULT_TRANSITION_DURATION;
  const advanceOnClick = attr(transitionNode, 'advClick') !== '0';
  if (kind === 'fade' || kind === 'push') {
    return { type: kind, duration, advanceOnClick };
  }
  unsupported.push(`transition:${kind || 'unknown'}`);
  return undefined;
}

/** 每个「单击组」的 par 节点（组内是若干效果节点，可能嵌多层） */
function groupNodesOf(slideXml: XmlNode): XmlNode[] {
  const timing = childOf(slideXml, 'timing');
  if (!timing) return [];
  const tnLst = childOf(timing, 'tnLst');
  const seq = findFirst(tnLst, 'seq');
  const host = seq
    ? childOf(childOf(seq, 'cTn'), 'childTnLst')
    : childOf(childOf(childOf(tnLst, 'par'), 'cTn'), 'childTnLst');
  return childrenNamed(host, 'par');
}

function delayOf(node: XmlNode): number {
  const cond = childOf(childOf(node, 'stCondLst'), 'cond');
  return numAttr(cond, 'delay') ?? 0;
}

function effectDuration(node: XmlNode): number {
  const animEffect = collect(node, 'animEffect')[0];
  const anim = collect(node, 'anim')[0];
  const holder = animEffect ?? anim;
  if (!holder) return DEFAULT_ANIMATION_DURATION;
  return numAttr(childOf(childOf(holder, 'cBhvr'), 'cTn'), 'dur') ?? DEFAULT_ANIMATION_DURATION;
}

function effectOf(node: XmlNode, unsupported: string[]): AnimationEffect | undefined {
  const presetClass = attr(node, 'presetClass');
  if (presetClass && presetClass !== 'entr') {
    unsupported.push(`anim:${presetClass}`);
    return undefined;
  }
  const presetId = numAttr(node, 'presetID');
  if (presetId === 10) return 'fadeIn';
  if (presetId === 2) return 'flyIn';
  unsupported.push(presetId === undefined ? 'anim:noPreset' : `anim:preset${presetId}`);
  return undefined;
}

function triggerOf(nodeType: string | undefined): AnimationStep['trigger'] {
  if (nodeType === 'withEffect') return 'withPrevious';
  if (nodeType === 'afterEffect') return 'afterPrevious';
  return 'onClick';
}

/**
 * @param spidToElement 当前页的 `p:cNvPr@id` → 内部元素 id（由 spTree 解析时记录）
 */
export function parseSlideMotion(
  slideXml: XmlNode,
  spidToElement: ReadonlyMap<string, string>,
): MotionImport {
  const unsupported: string[] = [];
  const transition = transitionOf(slideXml, unsupported);
  const animations: AnimationStep[] = [];
  const seenElements = new Set<string>();

  for (const groupNode of groupNodesOf(slideXml)) {
    const groupCond = childOf(groupNode, 'stCondLst');
    if (groupCond && numAttr(childOf(groupCond, 'cond'), 'delay') !== undefined) {
      // 自动开始的组（"上一动画之后 N 秒"落到页面级）在模型里没有对应字段，只能退化成单击
      const delay = numAttr(childOf(groupCond, 'cond'), 'delay') ?? 0;
      if (delay > 0) unsupported.push('anim:autoStart');
    }
    // 效果节点 = 组内所有带 presetClass="entr" 且 nodeType 为效果类型的 cTn
    for (const ct of collect(groupNode, 'cTn')) {
      const nodeType = attr(ct, 'nodeType');
      if (nodeType !== 'clickEffect' && nodeType !== 'withEffect' && nodeType !== 'afterEffect') {
        continue;
      }
      const effect = effectOf(ct, unsupported);
      if (!effect) continue;
      const target = collect(ct, 'spTgt')[0];
      const spid = attr(target, 'spid');
      const elementId = spid ? spidToElement.get(spid) : undefined;
      if (!elementId) {
        // 目标形状没导入成功（占位/跳过）或 spid 对不上：动画无处可挂
        unsupported.push('anim:target');
        continue;
      }
      if (seenElements.has(elementId)) {
        // 同一元素的多段入场在播放层只有"第一次出场"有语义，后续会重播入场
        unsupported.push('anim:duplicate');
        continue;
      }
      const step = normalizeAnimationStep({
        elementId,
        effect,
        duration: effectDuration(ct),
        delay: delayOf(ct),
        trigger: triggerOf(nodeType),
      });
      if (!step) continue;
      seenElements.add(elementId);
      animations.push(step);
    }
  }

  return { transition, animations, unsupported };
}
