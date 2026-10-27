/**
 * TIFF encoding (baseline, uncompressed).
 *
 * Why hand-roll instead of pulling a library: we only need "save one RGBA bitmap as TIFF",
 * and baseline uncompressed TIFF is simple (header + one IFD + one strip of raw bytes):
 * dozens of lines, field-checkable by unit tests, beats a hundreds-of-KB encoder with a decoder attached.
 *
 * It combines **little-endian + a single strip + unassociated alpha**, the plainest form PS / GIMP / Preview read.
 * Resolution is written as 72 dpi (1:1 pixels to points), so viewers don't infer absurd physical sizes.
 */

/** Encoder input: same shape as `ImageData` (easy to build directly in tests) */
export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** TIFF tag constants (only the ones used) */
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

/** Field types */
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
  /** Element count */
  count: number;
  /** A single value is inlined; multiple values go to the value area */
  values: number[];
}

export interface TiffOptions {
  /** Keep alpha (unassociated). Turn off for fully opaque images: smaller files, better compatibility */
  alpha?: boolean;
  /** Pixels per inch, metadata only */
  dpi?: number;
}

/**
 * RGBA pixels → TIFF bytes.
 *
 * With `alpha: false` the channel is dropped by compositing onto white — dropping alpha outright would
 * turn transparent areas black; TIFF has no background color, and white is the expected default.
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
    // 2 = unassociated (straight alpha), matching canvas semantics
    entries.push({ tag: TAG.ExtraSamples, type: TYPE.SHORT, count: 1, values: [2] });
  }
  // TIFF requires IFD entries sorted by tag ascending (some readers give up otherwise)
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
  // StripOffsets is a single value, always inlined; just overwrite its value
  for (const item of entryValues) {
    if (item.entry.tag === TAG.StripOffsets) item.entry.values = [stripOffset];
  }

  const total = stripOffset + strip.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  // Header: little-endian + version 42 + offset of the first IFD
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
      // Offset into the value area; also write the value there
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

/** Write a value into the buffer by field type (little-endian) */
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
 * Whether the alpha channel is worth keeping.
 *
 * Keeping alpha on a fully opaque image only inflates the file and confuses viewers expecting it;
 * so scan alpha before exporting and use RGB when everything is 255.
 */
export function hasTransparency(image: PixelSource): boolean {
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] < 255) return true;
  }
  return false;
}
