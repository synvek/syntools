import type { CSSProperties } from 'react';
import { pageNumberFor, watermarkTileAnchors } from '../model/decorations';
import type { PdfDecoration } from '../model/types';

interface DecorationLayerProps {
  decoration: PdfDecoration;
  /** CSS px per PDF point, so 10pt stays 10pt at any zoom */
  scale: number;
  /** Page size in PDF points (visual, after /Rotate) */
  pageWidth: number;
  pageHeight: number;
  /** 1-based number of this page in the output document */
  pageNumber: number;
  totalPages: number;
}

/**
 * WYSIWYG preview of the page decorations (P1-A).
 *
 * It is not interactive and hidden from assistive technology: the canvas already carries the page
 * label, and the dialog is where the values are read and edited. Positions come from percentages
 * plus `scale`-converted typography, so the preview matches `io/drawDecorations.ts` without a second
 * layout algorithm.
 */
export function DecorationLayer({
  decoration,
  scale,
  pageWidth,
  pageHeight,
  pageNumber,
  totalPages,
}: DecorationLayerProps) {
  const header = decoration.header;
  const footer = decoration.footer;
  const numbers = decoration.numbers?.enabled ? decoration.numbers : undefined;
  const watermark = decoration.watermark?.text.trim() ? decoration.watermark : undefined;
  if (!header?.text.trim() && !footer?.text.trim() && !numbers && !watermark) return null;

  const lineStyle = (
    fontSize: number,
    color: string,
    margin: number,
    align: 'left' | 'center' | 'right',
  ): CSSProperties => ({
    fontSize: fontSize * scale,
    color,
    textAlign: align,
    left: margin * scale,
    right: margin * scale,
    lineHeight: 1.2,
  });

  const anchors = watermark
    ? watermark.tiled
      ? watermarkTileAnchors(pageWidth, pageHeight, watermark.spacing)
      : [{ x: 0.5, y: 0.5 }]
    : [];

  return (
    <div
      aria-hidden="true"
      data-testid="pdf-decoration-layer"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {header?.text.trim() ? (
        <div
          className="absolute whitespace-pre-wrap"
          style={{
            ...lineStyle(header.fontSize, header.color, header.margin, header.align),
            top: header.margin * scale,
          }}
        >
          {header.text}
        </div>
      ) : null}
      {footer?.text.trim() ? (
        <div
          className="absolute whitespace-pre-wrap"
          style={{
            ...lineStyle(footer.fontSize, footer.color, footer.margin, footer.align),
            bottom: footer.margin * scale,
          }}
        >
          {footer.text}
        </div>
      ) : null}
      {numbers ? (
        <div
          data-testid="pdf-decoration-number"
          className="absolute whitespace-nowrap"
          style={{
            ...lineStyle(
              numbers.fontSize,
              numbers.color,
              numbers.margin,
              numbers.position === 'bottom-left'
                ? 'left'
                : numbers.position === 'bottom-right'
                  ? 'right'
                  : 'center',
            ),
            ...(numbers.position === 'top-center'
              ? { top: numbers.margin * scale }
              : { bottom: numbers.margin * scale }),
          }}
        >
          {pageNumberFor(numbers, pageNumber - 1, totalPages)}
        </div>
      ) : null}
      {watermark
        ? anchors.map((anchor, index) => (
            <span
              key={`${anchor.x}-${anchor.y}-${index}`}
              className="absolute whitespace-nowrap"
              style={{
                left: `${anchor.x * 100}%`,
                top: `${(1 - anchor.y) * 100}%`,
                // PDF rotation is CCW; CSS is CW, so the sign flips to look the same
                transform: `translate(-50%, -50%) rotate(${-watermark.rotation}deg)`,
                fontSize: watermark.fontSize * scale,
                color: watermark.color,
                opacity: watermark.opacity,
                lineHeight: 1,
              }}
            >
              {watermark.text}
            </span>
          ))
        : null}
    </div>
  );
}
