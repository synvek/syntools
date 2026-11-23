/**
 * Large-document policy (M4-5).
 *
 * The threshold lives here, away from the controller, so the rule is unit testable without opening a
 * 20MB file: committing one to the repo would bloat every clone just to prove a `>` comparison.
 */

/** Above this size adjacent-page preloading stops and thumbnails become opt-in */
export const LARGE_DOC_BYTES = 20 * 1024 * 1024;

export function isLargeDocument(byteLength: number): boolean {
  return Number.isFinite(byteLength) && byteLength > LARGE_DOC_BYTES;
}

/**
 * True when the rail must ask before generating thumbnails.
 *
 * `forced` is the user's explicit "generate anyway" for this document; it resets when the file
 * changes because it is component state, not document state.
 */
export function thumbnailsNeedConsent(large: boolean, forced: boolean): boolean {
  return large && !forced;
}
