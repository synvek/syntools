import { meshControlPoints, meshIsIdentity } from '../core';
import type { LayerBox } from '../core';
import { createCanvasElement } from '../model/assets';
import type { MeshWarp } from '../model/types';

/**
 * 网格变形渲染：把一张位图按「目标网格」重画。
 *
 * 核心是**逐单元仿射**：每个细单元用自己的仿射矩阵绘制，单元足够密时肉眼无法分辨，
 * 却能表达透视 / 扭曲 / 变形这类**非仿射**映射（Canvas2D 一次 `drawImage` 只能做仿射）。
 * 文字变形与图层网格变形共用这一份实现，避免两处各写一套插值而出现视觉差异。
 */

export type Point = { x: number; y: number };

export interface MeshNodes {
  /** 横向单元数（节点数为 cols + 1） */
  cols: number;
  rows: number;
  /** 行优先的目标位置，长度 = (cols + 1) * (rows + 1) */
  nodes: Point[];
}

/** 单元外扩像素：遮住相邻单元间的细缝（浮点取整会留下 1px 缝） */
const CELL_BLEED = 1;
/** 变形位图四周留白比例（相对图层尺寸） */
const MESH_PAD_RATIO = 0.3;

/**
 * 按目标网格逐单元绘制 `source`。
 *
 * `sourceRect` 是 `source` 中要参与映射的矩形，`nodes` 是该矩形细分后的目标位置：
 * 节点 (r, c) 对应源矩形中的 `(c/cols, r/rows)`。
 */
export function drawMeshCells(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceRect: { x: number; y: number; width: number; height: number },
  meshNodes: MeshNodes,
  bleed = CELL_BLEED,
): void {
  const { cols, rows, nodes } = meshNodes;
  const cellW = sourceRect.width / cols;
  const cellH = sourceRect.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const p00 = nodes[row * (cols + 1) + col];
      const p10 = nodes[row * (cols + 1) + col + 1];
      const p01 = nodes[(row + 1) * (cols + 1) + col];
      if (!p00 || !p10 || !p01) continue;
      const sx = sourceRect.x + col * cellW;
      const sy = sourceRect.y + row * cellH;
      // 仿射：把源单元映射到由 p00 / p10 / p01 决定的平行四边形
      const a = (p10.x - p00.x) / cellW;
      const b = (p10.y - p00.y) / cellW;
      const c = (p01.x - p00.x) / cellH;
      const d = (p01.y - p00.y) / cellH;
      ctx.save();
      ctx.setTransform(a, b, c, d, p00.x, p00.y);
      ctx.drawImage(
        source,
        sx - bleed,
        sy - bleed,
        cellW + bleed * 2,
        cellH + bleed * 2,
        -bleed,
        -bleed,
        cellW + bleed * 2,
        cellH + bleed * 2,
      );
      ctx.restore();
    }
  }
}

/** 双线性插值取值（u, v 为整个网格上的归一化坐标） */
function sampleGrid(values: Point[], cols: number, rows: number, u: number, v: number): Point {
  const gx = u * (cols - 1);
  const gy = v * (rows - 1);
  const c0 = Math.min(cols - 2, Math.max(0, Math.floor(gx)));
  const r0 = Math.min(rows - 2, Math.max(0, Math.floor(gy)));
  const tx = gx - c0;
  const ty = gy - r0;
  const p = (c: number, r: number) => values[r * cols + c] ?? { x: 0, y: 0 };
  const top = {
    x: p(c0, r0).x + (p(c0 + 1, r0).x - p(c0, r0).x) * tx,
    y: p(c0, r0).y + (p(c0 + 1, r0).y - p(c0, r0).y) * tx,
  };
  const bottom = {
    x: p(c0, r0 + 1).x + (p(c0 + 1, r0 + 1).x - p(c0, r0 + 1).x) * tx,
    y: p(c0, r0 + 1).y + (p(c0 + 1, r0 + 1).y - p(c0, r0 + 1).y) * tx,
  };
  return { x: top.x + (bottom.x - top.x) * ty, y: top.y + (bottom.y - top.y) * ty };
}

/**
 * 由控制点网格算出细网格目标位置（双线性插值）。
 *
 * `subdivisions` 是每个控制单元再细分的份数：2×2（透视 / 扭曲 / 斜切）用大一点的值，
 * 因为一层双线性单元对透视的近似误差最明显；4×4（变形）本身已经足够密，用小值即可。
 */
