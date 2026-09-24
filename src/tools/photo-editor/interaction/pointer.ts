import { clampRect, normalizeRect, rgbToHex } from '../core';
import { createStrokeSession, floodFill, type StrokeSession } from '../render/brush';
import { compositeDoc } from '../render/export';
import type { StageHandle } from '../render/stage';
import { selectionFromPath as toSelection, usePhotoStore } from '../store';
import type { RasterLayer, Layer, PhotoDoc, Rect, Selection } from '../model/types';

/**
 * 指针交互：直接监听容器原生事件（Konva 节点一律 `listening: false`）。
 *
 * 好处是命中检测与自绘选区不会因为 Konva 的节点命中规则互相抢事件，
 * 也能统一把「屏幕坐标 → 文档坐标」的换算收在一处。
 */

export interface PointerContext {
  getTransform: () => { scale: number; x: number; y: number };
  onRequestTextEdit: (id: string) => void;
  /** 像素被改写（落笔 / 填充）：宿主以 rAF 合帧重绘该图层 */
  onSurfaceChange: () => void;
  /** 抓手平移：宿主立即写入变换并落库 */
  onPan: (x: number, y: number) => void;
  /** 右键菜单：坐标为视口坐标（clientX / clientY） */
  onContextMenu: (position: { x: number; y: number }) => void;
  /** 吸管取色结果（null = 画布外），由宿主更新前景色并给出反馈 */
  onPickColor: (picked: PickedColor | null) => void;
  /** 新建文字图层的默认内容（由宿主按当前语言提供） */
  defaultText: string;
}

type Drag =
  | { kind: 'move'; id: string; offsetX: number; offsetY: number; originX: number; originY: number }
  | { kind: 'select'; shape: 'rect' | 'ellipse'; startX: number; startY: number }
  | { kind: 'lasso'; path: number[] }
  | { kind: 'crop'; startX: number; startY: number }
  | { kind: 'shape'; startX: number; startY: number }
  | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | null;

