import {
  angleFromCenter,
  clampRect,
  hitTransformHandle,
  normalizeRect,
  resizeLayerBox,
  rgbToHex,
  rotateLayerBox,
  toLocalPoint,
} from '../core';
import type { LayerBox, MeshEdge, RepairTool, TransformDelta, TransformHandle } from '../core';
import type { MeshWarp } from '../model/types';
import {
  REPAIR_TOOLS,
  SNAP_THRESHOLD_PX,
  collectSnapTargets,
  needsCloneSource,
  screenToDoc,
  snapBoxPosition,
  dragMeshEdge,
  dragMeshPoint,
  isIdentityDelta,
  meshControlPoints,
  meshEdgeAt,
  meshParamAt,
  transformOverlayFor,
} from '../core';
import { getCanvas } from '../model/assets';
import { createStrokeSession, floodFill, type StrokeSession } from '../render/brush';
import { compositeDoc } from '../render/export';
import { applyGradient } from '../render/gradient';
import {
  createCloneSession,
  createFocusSession,
  createSmudgeSession,
  type RepairSession,
} from '../render/repair';
import { createRetouchSession, type RetouchSession } from '../render/retouch';
import { magicWandSelection } from '../render/selection';
import type { SelectionOp } from '../render/selection';
import { buildEdgeMap, snapToEdge, type EdgeMap } from './magnetic';
import type { OverlayState, StageHandle } from '../render/stage';
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
  | {
      kind: 'transform';
      id: string;
      handle: TransformHandle;
      start: LayerBox;
      startAngle: number;
    }
  | { kind: 'select'; shape: 'rect' | 'ellipse'; startX: number; startY: number }
  | { kind: 'lasso'; path: number[]; magnetic?: boolean }
  | { kind: 'quickSelect' }
  | { kind: 'gradient'; fromX: number; fromY: number }
  | { kind: 'retouch'; id: string }
  | { kind: 'repair'; id: string }
  | { kind: 'meshPoint'; id: string; index: number; base: MeshWarp; box: LayerBox }
  | {
      kind: 'meshEdge';
      id: string;
      edge: MeshEdge;
      base: MeshWarp;
      box: LayerBox;
      startU: number;
      startV: number;
    }
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
  /** 润饰工具会话（减淡 / 加深 / 海绵） */
  let retouch: RetouchSession | null = null;
  let retouchLayerId: string | null = null;
  /** 本次笔画是否落在快速蒙版上（松手时要刷新蒙版而不是图层 rev） */
  let strokeIsQuickMask = false;
  /** 修复类工具会话（图章 / 修复 / 涂抹 / 模糊锐化） */
  let repair: RepairSession | null = null;
  let repairLayerId: string | null = null;
  /** 快速选择：上次生长的时间戳（节流，避免每个 pointermove 都重算魔棒） */
  let quickLastAt = 0;

  /** 屏幕 → 文档：旋转视图下必须走完整逆变换，否则点击位置会随角度错开 */
  const toDoc = (event: PointerEvent | MouseEvent): { x: number; y: number } => {
    const rect = container.getBoundingClientRect();
    return screenToDoc(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      context.getTransform(),
      { width: container.clientWidth, height: container.clientHeight },
      usePhotoStore.getState().viewRotation,
    );
  };

  const scaleNow = () => context.getTransform().scale || 1;

  /** 重绘覆盖层：默认取当前 store 状态，允许局部覆盖（拖拽预览用） */
  const drawOverlay = (over: Partial<OverlayState> = {}) => {
    const state = usePhotoStore.getState();
    const active = state.doc.layers.find((item) => item.id === state.doc.activeLayerId);
    const overlay =
      state.tool === 'transform' && active
        ? transformOverlayFor(active, state.transformMode)
        : { transformBox: null, meshGrid: null };
    handle.renderOverlay({
      doc: state.doc,
      scale: scaleNow(),
      selection: state.selection,
      cropRect: state.cropRect,
      samples: state.samples,
      quickMask: state.quickMask ? (getCanvas(state.quickMask.assetId) ?? null) : null,
      transformBox: overlay.transformBox,
      meshGrid: overlay.meshGrid,
      cloneSource: needsCloneSource(state.tool) ? state.cloneSource : null,
      snapGuides: state.snapGuides,
      gradient: null,
      ...over,
    });
  };

  /** 修饰键 → 选区布尔运算：Shift 加选、Alt 减选、Shift+Alt 交集，否则替换 */
  const selectionOpFrom = (event: { shiftKey: boolean; altKey: boolean }): SelectionOp => {
    if (event.shiftKey && event.altKey) return 'intersect';
    if (event.shiftKey) return 'add';
    if (event.altKey) return 'subtract';
    return 'replace';
  };

  /** 快速选择：在落点做一次魔棒生长并并入当前选区（连续拖拽即逐步累积） */
  const growQuickSelection = (x: number, y: number) => {
    const state = usePhotoStore.getState();
    const next = magicWandSelection(state.doc, x, y, {
      tolerance: state.wandTolerance,
      contiguous: state.wandContiguous,
    });
    if (!next) return;
    state.applySelection(next, 'add');
    drawOverlay();
  };

  /** 多边形套索：已落下的顶点（文档坐标）；null = 未开始 */
  let polygon: { points: number[] } | null = null;
  /** 多边形套索：上一次点击的时间 / 位置（双击闭合用） */
  let lastPolyClick = { at: 0, x: 0, y: 0 };
  /** 多边形套索：闭合时刻（双击的第二下不要再开一个新多边形） */
  let lastPolyCloseAt = 0;
  /** 磁性套索：手势开始时算好的边缘图（文档在手势内不变，不必每帧重算） */
  let edgeMap: EdgeMap | null = null;

  /** 多边形套索：预览（最后一个顶点 → 光标 → 起点自动闭合） */
  const previewPolygon = (cursor?: { x: number; y: number }) => {
    if (!polygon) return;
    const path = cursor ? [...polygon.points, cursor.x, cursor.y] : [...polygon.points];
    if (path.length < 4) {
      // 只有 1 个点时还画不出折线：保持现有选区，不要把它清掉
      drawOverlay();
      return;
    }
    const preview: Selection = { kind: 'lasso', ...boundsOf(path), path, feather: 0 };
    drawOverlay({ selection: preview });
  };

  /** 多边形套索：闭合落子（顶点不足 3 个就当作误触丢弃） */
  const closePolygon = (op: SelectionOp) => {
    const points = polygon?.points ?? [];
    polygon = null;
    if (points.length < 6) {
      drawOverlay();
      return;
    }
    const selection = toSelection(points, 0);
    if (selection) usePhotoStore.getState().applySelection(selection, op);
    drawOverlay();
  };

  const cancelPolygon = () => {
    if (!polygon) return;
    polygon = null;
    drawOverlay();
  };

  /** 屏幕 10px 换算到文档单位的命中半径 */
  const handleRadius = () => 10 / scaleNow();
  /** 旋转柄相对顶边的文档单位距离（屏幕 26px） */
  const rotateOffset = () => 26 / scaleNow();

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

    const isSelectionTool =
      tool === 'rectSelect' ||
      tool === 'ellipseSelect' ||
      tool === 'lasso' ||
      tool === 'polyLasso' ||
      tool === 'magneticLasso' ||
      tool === 'wand' ||
      tool === 'quickSelect';

    // Alt + 左键：图章 / 修复类工具用于「取样源点」（Photoshop 同款手势）
    if (event.altKey && needsCloneSource(tool)) {
      state.setCloneSource({ x: point.x, y: point.y });
      drawOverlay();
      return;
    }

    // Alt + 左键：其余（非选区、非取样器）工具临时吸取前景色；选区工具下 Alt 表示「减选」。
    // 取样器自己要用 Alt 删除取样点，因此必须排除在外。
    if (event.altKey && !isSelectionTool && tool !== 'sampler') {
      context.onPickColor(pickColor(doc, point.x, point.y));
      return;
    }

    if (tool === 'eyedropper') {
      context.onPickColor(pickColor(doc, point.x, point.y));
      return;
    }

    if (tool === 'sampler') {
      // Alt + 点击 = 删除最近的一个取样点（与 Photoshop 的取样器一致）
      if (event.altKey) {
        const current = usePhotoStore.getState().samples;
        if (current.length > 0) {
          usePhotoStore.getState().removeSample(current.length - 1);
          drawOverlay();
        }
        return;
      }
      usePhotoStore.getState().addSample(point.x, point.y);
      drawOverlay();
      return;
    }

    if (tool === 'move') {
      const hit = hitTest(doc, point.x, point.y);
      if (hit) {
        state.selectLayer(hit.id);
        // 锁定位置：仍可选中（便于在面板里改属性），但不进入拖拽
        if (hit.lockPosition) return;
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

    if (tool === 'transform') {
      const active = doc.layers.find((item) => item.id === doc.activeLayerId);
      if (!active || active.locked) {
        const hit = hitTest(doc, point.x, point.y);
        if (hit) state.selectLayer(hit.id);
        return;
      }
      const box: LayerBox = {
        x: active.x,
        y: active.y,
        width: active.width,
        height: active.height,
        rotation: active.rotation,
      };
      // 网格模式（透视 / 扭曲 / 斜切 / 变形）：先命中控制点 / 边线，再回落到常规手柄判定
      if (state.transformMode !== 'free' && active.mesh) {
        const points = meshControlPoints(active.mesh, box, true);
        const radius = handleRadius();
        const hitIndex = points.findIndex(
          (item) => Math.hypot(item.x - point.x, item.y - point.y) <= radius,
        );
        if (hitIndex >= 0) {
          state.commit('histTransform');
          drag = { kind: 'meshPoint', id: active.id, index: hitIndex, base: active.mesh, box };
          return;
        }
        if (state.transformMode === 'skew') {
          const param = meshParamAt(box, point.x, point.y, true);
          const edge = meshEdgeAt(
            param.u,
            param.v,
            radius / Math.max(1, box.width),
            radius / Math.max(1, box.height),
          );
          if (edge && param.u >= 0 && param.u <= 1 && param.v >= 0 && param.v <= 1) {
            state.commit('histTransform');
            drag = {
              kind: 'meshEdge',
              id: active.id,
              edge,
              base: active.mesh,
              box,
              startU: param.u,
              startV: param.v,
            };
            return;
          }
        }
      }
      const target = hitTransformHandle(box, point.x, point.y, handleRadius(), rotateOffset());
      if (target === 'inside') {
        // 框内拖动 = 平移（与移动工具一致）
        state.selectLayer(active.id);
        state.commit('histMove');
        drag = {
          kind: 'move',
          id: active.id,
          offsetX: point.x - active.x,
          offsetY: point.y - active.y,
          originX: active.x,
          originY: active.y,
        };
        return;
      }
      if (!target) {
        const under = hitTest(doc, point.x, point.y);
        if (under) state.selectLayer(under.id);
        return;
      }
      // 一次变换 = 一次历史（拖拽过程沿用同一锚点，松手不再重复提交）
      state.commit('histMove');
      drag = {
        kind: 'transform',
        id: active.id,
        handle: target,
        start: box,
        startAngle: angleFromCenter(box, point.x, point.y),
      };
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

    if (tool === 'polyLasso') {
      // 逐点单击建框：点回起点或双击闭合，Esc 取消
      const doubleClick =
        event.timeStamp - lastPolyClick.at < 320 &&
        Math.hypot(point.x - lastPolyClick.x, point.y - lastPolyClick.y) < 6;
      lastPolyClick = { at: event.timeStamp, x: point.x, y: point.y };
      const first = polygon?.points;
      const nearFirst =
        !!first && first.length >= 6 && Math.hypot(point.x - first[0], point.y - first[1]) <= 12;
      if (polygon && (doubleClick || nearFirst)) {
        closePolygon(selectionOpFrom(event));
        lastPolyCloseAt = event.timeStamp;
        return;
      }
      // 双击闭合的第二下不要再起一个新多边形
      if (!polygon && event.timeStamp - lastPolyCloseAt < 350) return;
      if (polygon) polygon.points.push(point.x, point.y);
      else polygon = { points: [point.x, point.y] };
      previewPolygon();
      return;
    }

    if (tool === 'magneticLasso') {
      // 边缘图只在本手势内有效：文档变化（撤销 / 切图层）时下次手势会重算
      edgeMap = buildEdgeMap(doc);
      // 「宽度」按屏幕像素理解（Photoshop 的手感）：换算成文档像素后再去吸附
      const snapped = snapToEdge(
        edgeMap,
        point,
        state.magnetic.width / scaleNow(),
        state.magnetic.contrast,
      );
      drag = { kind: 'lasso', path: [snapped.x, snapped.y], magnetic: true };
      return;
    }

    if (tool === 'wand') {
      const next = magicWandSelection(doc, point.x, point.y, {
        tolerance: state.wandTolerance,
        contiguous: state.wandContiguous,
      });
      if (next) {
        state.applySelection(next, selectionOpFrom(event));
        drawOverlay();
      }
      return;
    }

    if (tool === 'quickSelect') {
      quickLastAt = 0;
      growQuickSelection(point.x, point.y);
      drag = { kind: 'quickSelect' };
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
      const changed = floodFill(
        layer,
        point.x,
        point.y,
        state.brush.color,
        state.fillTolerance,
        state.selection,
        Boolean(layer.lockAlpha),
        state.fillContiguous,
      );
      if (changed) {
        usePhotoStore.getState().bumpRev(layerId);
        context.onSurfaceChange();
      }
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      // 快速蒙版优先：笔迹写入蒙版画布（画笔涂白 = 加入选区，橡皮涂黑 = 移出选区）
      if (state.quickMask) {
        stroke = createStrokeSession(
          {
            assetId: state.quickMask.assetId,
            x: 0,
            y: 0,
            width: state.doc.width,
            height: state.doc.height,
          },
          {
            color: tool === 'eraser' ? '#000000' : '#ffffff',
            size: tool === 'eraser' ? state.eraserSize : state.brush.size,
            hardness: state.brush.hardness,
            opacity: 1,
            mode: 'brush',
            selection: null,
            spacing: state.brush.spacing,
            pressureSize: state.brush.pressureSize,
          },
        );
        strokeIsQuickMask = true;
        strokeLayerId = null;
        stroke?.move(point.x, point.y, event.pressure);
        context.onSurfaceChange();
        return;
      }

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
        lockAlpha: Boolean(layer.lockAlpha),
        spacing: state.brush.spacing,
        pressureSize: state.brush.pressureSize,
        pressureOpacity: tool === 'eraser' ? false : state.brush.pressureOpacity,
      });
      strokeLayerId = layerId;
      stroke?.move(point.x, point.y, event.pressure);
      context.onSurfaceChange();
      return;
    }

    if (REPAIR_TOOLS.includes(tool as RepairTool)) {
      const layerId = state.ensurePaintLayer();
      if (!layerId) return;
      const layer = usePhotoStore.getState().doc.layers.find((item) => item.id === layerId);
      if (!layer || layer.kind !== 'raster') return;
      const mode = tool as RepairTool;
      // 图章 / 修复必须已有取样点；污点修复自动取样
      if (needsCloneSource(mode) && !state.cloneSource) return;
      usePhotoStore.getState().commitPixels(layerId, 'histRetouch');
      const options = {
        // 与减淡 / 加深 / 海绵共用笔头大小与强度：同族工具换用时期望「笔头不变」
        size: state.retouchSize,
        strength: state.retouchStrength,
        selection: state.selection,
        source: state.cloneSource,
      };
      repair =
        mode === 'cloneStamp' || mode === 'healing' || mode === 'spotHeal'
          ? createCloneSession(layer, {
              ...options,
              mode: mode === 'cloneStamp' ? 'clone' : mode === 'healing' ? 'heal' : 'spot',
            })
          : mode === 'smudge'
            ? createSmudgeSession(layer, { ...options, mode: 'smudge' })
            : createFocusSession(layer, {
                ...options,
                mode: mode === 'blurBrush' ? 'blur' : 'sharpen',
              });
      if (!repair) return;
      repairLayerId = layerId;
      repair.move(point.x, point.y, event.pressure);
      drag = { kind: 'repair', id: layerId };
      context.onSurfaceChange();
      return;
    }

    if (tool === 'gradient') {
      drag = { kind: 'gradient', fromX: point.x, fromY: point.y };
      return;
    }

    if (tool === 'dodge' || tool === 'burn' || tool === 'sponge') {
      const layerId = state.ensurePaintLayer();
      if (!layerId) return;
      const layer = usePhotoStore.getState().doc.layers.find((item) => item.id === layerId);
      if (!layer || layer.kind !== 'raster') return;
      usePhotoStore.getState().commitPixels(layerId, 'histRetouch');
      retouch = createRetouchSession(layer, {
        mode: tool,
        size: state.retouchSize,
        strength: state.retouchStrength,
        selection: state.selection,
      });
      if (!retouch) return;
      retouchLayerId = layerId;
      retouch.move(point.x, point.y, event.pressure);
      drag = { kind: 'retouch', id: layerId };
      context.onSurfaceChange();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    // 多边形套索没有拖拽过程，但仍要跟着光标画「下一段」预览
    const drawingPolygon =
      !drag && !stroke && polygon !== null && usePhotoStore.getState().tool === 'polyLasso';
    if (!drag && !stroke && !drawingPolygon) return;
    const state = usePhotoStore.getState();
    const point = toDoc(event);

    if (stroke) {
      stroke.move(point.x, point.y, event.pressure);
      context.onSurfaceChange();
      return;
    }
    if (retouch) {
      retouch.move(point.x, point.y, event.pressure);
      context.onSurfaceChange();
      return;
    }
    if (repair) {
      repair.move(point.x, point.y, event.pressure);
      context.onSurfaceChange();
      return;
    }
    if (!drag) {
      if (drawingPolygon) previewPolygon(point);
      return;
    }

    if (drag.kind === 'pan') {
      context.onPan(
        drag.originX + (event.clientX - drag.startX),
        drag.originY + (event.clientY - drag.startY),
      );
      return;
    }

    if (drag.kind === 'move') {
      // 闭包内无法沿用外层收窄，先落到局部常量
      const dragging = drag;
      const layer = state.doc.layers.find((item) => item.id === dragging.id);
      const raw = { x: point.x - drag.offsetX, y: point.y - drag.offsetY };
      const box = {
        x: raw.x,
        y: raw.y,
        width: layer?.width ?? 0,
        height: layer?.height ?? 0,
      };
      // 吸附：⌘/Ctrl 临时关闭（与 Photoshop 的「临时停用对齐」同一手势）
      const snapped = snapBoxPosition(
        box,
        collectSnapTargets(state.doc, {
          excludeLayerId: dragging.id,
          guides: state.overlay.guides,
        }),
        SNAP_THRESHOLD_PX / Math.max(0.05, scaleNow()),
        {
          enabled: state.snapEnabled && !event.metaKey && !event.ctrlKey,
          gridSize: state.overlay.grid ? state.overlay.gridSize : 0,
        },
      );
      state.patchLayer(dragging.id, { x: Math.round(snapped.x), y: Math.round(snapped.y) }, false);
      state.setSnapGuides(snapped.guides);
      return;
    }

    if (drag.kind === 'meshPoint') {
      const param = meshParamAt(drag.box, point.x, point.y, true);
      const mesh = dragMeshPoint(drag.base, drag.index, param.u, param.v, state.transformMode);
      state.patchLayer(drag.id, { mesh }, false);
      return;
    }

    if (drag.kind === 'meshEdge') {
      const param = meshParamAt(drag.box, point.x, point.y, true);
      const mesh = dragMeshEdge(drag.base, drag.edge, param.u - drag.startU, param.v - drag.startV);
      state.patchLayer(drag.id, { mesh }, false);
      return;
    }

    if (drag.kind === 'transform') {
      if (drag.handle === 'rotate') {
        const delta = angleFromCenter(drag.start, point.x, point.y) - drag.startAngle;
        const box = rotateLayerBox(drag.start, delta, event.shiftKey);
        state.patchLayer(drag.id, { rotation: box.rotation }, false);
        return;
      }
      const local = toLocalPoint(drag.start, point.x, point.y);
      const box = resizeLayerBox(drag.start, drag.handle, local, {
        keepRatio: event.shiftKey,
        fromCenter: event.altKey,
      });
      state.patchLayer(
        drag.id,
        { x: box.x, y: box.y, width: box.width, height: box.height },
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
      // 预览只画新形状；布尔运算在松手时统一结算（避免拖拽中途反复叠加）
      drawOverlay({ selection });
      return;
    }

    if (drag.kind === 'quickSelect') {
      const now = performance.now();
      if (now - quickLastAt > 60) {
        quickLastAt = now;
        growQuickSelection(point.x, point.y);
      }
      return;
    }

    if (drag.kind === 'gradient') {
      drawOverlay({
        gradient: {
          from: { x: drag.fromX, y: drag.fromY },
          to: { x: point.x, y: point.y },
        },
      });
      return;
    }

    if (drag.kind === 'lasso') {
      if (drag.magnetic && edgeMap) {
        // 磁性套索：吸附到附近最强边缘；间隔太小会让顶点爆炸（轮廓也变毛躁）
        const snapped = snapToEdge(
          edgeMap,
          point,
          state.magnetic.width / scaleNow(),
          state.magnetic.contrast,
        );
        const lastX = drag.path[drag.path.length - 2];
        const lastY = drag.path[drag.path.length - 1];
        if (Math.hypot(snapped.x - lastX, snapped.y - lastY) >= 3) {
          drag.path.push(snapped.x, snapped.y);
        }
      } else {
        drag.path.push(point.x, point.y);
      }
      const preview: Selection = {
        kind: 'lasso',
        ...boundsOf(drag.path),
        path: drag.path,
        feather: 0,
      };
      drawOverlay({ selection: preview });
      return;
    }

    if (drag.kind === 'crop') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, point), {
        width: state.doc.width,
        height: state.doc.height,
      });
      state.setCropRect(rect);
      drawOverlay({ cropRect: rect });
      return;
    }

    if (drag.kind === 'shape') {
      const rect = normalizeRect({ x: drag.startX, y: drag.startY }, point);
      drawOverlay({ cropRect: rect });
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const state = usePhotoStore.getState();
    if (stroke) {
      stroke.end();
      stroke = null;
      if (strokeIsQuickMask) {
        state.bumpQuickMask();
      } else if (strokeLayerId) {
        if (strokeIsMask) {
          const layer = state.doc.layers.find((item) => item.id === strokeLayerId);
          if (layer?.mask) state.patchMask(layer.id, { rev: layer.mask.rev + 1 }, false);
        } else {
          state.bumpRev(strokeLayerId);
        }
      }
      strokeLayerId = null;
      strokeIsMask = false;
      strokeIsQuickMask = false;
      context.onSurfaceChange();
    }
    if (retouch) {
      retouch.end();
      retouch = null;
      if (retouchLayerId) state.bumpRev(retouchLayerId);
      retouchLayerId = null;
      context.onSurfaceChange();
    }
    if (repair) {
      repair.end();
      repair = null;
      if (repairLayerId) state.bumpRev(repairLayerId);
      repairLayerId = null;
      context.onSurfaceChange();
    }
    if (!drag) return;

    if (drag.kind === 'gradient') {
      const end = toDoc(event);
      const layerId = state.ensurePaintLayer();
      if (layerId) {
        state.commitPixels(layerId, 'histGradient');
        const target = usePhotoStore.getState().doc.layers.find((item) => item.id === layerId);
        if (target && target.kind === 'raster') {
          const changed = applyGradient(target, {
            kind: state.gradientKind,
            mode: state.gradientMode,
            from: { x: drag.fromX, y: drag.fromY },
            to: end,
            foreground: state.brush.color,
            background: state.brush.background,
            selection: state.selection,
            lockAlpha: Boolean(target.lockAlpha),
          });
          if (changed) {
            usePhotoStore.getState().bumpRev(layerId);
            context.onSurfaceChange();
          }
        }
      }
      drawOverlay({ gradient: null });
      return;
    }

    if (drag.kind === 'select') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, toDoc(event)), {
        width: state.doc.width,
        height: state.doc.height,
      });
      if (rect.width >= 2 && rect.height >= 2) {
        const selection: Selection = {
          kind: drag.shape,
          ...rect,
          path: [],
          feather: 0,
        };
        state.applySelection(selection, selectionOpFrom(event));
      } else {
        state.setSelection(null);
      }
      drawOverlay();
    } else if (drag.kind === 'lasso') {
      const selection = toSelection(drag.path, 0);
      if (selection) state.applySelection(selection, selectionOpFrom(event));
      edgeMap = null;
      drawOverlay();
    } else if (drag.kind === 'shape') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, toDoc(event)), {
        width: state.doc.width,
        height: state.doc.height,
      });
      drawOverlay({ cropRect: null });
      if (rect.width >= 8 && rect.height >= 8) state.addShapeLayer(rect);
    } else if (drag.kind === 'crop') {
      const rect = clampRect(normalizeRect({ x: drag.startX, y: drag.startY }, toDoc(event)), {
        width: state.doc.width,
        height: state.doc.height,
      });
      if (rect.width >= 8 && rect.height >= 8) {
        state.setCropRect(rect);
        drawOverlay({ cropRect: rect });
      }
    }

    // 记录本次变换增量：⌘⇧T「再次变换」用。
    // 只登记平移与自由变换 —— 透视 / 扭曲 / 变形不是「可重复的线性增量」，Photoshop 同样不支持重复。
    const finished = drag;
    if (finished.kind === 'move') state.setSnapGuides([]);
    if (finished.kind === 'move' || finished.kind === 'transform') {
      const layer = state.doc.layers.find((item) => item.id === finished.id);
      if (layer) {
        const delta: TransformDelta =
          finished.kind === 'move'
            ? {
                dx: layer.x - finished.originX,
                dy: layer.y - finished.originY,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
              }
            : {
                dx: layer.x - finished.start.x,
                dy: layer.y - finished.start.y,
                scaleX: layer.width / Math.max(1, finished.start.width),
                scaleY: layer.height / Math.max(1, finished.start.height),
                rotation: layer.rotation - finished.start.rotation,
              };
        if (!isIdentityDelta(delta)) state.recordTransform(delta);
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

  // 多边形套索是「跨多次点击」的会话：Esc 取消、切走工具也要取消，
  // 否则未闭合的折线会一直留在覆盖层上（换工具后看起来像卡住的选区）
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cancelPolygon();
  };
  window.addEventListener('keydown', onKeyDown);
  const unsubscribe = usePhotoStore.subscribe((state, previous) => {
    if (state.tool !== previous.tool) cancelPolygon();
  });

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('dblclick', onDoubleClick);
  container.addEventListener('contextmenu', onContextMenu);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    unsubscribe();
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
