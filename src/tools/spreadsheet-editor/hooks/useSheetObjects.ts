import { useCallback, useRef, useState } from 'react';
import { measureImage, readFileAsDataUrl } from '../imageSource';
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  createSheetImage,
  fitImageSize,
  parseImageDataUrl,
  type SheetImageConfig,
} from '../sheetImages';
import { createSheetShape, pxToAnchor, type SheetLayout, type SheetShapeConfig } from '../shapes';

/**
 * 漂浮形状与图片（P2-4 第 6 片）。
 *
 * 两族对象的生命周期一模一样（插入 → 拖拽/缩放 → 层级调整 → 删除），只是"插入"的来源不同：
 * 形状来自形状库（拖拽绘制或选菜单），图片来自 `File`。它们都满足三条：
 *
 * 1. 不在 Univer 的单元格里 → 每次改动都要显式请求落盘（`onCommit`）；
 * 2. 层级用递增的 `z`，永远比现有最大值高一步 → 后插入的在上；
 * 3. 快照重建时的采纳规则是"列表为空才采纳"（同图表，不同于批注）：重建拿到的原始快照里
 *    没有这些字段，只要有内容就说明来自草稿。
 *
 * 图片以 dataURL 存进快照（快照必须自包含：草稿、历史版本、导出都不能依赖原文件路径），
 * 所以这里既有大小上限，也有"读不出来就明说"的提示，而不是插一张空白图。
 */

/** 本 hook 真正会调的引擎能力 */
export interface ObjectEngine {
  getActiveSheetId(): string | null;
  getActiveRange(): { startRow: number; startColumn: number } | null;
}

export interface UseSheetObjectsOptions {
  handleRef: { current: ObjectEngine | null };
  /** 画布还没测量出来时的锚点换算兜底 */
  layoutRef: { current: SheetLayout };
  onCommit: () => void;
  /** 图片相关的两句提示（已翻译） */
  messages: { imageTooLarge: string; imageReadFailed: string };
}

export interface SheetObjectsApi {
  shapes: SheetShapeConfig[];
  shapesRef: { current: SheetShapeConfig[] };
  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  insertShape: (
    prst: string,
    from: SheetShapeConfig['from'],
    width?: number,
    height?: number,
  ) => void;
  updateShape: (id: string, patch: Partial<SheetShapeConfig>) => void;
  removeShape: (id: string) => void;
  reorderShape: (id: string, direction: 'front' | 'back') => void;
  /** 形状库面板 */
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  /** 已选中形状库里的样式：下一次在表格上拖拽即按它建形状 */
  drawPrst: string | null;
  choosePreset: (prst: string) => void;
  cancelDraw: () => void;

  images: SheetImageConfig[];
  imagesRef: { current: SheetImageConfig[] };
  selectedImageId: string | null;
  selectImage: (id: string | null) => void;
  /** 图片文件对话框的 accept（提示用，真正的上限在 addImageFile 里） */
  imageAccept: string;
  addImageFile: (file: File) => Promise<void>;
  updateImage: (id: string, patch: Partial<SheetImageConfig>) => void;
  removeImage: (id: string) => void;
  reorderImage: (id: string, direction: 'front' | 'back') => void;
  /** 插入图片时的提示（超限 / 读取失败），贴在工具栏下方 */
  imageNotice: string | null;

  /** 实例重建：列表为空才采纳 */
  adoptIfEmpty: (next: { shapes: SheetShapeConfig[]; images: SheetImageConfig[] }) => void;
  /** 换文档：无条件替换 */
  reset: (next: { shapes: SheetShapeConfig[]; images: SheetImageConfig[] }) => void;
}

