/**
 * `DocxBlock[]` → .docx blob.
 *
 * `docx` is a ~1 MB dependency, so it is imported dynamically here and nowhere else: the PDF editor
 * only pays for it when the user actually exports Word, and the initial chunk stays unchanged.
 */

import type { DocxBlock, DocxExportOptions, DocxPageSetup } from './types';
import { DEFAULT_DOCX_PAGE_SETUP } from './types';

/** Longest edge (px at 96 dpi) an exported page image may keep inside the text column */
const CONTENT_DPI = 96;

function resolvePageSetup(overrides?: Partial<DocxPageSetup>): DocxPageSetup {
  const merged = { ...DEFAULT_DOCX_PAGE_SETUP, ...overrides };
  return {
    widthMm: Math.max(20, merged.widthMm),
    heightMm: Math.max(20, merged.heightMm),
    marginTopMm: Math.max(0, merged.marginTopMm),
    marginBottomMm: Math.max(0, merged.marginBottomMm),
    marginLeftMm: Math.max(0, merged.marginLeftMm),
    marginRightMm: Math.max(0, merged.marginRightMm),
  };
}

/** Content width in CSS pixels, used to scale rasterized pages down to the text column */
export function contentWidthPx(setup: DocxPageSetup): number {
  const widthMm = Math.max(10, setup.widthMm - setup.marginLeftMm - setup.marginRightMm);
  return Math.round((widthMm / 25.4) * CONTENT_DPI);
}

interface DecodedImage {
  data: Uint8Array;
  type: 'png' | 'jpg';
}

/**
 * Decode a base64 data URL.
 *
 * Only data URLs are supported: a remote `http(s)` image would make the export depend on CORS and
 * the network, and the PDF exporter always rasterizes into a data URL first.
 */
export function decodeImageDataUrl(src: string): DecodedImage | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(src);
  if (!match) return null;
  const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  try {
    const binary = atob(match[2]);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      data[index] = binary.charCodeAt(index);
    }
    return { data, type };
  } catch {
    return null;
  }
}

/** Fit an image into the text column while preserving its aspect ratio */
export function fitImageSize(
  widthPx: number,
  heightPx: number,
  maxWidthPx: number,
): { width: number; height: number } {
  const width = widthPx > 0 ? widthPx : maxWidthPx;
  const height = heightPx > 0 ? heightPx : Math.round(maxWidthPx * 0.75);
  if (width <= maxWidthPx) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxWidthPx / width;
  return { width: Math.round(maxWidthPx), height: Math.max(1, Math.round(height * scale)) };
}

/** Build a .docx blob; throws when `docx` cannot be loaded (offline / blocked chunk) */
export async function buildDocxBlob(
  blocks: DocxBlock[],
  options: DocxExportOptions = {},
): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    Footer,
    Header,
    HeadingLevel,
    ImageRun,
    PageBreak,
    PageNumber,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    convertMillimetersToTwip,
  } = await import('docx');

  const setup = resolvePageSetup(options.pageSetup);
  const maxImageWidth = contentWidthPx(setup);

  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  } as const;

  const toParagraph = (
    block: DocxBlock,
  ): InstanceType<typeof Paragraph> | InstanceType<typeof Table> | null => {
    switch (block.type) {
      case 'heading':
        return new Paragraph({
          heading: headingMap[block.level],
          children: [new TextRun(block.text)],
        });

      case 'paragraph': {
        const alignment =
          block.align === 'center'
            ? AlignmentType.CENTER
            : block.align === 'right'
              ? AlignmentType.RIGHT
              : block.align === 'justify'
                ? AlignmentType.JUSTIFIED
                : AlignmentType.LEFT;
        return new Paragraph({
          alignment,
          children: [new TextRun(block.text.replace(/\n+/g, ' '))],
        });
      }

      case 'table':
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) => new TableCell({ children: [new Paragraph(cell || ' ')] }),
                ),
              }),
          ),
        });

      case 'image': {
        const decoded = decodeImageDataUrl(block.src);
        if (!decoded) return null;
        const size = fitImageSize(block.widthPx, block.heightPx, maxImageWidth);
        return new Paragraph({
          children: [
            new ImageRun({ type: decoded.type, data: decoded.data, transformation: size }),
          ],
        });
      }

      case 'pageBreak':
        return new Paragraph({ children: [new PageBreak()] });

      default:
        return null;
    }
  };

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  for (const block of blocks) {
    if (block.type === 'list') {
      // One paragraph per item; ordered lists keep their visible number as text so the file needs no
      // numbering definition (a PDF export has no shared numbering across pages anyway)
      block.items.forEach((item, index) => {
        children.push(
          new Paragraph({
            // `bullet` is only meaningful for unordered lists; ordered items carry their number as
            // text so the document needs no numbering definition
            ...(block.ordered ? {} : { bullet: { level: 0 } }),
            children: [new TextRun(block.ordered ? `${index + 1}. ${item}` : item)],
          }),
        );
      });
      continue;
    }
    const element = toParagraph(block);
    if (element) children.push(element);
  }

  const headerText = options.headerText?.trim();
  const document = new Document({
    title: options.title,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(setup.widthMm),
              height: convertMillimetersToTwip(setup.heightMm),
            },
            margin: {
              top: convertMillimetersToTwip(setup.marginTopMm),
              bottom: convertMillimetersToTwip(setup.marginBottomMm),
              left: convertMillimetersToTwip(setup.marginLeftMm),
              right: convertMillimetersToTwip(setup.marginRightMm),
            },
          },
        },
        headers: headerText
          ? {
              default: new Header({
                children: [new Paragraph({ children: [new TextRun(headerText)] })],
              }),
            }
          : undefined,
        footers: options.footerPageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        children: ['— ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES, ' —'],
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
