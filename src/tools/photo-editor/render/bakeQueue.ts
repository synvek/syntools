import { shouldOffloadPixels } from './bakePlan';
import { cssFilterOf } from './filters';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * Async bake scheduling (opportunistic acceleration).
 *
 * Design premise: **the main render pipeline stays synchronous**. Every frame while painting / dragging
 * must return at once; async would touch nodes / sync / export, and the risk far outweighs the gain. The
 * Worker therefore only handles work not needed this frame: live preview gives a **downsampled** synchronous
 * result, and when the user stops the Worker recomputes **full resolution**, updates the bake cache and repaints.
 *
 * Arguments cross only as `ImageBitmap`: the source canvas becomes a bitmap handed to the Worker (transferable,
 * not copied); the main thread never calls `getImageData` at full resolution — else the saved time is spent there.
 *
 * Failure policy: if the Worker is unavailable (SSR / old browsers) or throws, fall back silently to pure sync; no retry.
 */

export interface FullResBakeJob {
  signature: string;
  /** Source canvas (turned into an ImageBitmap on the main thread, then transferred to the Worker) */
  source: HTMLCanvasElement;
  adjustments: Adjustments;
  filters: FilterSpec[];
}

interface PendingJob extends FullResBakeJob {
  id: number;
}

const DEBOUNCE_MS = 220;

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: FullResBakeJob | null = null;
const inFlight = new Map<number, PendingJob>();
const listeners = new Set<(signature: string, bitmap: ImageBitmap) => void>();

function ensureWorker(): Worker | null {
  if (worker || workerBroken) return worker;
  if (typeof Worker === 'undefined' || typeof createImageBitmap !== 'function') {
    workerBroken = true;
    return null;
  }
  try {
    worker = new Worker(new URL('../workers/bake.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; bitmap: ImageBitmap | null }>) => {
      const job = inFlight.get(event.data.id);
      inFlight.delete(event.data.id);
      if (!job || !event.data.bitmap) return;
      for (const listener of listeners) listener(job.signature, event.data.bitmap);
    };
    worker.onerror = () => {
      // One error is fatal: retrying would only keep spawning threads in a broken environment
      workerBroken = true;
      worker?.terminate();
      worker = null;
      inFlight.clear();
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

/** Register a "recompute at full resolution after the user stops" job; within the debounce window only the last one per signature is kept */
export function scheduleFullResBake(job: FullResBakeJob): void {
  if (!shouldOffloadPixels(job.source.width, job.source.height, job.filters)) return;
  if (typeof createImageBitmap !== 'function') return;
  pending = job;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

function flush(): void {
  timer = null;
  const job = pending;
  pending = null;
  if (!job) return;
  const instance = ensureWorker();
  if (!instance) return;
  const { source, adjustments, filters, signature } = job;
  const width = source.width;
  const height = source.height;
  const id = nextId++;
  void createImageBitmap(source)
    .then((bitmap) => {
      const active = inFlight.size === 0 && worker === instance;
      if (!active) {
        bitmap.close();
        return;
      }
      inFlight.set(id, { ...job, id });
      instance.postMessage(
        {
          id,
          width,
          height,
          bitmap,
          cssFilter: cssFilterOf(adjustments, filters),
          adjustments,
          filters,
        },
        [bitmap],
      );
    })
    .catch(() => {
      // If bitmap creation fails (zero-size canvas / already reclaimed), skip this warm-up; the sync result is unaffected
      void signature;
    });
}

/** Subscribe to "full-resolution bake finished"; returns an unsubscribe function */
export function onBakeReady(
  listener: (signature: string, bitmap: ImageBitmap) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: reset internal state */
export function resetBakeQueue(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  inFlight.clear();
  listeners.clear();
  worker?.terminate();
  worker = null;
  workerBroken = false;
  nextId = 1;
}

/** Test / diagnostic only: whether the Worker has been marked unavailable */
export function isWorkerUnavailable(): boolean {
  return workerBroken;
}
