/**
 * Runtime switch for P1-5 incremental pagination.
 *
 * Two sources, in order:
 * 1. `VITE_INCR_LAYOUT` — the release flag (`1` / `true` / `on` / `yes` turns it on).
 * 2. `globalThis.__RTE_INCR_LAYOUT__` — test-only override so e2e can compare the incremental and the
 *    full-measure paths inside one build (a build-time flag cannot be toggled per test).
 *
 * Default off: the incremental path reuses cached block geometry, which is only correct while the
 * cached assumptions hold (no width / zoom change, no block count change). Keeping it behind a flag
 * makes "one bad document paginates differently" a switch away from the known-good full measure.
 */

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

const isTruthy = (raw: string | undefined): boolean =>
  typeof raw === 'string' && TRUTHY.has(raw.trim().toLowerCase());

export function isIncrementalLayoutEnabled(
  raw: string | undefined = readEnvFlag(),
  override: unknown = readOverride(),
): boolean {
  if (typeof override === 'boolean') return override;
  return isTruthy(raw);
}

function readEnvFlag(): string | undefined {
  // `import.meta.env` is absent in plain Node (unit tests) — optional chain keeps this importable
  return import.meta.env?.VITE_INCR_LAYOUT;
}

function readOverride(): unknown {
  return (globalThis as { __RTE_INCR_LAYOUT__?: unknown }).__RTE_INCR_LAYOUT__;
}
