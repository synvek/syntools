import Konva from 'konva';
import { computeSnap, type Guide, type SnapCandidate } from '../core';
import type { StageHandle } from '../render/stage';
import { updateMarquee } from '../render/overlays';

/**
 * 画布交互：选择 / 拖拽（含吸附）/ 框选 / 双击进入文本编辑。
 * 本模块只负责「把 Konva 事件翻译成回调」，具体状态变更交给 store 与页面组件，
 * 便于后续把吸附、多选拖拽等逻辑抽成纯函数单独测试。
 */

export interface TransformChange {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SnapContext {
  page: { width: number; height: number };
  others: SnapCandidate[];
}

export interface StageCallbacks {
  onSelect: (ids: string[], additive: boolean) => void;
  onDragStart: () => void;
  onDragMove: (id: string, x: number, y: number, guides: Guide[]) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (change: TransformChange) => void;
  onBackgroundClick: () => void;
  onTextEdit: (id: string) => void;
  getSnapContext: () => SnapContext;
  getSelection: () => string[];
}

const SNAP_TOLERANCE = 6;

function ancestorElement(node: Konva.Node): Konva.Node | undefined {
  return node.findAncestor('.element', true) ?? undefined;
}

export function attachInteraction(handle: StageHandle): void {
  const { stage, contentLayer, marquee, callbacks } = handle;
  let marqueeStart: { x: number; y: number } | null = null;
  /** 本帧是否由框选落点触发，用于抑制随后误发的背景 click 清选 */
  let marqueeJustEnded = false;
  let dragOrigin = new Map<string, { x: number; y: number }>();

  const pointerPosition = (): { x: number; y: number } => {
    const point = stage.getPointerPosition();
    return point ?? { x: 0, y: 0 };
  };

  stage.on('mousedown touchstart', (event) => {
    const target = event.target;
    const element = ancestorElement(target);
    // 任何按下动作都会让上一轮「框选落点」标记失效，避免误吞后续正常点击
    marqueeJustEnded = false;
    if (element) return;
    // 在页面矩形或空白处按下 → 开始框选
    marqueeStart = pointerPosition();
    updateMarquee(marquee, { x: marqueeStart.x, y: marqueeStart.y, width: 0, height: 0 });
  });

  stage.on('mousemove touchmove', () => {
    if (!marqueeStart) return;
    const current = pointerPosition();
    updateMarquee(marquee, {
      x: Math.min(marqueeStart.x, current.x),
      y: Math.min(marqueeStart.y, current.y),
      width: Math.abs(current.x - marqueeStart.x),
      height: Math.abs(current.y - marqueeStart.y),
    });
  });

  stage.on('mouseup touchend', () => {
    if (!marqueeStart) return;
    const box = marquee.getAttrs();
    marqueeStart = null;
    updateMarquee(marquee, null);
    if (!box.visible || Number(box.width) < 4 || Number(box.height) < 4) return;
    const rect = {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height),
    };
    const ids = contentLayer
      .getChildren()
      .filter((child) => child.name() === 'element' && intersects(child, rect))
      .map((child) => child.id());
    // 标记为本轮框选落点，抑制紧随其后的背景 click 把刚选中的对象清空
    marqueeJustEnded = true;
    callbacks.onSelect(ids, false);
  });

  stage.on('click tap', (event) => {
    // 框选落点后 Konva 仍会补发一次背景 click，这里直接吞掉，保留框选结果
    if (marqueeJustEnded) {
      marqueeJustEnded = false;
      return;
    }
    // 点击落在 contentLayer（元素 / Transformer 控件）内才关心，否则视为背景
    if (event.target.getLayer() !== contentLayer) {
      callbacks.onBackgroundClick();
      return;
    }
    const element = ancestorElement(event.target);
    if (!element) return; // Transformer 手柄等：不处理、不清选
    const additive = Boolean(
      event.evt instanceof MouseEvent && (event.evt.shiftKey || event.evt.metaKey),
    );
    callbacks.onSelect([element.id()], additive);
  });

  contentLayer.on('dblclick dbltap', (event) => {
    const element = ancestorElement(event.target);
    if (element) callbacks.onTextEdit(element.id());
  });

  contentLayer.on('dragstart', (event) => {
    const node = event.target;
    if (!node.id()) return;
    dragOrigin = new Map();
    // 拖拽一个「未被选中」的对象：先把它设为唯一选中项，再拖拽它自己，
    // 而不是沿用旧选择把多个对象一起带走（旧选择不会被误删但仍保持选中见下方说明）。
    let selection = callbacks.getSelection();
    if (!selection.includes(node.id())) {
      callbacks.onSelect([node.id()], false);
      selection = [node.id()];
    }
    const selected = new Set(selection);
    for (const child of contentLayer.getChildren()) {
      if (child.name() !== 'element') continue;
      if (!selected.has(child.id())) continue;
      dragOrigin.set(child.id(), { x: child.x(), y: child.y() });
    }
    callbacks.onDragStart();
  });

  contentLayer.on('dragmove', (event) => {
    const node = event.target;
    if (!node.id()) return;
    const context = callbacks.getSnapContext();
    const moving = snapNode(node, context, handle);
    const origin = dragOrigin.get(node.id());
    const dx = origin ? moving.x - origin.x : 0;
    const dy = origin ? moving.y - origin.y : 0;
    for (const [id, start] of dragOrigin) {
      if (id === node.id()) continue;
      const sibling = contentLayer.findOne<Konva.Node>(`#${id}`);
      if (sibling) sibling.position({ x: start.x + dx, y: start.y + dy });
    }
    contentLayer.batchDraw();
    callbacks.onDragMove(node.id(), moving.x, moving.y, moving.guides);
  });

  contentLayer.on('dragend', (event) => {
    const node = event.target;
    const id = node.id();
    if (id) callbacks.onDragEnd(id, Math.round(node.x()), Math.round(node.y()));
    handle.hideGuides();
    dragOrigin = new Map();
    contentLayer.batchDraw();
  });
}

/** 拖拽中的吸附：直接改写节点位置，让画面即时「咬合」 */
function snapNode(
  node: Konva.Node,
  context: SnapContext,
  handle: StageHandle,
): { x: number; y: number; guides: Guide[] } {
  const box = node.getClientRect({ relativeTo: node.getLayer() ?? undefined });
  const scale = Math.max(0.1, handle.contentLayer.scaleX());
  const tolerance = SNAP_TOLERANCE / scale;
  const result = computeSnap(
    {
      x: node.x(),
      y: node.y(),
      width: node.width() || box.width,
      height: node.height() || box.height,
    },
    context.others,
    context.page,
    tolerance,
  );
  node.position({ x: result.x, y: result.y });
  if (result.guides.length > 0) {
    handle.showGuides(result.guides, context.page);
  } else {
    handle.hideGuides();
  }
  return { x: result.x, y: result.y, guides: result.guides };
}

function intersects(
  node: Konva.Node,
  box: { x: number; y: number; width: number; height: number },
): boolean {
  const rect = node.getClientRect();
  return !(
    rect.x + rect.width < box.x ||
    rect.x > box.x + box.width ||
    rect.y + rect.height < box.y ||
    rect.y > box.y + box.height
  );
}
