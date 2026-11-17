import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fitImageSize, MAX_IMAGE_BYTES } from '../sheetImages';
import { buildSheetLayout, type SheetShapeConfig } from '../shapes';
import { useSheetObjects, type ObjectEngine, type UseSheetObjectsOptions } from './useSheetObjects';

const files = vi.hoisted(() => ({
  readFileAsDataUrl: vi.fn(),
  measureImage: vi.fn(),
}));

vi.mock('../imageSource', () => ({
  readFileAsDataUrl: files.readFileAsDataUrl,
  measureImage: files.measureImage,
}));

const PNG = 'data:image/png;base64,AAAA';
const FROM = { col: 1, row: 2, colOff: 0, rowOff: 0 };

function fakeEngine(overrides: Partial<ObjectEngine> = {}): ObjectEngine {
  return {
    getActiveSheetId: () => 's1',
    getActiveRange: () => ({ startRow: 3, startColumn: 2 }),
    ...overrides,
  };
}

function setup(overrides: Partial<UseSheetObjectsOptions> = {}) {
  const handleRef = { current: fakeEngine() as ObjectEngine | null };
  const onCommit = vi.fn();
  const options: UseSheetObjectsOptions = {
    handleRef,
    layoutRef: { current: buildSheetLayout(undefined) },
    onCommit,
    messages: { imageTooLarge: '图太大', imageReadFailed: '读不出来' },
    ...overrides,
  };
  const view = renderHook(() => useSheetObjects(options));
  return { view, handleRef, onCommit };
}

function fileOf(size: number, name = 'cat.png'): File {
  return { name, size } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  files.readFileAsDataUrl.mockResolvedValue(PNG);
  files.measureImage.mockResolvedValue({ width: 640, height: 480 });
});

