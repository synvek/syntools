/**
 * PDF export (single page, embedded bitmap).
 *
 * Hand-assembled instead of jsPDF / pdf-lib: we only need "one page + one image", and the container is
 * simple (objects + xref), so writing it allows **byte-level** offset checks and no heavy dependency.
 *
 * Three trade-offs worth noting:
 * 1. **FlateDecode + pako** over raw RGB instead of embedded JPEG: JPEG drops alpha and adds artifacts;
 * 2. a separate **SMask** grayscale image when alpha is present, so transparency survives (JPEG can't);
 * 3. page size derived from `dpi` (72 by default, 1:1), so a 3000px image isn't laid out 40 inches wide.
 */

import { deflate } from 'pako';
import { hasTransparency, type PixelSource } from './tiff';

export interface PdfOptions {
  /** Basis for the page size (at 72 dpi, 1 pixel = 1 point) */
  dpi?: number;
  /** Whether alpha (SMask) is needed; callers usually check `hasTransparency` first */
  alpha?: boolean;
}

interface PdfPart {
  /** Binary stream (image data), optional */
  stream?: Uint8Array;
  /** Whether the stream uses FlateDecode (here it always compresses) */
  flate?: boolean;
  dict: string;
}

/**
 * RGBA pixels → single-page PDF bytes.
 *
 * Object numbers are fixed: 1 catalog, 2 page tree, 3 page, 4 image, 5 content stream, 6 SMask (optional).
 * Fixed numbers keep the xref readable and let tests fetch objects by number directly.
 */
export function encodePdf(image: PixelSource, options: PdfOptions = {}): Uint8Array {
  const dpi = Math.max(1, options.dpi ?? 72);
  const { width, height } = image;
  const pageWidth = round2((width * 72) / dpi);
  const pageHeight = round2((height * 72) / dpi);

  const alpha = options.alpha ?? hasTransparency(image);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, o = 0; i < image.data.length; i += 4, o += 3) {
    rgb[o] = image.data[i];
    rgb[o + 1] = image.data[i + 1];
    rgb[o + 2] = image.data[i + 2];
  }
  const rgbStream = deflate(rgb);
  const smaskStream = alpha ? deflate(alphaChannel(image)) : null;

  const parts: PdfPart[] = [];
  parts.push({ dict: '<< /Type /Catalog /Pages 2 0 R >>' });
  parts.push({ dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' });
  parts.push({
    dict:
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  });
  parts.push({
    dict:
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
      `/Length ${rgbStream.length}${smaskStream ? ' /SMask 6 0 R' : ''} >>`,
    stream: rgbStream,
  });
  const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  const contentBytes = latin1(content);
  parts.push({ dict: `<< /Length ${contentBytes.length} >>`, stream: contentBytes });
  if (smaskStream) {
    parts.push({
      dict:
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${smaskStream.length} >>`,
      stream: smaskStream,
    });
  }

  return assemble(parts);
}

/** Assemble objects + cross-reference table + trailer */
function assemble(parts: PdfPart[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    size += bytes.length;
  };
  push(latin1('%PDF-1.4\n'));
  // Binary marker: tells readers the file has binary streams and not to treat it as text
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [];
  parts.forEach((part, index) => {
    offsets.push(size);
    const header = `${index + 1} 0 obj\n${part.dict}\n`;
    push(latin1(header));
    if (part.stream) {
      push(latin1('stream\n'));
      push(part.stream);
      push(latin1('\nendstream\n'));
    }
    push(latin1('endobj\n'));
  });

  const xrefOffset = size;
  const count = parts.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  push(latin1(xref));
  push(latin1(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));

  const out = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function round2(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function alphaChannel(image: PixelSource): Uint8Array {
  const out = new Uint8Array(image.width * image.height);
  for (let i = 0, o = 0; i < image.data.length; i += 4, o += 1) out[o] = image.data[i + 3];
  return out;
}
