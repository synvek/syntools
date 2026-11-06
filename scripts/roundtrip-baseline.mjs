#!/usr/bin/env node
/**
 * OOXML round-trip baseline (implementation plan P0-1).
 *
 * Runs the suite with BASELINE_REPORT=1 so it writes
 * `fixtures/ooxml-baseline/{manifest,report}.json` and compares against `report.golden.json`.
 * The comparison is now a release gate: fewer metrics back, new degradations, changed fixtures
 * or a worse per-part status fail the step. Improvements still print as drift and are accepted
 * with `--update`. CI no longer marks the step `continue-on-error`.
 *
 * Usage:
 *   pnpm baseline:roundtrip                    # gate: regressions fail
 *   pnpm baseline:roundtrip --update          # accept a new golden baseline
 *   pnpm baseline:roundtrip --informational   # print blockers without failing (local debugging)
 *   BASELINE_REQUIRE_COVERAGE=1 pnpm baseline:roundtrip  # require >=10 external samples and all
 *                                                        # 4 office-suite families (CI sets this)
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const update = process.argv.includes('--update');
const informational = process.argv.includes('--informational');
const bin = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vitest.cmd' : 'vitest',
);

const result = spawnSync(bin, ['run', 'src/tools/baseline'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BASELINE_REPORT: '1',
    ...(update ? { BASELINE_UPDATE: '1' } : {}),
    ...(informational ? { BASELINE_INFORMATIONAL: '1' } : {}),
  },
});

if (result.error) {
  console.error('[baseline] failed to start vitest:', result.error.message);
  process.exit(1);
}

if (!update) {
  console.log(
    informational
      ? '[baseline] informational: golden left untouched; blockers were printed but ignored.'
      : '[baseline] gate: golden left untouched. Review fixtures/ooxml-baseline/report.json, then re-run with --update to accept improvements.',
  );
}

process.exit(result.status ?? 1);