export function attachPointer(
  container: HTMLDivElement,
  handle: StageHandle,
  context: PointerContext,
): () => void {
  let drag: Drag = null;
  let stroke: StrokeSession | null = null;
  let strokeLayerId: string | null = null;
  let strokeIsMask = false;

  const toDoc = (event: PointerEvent | MouseEvent): { x: number; y: number } => {
    const rect = container.getBoundingClientRect();
    const transform = context.getTransform();
    return {
      x: (event.clientX - rect.left - transform.x) / (transform.scale || 1),
      y: (event.clientY - rect.top - transform.y) / (transform.scale || 1),
    };
  };

  const scaleNow = () => context.getTransform().scale || 1;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const state = usePhotoStore.getState();
    const doc = state.doc;
    const point = toDoc(event);
    const tool = state.tool;
    container.setPointerCapture(event.pointerId);

    if (tool === 'hand') {
      drag = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        originX: state.viewport.x,
        originY: state.viewport.y,
      };
      return;
    }

    // Alt + 左键：任意工具下临时吸取前景色（与桌面修图软件一致，不切换当前工具）
    if (event.altKey) {
      context.onPickColor(pickColor(doc, point.x, point.y));
      return;
    }

    if (tool === 'eyedropper') {
      context.onPickColor(pickColor(doc, point.x, point.y));
      return;
    }

    if (tool === 'move') {
      const hit = hitTest(doc, point.x, point.y);
      if (hit) {
        state.selectLayer(hit.id);
        state.commit('histMove');
        drag = {
          kind: 'move',
          id: hit.id,
          offsetX: point.x - hit.x,
          offsetY: point.y - hit.y,
          originX: hit.x,
          originY: hit.y,
        };
      } else {
        state.selectLayer(null);
      }
      return;
    }

    if (tool === 'rectSelect' || tool === 'ellipseSelect') {
      drag = {
        kind: 'select',
        shape: tool === 'rectSelect' ? 'rect' : 'ellipse',
        startX: point.x,
        startY: point.y,
      };
      return;
    }

    if (tool === 'lasso') {
      drag = { kind: 'lasso', path: [point.x, point.y] };
      return;
    }

    if (tool === 'crop') {
      drag = { kind: 'crop', startX: point.x, startY: point.y };
      state.setCropRect(null);
      return;
    }

    if (tool === 'shape') {
      drag = { kind: 'shape', startX: point.x, startY: point.y };
      return;
    }

    if (tool === 'text') {
      const id = state.addTextLayer(point.x, point.y, context.defaultText);
      if (id) context.onRequestTextEdit(id);
      state.setTool('move');
      return;
    }

    if (tool === 'fill') {
      const layerId = state.ensurePaintLayer();
      if (!layerId) return;
      const layer = usePhotoStore.getState().doc.layers.find((item) => item.id === layerId);
      if (!layer || layer.kind !== 'raster') return;
      usePhotoStore.getState().commitPixels(layerId, 'histFill');
      const changed = floodFill(layer, point.x, point.y, state.brush.color, 32, state.selection);
      if (changed) {
        usePhotoStore.getState().bumpRev(layerId);
        context.onSurfaceChange();
      }
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      // 蒙版编辑：笔迹写入蒙版画布（画笔涂白 = 显示，橡皮涂黑 = 隐藏）
      const active = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
      if (state.maskEditing && active?.mask) {
        state.commitMask(active.id);
        const maskLayer = {
          ...(active as RasterLayer),
          assetId: active.mask.assetId,
        } as RasterLayer;
        stroke = createStrokeSession(maskLayer, {
          color: tool === 'eraser' ? '#000000' : '#ffffff',
          size: tool === 'eraser' ? state.eraserSize : state.brush.size,
          hardness: state.brush.hardness,
          opacity: 1,
          mode: 'brush',
          selection: null,
        });
        strokeLayerId = active.id;
        strokeIsMask = true;
        stroke?.move(point.x, point.y);
        context.onSurfaceChange();
        return;
      }

      const layerId = state.ensurePaintLayer();
      if (!layerId) return;
      const layer = usePhotoStore.getState().doc.layers.find((item) => item.id === layerId);
      if (!layer || layer.kind !== 'raster') return;
      usePhotoStore.getState().commitPixels(layerId, tool === 'eraser' ? 'histErase' : 'histBrush');
      stroke = createStrokeSession(layer, {
        color: state.brush.color,
        size: tool === 'eraser' ? state.eraserSize : state.brush.size,
        hardness: state.brush.hardness,
        opacity: tool === 'eraser' ? 1 : state.brush.opacity,
        mode: tool === 'eraser' ? 'eraser' : 'brush',
        selection: state.selection,
      });
      strokeLayerId = layerId;
      stroke?.move(point.x, point.y);
      context.onSurfaceChange();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag && !stroke) return;
    const state = usePhotoStore.getState();
    const point = toDoc(event);

    if (stroke) {
      stroke.move(point.x, point.y);
      context.onSurfaceChange();
      return;
    }
    if (!drag) return;

    if (drag.kind === 'pan') {
      context.onPan(
        drag.originX + (event.clientX - drag.startX),
        drag.originY + (event.clientY - drag.startY),
      );
      return;
    }

    if (drag.kind === 'move') {
      state.patchLayer(
        drag.id,
        { x: Math.round(point.x - drag.offsetX), y: Math.round(point.y - drag.offsetY) },
        false,
      );
      return;
    }

    if (drag.kind === 'select') {
      const rect = normalizeRect({ x: drag.startX, y: drag.startY }, point);
      const selection: Selection = {
        kind: drag.shape,
        ...clampRect(rect, { width: state.doc.width, height: state.doc.height }),
        path: [],
        feather: 0,
      };
      state.setSelection(selection);
      handle.setSelection(selection, scaleNow());
      return;
    }

    if (drag.kind === 'lasso') {
      drag.path.push(point.x, point.y);
      const preview: Selection = {
        kind: 'lasso',
        ...boundsOf(drag.path),
        path: drag.path,
        feather: 0,
      };
      handle.setSelection(preview, scaleNow());
      return;
    }

    if (drag.kind === 'crop') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, point), {
        width: state.doc.width,
        height: state.doc.height,
      });
      state.setCropRect(rect);
      handle.setCropRect(rect, state.doc, scaleNow());
      return;
    }

    if (drag.kind === 'shape') {
      const rect = normalizeRect({ x: drag.startX, y: drag.startY }, point);
      handle.setCropRect(rect, state.doc, scaleNow());
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const state = usePhotoStore.getState();
    if (stroke) {
      stroke.end();
      stroke = null;
      if (strokeLayerId) {
        if (strokeIsMask) {
          const layer = state.doc.layers.find((item) => item.id === strokeLayerId);
          if (layer?.mask) state.patchMask(layer.id, { rev: layer.mask.rev + 1 }, false);
        } else {
          state.bumpRev(strokeLayerId);
        }
      }
      strokeLayerId = null;
      strokeIsMask = false;
      context.onSurfaceChange();
    }
    if (!drag) return;

    if (drag.kind === 'lasso') {
      const selection = toSelection(drag.path, 0);
      state.setSelection(selection);
      handle.setSelection(selection, scaleNow());
    } else if (drag.kind === 'shape') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, toDoc(event)), {
        width: state.doc.width,
        height: state.doc.height,
      });
      handle.setCropRect(null, state.doc, scaleNow());
      if (rect.width >= 8 && rect.height >= 8) state.addShapeLayer(rect);
    } else if (drag.kind === 'crop') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, toDoc(event)), {
        width: state.doc.width,
        height: state.doc.height,
      });
      if (rect.width >= 8 && rect.height >= 8) {
        state.setCropRect(rect);
        handle.setCropRect(rect, state.doc, scaleNow());
      }
    }
    drag = null;
  };

  const onDoubleClick = (event: MouseEvent) => {
    const state = usePhotoStore.getState();
    const point = toDoc(event);
    const hit = hitTest(state.doc, point.x, point.y);
    if (hit && hit.kind === 'text') {
      state.selectLayer(hit.id);
      context.onRequestTextEdit(hit.id);
    }
  };

  /** 右键：屏蔽浏览器默认菜单，交给宿主的画布右键菜单 */
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    context.onContextMenu({ x: event.clientX, y: event.clientY });
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('dblclick', onDoubleClick);
  container.addEventListener('contextmenu', onContextMenu);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('dblclick', onDoubleClick);
    container.removeEventListener('contextmenu', onContextMenu);
  };
}

