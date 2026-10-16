/**
 * TIFF 编码（baseline，无压缩）。
 *
 * 为什么自己写而不是引库：我们只需要「一张 RGBA 位图存成 TIFF」这一种情况，
 * 而 baseline 无压缩 TIFF 的结构非常简单（头 + 一个 IFD + 一条 strip 的原始字节），
 * 几十行就能写完、还能被单元测试逐字段校验；引一个几百 KB 的编码器（多半还带解码器）不划算。
 *
 * 采用**小端 + 单条 strip + 未关联 alpha** 的组合：这是 Photoshop / GIMP / 预览程序都认的最朴素形态。
 * 分辨率按 72 dpi 写入（像素与点 1:1），避免某些程序按 1 dpi 猜出离谱的物理尺寸。
 */

/** 编码输入：与 `ImageData` 结构一致（便于单测直接构造） */
export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** TIFF 标签常量（只列用到的） */
const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  XResolution: 282,
  YResolution: 283,
  PlanarConfiguration: 284,
  ResolutionUnit: 296,
  ExtraSamples: 338,
} as const;

/** 字段类型 */
const TYPE = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
} as const;

const TYPE_SIZE: Record<number, number> = {
  [TYPE.BYTE]: 1,
  [TYPE.ASCII]: 1,
  [TYPE.SHORT]: 2,
  [TYPE.LONG]: 4,
  [TYPE.RATIONAL]: 8,
};

interface Entry {
  tag: number;
  type: number;
  /** 元素个数 */
  count: number;
  /** 单值直接内联；多值走值区 */
  values: number[];
}

export interface TiffOptions {
  /** 保留透明通道（未关联 alpha）。文档全不透明时建议关掉，文件更小、兼容性更好 */
  alpha?: boolean;
  /** 每英寸像素数，仅作元数据 */
  dpi?: number;
}

/**
 * RGBA 像素 → TIFF 字节。
 *
 * `alpha: false` 时按「白底 + alpha 合成」丢弃透明通道 —— 直接丢掉 alpha 会让透明区域变黑，
 * 而 TIFF 没有「背景色」概念，白底是用户预期中的默认结果。
 */
export function encodeTiff(image: PixelSource, options: TiffOptions = {}): Uint8Array {
  const { width, height } = image;
  const alpha = options.alpha ?? true;
  const samples = alpha ? 4 : 3;
  const dpi = Math.max(1, Math.round(options.dpi ?? 72));

  const strip = new Uint8Array(width * height * samples);
  for (let i = 0, o = 0; i < image.data.length; i += 4, o += samples) {
    if (alpha) {
      strip[o] = image.data[i];
      strip[o + 1] = image.data[i + 1];
      strip[o + 2] = image.data[i + 2];
      strip[o + 3] = image.data[i + 3];
      continue;
    }
    const a = image.data[i + 3] / 255;
    strip[o] = Math.round(image.data[i] * a + 255 * (1 - a));
    strip[o + 1] = Math.round(image.data[i + 1] * a + 255 * (1 - a));
    strip[o + 2] = Math.round(image.data[i + 2] * a + 255 * (1 - a));
  }

  const entries: Entry[] = [
    { tag: TAG.ImageWidth, type: TYPE.LONG, count: 1, values: [width] },
    { tag: TAG.ImageLength, type: TYPE.LONG, count: 1, values: [height] },
    {
      tag: TAG.BitsPerSample,
      type: TYPE.SHORT,
      count: samples,
      values: [8, 8, 8, 8].slice(0, samples),
    },
    { tag: TAG.Compression, type: TYPE.SHORT, count: 1, values: [1] },
    { tag: TAG.PhotometricInterpretation, type: TYPE.SHORT, count: 1, values: [2] },
    { tag: TAG.StripOffsets, type: TYPE.LONG, count: 1, values: [0] },
    { tag: TAG.SamplesPerPixel, type: TYPE.SHORT, count: 1, values: [samples] },
    { tag: TAG.RowsPerStrip, type: TYPE.LONG, count: 1, values: [height] },
    { tag: TAG.StripByteCounts, type: TYPE.LONG, count: 1, values: [strip.length] },
    { tag: TAG.XResolution, type: TYPE.RATIONAL, count: 1, values: [dpi, 1] },
    { tag: TAG.YResolution, type: TYPE.RATIONAL, count: 1, values: [dpi, 1] },
    { tag: TAG.PlanarConfiguration, type: TYPE.SHORT, count: 1, values: [1] },
    { tag: TAG.ResolutionUnit, type: TYPE.SHORT, count: 1, values: [2] },
  ];
  if (alpha) {
    // 2 = unassociated（直通 alpha），与 canvas 的语义一致
    entries.push({ tag: TAG.ExtraSamples, type: TYPE.SHORT, count: 1, values: [2] });
  }
  // TIFF 要求 IFD 条目按 tag 升序排列（部分读取器会因此直接放弃解析）
  entries.sort((a, b) => a.tag - b.tag);

  const headerSize = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  let valueCursor = headerSize + ifdSize;
  const valueBlocks: Uint8Array[] = [];
  const entryValues = entries.map((entry) => {
    const size = TYPE_SIZE[entry.type] * entry.count;
    if (size <= 4) return { entry, inline: true, value: 0, offset: 0 };
    const offset = valueCursor;
    const block = new Uint8Array(size);
    writeValues(block, entry.type, entry.values);
    valueBlocks.push(block);
    valueCursor += size;
    return { entry, inline: false, value: 0, offset };
  });

  const stripOffset = valueCursor;
  // StripOffsets 是单值，一定内联；直接改它的值即可
  for (const item of entryValues) {
    if (item.entry.tag === TAG.StripOffsets) item.entry.values = [stripOffset];
  }

  const total = stripOffset + strip.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  // 头：小端 + 版本 42 + 首个 IFD 偏移
  out[0] = 0x49; // 'I'
  out[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, headerSize, true);

  view.setUint16(headerSize, entries.length, true);
  entryValues.forEach((item, index) => {
    const base = headerSize + 2 + index * 12;
    view.setUint16(base, item.entry.tag, true);
    view.setUint16(base + 2, item.entry.type, true);
    view.setUint32(base + 4, item.entry.count, true);
    if (item.inline) {
      writeValues(out.subarray(base + 8, base + 12), item.entry.type, item.entry.values);
    } else {
      // 值区偏移；同时把值写进值区
      view.setUint32(base + 8, item.offset, true);
    }
  });
  view.setUint32(headerSize + 2 + entries.length * 12, 0, true);

  let cursor = headerSize + ifdSize;
  for (const block of valueBlocks) {
    out.set(block, cursor);
    cursor += block.length;
  }
  out.set(strip, stripOffset);
  return out;
}

/** 按字段类型把值写入缓冲区（小端） */
function writeValues(target: Uint8Array, type: number, values: number[]): void {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  switch (type) {
    case TYPE.SHORT:
      values.forEach((value, index) => view.setUint16(index * 2, value & 0xffff, true));
      return;
    case TYPE.LONG:
      values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true));
      return;
    case TYPE.RATIONAL:
      values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, true));
      return;
    default:
      values.forEach((value, index) => {
        target[index] = value & 0xff;
      });
  }
}

/**
 * 是否值得保留 alpha 通道。
 *
 * 全不透明的图带上 alpha 只会让文件变大、并让部分老程序把图当成「未关联 alpha」显示异常；
 * 因此导出前扫一遍 alpha，全 255 就走 RGB。
 */
export function hasTransparency(image: PixelSource): boolean {
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] < 255) return true;
  }
  return false;
}
