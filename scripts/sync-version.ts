/**
 * Version sync: the root `package.json` `version` is the single source of truth;
 * the version is written into the copies that cannot be derived.
 *
 * Why only Cargo remains to sync:
 * - `src-tauri/tauri.conf.json` may point `version` at a **path** to package.json
 *   (Tauri v2 spec: either semver or a package.json path), so no copy is kept by
 *   default; if it is changed back to a literal, this script still syncs it — both
 *   forms are supported.
 * - Cargo cannot derive its version from package.json: `Cargo.toml` needs a literal,
 *   and the version entry for this crate (syntools) in `Cargo.lock` must change too,
 *   otherwise cargo rewrites the lock file.
 *
 * Usage:
 *   pnpm version:sync    write and report each target
 *   pnpm version:check   verify only; exit code 1 on drift (CI / pre-commit guard)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG_FILE = path.join(ROOT, 'package.json');
/** Cargo crate name (= [package] name in Cargo.toml), used to locate our entry in Cargo.lock */
const CRATE_NAME = 'syntools';
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const FILES = {
  tauriConf: path.join(ROOT, 'src-tauri/tauri.conf.json'),
  cargoToml: path.join(ROOT, 'src-tauri/Cargo.toml'),
  cargoLock: path.join(ROOT, 'src-tauri/Cargo.lock'),
};

type Status = 'in-sync' | 'updated' | 'derived' | 'drifted' | 'missing' | 'unsupported';

interface Report {
  label: string;
  status: Status;
  detail: string;
}

const isCheck = process.argv.includes('--check');

function readVersionFrom(file: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/** tauri.conf.json: sync when it is a literal; when it is a path, verify the package.json it points to */
function syncTauriConf(version: string): Report {
  const label = 'tauri.conf.json';
  if (!existsSync(FILES.tauriConf))
    return { label, status: 'missing', detail: 'file not found, skipped' };

  const raw = readFileSync(FILES.tauriConf, 'utf8');
  const current = readVersionFrom(FILES.tauriConf);
  if (current === null)
    return { label, status: 'unsupported', detail: 'no readable version field' };

  // Path form (e.g. "../package.json"): read by the Tauri CLI itself, so only verify here
  if (current.endsWith('.json')) {
    const resolved = path.resolve(path.dirname(FILES.tauriConf), current);
    const referenced = existsSync(resolved) ? readVersionFrom(resolved) : null;
    if (referenced === version) {
      return {
        label,
        status: 'derived',
        detail: `points at ${current} (${version}), nothing to sync`,
      };
    }
    return {
      label,
      status: 'drifted',
      detail: `points at ${current}, whose version is ${referenced ?? 'unreadable'}, expected ${version}`,
    };
  }

  if (current === version) return { label, status: 'in-sync', detail: current };
  if (isCheck) return { label, status: 'drifted', detail: `${current} → ${version}` };

  writeFileSync(FILES.tauriConf, raw.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
  return { label, status: 'updated', detail: `${current} → ${version}` };
}

/** Cargo.toml: only change the version in the [package] section, never dependency versions */
function syncCargoToml(version: string): Report {
  const label = 'Cargo.toml';
  if (!existsSync(FILES.cargoToml))
    return { label, status: 'missing', detail: 'file not found, skipped' };

  const lines = readFileSync(FILES.cargoToml, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.trim() === '[package]');
  if (start < 0) return { label, status: 'unsupported', detail: 'no [package] section' };
  const after = lines.findIndex((line, i) => i > start && /^\s*\[/.test(line));
  const end = after < 0 ? lines.length : after;

  let index = -1;
  for (let i = start + 1; i < end; i += 1) {
    if (/^\s*version\s*=/.test(lines[i])) {
      index = i;
      break;
    }
  }
  if (index < 0)
    return { label, status: 'unsupported', detail: 'no version in the [package] section' };

  const current = /^\s*version\s*=\s*"([^"]*)"/.exec(lines[index])?.[1] ?? '';
  if (current === version) return { label, status: 'in-sync', detail: current };
  if (isCheck) return { label, status: 'drifted', detail: `${current} → ${version}` };

  lines[index] = lines[index].replace(/(version\s*=\s*")[^"]*(")/, `$1${version}$2`);
  writeFileSync(FILES.cargoToml, lines.join('\n'));
  return { label, status: 'updated', detail: `${current} → ${version}` };
}

/** Cargo.lock: only change the version of the [[package]] name = "syntools" entry */
function syncCargoLock(version: string): Report {
  const label = 'Cargo.lock';
  if (!existsSync(FILES.cargoLock))
    return { label, status: 'missing', detail: 'file not found, skipped' };

  const lines = readFileSync(FILES.cargoLock, 'utf8').split('\n');
  const nameIndex = lines.findIndex(
    (line, i) => line.trim() === `name = "${CRATE_NAME}"` && lines[i - 1]?.trim() === '[[package]]',
  );
  if (nameIndex < 0) {
    return { label, status: 'missing', detail: `no package entry for ${CRATE_NAME}` };
  }

  let index = -1;
  for (let i = nameIndex + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '' || lines[i].trim() === '[[package]]') break;
    if (/^\s*version\s*=/.test(lines[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return { label, status: 'unsupported', detail: 'no version in the package entry' };

  const current = /^\s*version\s*=\s*"([^"]*)"/.exec(lines[index])?.[1] ?? '';
  if (current === version) return { label, status: 'in-sync', detail: current };
  if (isCheck) return { label, status: 'drifted', detail: `${current} → ${version}` };

  lines[index] = lines[index].replace(/(version\s*=\s*")[^"]*(")/, `$1${version}$2`);
  writeFileSync(FILES.cargoLock, lines.join('\n'));
  return { label, status: 'updated', detail: `${current} → ${version}` };
}

const ICONS: Record<Status, string> = {
  'in-sync': '=',
  updated: '+',
  derived: '→',
  drifted: '!',
  missing: '-',
  unsupported: '?',
};

function main(): void {
  // CI may inject a build version through the environment (e.g. 0.7.0-dev.123.abc1234),
  // so dev/nightly builds carry a unique traceable version; defaults to package.json.
  const envVersion = process.env.SYNTOOLS_BUILD_VERSION?.trim();
  const version = envVersion && envVersion.length > 0 ? envVersion : readVersionFrom(PKG_FILE);
  if (!version || !SEMVER_RE.test(version)) {
    console.error(
      `✖ Invalid version source (env=${JSON.stringify(envVersion)}): ${JSON.stringify(version)}`,
    );
    process.exit(1);
  }

  const reports = [syncTauriConf(version), syncCargoToml(version), syncCargoLock(version)];

  console.log(
    `SynTools version sync${isCheck ? ' (check mode)' : ''} — source package.json: ${version}`,
  );
  for (const report of reports) {
    console.log(`  [${ICONS[report.status]}] ${report.label.padEnd(15)} ${report.detail}`);
  }

  const drifted = reports.filter((report) => report.status === 'drifted');
  if (drifted.length > 0) {
    const hint = isCheck
      ? 'run pnpm version:sync'
      : 'check whether the files above were edited by hand';
    console.error(`\n✖ ${drifted.length} target(s) differ from package.json, ${hint}`);
    process.exit(1);
  }

  if (reports.some((report) => report.status === 'unsupported' || report.status === 'missing')) {
    console.warn('\n⚠ Some targets could not be handled; see the [ ] markers above');
  }
  console.log(isCheck ? '\n✔ Versions match' : '\n✔ Sync complete');
}

main();