describe('useSheetObjects（形状）', () => {
  it('插入形状：层级高于现有最大值、自动选中、收起面板、退出绘制、落盘', () => {
    const { view, onCommit } = setup();
    act(() => view.result.current.insertShape('roundRect', FROM));
    act(() => view.result.current.insertShape('ellipse', FROM));

    const [first, second] = view.result.current.shapes;
    expect(second.z).toBeGreaterThan(first.z);
    expect(view.result.current.selectedShapeId).toBe(second.id);
    expect(view.result.current.paletteOpen).toBe(false);
    expect(view.result.current.drawPrst).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('引擎未就绪：不建形状、不落盘', () => {
    const { view, onCommit } = setup({ handleRef: { current: null } });
    act(() => view.result.current.insertShape('rect', FROM));
    expect(view.result.current.shapes).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('删除形状时清掉选中态，删的不是选中项则保持', () => {
    const { view } = setup();
    act(() => view.result.current.insertShape('rect', FROM));
    const first = view.result.current.shapes[0].id;
    act(() => view.result.current.insertShape('rect', FROM));
    const second = view.result.current.shapes[1].id;

    act(() => view.result.current.removeShape(first));
    expect(view.result.current.selectedShapeId).toBe(second);

    act(() => view.result.current.removeShape(second));
    expect(view.result.current.selectedShapeId).toBeNull();
  });

  it('层级调整：前移比最大 z 高一步，后移比最小 z 低一步', () => {
    const { view } = setup();
    act(() => view.result.current.insertShape('rect', FROM));
    const id = view.result.current.shapes[0].id;
    const baseZ = view.result.current.shapes[0].z;

    act(() => view.result.current.reorderShape(id, 'front'));
    expect(view.result.current.shapes[0].z).toBeGreaterThan(baseZ);

    act(() => view.result.current.reorderShape(id, 'back'));
    expect(view.result.current.shapes[0].z).toBeLessThan(0);
  });

  it('形状库：选择样式后进入绘制模式，取消绘制只是清掉状态', () => {
    const { view } = setup();
    act(() => view.result.current.openPalette());
    expect(view.result.current.paletteOpen).toBe(true);

    act(() => view.result.current.choosePreset('star5'));
    expect(view.result.current.paletteOpen).toBe(false);
    expect(view.result.current.drawPrst).toBe('star5');

    act(() => view.result.current.cancelDraw());
    expect(view.result.current.drawPrst).toBeNull();
  });
});

describe('useSheetObjects（图片）', () => {
  it('超过体积上限：给提示，不读取也不插入', async () => {
    const { view, onCommit } = setup();
    await act(() => view.result.current.addImageFile(fileOf(MAX_IMAGE_BYTES + 1)));
    expect(view.result.current.imageNotice).toBe('图太大');
    expect(files.readFileAsDataUrl).not.toHaveBeenCalled();
    expect(view.result.current.images).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('读取失败：给提示，不留半张图', async () => {
    files.readFileAsDataUrl.mockRejectedValue(new Error('nope'));
    const { view, onCommit } = setup();
    await act(() => view.result.current.addImageFile(fileOf(1024)));
    expect(view.result.current.imageNotice).toBe('读不出来');
    expect(view.result.current.images).toHaveLength(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('不是合法 dataURL（如读回来是空串）：同样拒绝', async () => {
    files.readFileAsDataUrl.mockResolvedValue('');
    const { view } = setup();
    await act(() => view.result.current.addImageFile(fileOf(1024)));
    expect(view.result.current.imageNotice).toBe('读不出来');
    expect(view.result.current.images).toHaveLength(0);
  });

  it('插入成功：按原始比例缩到插入上限，锚在当前选区、自动选中并落盘', async () => {
    const { view, onCommit } = setup();
    await act(() => view.result.current.addImageFile(fileOf(2048, 'cat.png')));

    const image = view.result.current.images[0];
    expect(image.src).toBe(PNG);
    expect(image.name).toBe('cat.png');
    expect({ width: image.width, height: image.height }).toEqual(fitImageSize(640, 480));
    expect(image.from).toEqual({ col: 2, row: 3, colOff: 8, rowOff: 8 });
    expect(view.result.current.selectedImageId).toBe(image.id);
    expect(view.result.current.imageNotice).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('没有选区时退回固定锚点（pxToAnchor），不报错', async () => {
    const { view } = setup({
      handleRef: { current: fakeEngine({ getActiveRange: () => null }) },
    });
    await act(() => view.result.current.addImageFile(fileOf(2048)));
    expect(view.result.current.images).toHaveLength(1);
  });

  it('更新 / 删除 / 层级调整都只动目标图', async () => {
    const { view } = setup();
    await act(() => view.result.current.addImageFile(fileOf(2048, 'a.png')));
    await act(() => view.result.current.addImageFile(fileOf(2048, 'b.png')));
    const [first, second] = view.result.current.images;

    act(() => view.result.current.updateImage(first.id, { name: 'renamed.png' }));
    expect(view.result.current.images[0].name).toBe('renamed.png');
    expect(view.result.current.images[1].name).toBe('b.png');

    act(() => view.result.current.reorderImage(second.id, 'front'));
    expect(view.result.current.images[1].z).toBeGreaterThan(view.result.current.images[0].z);

    act(() => view.result.current.removeImage(second.id));
    expect(view.result.current.images).toHaveLength(1);
    expect(view.result.current.selectedImageId).toBeNull();
  });
});

describe('useSheetObjects（采纳规则）', () => {
  it('重建：两族各自"空才采纳"，已有内容的不会被覆盖', () => {
    const { view } = setup();
    act(() => view.result.current.insertShape('rect', FROM));

    const snapshotShape = { id: 'shape-from-snapshot' } as SheetShapeConfig;
    act(() =>
      view.result.current.adoptIfEmpty({
        shapes: [snapshotShape],
        images: [{ id: 'image-from-snapshot' } as never],
      }),
    );
    expect(view.result.current.shapes[0].id).not.toBe('shape-from-snapshot');
    // 图片列表是空的，所以图片会被采纳
    expect(view.result.current.images[0].id).toBe('image-from-snapshot');
  });

  it('换文档：无条件替换，并把选中态 / 绘制模式 / 提示一起清掉', async () => {
    const { view } = setup();
    act(() => view.result.current.insertShape('rect', FROM));
    act(() => view.result.current.choosePreset('star5'));
    await act(() => view.result.current.addImageFile(fileOf(MAX_IMAGE_BYTES + 1)));

    act(() =>
      view.result.current.reset({
        shapes: [{ id: 'next-shape' } as SheetShapeConfig],
        images: [],
      }),
    );
    expect(view.result.current.shapes.map((item) => item.id)).toEqual(['next-shape']);
    expect(view.result.current.images).toHaveLength(0);
    expect(view.result.current.selectedShapeId).toBeNull();
    expect(view.result.current.drawPrst).toBeNull();
    expect(view.result.current.selectedImageId).toBeNull();
    expect(view.result.current.imageNotice).toBeNull();
  });

  it('图片文件对话框接受这几类图片', () => {
    const { view } = setup();
    expect(view.result.current.imageAccept).toContain('.png');
    expect(view.result.current.imageAccept).toContain('image/webp');
  });

  it('图片插入后 ref 与 state 同源（快照合成读到的就是最新的）', async () => {
    const { view } = setup();
    await act(() => view.result.current.addImageFile(fileOf(2048)));
    await waitFor(() =>
      expect(view.result.current.imagesRef.current).toEqual(view.result.current.images),
    );
  });
});
