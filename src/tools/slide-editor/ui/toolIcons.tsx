import type { ReactNode } from 'react';

/**
 * Icons dedicated to the slide toolbar.
 *
 * Since the toolbar switched to "icon-first with text in tooltips", z-order / group / align / distribute / flip
 * have no suitable glyph in the shared icon set (`chevronLeft` and friends read as "previous slide"), so they
 * are defined inline here. Drawing matches the built-in icon set: 24 viewBox, currentColor stroke.
 */

const svg = (children: ReactNode, extra: { dashed?: boolean } = {}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
    {...(extra.dashed ? { strokeDasharray: '3 2.5' } : {})}
  >
    {children}
  </svg>
);

/** Undo / redo: the standard curved arrow (matching the word-processor toolbar) */
export function UndoIcon() {
  return svg(
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </>,
  );
}

export function RedoIcon() {
  return svg(
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
    </>,
  );
}

/** Align: outer frame + lines all pushed left */
export function AlignIcon() {
  return svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M6.5 8h8M6.5 12h11M6.5 16h6" />
    </>,
  );
}

/** Distribute: outer frame + three evenly spaced bars */
export function DistributeIcon() {
  return svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8v8M12 8v8M17 8v8" />
    </>,
  );
}

/** Flip: a center axis + two mirrored triangles */
export function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M12 2v20" stroke="currentColor" strokeWidth={1.7} strokeDasharray="3 2.5" />
      <path d="M9.5 7 3.5 12l6 5z" fill="currentColor" fillOpacity={0.9} />
      <path d="M14.5 7l6 5-6 5z" fill="currentColor" fillOpacity={0.3} />
    </svg>
  );
}

/** Z-order: front = bring to front, back = send to back, forward = bring forward, backward = send backward */
export function LayerIcon({ variant }: { variant: 'front' | 'back' | 'forward' | 'backward' }) {
  if (variant === 'front') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect
          x="8"
          y="8"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        />
        <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" fillOpacity={0.85} />
      </svg>
    );
  }
  if (variant === 'back') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fillOpacity={0.35} />
        <rect
          x="4"
          y="4"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        />
      </svg>
    );
  }
  if (variant === 'forward') {
    return svg(
      <>
        <rect x="4" y="10" width="11" height="11" rx="2" />
        <path d="M14 3v8M11 8.5 14 5.5l3 3" />
      </>,
    );
  }
  return svg(
    <>
      <rect x="4" y="3" width="11" height="11" rx="2" />
      <path d="M14 13v8M11 15.5l3 3 3-3" />
    </>,
  );
}

/** Group: two squares + a dashed outer frame */
export function GroupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1.5" fill="currentColor" fillOpacity={0.8} />
      <rect
        x="12.5"
        y="12.5"
        width="8.5"
        height="8.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity={0.8}
      />
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeDasharray="3 2.5"
      />
    </svg>
  );
}

/** Ungroup: two squares + a slash */
export function UngroupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1.5" fill="currentColor" fillOpacity={0.8} />
      <rect
        x="12.5"
        y="12.5"
        width="8.5"
        height="8.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity={0.8}
      />
      <path d="M4.5 19.5 19.5 4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}
