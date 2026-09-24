import { describe, expect, it } from 'vitest';
import {
  BLEND_MODES,
  CANVAS_PRESETS,
  FILTERS,
  MAX_CANVAS_SIZE,
  MAX_ZOOM,
  MIN_CANVAS_SIZE,
  MIN_ZOOM,
  OVERSCROLL_SCREEN,
  bakeSignature,
  buildFilterString,
  clampScale,
  clampViewport,
  checkImageFile,
  checkProjectFile,
  clampBrushSize,
  clampPercent,
  clampRect,
  clampUnit,
  computeFitScale,
  effectiveLocked,
  effectiveVisible,
  flattenStack,
  historyTimeline,
  layerAssetIds,
  maskSignature,
  moveSubtree,
  subtreeIdsOf,
  formatBytes,
  fullSelection,
  hexToRgb,
  intersectRect,
  invertSelection,
  needsPixelPass,
  normalizeRect,
  pointInSelection,
  polygonBounds,
  rgbToHex,
  sanitizeFilename,
  scrollMetrics,
  selectionPolygon,
  simplifyPath,
  viewportFromScroll,
  zoomAtPoint,
} from './core';
import { createAdjustments } from './model/factory';
import { photoStrings } from './strings';
import type { Selection } from './model/types';
import type { GroupLayer, HistoryEntry, HistoryLabel, Layer, PhotoDoc } from './model/types';

describe('钳制与格式化', () => {
  it('笔刷尺寸落在合法区间，非法值回落最小值', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(9999)).toBe(400);
    expect(clampBrushSize(Number.NaN)).toBe(1);
    expect(clampBrushSize(12.6)).toBe(13);
  });

  it('百分比与不透明度按区间取整', () => {
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(-120)).toBe(-100);
    expect(clampUnit(1.8)).toBe(1);
    expect(clampUnit(0.456)).toBe(0.46);
  });

  it('文件名清洗掉路径分隔符', () => {
    expect(sanitizeFilename('a/b:c*d?')).toBe('a-b-c-d-');
    expect(sanitizeFilename('   ')).toBe('photo');
  });

  it('字节格式化', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB');
  });
});

describe('颜色', () => {
  it('hex 与 rgb 互转', () => {
    expect(hexToRgb('#2563EB')).toEqual({ r: 37, g: 99, b: 235 });
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('nope')).toBeNull();
    expect(rgbToHex(37, 99, 235)).toBe('#2563EB');
  });
});

describe('调整参数 → 滤镜管线', () => {
  it('默认参数不产生任何 CSS filter', () => {
    expect(buildFilterString(createAdjustments())).toBe('');
  });

  it('亮度与曝光叠加，色相单独成段', () => {
    const result = buildFilterString({
      ...createAdjustments(),
      brightness: 20,
      hue: 90,
      saturation: -50,
    });
    expect(result).toContain('brightness(1.2)');
    expect(result).toContain('hue-rotate(90deg)');
    expect(result).toContain('saturate(0.5)');
  });

  it('色温 / 锐化 / 非 CSS 滤镜需要像素通道', () => {
    expect(needsPixelPass(createAdjustments(), ['grayscale'])).toBe(false);
    expect(needsPixelPass({ ...createAdjustments(), temperature: 10 }, [])).toBe(true);
    expect(needsPixelPass({ ...createAdjustments(), sharpen: 40 }, [])).toBe(true);
    expect(needsPixelPass(createAdjustments(), ['pixelate'])).toBe(true);
  });

  it('烘焙签名随参数与版本号变化', () => {
    const base = bakeSignature('asset-1', 1, createAdjustments(), []);
    const revChanged = bakeSignature('asset-1', 2, createAdjustments(), []);
    const paramChanged = bakeSignature(
      'asset-1',
      1,
      { ...createAdjustments(), brightness: 10 },
      [],
    );
    expect(base).not.toBe(revChanged);
    expect(base).not.toBe(paramChanged);
  });
});

