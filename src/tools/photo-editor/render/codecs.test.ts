import { describe, expect, it } from 'vitest';
import { decompressFrames, parseGIF } from 'gifuct-js';
import { inflate } from 'pako';
import { encodeGif } from './gif';
import { encodePdf } from './pdf';
import { encodeTiff, hasTransparency, type PixelSource } from './tiff';

/** 由 RGB 三元组数组构造 RGBA 像素源 */
function pixels(rows: number[][]): PixelSource {
  const data = new Uint8ClampedArray(rows.length * 4);
  rows.forEach((rgba, index) => data.set(rgba, index * 4));
  return { data, width: 1, height: rows.length };
}

function image(
  width: number,
  height: number,
  fill: (x: number, y: number) => number[],
): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(fill(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}

/**
 * 独立的 TIFF 读取器（测试自备）。
 *
 * 故意不复用被测代码的任何部分：只按 TIFF 规范解释字节——
 * 若写出侧的 IFD 顺序 / 值偏移 / strip 布局有错，这里会解析失败或读出不同的像素，而不是「自证正确」。
 */
function readTiff(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little =
    view.getUint16(0, true) === 0x4949
      ? true
      : (expect(view.getUint16(0, false)).toBe(0x4d4d), false);
  const readU16 = (offset: number) => view.getUint16(offset, little);
  const readU32 = (offset: number) => view.getUint32(offset, little);
  const magic = readU16(2);
  const ifdOffset = readU32(4);
  const count = readU16(ifdOffset);
  const tags = new Map<number, { type: number; count: number; values: number[]; offset: number }>();
  for (let i = 0; i < count; i += 1) {
    const base = ifdOffset + 2 + i * 12;
    const tag = readU16(base);
    const type = readU16(base + 2);
    const itemCount = readU32(base + 4);
    const size = itemCount * (type === 3 ? 2 : type === 4 || type === 5 ? 4 : 1);
    const values: number[] = [];
    if (size <= 4) {
      for (let k = 0; k < itemCount; k += 1) {
        values.push(type === 3 ? readU16(base + 8 + k * 2) : readU32(base + 8 + k * 4));
      }
    } else {
      const valueOffset = readU32(base + 8);
      for (let k = 0; k < itemCount; k += 1) {
        values.push(type === 3 ? readU16(valueOffset + k * 2) : readU32(valueOffset + k * 4));
      }
    }
    tags.set(tag, { type, count: itemCount, values, offset: base });
  }
  const stripOffset = tags.get(273)?.values[0] ?? 0;
  const stripLength = tags.get(279)?.values[0] ?? 0;
  return { magic, ifdOffset, tags, strip: bytes.subarray(stripOffset, stripOffset + stripLength) };
}

function readGif(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return decompressFrames(parseGIF(buffer), true);
}

describe('TIFF 编码', () => {
  it('写出 baseline 头与必需标签（小端 / 无压缩 / RGB）', () => {
    const source = image(2, 1, () => [10, 20, 30, 255]);
    const tiff = readTiff(encodeTiff(source, { alpha: false }));
    expect(tiff.magic).toBe(42);
    expect(tiff.ifdOffset).toBe(8);
    expect(tiff.tags.get(256)?.values).toEqual([2]);
    expect(tiff.tags.get(257)?.values).toEqual([1]);
    expect(tiff.tags.get(258)?.values).toEqual([8, 8, 8]);
    expect(tiff.tags.get(259)?.values).toEqual([1]);
    expect(tiff.tags.get(262)?.values).toEqual([2]);
    expect(tiff.tags.get(277)?.values).toEqual([3]);
    expect(tiff.tags.get(278)?.values).toEqual([1]);
    expect(tiff.tags.get(284)?.values).toEqual([1]);
    expect(tiff.tags.get(296)?.values).toEqual([2]);
    expect(tiff.tags.get(338)).toBeUndefined();
  });

  it('IFD 条目按 tag 升序（部分读取器会因此拒绝解析）', () => {
    const bytes = encodeTiff(image(1, 1, () => [1, 2, 3, 255]));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(8, true);
    const tags: number[] = [];
    for (let i = 0; i < count; i += 1) tags.push(view.getUint16(8 + 2 + i * 12, true));
    expect(tags).toEqual([...tags].sort((a, b) => a - b));
  });

  it('strip 里的像素与输入逐字节一致（RGB）', () => {
    const source = image(2, 1, (x) => [x === 0 ? 255 : 0, 128, 64, 255]);
    const tiff = readTiff(encodeTiff(source, { alpha: false }));
    expect([...tiff.strip]).toEqual([255, 128, 64, 0, 128, 64]);
  });

  it('带 alpha 时写 4 通道并标注未关联 alpha', () => {
    const source = image(1, 1, () => [9, 8, 7, 128]);
    const tiff = readTiff(encodeTiff(source, { alpha: true }));
    expect(tiff.tags.get(258)?.values).toEqual([8, 8, 8, 8]);
    expect(tiff.tags.get(277)?.values).toEqual([4]);
    expect(tiff.tags.get(338)?.values).toEqual([2]);
    expect([...tiff.strip]).toEqual([9, 8, 7, 128]);
  });

  it('不保留 alpha 时透明区域按白底合成（而不是变黑）', () => {
    const source = image(1, 1, () => [0, 0, 0, 0]);
    const tiff = readTiff(encodeTiff(source, { alpha: false }));
    expect([...tiff.strip]).toEqual([255, 255, 255]);
  });

  it('多值字段（BitsPerSample）走值区且偏移正确', () => {
    const bytes = encodeTiff(image(1, 1, () => [1, 1, 1, 1]));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // 找到 BitsPerSample(258) 条目，其值区不应落在 IFD 自身区间内
    const count = view.getUint16(8, true);
    const ifdEnd = 8 + 2 + count * 12 + 4;
    for (let i = 0; i < count; i += 1) {
      const base = 8 + 2 + i * 12;
      if (view.getUint16(base, true) !== 258) continue;
      const offset = view.getUint32(base + 8, true);
      expect(offset).toBeGreaterThanOrEqual(ifdEnd);
    }
  });

  it('hasTransparency 只对真正含透明的图返回 true', () => {
    expect(hasTransparency(image(2, 2, () => [0, 0, 0, 255]))).toBe(false);
    expect(hasTransparency(image(2, 2, (x) => [0, 0, 0, x === 0 ? 254 : 255]))).toBe(true);
  });
});

describe('GIF 编码（用 gifuct-js 解码回读）', () => {
  const COLORS = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255],
  ] as const;

  it('四种纯色可无损往返（调色板精确覆盖）', () => {
    const source = image(2, 2, (x, y) => [...COLORS[(y * 2 + x) % 4]]);
    const frames = readGif(encodeGif(source, { alpha: false }));
    expect(frames).toHaveLength(1);
    expect(frames[0].dims).toMatchObject({ width: 2, height: 2 });
    expect([...frames[0].patch]).toEqual([...source.data]);
  });

  it('透明像素写出透明色索引，其余不受影响', () => {
    const source = image(2, 1, (x) => (x === 0 ? [0, 0, 0, 0] : [12, 34, 56, 255]));
    const frames = readGif(encodeGif(source, { alpha: true }));
    expect(frames[0].transparentIndex).toBeGreaterThanOrEqual(0);
    expect(frames[0].patch[3]).toBe(0);
    expect([...frames[0].patch.slice(4)]).toEqual([12, 34, 56, 255]);
  });

  it('超过 256 色时量化到调色板，尺寸与像素数不变', () => {
    const source = image(32, 32, (x, y) => [(x * 8) % 256, (y * 8) % 256, (x + y) % 256, 255]);
    const frames = readGif(encodeGif(source, { alpha: false }));
    expect(frames[0].dims).toMatchObject({ width: 32, height: 32 });
    expect(frames[0].patch).toHaveLength(32 * 32 * 4);
  });

  it('大图触发 LZW 码长增长与字典重置，仍能被解码器接受', () => {
    // 伪随机噪声：颜色几乎不重复，LZW 字典会被灌满，必然走到 12 位 + Clear 重开字典的分支
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % 256;
    };
    const source = image(96, 96, () => [random(), random(), random(), 255]);
    const frames = readGif(encodeGif(source, { alpha: false }));
    expect(frames[0].dims).toMatchObject({ width: 96, height: 96 });
    expect(frames[0].patch).toHaveLength(96 * 96 * 4);
    // 量化后每个像素都应是调色板中的颜色，不应出现解码错位导致的越界
    for (let i = 0; i < frames[0].patch.length; i += 4) {
      expect(frames[0].patch[i + 3]).toBe(255);
    }
  });

  it('全透明图不崩（调色板为空时补一个占位色）', () => {
    const source = image(2, 2, () => [0, 0, 0, 0]);
    const frames = readGif(encodeGif(source, { alpha: true }));
    expect(
      frames[0].patch.every((value: number, index: number) => index % 4 === 3 || value === 0),
    ).toBe(true);
  });

  it('文件头是 GIF89a 且以结束符收尾', () => {
    const bytes = encodeGif(image(1, 1, () => [1, 2, 3, 255]));
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });

  it('未使用 alpha 时不写图形控制扩展（无透明索引）', () => {
    const bytes = encodeGif(
      image(1, 1, () => [1, 2, 3, 255]),
      { alpha: false },
    );
    // 0x21 0xf9 是 GCE 引导符
    let found = false;
    for (let i = 0; i < bytes.length - 1; i += 1) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) found = true;
    }
    expect(found).toBe(false);
  });
});

