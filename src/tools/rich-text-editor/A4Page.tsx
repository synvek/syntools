import { createPortal } from 'react-dom';
import type { CSSProperties, Ref } from 'react';
import { watermarkCssVars, type WatermarkConfig } from './pageSetup';

interface PrintLayerProps {
  /** Sanitized document HTML */
  html: string;
  flowRef: Ref<HTMLDivElement>;
  /** Text watermark (null for none): fixed-positioned so it repeats on every printed page */
  watermark?: WatermarkConfig | null;
}

/**
 * A4 print/export layer (technical design §7.3):
 * - Screen: rendered into an off-screen container on body (still laid out so heights can be measured);
 * - Print: @media print keeps only this container and lets the browser paginate;
 * - Snapshot: measures block boundaries in the same container, then slices it into pages.
 * Print and snapshot therefore share an identical layout.
 */
export function PrintLayer({ html, flowRef, watermark }: PrintLayerProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="rte-print-root" aria-hidden="true">
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
