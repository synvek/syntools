/**
 * Which page number the ribbon should report for the current scroll position.
 *
 * Continuous mode anchors on the page whose top is at (or above) the viewport top. That rule breaks
 * at the end of the document: the last page can never reach the viewport top — the scroller clamps at
 * `scrollHeight - clientHeight` — so a short final page would always report its predecessor, and
 * "next page" would bounce back one page right after the jump. At the bottom the last page wins.
 *
 * @param tops    Document-space top offset of every page, in order
 * @param anchor  Viewport top + a small slop so a page that starts just below the edge still counts
 * @param atBottom Whether the scroller is (within a pixel or two) at the end of its range
 */
export function pickCurrentPage(
  tops: readonly number[],
  anchor: number,
  atBottom: boolean,
): number {
  if (tops.length === 0) return 1;
  if (atBottom) return tops.length;

  let current = 1;
  tops.forEach((top, index) => {
    if (top <= anchor) current = index + 1;
  });
  return current;
}

/** A scroller is at its end within a couple of pixels (sub-pixel offsets are common on retina) */
export function isAtBottom(element: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): boolean {
  const overflow = element.scrollHeight - element.clientHeight;
  // Without overflow every page is "at the bottom"; the anchor rule must decide
  if (overflow <= 2) return false;
  return overflow - element.scrollTop <= 2;
}
