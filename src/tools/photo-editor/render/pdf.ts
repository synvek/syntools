/**
 * PDF 导出（单页、内嵌位图）。
 *
 * 自己拼而不是用 jsPDF / pdf-lib：我们只需要「一页 + 一张图」，PDF 的容器结构足够简单
 * （对象 + 交叉引用表），自己写能**逐字节验证**偏移量正确性，也不必为了导出把几百 KB 的库拉进编辑器的懒加载块。
 *
 * 三点值得说明的取舍：
 * 1. 用 **FlateDecode + pako** 压原始 RGB，而不是内嵌 JPEG：JPEG 会丢透明通道、并在文字 / 线条上留压缩痕迹；
 * 2. 有透明像素时额外写一个 **SMask** 灰度图，PDF 里就能保留透明（JPEG 做不到这一点）；
 * 3. 页面尺寸按 `dpi`（默认 72 = 像素与点 1:1）换算，避免某些阅读器把一张 3000px 的图铺成 40 英寸巨幅。
 */

import { deflate } from 'pako';
import { hasTransparency, type PixelSource } from './tiff';

export interface PdfOptions {
  /** 写入页面尺寸的换算基准（72 dpi 时 1 像素 = 1 点） */
  dpi?: number;
  /** 是否需要透明通道（SMask）；缺省由调用方先用 `hasTransparency` 判断 */
  alpha?: boolean;
}

interface PdfPart {
  /** 二进制流（图片数据），可选 */
  stream?: Uint8Array;
  /** 流是否走 FlateDecode（这里我们始终压缩） */
  flate?: boolean;
  dict: string;
}

/**
 * RGBA 像素 → 单页 PDF 字节。
 *
 * 对象编号固定为：1 目录、2 页面树、3 页面、4 图像、5 内容流、6 SMask（可选）。
 * 固定编号是为了让交叉引用表可读、也便于测试直接按编号取对象。
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

/** 组装对象 + 交叉引用表 + 尾部 */
function assemble(parts: PdfPart[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    size += bytes.length;
  };
  push(latin1('%PDF-1.4\n'));
  // 二进制标记：告诉阅读器这份文件含二进制流，不要按文本模式处理
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
