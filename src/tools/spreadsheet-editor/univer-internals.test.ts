import { describe, expect, it, vi } from 'vitest';
import { probeUniverInternals, readSheetViewport, type InternalsHost } from './univer-internals';

/**
 * 契约测试（P2-11）：内部注入器的**每一层**都可能在新版本里消失或改名，
 * 这里把每种断法的结果钉死，升级后跑一遍就知道断在哪。
 */

vi.mock('@univerjs/engine-render', () => ({
  // 只用来做 token 相等判断：真实实现里它是个类
  IRenderManagerService: { name: 'IRenderManagerService' },
  SHEET_VIEWPORT_KEY: { VIEW_MAIN: 'viewMain' },
}));

function container(rect = { left: 0, top: 0, width: 800, height: 600 }): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLElement;
}

function canvas(rect: { left: number; top: number; width: number; height: number }) {
  return {
    getBoundingClientRect: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLCanvasElement;
}

interface SceneStub {
  scaleX?: number;
  viewport?: { left?: number; top?: number } | null;
  scroll?: { x: number; y: number };
  throwOnViewport?: boolean;
  throwOnScroll?: boolean;
}

function host(options: {
  injector?: InternalsHost['__getInjector'];
  scene?: SceneStub;
  render?: unknown;
  canvasRect?: { left: number; top: number; width: number; height: number };
}): InternalsHost {
  const scene = options.scene ?? {};
  const render = options.render ?? {
    scene: {
      scaleX: scene.scaleX ?? 1,
      getViewport: () => {
        if (scene.throwOnViewport) throw new Error('no viewport api');
        return scene.viewport === null ? null : (scene.viewport ?? { left: 46, top: 24 });
      },
      getViewportScrollXY: () => {
        if (scene.throwOnScroll) throw new Error('no scroll api');
        return scene.scroll ?? { x: 0, y: 0 };
      },
    },
    engine: {
      getCanvasElement: () =>
        canvas(options.canvasRect ?? { left: 0, top: 84, width: 800, height: 600 }),
    },
  };

  const injector = () => ({
    get: () => ({ getRenderById: () => render }),
  });
  return { __getInjector: options.injector ?? injector };
}

describe('probeUniverInternals', () => {
  it('注入器还在：给出按 unitId 取 render 的能力', () => {
    const probe = probeUniverInternals(host({}));
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value.render('unit-1')).not.toBeNull();
  });

  it('没有 __getInjector（改名 / 移除）：报 missingInjector', () => {
    const probe = probeUniverInternals({});
    expect(probe).toEqual({ ok: false, code: 'missingInjector' });
  });

  it('__getInjector 抛错：报 injectorThrew 并带上原文', () => {
    const probe = probeUniverInternals({
      __getInjector: () => {
        throw new Error('boom');
      },
    });
    expect(probe.ok).toBe(false);
    if (probe.ok) return;
    expect(probe.code).toBe('injectorThrew');
    expect(probe.detail).toContain('boom');
  });

  it('注入器在、但取不到渲染服务：render 返回 null（调用方降级）', () => {
    const probe = probeUniverInternals({ __getInjector: () => ({ get: () => undefined }) });
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value.render('unit-1')).toBeNull();
  });

  it('渲染服务抛错：render 返回 null，不把异常抛给渲染循环', () => {
    const probe = probeUniverInternals({
      __getInjector: () => ({
        get: () => ({
          getRenderById: () => {
            throw new Error('nope');
          },
        }),
      }),
    });
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    expect(probe.value.render('unit-1')).toBeNull();
  });
});

describe('readSheetViewport', () => {
  it('三段偏移相加：canvas 位置 + 表头宽高 × 缩放', () => {
    const read = readSheetViewport(
      host({ scene: { viewport: { left: 46, top: 24 } } }),
      'u1',
      container(),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual({
      originX: 46,
      originY: 84 + 24,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 800 - 46,
      height: 600 - 24,
    });
  });

  it('缩放 2 倍时表头宽度同样翻倍，可视尺寸按缩放扣除', () => {
    const read = readSheetViewport(
      host({ scene: { scaleX: 2, viewport: { left: 46, top: 24 } } }),
      'u1',
      container(),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // 负的 scaleX（水平翻转）也按绝对值算，否则原点会跑到左边
    expect(read.value.zoom).toBe(2);
    expect(read.value.originX).toBe(92);
    expect(read.value.width).toBe(800 - 92);
  });

  it('scaleX 为 0 / NaN 时按 1 处理，不产生 NaN 坐标', () => {
    const read = readSheetViewport(host({ scene: { scaleX: 0 } }), 'u1', container());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.zoom).toBe(1);
    expect(Number.isFinite(read.value.originX)).toBe(true);
  });

  it('滚动量原样带出（内容 px，由调用方乘缩放）', () => {
    const read = readSheetViewport(
      host({ scene: { scroll: { x: 120, y: 340 } } }),
      'u1',
      container(),
    );
    expect(read.ok && read.value.scrollX).toBe(120);
    expect(read.ok && read.value.scrollY).toBe(340);
  });

  it('canvas 不在容器原点时，原点跟着 canvas 走（Ribbon / 公式栏的高度）', () => {
    const read = readSheetViewport(
      host({ canvasRect: { left: 12, top: 100, width: 780, height: 500 } }),
      'u1',
      container(),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.originX).toBe(12 + 46);
    expect(read.value.originY).toBe(100 + 24);
  });

  it('取不到 render：报 missingRender', () => {
    const read = readSheetViewport(
      { __getInjector: () => ({ get: () => ({ getRenderById: () => null }) }) },
      'u1',
      container(),
    );
    expect(read).toEqual({ ok: false, code: 'missingRender' });
  });

  it('取不到 viewMain 视口：报 missingViewport（旧版本可能换了 key）', () => {
    const read = readSheetViewport(host({ scene: { viewport: null } }), 'u1', container());
    expect(read).toEqual({ ok: false, code: 'missingViewport' });
  });

  it('scene 成员签名变了（抛错）：报 readThrew，不炸渲染循环', () => {
    const read = readSheetViewport(host({ scene: { throwOnViewport: true } }), 'u1', container());
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.code).toBe('readThrew');
    expect(read.detail).toContain('viewport');
  });

  it('注入器整个没了：直接把 probe 的码透出来', () => {
    const read = readSheetViewport({}, 'u1', container());
    expect(read).toEqual({ ok: false, code: 'missingInjector' });
  });
});
