import { describe, expect, it, vi } from 'vitest';

/**
 * Contract test for **live** painting feedback.
 *
 * Background (a real regression): the canvas refreshes by re-reading the layer bitmap, so **the bitmap must
 * receive new pixels during the stroke**. Once, so overlapping stamps wouldn't compound, a whole stroke went
 * into a buffer and was composited only on release: right semantics, but the bitmap never changed while
 * painting, so users saw "refresh on finish". Pure-function tests never caught it, so these were added.
 *
 * Approach: swap `model/assets` for a call-recording canvas stub and assert only "who drew when",
 * with no real 2D context (jsdom has none).
 *
 * Terms: **move point** = one `move()`; **spacing mode** uses `MIN_SPACING` for a continuous stroke (no sprite),
 * wide spacing stamps (creating an extra sprite canvas); both branches must be covered.
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
        // Only "which method was called" and "which property was set" matter; arguments and returns don't
        get: (_target, prop) => () => {
          calls.push(String(prop));
        },
        // Property writes are recorded too: that is the only way to assert copy / source-over / destination-out
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
    /** Layer bitmap (`getCanvas` returns it) */
    asset: null as Recorder | null,
    /** Temp canvases created during the stroke (tip sprite / buffer / pre-stroke snapshot) */
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
    // Continuous stroke (no sprite) keeps assertions clean; the stamping branch is covered separately
    spacing: MIN_SPACING,
    ...overrides,
  };
}

function reset() {
  harness.asset = harness.make();
  harness.created = [];
  return { asset: harness.asset, created: harness.created };
}

/** Whether the bitmap was actually rewritten during one move point */
const wroteToAsset = (calls: string[]) =>
  calls.some((call) => call === 'fill' || call === 'stroke' || call === 'drawImage');

describe('A stroke must land in the layer bitmap in real time', () => {
  it('opacity = 1: the bitmap is written right after move (no end needed)', () => {
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

  it('opacity = 1 allocates no extra canvas (the common fully opaque brush costs nothing)', () => {
    reset();
    createStrokeSession(target, options());
    expect(harness.created).toHaveLength(0);
  });

  it('stamp mode (large spacing): the bitmap still receives stamps in real time', () => {
    const { asset, created } = reset();
    const session = createStrokeSession(target, options({ spacing: 0.5 }));
    expect(created).toHaveLength(1); // Tip sprite

    asset!.calls.length = 0;
    session!.move(20, 20);
    expect(asset!.calls).toContain('drawImage');
  });

  it('opacity < 1: the bitmap gets the composite right after move (buffered mode is still live)', () => {
    const { asset, created } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.5 }));
    expect(session).not.toBeNull();
    // Pre-stroke snapshot + buffer (the source creates them in this order)
    expect(created).toHaveLength(2);
    const [snapshot, buffer] = created;
    // The snapshot must copy pre-stroke pixels first (drawImage bitmap → snapshot), or nothing to restore
    expect(snapshot.calls).toContain('drawImage');
    expect(snapshot.calls).not.toContain('fill');

    asset!.calls.length = 0;
    buffer.calls.length = 0;
    session!.move(20, 20);
    // The stroke is drawn into the buffer…
    expect(wroteToAsset(buffer.calls)).toBe(true);
    // …and composited back into the bitmap at that same moment (not waiting for end)
    expect(asset!.calls).toContain('drawImage');
    // Restore the dirty region to pre-stroke pixels first: only 'copy' restores transparency too
    expect(asset!.calls).toContain('set:globalCompositeOperation=copy');
    // Then overlay the buffer at that opacity
    expect(asset!.calls).toContain('set:globalAlpha=0.5');
    expect(asset!.calls).toContain('set:globalCompositeOperation=source-over');
  });

  it('buffered mode: every move during the stroke composites into the bitmap (not just once)', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.4 }));
    session!.move(10, 10);
    asset!.calls.length = 0;
    session!.move(30, 10);
    expect(asset!.calls).toContain('drawImage');
  });

  it('the eraser (destination-out) also writes through in real time', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ mode: 'eraser' }));
    asset!.calls.length = 0;
    session!.move(30, 30);
    expect(wroteToAsset(asset!.calls)).toBe(true);
  });

  it('locking transparency (source-atop) also writes directly in real time', () => {
    const { asset } = reset();
    const session = createStrokeSession(target, options({ lockAlpha: true }));
    asset!.calls.length = 0;
    session!.move(30, 30);
    expect(wroteToAsset(asset!.calls)).toBe(true);
  });

  it('end releases the two scratch canvases of buffered mode (tens of megabytes on large canvases)', () => {
    const { created } = reset();
    const session = createStrokeSession(target, options({ opacity: 0.3 }));
    session!.move(10, 10);
    session!.end();
    expect(created).toHaveLength(2);
    expect(created.every((item) => item.canvas.width === 0 && item.canvas.height === 0)).toBe(true);
  });

  it('selection clipping: buffered mode clips at composite time (the buffer only accumulates paint)', () => {
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