describe('PDF 编码', () => {
  /** 从 PDF 文本里取出交叉引用表声明的对象偏移 */
  function xrefOffsets(text: string): number[] {
    const table = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(text);
    expect(table).not.toBeNull();
    return (table?.[2] ?? '')
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => Number(line.slice(0, 10)));
  }

  function streamOf(text: string, bytes: Uint8Array, object: number): Uint8Array {
    const marker = `${object} 0 obj`;
    const start = text.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const dictEnd = text.indexOf('stream\n', start);
    const length = Number(/\/Length (\d+)/.exec(text.slice(start, dictEnd))?.[1]);
    const dataStart = dictEnd + 'stream\n'.length;
    return bytes.subarray(dataStart, dataStart + length);
  }

  const SOURCE = image(2, 2, (x, y) => [x * 10, y * 20, 30, 255]);

  it('头部 / 交叉引用表 / startxref 自洽（偏移指向真正的对象起始处）', () => {
    const bytes = encodePdf(SOURCE, { dpi: 72 });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);

    const offsets = xrefOffsets(text);
    expect(offsets).toHaveLength(5); // 1..5 号对象（无 SMask）
    offsets.forEach((offset, index) => {
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });

    const startxrefOffset = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxrefOffset, startxrefOffset + 4)).toBe('xref');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('图像流解压后与输入 RGB 逐字节一致', () => {
    const bytes = encodePdf(SOURCE, { dpi: 72 });
    const text = new TextDecoder('latin1').decode(bytes);
    const stream = inflate(streamOf(text, bytes, 4));
    // 逐行：(0,0) (1,0) (0,1) (1,1)
    expect([...stream]).toEqual([0, 0, 30, 10, 0, 30, 0, 20, 30, 10, 20, 30]);
  });

  it('页面尺寸按 dpi 换算（72dpi 时 1 像素 = 1 点）', () => {
    const text = new TextDecoder('latin1').decode(
      encodePdf(
        image(200, 100, () => [0, 0, 0, 255]),
        { dpi: 72 },
      ),
    );
    expect(text).toContain('/MediaBox [0 0 200 100]');
    const at144 = new TextDecoder('latin1').decode(
      encodePdf(
        image(200, 100, () => [0, 0, 0, 255]),
        { dpi: 144 },
      ),
    );
    expect(at144).toContain('/MediaBox [0 0 100 50]');
  });

  it('含透明像素时写入 SMask，且 alpha 与输入一致', () => {
    const source = image(2, 1, (x) => [255, 255, 255, x === 0 ? 0 : 255]);
    const bytes = encodePdf(source, { dpi: 72 });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/SMask 6 0 R');
    expect(xrefOffsets(text)).toHaveLength(6);
    expect([...inflate(streamOf(text, bytes, 6))]).toEqual([0, 255]);
  });

  it('全不透明时不写 SMask（少一个对象、文件更小）', () => {
    const text = new TextDecoder('latin1').decode(encodePdf(SOURCE, { dpi: 72 }));
    expect(text).not.toContain('SMask');
    expect(xrefOffsets(text)).toHaveLength(5);
  });

  it('内容流按页面尺寸铺满整页', () => {
    const text = new TextDecoder('latin1').decode(
      encodePdf(
        image(50, 20, () => [0, 0, 0, 255]),
        { dpi: 72 },
      ),
    );
    expect(text).toContain('q 50 0 0 20 0 0 cm /Im0 Do Q');
  });
});

describe('导出像素源', () => {
  it('pixels 辅助函数构造的宽度与数据长度一致', () => {
    const source = pixels([
      [1, 2, 3, 255],
      [4, 5, 6, 255],
    ]);
    expect(source.data.length).toBe(source.width * source.height * 4);
  });
});