export function useSheetObjects({
  handleRef,
  layoutRef,
  onCommit,
  messages,
}: UseSheetObjectsOptions): SheetObjectsApi {
  const [shapes, setShapes] = useState<SheetShapeConfig[]>([]);
  const shapesRef = useRef<SheetShapeConfig[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawPrst, setDrawPrst] = useState<string | null>(null);

  const [images, setImages] = useState<SheetImageConfig[]>([]);
  const imagesRef = useRef<SheetImageConfig[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);

  const latest = useRef({ onCommit, messages, layoutRef });
  latest.current = { onCommit, messages, layoutRef };

  const setShapeList = useCallback((next: SheetShapeConfig[]) => {
    shapesRef.current = next;
    setShapes(next);
  }, []);

  const setImageList = useCallback((next: SheetImageConfig[]) => {
    imagesRef.current = next;
    setImages(next);
  }, []);

  /**
   * 在指定锚点/尺寸处建形状（拖拽绘制与"插入到选区"共用一条路径）。
   * 锚点由调用方给出：绘制时是鼠标落点，菜单插入时是当前选区左上角。
   */
  const insertShape = useCallback(
    (prst: string, from: SheetShapeConfig['from'], width?: number, height?: number) => {
      const handle = handleRef.current;
      if (!handle) return;
      const shape = createSheetShape({
        prst,
        from,
        sheetId: handle.getActiveSheetId() ?? undefined,
        width,
        height,
        z: shapesRef.current.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      });
      setShapeList([...shapesRef.current, shape]);
      setSelectedShapeId(shape.id);
      setPaletteOpen(false);
      setDrawPrst(null);
      latest.current.onCommit();
    },
    [handleRef, setShapeList],
  );

  const updateShape = useCallback(
    (id: string, patch: Partial<SheetShapeConfig>) => {
      setShapeList(
        shapesRef.current.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape)),
      );
      latest.current.onCommit();
    },
    [setShapeList],
  );

  const removeShape = useCallback(
    (id: string) => {
      setShapeList(shapesRef.current.filter((shape) => shape.id !== id));
      setSelectedShapeId((current) => (current === id ? null : current));
      latest.current.onCommit();
    },
    [setShapeList],
  );

  /** 层级：往前一步 = 比现有最大值高 1；往后一步 = 比最小值低 1 */
  const reorderShape = useCallback(
    (id: string, direction: 'front' | 'back') => {
      const zs = shapesRef.current.map((shape) => shape.z);
      const next = direction === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
      setShapeList(
        shapesRef.current.map((shape) => (shape.id === id ? { ...shape, z: next } : shape)),
      );
      latest.current.onCommit();
    },
    [setShapeList],
  );

  const selectShape = useCallback((id: string | null) => setSelectedShapeId(id), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const choosePreset = useCallback((prst: string) => {
    setPaletteOpen(false);
    setDrawPrst(prst);
  }, []);
  const cancelDraw = useCallback(() => setDrawPrst(null), []);

  /**
   * 插入一张图。图片以 dataURL 存进快照 —— 快照必须自包含（草稿/历史版本/导出都不能依赖原文件路径），
   * 导出时再拆回 `xl/media/imageN.<ext>`。超过上限直接拒绝，免得把 localStorage 撑爆。
   */
  const addImageFile = useCallback(
    async (file: File) => {
      const { messages: text, layoutRef: layout } = latest.current;
      if (file.size > MAX_IMAGE_BYTES) {
        setImageNotice(text.imageTooLarge);
        return;
      }
      let src = '';
      try {
        src = await readFileAsDataUrl(file);
      } catch {
        setImageNotice(text.imageReadFailed);
        return;
      }
      if (!parseImageDataUrl(src)) {
        setImageNotice(text.imageReadFailed);
        return;
      }
      const natural = await measureImage(src);
      const handle = handleRef.current;
      const range = handle?.getActiveRange();
      const from = range
        ? { col: range.startColumn, row: range.startRow, colOff: 8, rowOff: 8 }
        : pxToAnchor(24, 24, layout.current);
      const fit = fitImageSize(natural.width, natural.height);
      const image = createSheetImage({
        src,
        name: file.name,
        from,
        sheetId: handle?.getActiveSheetId() ?? undefined,
        width: fit.width,
        height: fit.height,
        z: imagesRef.current.reduce((max, item) => Math.max(max, item.z), 0) + 1,
      });
      setImageNotice(null);
      setImageList([...imagesRef.current, image]);
      setSelectedImageId(image.id);
      latest.current.onCommit();
    },
    [handleRef, setImageList],
  );

  const updateImage = useCallback(
    (id: string, patch: Partial<SheetImageConfig>) => {
      setImageList(
        imagesRef.current.map((image) => (image.id === id ? { ...image, ...patch } : image)),
      );
      latest.current.onCommit();
    },
    [setImageList],
  );

  const removeImage = useCallback(
    (id: string) => {
      setImageList(imagesRef.current.filter((image) => image.id !== id));
      setSelectedImageId((current) => (current === id ? null : current));
      latest.current.onCommit();
    },
    [setImageList],
  );

  const reorderImage = useCallback(
    (id: string, direction: 'front' | 'back') => {
      const zs = imagesRef.current.map((image) => image.z);
      const next = direction === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
      setImageList(
        imagesRef.current.map((image) => (image.id === id ? { ...image, z: next } : image)),
      );
      latest.current.onCommit();
    },
    [setImageList],
  );

  const selectImage = useCallback((id: string | null) => setSelectedImageId(id), []);

  /** 重建路径：两族分别"空才采纳"，互不影响（只有形状的新文档不会把图片列表清掉） */
  const adoptIfEmpty = useCallback(
    (next: { shapes: SheetShapeConfig[]; images: SheetImageConfig[] }) => {
      if (shapesRef.current.length === 0 && next.shapes.length > 0) {
        shapesRef.current = next.shapes;
        setShapes(next.shapes);
      }
      if (imagesRef.current.length === 0 && next.images.length > 0) {
        imagesRef.current = next.images;
        setImages(next.images);
      }
    },
    [],
  );

  const reset = useCallback((next: { shapes: SheetShapeConfig[]; images: SheetImageConfig[] }) => {
    shapesRef.current = next.shapes;
    setShapes(next.shapes);
    setSelectedShapeId(null);
    setDrawPrst(null);
    setPaletteOpen(false);
    imagesRef.current = next.images;
    setImages(next.images);
    setSelectedImageId(null);
    setImageNotice(null);
  }, []);

  return {
    shapes,
    shapesRef,
    selectedShapeId,
    selectShape,
    insertShape,
    updateShape,
    removeShape,
    reorderShape,
    paletteOpen,
    openPalette,
    closePalette,
    drawPrst,
    choosePreset,
    cancelDraw,
    images,
    imagesRef,
    selectedImageId,
    selectImage,
    imageAccept: IMAGE_ACCEPT,
    addImageFile,
    updateImage,
    removeImage,
    reorderImage,
    imageNotice,
    adoptIfEmpty,
    reset,
  };
}
