import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectImageMime, extensionForMime, measureImageSize, mimeFromFilename } from './media';
import type { MediaAsset } from './types';

/**
 * `measureImageSize` 的失败语义（曾经挂死过一次，值得单独钉住）。
 *
 * `onload` / `onerror` 不保证二选一触发：jsdom 对 `blob:` URL 两个都不触发，部分 WebView 遇到不支持
 * 的编码也会静默挂住。历史上这条路径没有超时兜底，含图片的 pptx 在导入时**永久 await**，
 * `baseline:roundtrip` 的 `slide/image-1px` 因此把整份基线测试拖到 120s 超时。
 */

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'media-1',
    mime: 'image/png',
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    width: 0,
    height: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('measureImageSize', () => {
  it('reads the intrinsic size once the image loads', async () => {
    class LoadingImage {
      naturalWidth = 40;
      naturalHeight = 20;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', LoadingImage);

    await expect(measureImageSize(asset())).resolves.toEqual({ width: 40, height: 20 });
  });

  it('resolves null when the image reports an error', async () => {
    class BrokenImage {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);

    await expect(measureImageSize(asset())).resolves.toBeNull();
  });

  it('gives up instead of awaiting forever when neither handler ever fires', async () => {
    // 两个事件都不触发：jsdom 的 blob: 行为，也是"导入卡死"的现场
    class NeverSettles {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        /* 什么都不做 */
      }
    }
    vi.stubGlobal('Image', NeverSettles);
    vi.useFakeTimers();

    const pending = measureImageSize(asset());
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toBeNull();
  });

  it('skips decoding entirely when there is no url to decode', async () => {
    await expect(measureImageSize(asset({ bytes: undefined, url: undefined }))).resolves.toBeNull();
  });
});

describe('media type detection', () => {
  it('trusts the byte signature over the file extension', () => {
    expect(mimeFromFilename('photo.jpeg')).toBe('image/jpeg');
    expect(mimeFromFilename('photo.heic')).toBeUndefined();
    // 扩展名撒谎时以字节签名为准
    expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(detectImageMime(Uint8Array.from([0x00, 0x01, 0x02]))).toBeUndefined();
  });

  it('maps unsupported mimes to a safe extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpeg');
    expect(extensionForMime('image/webp')).toBe('png');
    expect(extensionForMime('image/heic')).toBe('png');
  });
});
