import { describe, expect, it } from 'vitest';
import { blobToImageFile } from './clipboard';

describe('blobToImageFile', () => {
  it('按 MIME 推导扩展名', () => {
    const file = blobToImageFile(new Blob(['x'], { type: 'image/png' }));
    expect(file.name).toBe('clipboard.png');
    expect(file.type).toBe('image/png');
  });

  it('jpeg 落成 .jpg（否则后端的格式校验会拒收）', () => {
    expect(blobToImageFile(new Blob(['x'], { type: 'image/jpeg' })).name).toBe('clipboard.jpg');
  });

  it('未知类型回落到 png，并保留调用方给的名字', () => {
    const file = blobToImageFile(new Blob(['x'], { type: '' }), 'shot');
    expect(file.name).toBe('shot.png');
    expect(file.type).toBe('image/png');
  });
});
