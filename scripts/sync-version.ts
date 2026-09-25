/**
 * 版本号同步：以根目录 `package.json` 的 `version` 为唯一来源，
 * 把版本写进「无法派生」的副本。
 *
 * 为什么同步面只剩 Cargo：
 * - `src-tauri/tauri.conf.json` 的 `version` 可以写成指向 package.json 的**路径**
 *   （Tauri v2 规范：semver 或 package.json 路径二选一），所以默认不再保留副本；
 *   若被改回字面量，本脚本会照常同步它，两种写法都支持。
 * - Cargo 无法从 package.json 派生版本：`Cargo.toml` 必须写字面量，
 *   `Cargo.lock` 中本包（syntools）的版本条目也要跟着变，否则 cargo 会重写锁文件。
 *
 * 用法：
 *   pnpm version:sync    写入并逐项报告
 *   pnpm version:check   只校验，发现漂移则退出码 1（CI / 提交前守卫）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG_FILE = path.join(ROOT, 'package.json');
/** Cargo 包名（= Cargo.toml 的 [package] name），用于在 Cargo.lock 中定位本包条目 */
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

/** tauri.conf.json：字面量则同步；路径写法则校验其指向的 package.json */
function syncTauriConf(version: string): Report {
  const label = 'tauri.conf.json';
  if (!existsSync(FILES.tauriConf))
    return { label, status: 'missing', detail: '文件不存在，已跳过' };

  const raw = readFileSync(FILES.tauriConf, 'utf8');
  const current = readVersionFrom(FILES.tauriConf);
  if (current === null) return { label, status: 'unsupported', detail: '没有可读的 version 字段' };

  // 路径写法（例如 "../package.json"）：由 Tauri CLI 自行读取，这里只做校验
  if (current.endsWith('.json')) {
    const resolved = path.resolve(path.dirname(FILES.tauriConf), current);
    const referenced = existsSync(resolved) ? readVersionFrom(resolved) : null;
    if (referenced === version) {
      return { label, status: 'derived', detail: `指向 ${current}（${version}），无需同步` };
    }
    return {
      label,
      status: 'drifted',
      detail: `指向 ${current}，其版本为 ${referenced ?? '不可读'}，期望 ${version}`,
    };
  }

  if (current === version) return { label, status: 'in-sync', detail: current };
  if (isCheck) return { label, status: 'drifted', detail: `${current} → ${version}` };

  writeFileSync(FILES.tauriConf, raw.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
  return { label, status: 'updated', detail: `${current} → ${version}` };
}

/** Cargo.toml：只改 [package] 段内的 version，不碰依赖里的 version */
function syncCargoToml(version: string): Report {
  const label = 'Cargo.toml';
  if (!existsSync(FILES.cargoToml))
    return { label, status: 'missing', detail: '文件不存在，已跳过' };

  const lines = readFileSync(FILES.cargoToml, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.trim() === '[package]');
  if (start < 0) return { label, status: 'unsupported', detail: '缺少 [package] 段' };
  const after = lines.findIndex((line, i) => i > start && /^\s*\[/.test(line));
  const end = after < 0 ? lines.length : after;

  let index = -1;
  for (let i = start + 1; i < end; i += 1) {
    if (/^\s*version\s*=/.test(lines[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return { label, status: 'unsupported', detail: '[package] 段内没有 version' };

  const current = /^\s*version\s*=\s*"([^"]*)"/.exec(lines[index])?.[1] ?? '';
  if (current === version) return { label, status: 'in-sync', detail: current };
  if (isCheck) return { label, status: 'drifted', detail: `${current} → ${version}` };

  lines[index] = lines[index].replace(/(version\s*=\s*")[^"]*(")/, `$1${version}$2`);
  writeFileSync(FILES.cargoToml, lines.join('\n'));
  return { label, status: 'updated', detail: `${current} → ${version}` };
}

/** Cargo.lock：只改 [[package]] name = "syntools" 那一条的 version */
function syncCargoLock(version: string): Report {
  const label = 'Cargo.lock';
  if (!existsSync(FILES.cargoLock))
    return { label, status: 'missing', detail: '文件不存在，已跳过' };

  const lines = readFileSync(FILES.cargoLock, 'utf8').split('\n');
  const nameIndex = lines.findIndex(
    (line, i) => line.trim() === `name = "${CRATE_NAME}"` && lines[i - 1]?.trim() === '[[package]]',
  );
  if (nameIndex < 0) {
    return { label, status: 'missing', detail: `未找到 ${CRATE_NAME} 的包条目` };
  }

  let index = -1;
  for (let i = nameIndex + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '' || lines[i].trim() === '[[package]]') break;
    if (/^\s*version\s*=/.test(lines[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return { label, status: 'unsupported', detail: '包条目内没有 version' };

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
  const version = readVersionFrom(PKG_FILE);
  if (!version || !SEMVER_RE.test(version)) {
    console.error(`✖ package.json 的 version 不是合法 semver：${JSON.stringify(version)}`);
    process.exit(1);
  }

  const reports = [syncTauriConf(version), syncCargoToml(version), syncCargoLock(version)];

  console.log(`SynTools 版本同步${isCheck ? '（校验模式）' : ''} — 来源 package.json: ${version}`);
  for (const report of reports) {
    console.log(`  [${ICONS[report.status]}] ${report.label.padEnd(15)} ${report.detail}`);
  }

  const drifted = reports.filter((report) => report.status === 'drifted');
  if (drifted.length > 0) {
    const hint = isCheck ? '请运行 pnpm version:sync' : '请检查上述文件是否被手动改动';
    console.error(`\n✖ ${drifted.length} 处版本与 package.json 不一致，${hint}`);
    process.exit(1);
  }

  if (reports.some((report) => report.status === 'unsupported' || report.status === 'missing')) {
    console.warn('\n⚠ 有目标未能处理，请查看上面的 [ ] 标记');
  }
  console.log(isCheck ? '\n✔ 版本一致' : '\n✔ 同步完成');
}

main();