/** 命中检测：自顶层向下找第一个包含该点的可见图层 */
export function hitTest(doc: PhotoDoc, x: number, y: number): Layer | null {
  for (let i = doc.layers.length - 1; i >= 0; i -= 1) {
    const layer = doc.layers[i];
    if (!layer.visible || layer.locked) continue;
    if (x >= layer.x && y >= layer.y && x <= layer.x + layer.width && y <= layer.y + layer.height) {
      return layer;
    }
  }
  return null;
}

function boundsOf(path: number[]): Rect {
  if (path.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; i += 2) {
    minX = Math.min(minX, path[i]);
    maxX = Math.max(maxX, path[i]);
    minY = Math.min(minY, path[i + 1]);
    maxY = Math.max(maxY, path[i + 1]);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface PickedColor {
  hex: string;
  /** 0~255：透明像素不该覆盖前景色，UI 据此给出提示 */
  alpha: number;
}

/** 吸管：合成整份文档后在落点取色（点击才触发，成本可接受） */
export function pickColor(doc: PhotoDoc, x: number, y: number): PickedColor | null {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= doc.width || py >= doc.height) return null;
  const canvas = compositeDoc(doc, { x: px, y: py, width: 1, height: 1 }, 1);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return { hex: rgbToHex(data[0], data[1], data[2]), alpha: data[3] };
}
