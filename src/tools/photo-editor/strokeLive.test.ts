import { describe, expect, it, vi } from 'vitest';

/**
 * 落笔的**实时性**契约测试。
 *
 * 背景（真实回归）：画布刷新是「从图层位图重新取图」，因此**位图必须在落笔过程中就拿到新像素**。
 * 曾经为了「重叠印章不叠深」把整条笔迹先画进独立缓冲、只在松手时合成回位图 ——
 * 语义对了，但位图在落笔期间一直没变，用户看到的是「画完才刷新」。
 * 当时的测试全是纯函数（步进、间距、遮罩），**没有一条能发现这个问题**，所以在这里补上。
 *
 * 做法：把 `model/assets` 换成「记录调用」的画布替身，只断言「谁在什么时候被画」，
 * 不依赖真实 2D 上下文（jsdom 没有）。
 *
 * 术语：**落点** = 一次 `move()`；**间距模式** 用 `MIN_SPACING` 走连续描边（不建笔尖 sprite），
 * 大间距走盖章（会额外建一张 sprite 画布），两条分支都要覆盖。
 */

const harness = vi.hoisted(() => {
  interface Recorder {
    calls: string[];
    canvas: { width: number; height: number; getContext: () => unknown };
  }
  const make = (): Recorder => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        // 只关心「调了哪个方法」与「写了哪个属性」，参数与返回值都不需要
        get: (_target, prop) => () => {
          calls.push(String(prop));
        },
        // 属性写入也要留痕：合成方式（copy / source-over / destination-out）只能这样断言
        set: (_target, prop, value) => {
          calls.push(`set:${String(prop)}=${String(value)}`);
          return true;
        },
      },
    );
    const canvas = { width: 100, height: 100, getContext: () => ctx };
    return { calls, canvas };
  };
  return {
    make,
    /** 图层位图（`getCanvas` 返回它） */
    asset: null as Recorder | null,
    /** 笔迹过程中新建的临时画布（笔尖 sprite / 缓冲 / 落笔前快照） */
    created: [] as Recorder[],
  };
});

vi.mock('./model/assets', () => ({
  getCanvas: (id: string) => (id === 'layer-asset' ? harness.asset?.canvas : undefined),
  createCanvasElement: () => {
    const recorder = harness.make();
    harness.created.push(recorder);
    return recorder.canvas;
  },
}));

const { createStrokeSession } = await import('./render/brush');
const { MIN_SPACING } = await import('./core');

const target = { assetId: 'layer-asset', x: 0, y: 0, width: 100, height: 100 };

function options(overrides: Partial<Parameters<typeof createStrokeSession>[1]> = {}) {
  return {
    color: '#000000',
    size: 10,
    hardness: 1,
    opacity: 1,
    mode: 'brush' as const,
    selection: null,
    // 连续描边（不建 sprite），断言更干净；盖章分支单独覆盖
    spacing: MIN_SPACING,
    ...overrides,
  };
}

function reset() {
  harness.asset = harness.make();
  harness.created = [];
  return { asset: harness.asset, created: harness.created };
}

/** 一次落点里位图是否真的被改写过 */
const wroteToAsset = (calls: string[]) =>
  calls.some((call) => call === 'fill' || call === 'stroke' || call === 'drawImage');

describe('落笔必须实时写进图层位图', () => {
  it('不透明度 = 1：move 之后位图立即被写入（不需要 end）', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options());
    expect(session).not.toBeNull();

    asset!.calls.length = 0;
    session!.move(20, 20);
    expect(wroteToAsset(asset!.calls)).toBe(true);

    asset!.calls.length = 0;
    session!.move(40, 30);
    expect(wroteToAsset(asset!.calls)).toBe(true);
    expect(asset!.calls).toContain('stroke');
  });

  it('不透明度 = 1 时不额外分配画布（常见的满不透明笔刷零开销）', () => {
    reset();
    createStrokeSession(target, options());
    expect(harness.created).toHaveLength(0);
  });

  it('盖章模式（大间距）：位图同样实时拿到印章', () => {
    const { asset, created } = reset();
    const session = createStrokeSession(target, options({ spacing: 0.5 }));
    expect(created).toHaveLength(1); // 笔尖 sprite

    asset!.calls.length = 0;
    session!.move(20, 20);
    expect(asset!.calls).toContain('drawImage');
  });

  it('不透明度 < 1：move 之后位图立即拿到合成结果（缓冲模式也要实时）', () => {
    const { asset, created } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.5 }));
    expect(session).not.toBeNull();
    // 落笔前快照 + 缓冲（源码里就是这个创建顺序）
    expect(created).toHaveLength(2);
    const [snapshot, buffer] = created;
    // 快照必须先把落笔前像素抄走（drawImage 位图 → 快照），否则重合成无从还原
    expect(snapshot.calls).toContain('drawImage');
    expect(snapshot.calls).not.toContain('fill');

    asset!.calls.length = 0;
    buffer.calls.length = 0;
    session!.move(20, 20);
    // 笔迹画进缓冲…
    expect(wroteToAsset(buffer.calls)).toBe(true);
    // …并且同一时刻就合成回位图（而不是等 end）
    expect(asset!.calls).toContain('drawImage');
    // 合成前先把脏区还原成落笔前的像素：用 'copy' 才会连透明一起还原
    expect(asset!.calls).toContain('set:globalCompositeOperation=copy');
    // 再按「不透明度」把缓冲盖上去
    expect(asset!.calls).toContain('set:globalAlpha=0.5');
    expect(asset!.calls).toContain('set:globalCompositeOperation=source-over');
  });

  it('缓冲模式：位图在落笔期间的每次 move 都会被合成（不是只合一次）', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.4 }));
    session!.move(10, 10);
    asset!.calls.length = 0;
    session!.move(30, 10);
    expect(asset!.calls).toContain('drawImage');
  });

  it('橡皮（destination-out）同样实时写进位图', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ mode: 'eraser' }));
    asset!.calls.length = 0;
    session!.move(30, 30);
    expect(wroteToAsset(asset!.calls)).toBe(true);
  });

  it('锁定透明像素（source-atop）也走实时直写', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ lockAlpha: true }));
    asset!.calls.length = 0;
    session!.move(30, 30);
    expect(wroteToAsset(asset!.calls)).toBe(true);
  });

  it('end 之后释放缓冲模式的两张临时画布（大画布上这是几十兆的差别）', () => {
    const { created } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.3 }));
    session!.move(10, 10);
    session!.end();
    expect(created).toHaveLength(2);
    expect(created.every((item) => item.canvas.width === 0 && item.canvas.height === 0)).toBe(true);
  });

  it('选区裁剪：缓冲模式把裁剪放在合成阶段（缓冲只累积笔迹）', () => {
    const { asset } = reset();
    const selection = {
      kind: 'rect' as const,
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      path: [],
      feather: 0,
    };
    const session = createStrokeSession(target, options({ opacity: 0.5, selection }));
    asset!.calls.length = 0;
    session!.move(20, 20);
    expect(asset!.calls).toContain('clip');
  });
});
