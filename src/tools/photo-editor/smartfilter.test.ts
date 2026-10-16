import { describe, expect, it } from 'vitest';
import {
  NO_ADJUSTMENTS,
  activeFilters,
  bakeSignature,
  hasActiveFilters,
  needsPixelPass,
} from './core';
import { createSmartLayer } from './model/factory';
import { migrateDoc } from './model/migrate';
import { layerNeedsComposite } from './render/paint';
import type { FilterSpec, PhotoDoc, SmartLayer } from './model/types';

const docStub = { width: 200, height: 200 } as PhotoDoc;

const blur = (patch: Partial<FilterSpec> = {}): FilterSpec => ({
  id: 'gaussianBlur',
  params: { radius: 8 },
  ...patch,
});

const smart = (filters: FilterSpec[]): SmartLayer => ({
  ...createSmartLayer({
    doc: docStub,
    sourceAssetId: 'src',
    sourceWidth: 100,
    sourceHeight: 100,
  }),
  filters,
});

describe('activeFilters：启停语义', () => {
  it('缺省（没有 enabled 字段）视为启用', () => {
    expect(activeFilters([{ id: 'blur', params: { radius: 4 } }])).toHaveLength(1);
  });

  it('enabled: false 的滤镜被排除，但参数仍留在原列表里', () => {
    const filters: FilterSpec[] = [blur(), { id: 'noise', params: { amount: 10 }, enabled: false }];
    expect(activeFilters(filters)).toHaveLength(1);
    expect(activeFilters(filters)[0].id).toBe('gaussianBlur');
    // 面板还要继续显示被停用的那一项，所以原数组不能被就地改写
    expect(filters).toHaveLength(2);
  });

  it('空列表 / null / undefined 都安全', () => {
    expect(activeFilters([])).toEqual([]);
    expect(activeFilters(null)).toEqual([]);
    expect(activeFilters(undefined)).toEqual([]);
  });

  it('hasActiveFilters 反映是否还有启用中的滤镜', () => {
    expect(hasActiveFilters([blur()])).toBe(true);
    expect(hasActiveFilters([blur({ enabled: false })])).toBe(false);
    expect(hasActiveFilters([])).toBe(false);
  });
});

describe('停用滤镜后不再参与烘焙', () => {
  it('全部停用时不需要像素通道', () => {
    const filters: FilterSpec[] = [
      blur({ enabled: false }),
      { id: 'unsharp', params: { radius: 4, amount: 100 }, enabled: false },
    ];
    expect(needsPixelPass(NO_ADJUSTMENTS, filters)).toBe(false);
  });

  it('启用像素级滤镜（USM）时走像素通道', () => {
    expect(
      needsPixelPass(NO_ADJUSTMENTS, [{ id: 'unsharp', params: { radius: 4, amount: 100 } }]),
    ).toBe(true);
  });
});

describe('缓存签名对启停敏感', () => {
  it('同一份滤镜，启用与停用产生不同签名（否则画面不会刷新）', () => {
    const on = bakeSignature('a1', 1, NO_ADJUSTMENTS, [blur()]);
    const off = bakeSignature('a1', 1, NO_ADJUSTMENTS, [blur({ enabled: false })]);
    expect(on).not.toBe(off);
  });

  it('参数键序不同但内容相同的滤镜签名一致', () => {
    const a = bakeSignature('a1', 1, NO_ADJUSTMENTS, [
      { id: 'noise', params: { amount: 10, mono: 1 } },
    ]);
    const b = bakeSignature('a1', 1, NO_ADJUSTMENTS, [
      { id: 'noise', params: { mono: 1, amount: 10 } },
    ]);
    expect(a).toBe(b);
  });

  it('NO_ADJUSTMENTS 等价于「不调整」', () => {
    expect(needsPixelPass(NO_ADJUSTMENTS, [])).toBe(false);
  });
});

describe('智能滤镜决定预览是否走离屏合成', () => {
  it('有启用中的滤镜时要合成（否则 Konva 直接画源图，滤镜不可见）', () => {
    expect(layerNeedsComposite(smart([blur()]))).toBe(true);
  });

  it('没有滤镜或全部停用时保持轻量路径', () => {
    expect(layerNeedsComposite(smart([]))).toBe(false);
    expect(layerNeedsComposite(smart([blur({ enabled: false })]))).toBe(false);
  });
});

describe('migrateDoc：智能滤镜栈归一', () => {
  const raw = (filters: unknown) => ({
    id: 'doc-1',
    name: 'n',
    width: 200,
    height: 200,
    background: 'white',
    layers: [
      {
        id: 's1',
        kind: 'smart',
        name: '',
        visible: true,
        locked: false,
        opacity: 1,
        blend: 'normal',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        sourceAssetId: 'src',
        sourceWidth: 100,
        sourceHeight: 100,
        filters,
      },
    ],
  });

  function parse(input: unknown): PhotoDoc {
    const parsed = migrateDoc(input);
    if (!parsed) throw new Error('migrateDoc 返回 null');
    return parsed;
  }

  it('旧工程没有 filters 字段时补成空栈', () => {
    const parsed = parse(raw(undefined));
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toEqual([]);
    expect(layerNeedsComposite(layer)).toBe(false);
  });

  it('保留 enabled: false 并补齐缺省参数', () => {
    const parsed = parse(raw([{ id: 'gaussianBlur', params: { radius: 12 }, enabled: false }]));
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toHaveLength(1);
    expect(layer.filters[0].enabled).toBe(false);
    expect(layer.filters[0].params?.radius).toBe(12);
    // 启用中的滤镜缺省写入时不带 enabled 字段
    const enabled = parse(raw([{ id: 'gaussianBlur', params: { radius: 12 } }]));
    expect((enabled.layers[0] as SmartLayer).filters[0].enabled).toBeUndefined();
  });

  it('未知滤镜 id 与非法参数被丢弃 / 钳制', () => {
    const parsed = parse(
      raw([{ id: 'notAFilter' }, { id: 'gaussianBlur', params: { radius: 99999 } }]),
    );
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toHaveLength(1);
    expect(layer.filters[0].id).toBe('gaussianBlur');
    expect(layer.filters[0].params?.radius).toBeLessThan(99999);
  });
});
