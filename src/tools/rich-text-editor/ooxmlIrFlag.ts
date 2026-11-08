/**
 * Feature flag for the structured-import side channel (implementation plan P0-2.6).
 *
 * The IR is a side channel, not a replacement: with the flag on, `importDocx` additionally parses the
 * package into `OoxmlIr` and reports what cannot be restored yet through the shared fidelity report.
 * With the flag off (the default) the import path is byte-for-byte what it was before P0-2.
 *
 * The raw value stays injectable so tests and callers never depend on the build environment.
 */

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

/** Default source: `VITE_USE_OOXML_IR`, read at build time. */
function envFlag(): string | undefined {
  return import.meta.env?.VITE_USE_OOXML_IR;
}

/** `1` / `true` / `on` / `yes` (case-insensitive) turn the flag on; anything else leaves it off. */
export function isOoxmlIrEnabled(raw: string | undefined = envFlag()): boolean {
  return typeof raw === 'string' && TRUTHY.has(raw.trim().toLowerCase());
}
