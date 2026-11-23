import { describe, expect, it } from 'vitest';
import { isLargeDocument, LARGE_DOC_BYTES, thumbnailsNeedConsent } from './largeDoc';

describe('large-document policy', () => {
  it('阈值是 20MB，且严格大于才算大文件', () => {
    expect(LARGE_DOC_BYTES).toBe(20 * 1024 * 1024);
    expect(isLargeDocument(LARGE_DOC_BYTES)).toBe(false);
    expect(isLargeDocument(LARGE_DOC_BYTES + 1)).toBe(true);
    expect(isLargeDocument(0)).toBe(false);
    expect(isLargeDocument(Number.NaN)).toBe(false);
  });

  it('大文件的缩略图需要用户点头，手动生成后不再拦', () => {
    expect(thumbnailsNeedConsent(true, false)).toBe(true);
    expect(thumbnailsNeedConsent(true, true)).toBe(false);
    expect(thumbnailsNeedConsent(false, false)).toBe(false);
  });
});