export function meshFineNodes(
  mesh: MeshWarp,
  box: LayerBox,
  subdivisions: number,
  rotated = false,
): MeshNodes {
  const controls = meshControlPoints(mesh, box, rotated);
  const values: Point[] = controls.map((point) => ({ x: point.x, y: point.y }));
  const fineCols = (mesh.cols - 1) * subdivisions;
  const fineRows = (mesh.rows - 1) * subdivisions;
  const nodes: Point[] = [];
  for (let row = 0; row <= fineRows; row += 1) {
    for (let col = 0; col <= fineCols; col += 1) {
      nodes.push(sampleGrid(values, mesh.cols, mesh.rows, col / fineCols, row / fineRows));
    }
  }
  return { cols: fineCols, rows: fineRows, nodes };
}

/** 不同网格规模对应的细分份数：以「细单元边长别超过约 20px」为目标 */
function subdivisionsFor(mesh: MeshWarp, box: LayerBox): number {
  const target = 20;
  const spanCols = Math.max(1, mesh.cols - 1);
  const spanRows = Math.max(1, mesh.rows - 1);
  const perCol = Math.ceil(Math.max(box.width, box.height) / target / Math.max(spanCols, spanRows));
  return Math.min(24, Math.max(4, perCol));
}

const cache = new Map<string, { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }>();
const CACHE_LIMIT = 16;

/** 变形位图在文档坐标中的落位（= 图层原点 - 留白）；`meshLayerBitmap` 与节点更新共用 */
export function meshBitmapOrigin(layer: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  const padX = Math.ceil(Math.max(1, layer.width) * MESH_PAD_RATIO);
  const padY = Math.ceil(Math.max(1, layer.height) * MESH_PAD_RATIO);
  return { x: layer.x - padX, y: layer.y - padY };
}

export interface MeshBitmap {
  canvas: HTMLCanvasElement;
  /** 画布相对图层原点的落位偏移（负值 = 向左上扩） */
  offsetX: number;
  offsetY: number;
}

/**
 * 网格变形后的图层位图（签名缓存）。
 *
 * 与文字变形同一取舍：把非仿射映射烘焙成位图，之后每次绘制只花一次 `drawImage`，
 * 代价是变形期间不再享受矢量清晰度。`render` 回调负责把**未变形**的图层内容画到给定上下文，
 * 调用方需保证回调里不再走网格分支（否则递归）。
 */
export function meshLayerBitmap(
  layer: { mesh?: MeshWarp | null; x: number; y: number; width: number; height: number },
  signature: string,
  render: (ctx: CanvasRenderingContext2D, box: LayerBox) => void,
): MeshBitmap | null {
  const mesh = layer.mesh;
  if (meshIsIdentity(mesh)) return null;
  const grid = mesh as MeshWarp;
  const cached = cache.get(signature);
  if (cached) return cached;

  const box: LayerBox = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: 0,
  };
  // 变形可能把内容甩出盒子：四周留 30% 余量，避免被裁
  const padX = Math.ceil(Math.max(1, layer.width) * MESH_PAD_RATIO);
  const padY = Math.ceil(Math.max(1, layer.height) * MESH_PAD_RATIO);
  const width = Math.max(1, Math.round(layer.width + padX * 2));
  const height = Math.max(1, Math.round(layer.height + padY * 2));
  // 画布内把「文档坐标」平移成以盒子左上角为 (padX, padY)
  const shiftX = padX - layer.x;
  const shiftY = padY - layer.y;

  const source = createCanvasElement(width, height);
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) return null;
  sourceCtx.save();
  sourceCtx.translate(shiftX, shiftY);
  render(sourceCtx, box);
  sourceCtx.restore();

  const out = createCanvasElement(width, height);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.save();
  ctx.translate(shiftX, shiftY);
  const nodes = meshFineNodes(grid, box, subdivisionsFor(grid, box), false);
  drawMeshCells(
    ctx,
    source,
    { x: 0, y: 0, width, height },
    {
      cols: nodes.cols,
      rows: nodes.rows,
      nodes: nodes.nodes.map((point) => ({ x: point.x, y: point.y })),
    },
  );
  ctx.restore();

  const bitmap: MeshBitmap = { canvas: out, offsetX: layer.x - padX, offsetY: layer.y - padY };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, bitmap);
  return bitmap;
}

/** 清空网格位图缓存（文档切换 / 内存吃紧时调用） */
export function clearMeshCache(): void {
  cache.clear();
}
