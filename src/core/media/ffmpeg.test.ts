import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 覆盖 wasm 的来源选择：优先 gzip 副本（Cloudflare Pages 单文件 25 MiB 限制下的发布形态），
 * 拿不到就回退原始 ffmpeg-core.wasm。
 */
const RAW_WASM = 'fake-wasm-bytes';

function fakeResponse(data: Uint8Array, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    arrayBuffer: async () => data.slice().buffer,
  } as unknown as Response;
}

/** 每个用例重新加载模块，绕开 resolveFfmpegWasmUrl 的会话级缓存。 */
async function loadMediaModule() {
  vi.resetModules();
  return import('./ffmpeg');
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:ffmpeg-core');
  // jsdom 不提供 DecompressionStream：确保走 pako 兜底分支
  Reflect.deleteProperty(globalThis, 'DecompressionStream');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveFfmpegWasmUrl', () => {
  it('gzip 副本可用时解压为同源 blob URL', async () => {
    const gz = new Uint8Array(gzipSync(new TextEncoder().encode(RAW_WASM)));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(gz)),
    );

    const { resolveFfmpegWasmUrl, ffmpegCoreUrl } = await loadMediaModule();

    await expect(resolveFfmpegWasmUrl()).resolves.toBe('blob:ffmpeg-core');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(ffmpegCoreUrl('ffmpeg-core.wasm.gz'));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe('application/wasm');
    expect(blob.size).toBe(RAW_WASM.length);
    // jsdom 的 Blob 没有 text()，用 FileReader 校验解压后的内容
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(text).toBe(RAW_WASM);
  });

  it('服务端已透明解码（返回原始 wasm 字节）时直接复用，不再解压', async () => {
    const raw = new TextEncoder().encode(`\0asm${RAW_WASM}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(raw)),
    );

    const { resolveFfmpegWasmUrl } = await loadMediaModule();

    await expect(resolveFfmpegWasmUrl()).resolves.toBe('blob:ffmpeg-core');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(blob.size).toBe(raw.length);
  });

  it('副本缺失（SPA fallback 返回 HTML）时回退原始 wasm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(new TextEncoder().encode('<!doctype html>'))),
    );

    const { resolveFfmpegWasmUrl, ffmpegCoreUrl } = await loadMediaModule();

    await expect(resolveFfmpegWasmUrl()).resolves.toBe(ffmpegCoreUrl('ffmpeg-core.wasm'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('下载失败时回退原始 wasm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(new Uint8Array(), false)),
    );

    const { resolveFfmpegWasmUrl, ffmpegCoreUrl } = await loadMediaModule();

    await expect(resolveFfmpegWasmUrl()).resolves.toBe(ffmpegCoreUrl('ffmpeg-core.wasm'));
  });

  it('同一次会话内只解压一次', async () => {
    const gz = new Uint8Array(gzipSync(new TextEncoder().encode(RAW_WASM)));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(gz)),
    );

    const { resolveFfmpegWasmUrl } = await loadMediaModule();

    await resolveFfmpegWasmUrl();
    await resolveFfmpegWasmUrl();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });
});
