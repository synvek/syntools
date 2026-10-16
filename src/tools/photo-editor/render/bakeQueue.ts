import { shouldOffloadPixels } from './bakePlan';
import { cssFilterOf } from './filters';
import type { Adjustments, FilterSpec } from '../model/types';

/**
 * 异步烘焙调度（机会式加速）。
 *
 * 设计前提：**主渲染管线保持同步**。落笔 / 拖滑杆的每一帧都必须立刻拿到结果，
 * 把管线改成异步会牵动 nodes / sync / 导出三条路径，风险远大于收益。
 * 因此 Worker 只承担「不必当帧要结果」的那部分：实时预览先按**降采样**给出同步结果，
 * 停手后再由 Worker 算一遍**全分辨率**，写回烘焙缓存并通知重绘。
 *
 * 传参只走 `ImageBitmap`：把源画布转成位图交给 Worker（可转移，不复制像素），
 * 主线程全程不碰全分辨率的 `getImageData` —— 否则「省下的时间」又会在取像素时花掉。
 *
 * 失败策略：Worker 不可用（SSR / 老浏览器）或出错时静默降级为纯同步，且出错后不再重试。
 */

export interface FullResBakeJob {
  signature: string;
  /** 源画布（主线程侧转成 ImageBitmap 后转移给 Worker） */
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
      // 出错即判死：继续重试只会在坏环境里反复起线程
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

/** 登记一次「停手后算全分辨率」的任务；同签名在防抖窗口内只保留最后一次 */
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
      // 位图创建失败（画布为 0 尺寸 / 被回收）时放弃本次预热，不影响同步结果
      void signature;
    });
}

/** 订阅「全分辨率烘焙完成」；返回取消订阅函数 */
export function onBakeReady(
  listener: (signature: string, bitmap: ImageBitmap) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 仅供测试：重置内部状态 */
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

/** 仅供测试 / 诊断：Worker 是否已被判定为不可用 */
export function isWorkerUnavailable(): boolean {
  return workerBroken;
}