describe('几何', () => {
  it('拖拽矩形归一化为正数宽高', () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });

  it('矩形被裁剪到画布内', () => {
    const clamped = clampRect(
      { x: -10, y: 90, width: 100, height: 100 },
      { width: 100, height: 100 },
    );
    expect(clamped).toEqual({ x: 0, y: 90, width: 100, height: 10 });
  });

  it('相交与不相交', () => {
    expect(
      intersectRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toEqual({
      x: 5,
      y: 5,
      width: 5,
      height: 5,
    });
    expect(
      intersectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBeNull();
  });

  it('适配缩放留出边距且不放大小图', () => {
    // 可宽 460 / 可高 260 → 取较小的 0.46
    expect(
      computeFitScale({ width: 1000, height: 500 }, { width: 500, height: 300 }, 20),
    ).toBeCloseTo(0.46, 2);
    expect(computeFitScale({ width: 100, height: 100 }, { width: 1000, height: 1000 }, 20)).toBe(1);
  });

  it('套索顶点抽稀并计算外接矩形', () => {
    const path = [0, 0, 1, 0, 2, 0, 3, 0, 30, 20];
    expect(simplifyPath(path).length).toBeLessThan(path.length);
    expect(polygonBounds([0, 0, 10, 20])).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });
});

describe('选区命中', () => {
  const rect: Selection = {
    kind: 'rect',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    path: [],
    feather: 0,
  };
  const ellipse: Selection = { ...rect, kind: 'ellipse' };
  const lasso: Selection = {
    ...rect,
    kind: 'lasso',
    path: [0, 0, 100, 0, 100, 50, 0, 50],
  };

  it('矩形选区按外接矩形判定', () => {
    expect(pointInSelection(rect, 50, 25)).toBe(true);
    expect(pointInSelection(rect, 120, 25)).toBe(false);
  });

  it('椭圆选区排除四角', () => {
    expect(pointInSelection(ellipse, 50, 25)).toBe(true);
    expect(pointInSelection(ellipse, 2, 2)).toBe(false);
  });

  it('套索按多边形判定', () => {
    expect(pointInSelection(lasso, 50, 25)).toBe(true);
    expect(pointInSelection(lasso, -5, 25)).toBe(false);
  });
});

describe('视口滚动与缩放', () => {
  const doc = { width: 1280, height: 720 };
  const size = { width: 650, height: 518 };

  it('缩放钳制在上下限内，非法值回落下限', () => {
    expect(clampScale(100)).toBe(MAX_ZOOM);
    expect(clampScale(0.0001)).toBe(MIN_ZOOM);
    expect(clampScale(Number.NaN)).toBe(MIN_ZOOM);
    expect(clampScale(0.5)).toBe(0.5);
  });

  it('内容装不下时产生滚动范围，装得下时为 0', () => {
    // 100%：1280×720 画布放进 650×518 视口 → 两轴都能滚
    const big = scrollMetrics(doc, { ...size, scale: 1, x: 0, y: 0 });
    expect(big.rangeX).toBeGreaterThan(0);
    expect(big.rangeY).toBeGreaterThan(0);
    expect(big.worldW).toBe(1280 + 2 * OVERSCROLL_SCREEN);
    expect(big.worldW - big.rangeX).toBeCloseTo(big.viewW, 5);

    // 5%：整幅画布都在视口里 → 范围为 0（滚动条不显示）
    const small = scrollMetrics(doc, { ...size, scale: 0.05, x: 0, y: 0 });
    expect(small.rangeX).toBe(0);
    expect(small.rangeY).toBe(0);
  });

  it('视口位置被钳制在世界范围内', () => {
    const metrics = scrollMetrics(doc, { ...size, scale: 1, x: 99999, y: -99999 });
    expect(metrics.left).toBe(metrics.worldLeft);
    expect(metrics.top).toBe(metrics.worldTop + metrics.rangeY);

    const clamped = clampViewport({ x: -99999, y: 99999, scale: 1 }, doc, size);
    expect(clamped.x).toBe(-(metrics.worldLeft + metrics.rangeX));
    expect(clamped.y).toBe(-metrics.worldTop);
  });

  it('世界坐标 ↔ 屏幕平移互为逆运算（允许整数像素取整误差）', () => {
    // 取范围内部的值：世界坐标 [-320, 300]（横向）/ [-320, 4]（纵向）
    const { x, y } = viewportFromScroll(-100, -100, 0.5);
    expect({ x, y }).toEqual({ x: 50, y: 50 });

    const back = scrollMetrics(doc, { ...size, scale: 0.5, x, y });
    // 屏幕像素取整 → 换算回文档单位最多差 1/scale
    expect(Math.abs(back.left + 100)).toBeLessThanOrEqual(1 / 0.5);
    expect(Math.abs(back.top + 100)).toBeLessThanOrEqual(1 / 0.5);
  });

  it('以光标为锚点缩放：锚点下的文档坐标保持不动', () => {
    const before = { x: 28, y: 92, scale: 0.5 };
    const anchor = { x: 300, y: 200 };
    const docX = (anchor.x - before.x) / before.scale;
    const docY = (anchor.y - before.y) / before.scale;

    const next = zoomAtPoint(before, 1.25, anchor);
    expect(next.scale).toBe(1.25);
    expect((anchor.x - next.x) / next.scale).toBeCloseTo(docX, 3);
    expect((anchor.y - next.y) / next.scale).toBeCloseTo(docY, 3);
  });

  it('锚点缩放同样受上下限约束', () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 1 }, 100, { x: 0, y: 0 });
    expect(next.scale).toBe(MAX_ZOOM);
  });
});

