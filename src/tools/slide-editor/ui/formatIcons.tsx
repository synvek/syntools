import type { ReactNode } from 'react';

/**
 * Icons dedicated to the "format" row.
 *
 * Same reasoning as `toolIcons.tsx`: font color, highlight, outline, line spacing and text alignment have
 * no suitable glyph in the shared icon set (`palette` reads more like a palette tool, `listCheck` like a checklist),
 * so they are defined inline here to keep this row's visual language consistent. Drawing follows the existing
 * convention: 24 viewBox, 1.7 stroke, currentColor.
 */

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const glyph = (text: string, className: string) => (
  <span className={`text-[13px] leading-none ${className}`} aria-hidden="true">
    {text}
  </span>
);

/* --------------------------- Glyphs (B/I/U/S) --------------------------- */

export const BoldGlyph = () => glyph('B', 'font-bold');
export const ItalicGlyph = () => glyph('I', 'font-serif italic');
export const UnderlineGlyph = () => glyph('U', 'underline');
export const StrikeGlyph = () => glyph('S', 'line-through');

/* ------------------------------ Font size ladder ------------------------------ */

export function FontSizeUpIcon() {
  return svg(
    <>
      <path d="M2.5 19 8 6l5.5 13" />
      <path d="M4.4 14.6h7.2" />
      <path d="M17 12.5h5M19.5 10v5" />
    </>,
  );
}

export function FontSizeDownIcon() {
  return svg(
    <>
      <path d="M2.5 19 8 6l5.5 13" />
      <path d="M4.4 14.6h7.2" />
      <path d="M17 12.5h5" />
    </>,
  );
}

/* ------------------------------- Color group ------------------------------- */

/** Text color: letter A with a bar underneath (the bar uses a darker currentColor to signal "this is a color button") */
export function TextColorIcon() {
  return svg(
    <>
      <path d="M3.5 16 9 4l5.5 12" />
      <path d="M5.3 12.6h7.4" />
      <path d="M3.5 20.5h17" strokeWidth={2.6} />
    </>,
  );
}

/** Highlight: a highlighter pen */
export function HighlightIcon() {
  return svg(
    <>
      <path d="M6.5 14.5 12 9l3.5 3.5L10 18H6.5z" />
      <path d="M14 7 17.2 3.8 20.4 7 17.2 10.2z" />
      <path d="M3.5 21h17" strokeWidth={2.6} />
    </>,
  );
}

/** Outline: hollow square + weight ticks */
export function OutlineIcon() {
  return svg(
    <>
      <rect x="3.5" y="3.5" width="17" height="12" rx="1.5" />
      <path d="M3.5 19.5h5.5" strokeWidth={1.2} />
      <path d="M11 19.5h3.5" strokeWidth={2.2} />
      <path d="M16.5 19.5h4" strokeWidth={3.4} />
    </>,
  );
}

/* ------------------------------ Text alignment ------------------------------ */

export function AlignLeftIcon() {
  return svg(
    <>
      <path d="M3 5.5h18M3 10h12M3 14.5h18M3 19h14" />
    </>,
  );
}

export function AlignCenterIcon() {
  return svg(
    <>
      <path d="M3 5.5h18M6 10h12M3 14.5h18M5 19h14" />
    </>,
  );
}

export function AlignRightIcon() {
  return svg(
    <>
      <path d="M3 5.5h18M9 10h12M3 14.5h18M7 19h14" />
    </>,
  );
}

export function AlignJustifyIcon() {
  return svg(
    <>
      <path d="M3 5.5h18M3 10h18M3 14.5h18M3 19h11" />
    </>,
  );
}

/** Line spacing: two lines of text with up/down arrows on the right */
export function LineSpacingIcon() {
  return svg(
    <>
      <path d="M3 8h11M3 16h11" />
      <path d="M19.5 5v14M16.8 7.8 19.5 5l2.7 2.8M16.8 16.2 19.5 19l2.7-2.8" />
    </>,
  );
}

export function BulletListIcon() {
  return svg(
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4.2" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4.2" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </>,
  );
}

export function NumberListIcon() {
  return svg(
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M3.4 4.2 4.8 3.6v4.6" />
      <path d="M3.3 10.6c.5-.7 1.9-.7 1.9.3 0 1-1.9 1.4-1.9 2.7h2.2" />
      <path d="M3.2 16.4c.6-.6 2-.5 2 .6 0 .7-.6 1-1 1 .5 0 1 .3 1 1.1 0 1.3-1.7 1.4-2.2.6" />
    </>,
  );
}

/* ------------------------------ Effects ------------------------------ */

/** Shadow: solid square + offset ghost */
export function ShadowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity={0.22} />
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
      />
    </svg>
  );
}

/** Corner radius: square corner vs rounded corner */
export function CornerRadiusIcon() {
  return svg(
    <>
      <path d="M9 4H4v16h16V9" />
      <path d="M4 9a5 5 0 0 1 5-5" />
    </>,
  );
}

/** Opacity: half solid, half dashed square */
export function OpacityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
      />
      <path d="M3 5a2 2 0 0 1 2-2h7v18H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity={0.85} />
    </svg>
  );
}
