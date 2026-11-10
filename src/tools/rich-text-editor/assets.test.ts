import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ASSET_REF_PREFIX,
  externalizeImages,
  getAssetDataUrl,
  hydrateImages,
  isAssetRef,
} from './assets';

/** Embedded image outboarding (implementation plan P1-6): document keeps a ref, reader gets the data URL. */

const PNG_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const PNG_B =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('externalizeImages / hydrateImages', () => {
  it('moves a data URL into storage and puts the same data URL back on read', async () => {
    const html = `<p>前<img src="${PNG_A}" alt="图">后</p>`;

    const stored = await externalizeImages(html);
    expect(stored).not.toContain('data:image');
    expect(stored).toContain(`${ASSET_REF_PREFIX}img-`);
    expect(stored).toContain('alt="图"');

    const ref = stored.match(/src="([^"]+)"/)?.[1] ?? '';
    expect(isAssetRef(ref)).toBe(true);
    await expect(getAssetDataUrl(ref)).resolves.toBe(PNG_A);

    expect(await hydrateImages(stored)).toBe(html);
  });

  it('keeps one record per unique image', async () => {
    const html = `<img src="${PNG_A}"><p>中间</p><img src="${PNG_A}">`;

    const stored = await externalizeImages(html);
    const refs = [...stored.matchAll(/src="([^"]+)"/g)].map((match) => match[1]);

    expect(refs).toHaveLength(2);
    expect(refs[0]).toBe(refs[1]);
  });

  it('leaves external and already-referenced images alone', async () => {
    const html = `<img src="https://example.com/a.png"><img src="${ASSET_REF_PREFIX}img-unknown"><p>文字</p>`;

    await expect(externalizeImages(html)).resolves.toBe(html);
    // Unknown refs stay visible instead of being silently dropped
    await expect(hydrateImages(html)).resolves.toBe(html);
  });

  it('returns the original HTML when the asset store rejects the write (base64 fallback)', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const html = `<p><img src="${PNG_B}"></p>`;
    await expect(externalizeImages(html)).resolves.toBe(html);
  });
});