describe('选区续操作辅助', () => {
  const canvas = { width: 200, height: 100 };
  const rect: Selection = {
    kind: 'rect',
    x: 50,
    y: 25,
    width: 100,
    height: 50,
    path: [],
    feather: 0,
  };

  it('全选覆盖整块画布', () => {
    const all = fullSelection(canvas);
    expect(all.kind).toBe('rect');
    expect(all.width).toBe(200);
    expect(pointInSelection(all, 199, 99)).toBe(true);
  });

  it('反选：原选区内变成「洞」，其余区域命中', () => {
    const inverted = invertSelection(rect, canvas);
    expect(inverted.hole?.length).toBeGreaterThan(0);
    // 原选区中心落在洞里 → 不属于反选结果
    expect(pointInSelection(inverted, 100, 50)).toBe(false);
    // 画布其它位置属于反选结果
    expect(pointInSelection(inverted, 10, 10)).toBe(true);
    expect(pointInSelection(inverted, 190, 90)).toBe(true);
  });

  it('椭圆选区转多边形顶点（32 边）', () => {
    const points = selectionPolygon({ ...rect, kind: 'ellipse' });
    expect(points.length).toBe(64);
  });

  it('矩形选区转多边形顶点', () => {
    expect(selectionPolygon(rect)).toEqual([50, 25, 150, 25, 150, 75, 50, 75]);
  });
});

describe('文件校验', () => {
  it('图片扩展名 / 空文件 / 超限', () => {
    expect(checkImageFile({ name: 'a.png', size: 1024 }).ok).toBe(true);
    expect(checkImageFile({ name: 'a.txt', size: 1024 })).toEqual({
      ok: false,
      error: 'NOT_IMAGE',
    });
    expect(checkImageFile({ name: 'a.png', size: 0 })).toEqual({ ok: false, error: 'EMPTY' });
    const tooLarge = checkImageFile({ name: 'a.jpg', size: 40 * 1024 * 1024 });
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.params?.max).toBe(30);
  });

  it('工程文件必须是 json', () => {
    expect(checkProjectFile({ name: 'a.photo.json', size: 100 }).ok).toBe(true);
    expect(checkProjectFile({ name: 'a.png', size: 100 })).toEqual({
      ok: false,
      error: 'NOT_PROJECT',
    });
  });
});

