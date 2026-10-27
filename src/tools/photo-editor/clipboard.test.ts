import { describe, expect, it } from 'vitest';
import { blobToImageFile } from './clipboard';

describe('blobToImageFile', () => {
  it('derives the extension from the MIME type', () => {
    const file = blobToImageFile(new Blob(['x'], { type: 'image/png' }));
    expect(file.name).toBe('clipboard.png');
    expect(file.type).toBe('image/png');
  });

  it('jpeg becomes .jpg (otherwise backend format checks reject it)', () => {
    expect(blobToImageFile(new Blob(['x'], { type: 'image/jpeg' })).name).toBe('clipboard.jpg');
  });

  it('unknown types fall back to png, keeping the caller-supplied name', () => {
    const file = blobToImageFile(new Blob(['x'], { type: '' }), 'shot');
    expect(file.name).toBe('shot.png');
    expect(file.type).toBe('image/png');
  });
});
