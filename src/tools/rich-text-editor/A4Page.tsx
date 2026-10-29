import { createPortal } from 'react-dom';
import type { CSSProperties, Ref } from 'react';
import { watermarkCssVars, type WatermarkConfig } from './pageSetup';

interface PrintLayerProps {
  /** Sanitized document HTML */
  html: string;
  flowRef: Ref<HTMLDivElement>;
  /** Text watermark (null for none): fixed-positioned so it repeats on every printed page */
  watermark?: WatermarkConfig | null;
  /**
   * Page-setup CSS variables (`PageMetrics.cssVars`). Required for WYSIWYG: the page view is laid out
   * at `--rte-content-width`, so the print/snapshot flow must resolve the same value — without them the
   * flow falls back to the A4 default (170mm) and every non-default page setup (Letter, landscape,
   * custom margins) is measured at a different width, which changes line breaks and the page count.
   */
  cssVars?: Record<string, string>;
}

/**
 * A4 print/export layer (technical design §7.3):
 * - Screen: rendered into an off-screen container on body (still laid out so heights can be measured);
 * - Print: @media print keeps only this container and lets the browser paginate;
 * - Snapshot: measures block boundaries in the same container, then slices it into pages.
 * Print and snapshot therefore share an identical layout.
 */
export function PrintLayer({ html, flowRef, watermark, cssVars }: PrintLayerProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="rte-print-root" aria-hidden="true" style={cssVars as CSSProperties | undefined}>
      {/* Watermark lives outside the print flow: a fixed element repeats on every printed page */}
      {watermark && watermark.text.trim() ? (
        <div className="rte-print-watermark" style={watermarkCssVars(watermark) as CSSProperties}>
          <span>{watermark.text}</span>
        </div>
      ) : null}
      <div className="rte-print-flow" ref={flowRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
    document.body,
  );
}