describe('文案完整性', () => {
  const flatten = (tree: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key}`]
        : flatten(value as Record<string, unknown>, `${prefix}${key}.`),
    );

  it('九种语言与简体中文的键集合完全一致（防止漏翻）', () => {
    const keys = Object.keys(photoStrings);
    expect(keys).toHaveLength(9);

    const base = flatten(photoStrings.zh).sort();
    expect(base.length).toBeGreaterThan(120);
    for (const [lang, tree] of Object.entries(photoStrings)) {
      expect({ lang, keys: flatten(tree).sort() }).toEqual({ lang, keys: base });
    }
  });

  it('每种语言都没有空文案', () => {
    const values = (tree: Record<string, unknown>): string[] =>
      Object.values(tree).flatMap((value) =>
        typeof value === 'string' ? [value] : values(value as Record<string, unknown>),
      );

    for (const [lang, tree] of Object.entries(photoStrings)) {
      expect({ lang, empty: values(tree).filter((text) => !text.trim()) }).toEqual({
        lang,
        empty: [],
      });
    }
  });
});

describe('工具常量', () => {
  it('预设尺寸都在合法范围内', () => {
    for (const preset of CANVAS_PRESETS) {
      expect(preset.width).toBeGreaterThanOrEqual(MIN_CANVAS_SIZE);
      expect(preset.height).toBeLessThanOrEqual(MAX_CANVAS_SIZE);
    }
  });

  it('混合模式与滤镜枚举可用于下拉', () => {
    expect(BLEND_MODES[0]).toBe('normal');
    expect(FILTERS.length).toBeGreaterThanOrEqual(10);
    expect(FILTERS).toContain('grayscale');
  });
});

describe('层栈展开与继承（编组 / 蒙版前置）', () => {
  const base = {
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
  };

  function makeDoc(layers: Layer[]): PhotoDoc {
    return {
      id: 'd',
      name: '',
      width: 800,
      height: 600,
      background: 'white',
      layers,
      activeLayerId: null,
    };
  }

  const raster = (id: string, patch: Partial<Layer> = {}): Layer =>
    ({
      ...base,
      id,
      kind: 'raster',
      assetId: `a-${id}`,
      rev: 1,
      adjustments: {} as never,
      filters: [],
      ...patch,
    }) as Layer;
  const group = (id: string, patch: Partial<Layer> = {}): Layer =>
    ({ ...base, id, kind: 'group', passThrough: true, ...patch }) as Layer;

  it('扁平层栈按 parentId 展开成 begin/end 包裹的序列', () => {
    const doc = makeDoc([
      raster('bottom'),
      group('g', { parentId: null }),
      raster('in1', { parentId: 'g' }),
      raster('in2', { parentId: 'g' }),
      raster('top'),
    ]);
    const steps = flattenStack(doc);
    expect(steps.map((step) => `${step.kind}:${step.layer.id}`)).toEqual([
      'layer:bottom',
      'group-begin:g',
      'layer:in1',
      'layer:in2',
      'group-end:g',
      'layer:top',
    ]);
  });

  it('组可以嵌套，空组也成对出现', () => {
    const doc = makeDoc([
      group('outer'),
      group('inner', { parentId: 'outer' }),
      raster('deep', { parentId: 'inner' }),
      group('empty', { parentId: 'outer' }),
    ]);
    expect(flattenStack(doc).map((step) => `${step.kind}:${step.layer.id}`)).toEqual([
      'group-begin:outer',
      'group-begin:inner',
      'layer:deep',
      'group-end:inner',
      'group-begin:empty',
      'group-end:empty',
      'group-end:outer',
    ]);
  });

  it('parentId 指向缺失图层时该图层降级为顶层，不会消失', () => {
    const doc = makeDoc([raster('orphan', { parentId: 'ghost' })]);
    expect(flattenStack(doc).map((step) => step.layer.id)).toEqual(['orphan']);
  });

  it('可见性 / 锁定沿祖先继承', () => {
    const doc = makeDoc([
      group('g', { visible: false }),
      raster('child', { parentId: 'g' }),
      raster('free'),
    ]);
    const child = doc.layers[1];
    const free = doc.layers[2];
    expect(effectiveVisible(doc, child)).toBe(false);
    expect(effectiveVisible(doc, free)).toBe(true);

    const lockedDoc = makeDoc([group('g', { locked: true }), raster('child', { parentId: 'g' })]);
    expect(effectiveLocked(lockedDoc, lockedDoc.layers[1])).toBe(true);
    expect(effectiveLocked(doc, free)).toBe(false);
  });

  it('自身不可见 / 锁定同样生效', () => {
    const doc = makeDoc([raster('a', { visible: false }), raster('b', { locked: true })]);
    expect(effectiveVisible(doc, doc.layers[0])).toBe(false);
    expect(effectiveLocked(doc, doc.layers[1])).toBe(true);
  });

  it('蒙版签名：无蒙版 / 停用为 null，像素或参数变化就换键', () => {
    const plain = raster('a');
    expect(maskSignature(plain)).toBeNull();

    const masked = raster('b', {
      mask: { assetId: 'm1', rev: 2, enabled: true, inverted: false, density: 1, feather: 3 },
    });
    const key = maskSignature(masked)!;
    expect(key).toContain('m1');
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, enabled: false } }))).toBeNull();
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, rev: 3 } }))).not.toBe(key);
    expect(maskSignature(raster('b', { mask: { ...masked.mask!, inverted: true } }))).not.toBe(key);
  });

  it('资产收集覆盖位图、智能对象源与蒙版', () => {
    expect(layerAssetIds(raster('a'))).toEqual(['a-a']);
    expect(
      layerAssetIds({
        ...base,
        id: 's',
        kind: 'smart',
        sourceAssetId: 'src',
        sourceWidth: 10,
        sourceHeight: 10,
        mask: { assetId: 'm', rev: 1, enabled: true, inverted: false, density: 1, feather: 0 },
      } as Layer),
    ).toEqual(['src', 'm']);
    expect(layerAssetIds(group('g'))).toEqual([]);
  });
});

describe('历史时间轴（面板数据源）', () => {
  const entry = (label: HistoryLabel, at: number): HistoryEntry => ({
    doc: {
      id: 'd',
      name: '',
      width: 10,
      height: 10,
      background: 'white',
      layers: [],
      activeLayerId: null,
    },
    label,
    at,
  });

  it('只有当前状态时是一行「打开文档」', () => {
    const rows = historyTimeline([], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'histOpen', current: true });
  });

  it('每行展示「产生该状态的操作名」，当前行取最后一次操作', () => {
    const rows = historyTimeline([entry('histAddLayer', 100), entry('histBrush', 200)], []);
    expect(rows.map((row) => row.label)).toEqual(['histOpen', 'histAddLayer', 'histBrush']);
    expect(rows.map((row) => row.current)).toEqual([false, false, true]);
  });

  it('可重做的行排在末尾且标记为非当前', () => {
    const rows = historyTimeline([entry('histBrush', 100)], [entry('histBrush', 300)]);
    expect(rows).toHaveLength(3);
    expect(rows[1].current).toBe(true);
    expect(rows[2]).toMatchObject({ label: 'histBrush', current: false });
  });

  it('行索引即 jumpTo 的目标：past.length 为当前', () => {
    const past = [entry('histAddLayer', 1), entry('histMerge', 2)];
    const rows = historyTimeline(past, []);
    expect(rows.findIndex((row) => row.current)).toBe(past.length);
  });
});

describe('编组层栈操作（纯函数）', () => {
  const base = {
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
  const leaf = (id: string, parentId: string | null = null): Layer =>
    ({
      ...base,
      id,
      kind: 'raster',
      parentId,
      assetId: `a-${id}`,
      rev: 1,
      adjustments: {} as never,
      filters: [],
    }) as Layer;
  const grp = (id: string, parentId: string | null = null, passThrough = true): GroupLayer =>
    ({ ...base, id, kind: 'group', parentId, passThrough }) as GroupLayer;

  const docOf = (layers: Layer[]): PhotoDoc => ({
    id: 'd',
    name: '',
    width: 800,
    height: 600,
    background: 'white',
    layers,
    activeLayerId: null,
  });

  it('子树包含自身与全部后代', () => {
    const doc = docOf([grp('g'), leaf('c1', 'g'), grp('g2', 'g'), leaf('c2', 'g2'), leaf('out')]);
    expect(subtreeIdsOf(doc, 'g')).toEqual(['g', 'c1', 'g2', 'c2']);
    expect(subtreeIdsOf(doc, 'out')).toEqual(['out']);
  });

  it('移入编组：图层连同子树紧跟编组之后，且 parentId 更新', () => {
    const doc = docOf([leaf('a'), grp('g'), leaf('b')]);
    const next = moveSubtree(doc.layers, 'a', 'g');
    expect(next.map((l) => l.id)).toEqual(['g', 'a', 'b']);
    expect(next.find((l) => l.id === 'a')!.parentId).toBe('g');
  });

  it('移到顶层：落在数组末尾（最上层）', () => {
    const doc = docOf([grp('g'), leaf('c', 'g'), leaf('b')]);
    const next = moveSubtree(doc.layers, 'c', null);
    expect(next.map((l) => l.id)).toEqual(['g', 'b', 'c']);
    expect(next.find((l) => l.id === 'c')!.parentId).toBeNull();
  });

  it('移动编组会带着整棵子树', () => {
    const doc = docOf([leaf('bottom'), grp('g'), leaf('c1', 'g'), leaf('c2', 'g'), leaf('top')]);
    const next = moveSubtree(doc.layers, 'g', null);
    expect(next.map((l) => l.id)).toEqual(['bottom', 'top', 'g', 'c1', 'c2']);
  });

  it('拒绝把编组移入自己的后代（否则成环）', () => {
    const layers = [grp('g'), grp('inner', 'g'), leaf('c', 'inner')];
    expect(moveSubtree(layers, 'g', 'inner')).toBe(layers);
    expect(moveSubtree(layers, 'g', 'g')).toBe(layers);
  });

  it('目标父级不存在时原样返回', () => {
    const layers = [leaf('a')];
    expect(moveSubtree(layers, 'a', 'ghost')).toBe(layers);
  });

  it('纯函数：不修改入参数组', () => {
    const layers = [grp('g'), leaf('a')];
    moveSubtree(layers, 'a', 'g');
    expect(layers.map((l) => l.id)).toEqual(['g', 'a']);
    expect(layers[1].parentId).toBeNull();
  });
});
