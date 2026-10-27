#!/usr/bin/env node
/**
 * Generates THIRD-PARTY-NOTICES.md (third-party components and license notices).
 *
 * Data sources:
 * - Runtime npm dependencies: `pnpm licenses ls --prod --json` (only packages shipped in the
 *   build, excluding devDependencies)
 * - Rust crates: `src-tauri/Cargo.lock` plus Cargo.toml from the local ~/.cargo/registry
 *
 * Why this file exists: AGPL-3.0 as well as Apache-2.0 / MPL-2.0 / OFL-1.1 require notices to be
 * kept with distribution. The commercial builds (desktop Pro, enterprise server) need it too —
 * a buyer's legal team will always ask for it.
 *
 * Usage: pnpm notices
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');

/** Dual-license choices: state the permissive side explicitly to avoid ambiguity */
const DUAL_CHOICE = {
  jszip: { choose: 'MIT', from: 'MIT OR GPL-3.0-or-later' },
  dompurify: { choose: 'Apache-2.0', from: 'MPL-2.0 OR Apache-2.0' },
};

/** Packages with no license in package.json but an MIT notice in their sources */
const UNKNOWN_ANNOTATION = {
  buffers: 'bundled LICENSE is MIT (package.json has no license field)',
  khroma: 'bundled LICENSE is MIT (package.json has no license field)',
  '@univerjs/telemetry': 'lockfile-only peer entry; not installed and not bundled',
};

/** Fonts and data files shipped with the build need their own explanation in the body */
const SPECIAL_NOTES = [
  {
    title: 'mediabunny — MPL-2.0 (file-level copyleft)',
    body: [
      'The audio/video tools use mediabunny for container demuxing/muxing. MPL-2.0 obligations attach only to **modified files**:',
      'this project has not modified its sources, so closed-source distribution requires disclosing no code; any modification must be published.',
      'Full license text: https://mozilla.org/MPL/2.0/',
    ],
  },
  {
    title: 'KaTeX fonts — SIL OFL-1.1',
    body: [
      'The math formula tool ships 59 KaTeX font files (woff/woff2/ttf) under the SIL Open Font License 1.1.',
      'OFL permits commercial use, embedding and redistribution, but the fonts **may not be sold on their own**, and a Reserved Font Name must not be kept after modification.',
      'This project redistributes them unchanged, with no glyph modifications and unchanged font names.',
      'Full license text: https://openfontlicense.org/open-font-license-official-text/',
    ],
  },
  {
    title: 'Apache-2.0 components',
    body: [
      "Apache-2.0 requires keeping copyright and license notices and includes a patent grant (section 3). Keep each package's NOTICE file when distributing.",
      'Full license text: https://www.apache.org/licenses/LICENSE-2.0',
    ],
  },
  {
    title: 'Removed components (license reasons)',
    body: [
      '| Component | Original license | Action | Reason |',
      '| --- | --- | --- | --- |',
      '| `@ffmpeg/core-mt` / `@ffmpeg/ffmpeg` | GPL-2.0-or-later (published builds enable `--enable-gpl --enable-libx264 --enable-libx265`) | Removed; media handling moved to WebCodecs + mediabunny | Shipping it in the closed-source commercial build triggers GPL source-disclosure duties |',
      '| `ua-parser-js@2` | AGPL-3.0-or-later | Downgraded to `1.0.41` (MIT) | Same as above; the tool only uses APIs present in v1 |',
      '',
      'The current dependency tree contains **no GPL / AGPL / SSPL / Commons Clause / non-commercial** components; `pnpm license:check` and `cargo deny` enforce this in CI.',
    ],
  },
];

function pickEntries() {
  const raw = execSync('pnpm licenses ls --prod --json', { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(raw);
}

function normalize(byLicense) {
  /** @type {{name:string,versions:string[],license:string,homepage?:string,installed:boolean}[]} */
  const out = [];
  for (const [license, packages] of Object.entries(byLicense)) {
    for (const pkg of packages) {
      const paths = Array.isArray(pkg.paths) ? pkg.paths : [];
      out.push({
        name: pkg.name,
        versions: [...(pkg.versions ?? [])].sort(),
        license,
        homepage: pkg.homepage || undefined,
        installed: paths.length > 0,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function readCargoCrats() {
  const lockPath = path.join(ROOT, 'src-tauri/Cargo.lock');
  if (!existsSync(lockPath)) return { crates: [], unresolved: 0 };
  const lock = readFileSync(lockPath, 'utf8');
  const pkgs = [...lock.matchAll(/\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/g)].map(
    (m) => ({ name: m[1], version: m[2] }),
  );

  const roots = (() => {
    const dir = path.join(homedir(), '.cargo/registry/src');
    if (!existsSync(dir)) return [];
    return readdirSync(dir).map((d) => path.join(dir, d));
  })();

  const index = new Map();
  for (const root of roots) {
    for (const dir of readdirSync(root)) index.set(dir, path.join(root, dir));
  }

  const crates = [];
  let unresolved = 0;
  for (const pkg of pkgs) {
    const dir = index.get(`${pkg.name}-${pkg.version}`);
    if (!dir) {
      unresolved += 1;
      continue;
    }
    let license = '';
    try {
      const manifest = readFileSync(path.join(dir, 'Cargo.toml'), 'utf8');
      license = /^license\s*=\s*"([^"]+)"/m.exec(manifest)?.[1] ?? '';
      if (!license) {
        const file = /^license-file\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
        license = file ? `file:${file}` : 'UNKNOWN';
      }
    } catch {
      unresolved += 1;
      continue;
    }
    crates.push({ ...pkg, license });
  }
  return { crates: crates.sort((a, b) => a.name.localeCompare(b.name)), unresolved };
}

function summarize(entries, key) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry[key], (counts.get(entry[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const npm = normalize(pickEntries());
const { crates, unresolved } = readCargoCrats();
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const lines = [];
const push = (...items) => lines.push(...items);

push('# Third-Party Notices');
push('');
push(
  `This file lists the third-party components shipped with **SynTools ${pkg.version}** and their licenses;`,
);
push(
  'it applies to the web build, the desktop installer (Tauri) and the enterprise server deployment.',
);
push('');
push(
  'This project itself is released under **AGPL-3.0-only** (see `LICENSE`). If you bought a commercial license,',
);
push(
  'these notices still apply: they govern third-party components and do not change with how this project is licensed.',
);
push('');
push('> Generated by `pnpm notices`; do not edit by hand. Sources:');
push(
  '> runtime npm dependencies (`pnpm licenses ls --prod --json`, excluding devDependencies) and `src-tauri/Cargo.lock`.',
);
push('');

push('## 1. Overview');
push('');
push(`| Scope | Components | Notes |`);
push('| --- | --- | --- |');
push(
  `| Runtime npm dependencies | ${npm.length} | packages shipped in the build (deduplicated by name) |`,
);
push(
  `| Rust crates (desktop) | ${crates.length}${unresolved ? ` + ${unresolved} not cached locally` : ''} | crates inside the Tauri app binary |`,
);
push('');
push(
  'Every component is under a permissive license, file-level copyleft, or a font license; **none are GPL / AGPL / SSPL / non-commercial**.',
);
push('CI enforces this with `pnpm license:check` (npm) and `cargo deny check licenses` (Rust).');
push('');

push('## 2. License distribution of runtime npm dependencies');
push('');
push('| License | Packages |');
push('| --- | --- |');
for (const [license, count] of summarize(npm, 'license')) {
  push(`| ${license} | ${count} |`);
}
push('');

push('## 3. Obligations that need special mention');
push('');
for (const note of SPECIAL_NOTES) {
  push(`### ${note.title}`);
  push('');
  push(...note.body);
  push('');
}

const dualRows = Object.entries(DUAL_CHOICE);
if (dualRows.length) {
  push('### Dual-license choices');
  push('');
  push('| Component | Declared license | License chosen here |');
  push('| --- | --- | --- |');
  for (const [name, choice] of dualRows) {
    push(`| ${name} | ${choice.from} | **${choice.choose}** |`);
  }
  push('');
  push(
    '`pako` declares `MIT AND Zlib`; both are permissive with similar obligations, and the bundled LICENSE satisfies both.',
  );
  push('');
}

push('### Packages with no license in package.json');
push('');
push('| Component | Treatment |');
push('| --- | --- |');
for (const [name, note] of Object.entries(UNKNOWN_ANNOTATION)) {
  push(`| ${name} | ${note} |`);
}
push('');

push('## 4. Runtime npm dependency list');
push('');
push('<details>');
push(`<summary>Expand all ${npm.length} packages</summary>`);
push('');
push('| Package | Version | License | Declared choice |');
push('| --- | --- | --- | --- |');
for (const entry of npm) {
  const choice = DUAL_CHOICE[entry.name]?.choose ?? '';
  const annotation = UNKNOWN_ANNOTATION[entry.name] ? ' (see table above)' : '';
  push(
    `| ${entry.name} | ${entry.versions.join(', ')} | ${entry.license}${annotation} | ${choice} |`,
  );
}
push('');
push('</details>');
push('');

push('## 5. Rust crate list (desktop)');
push('');
push(
  'Only the desktop (Tauri) binary contains these crates; the web and enterprise server builds do not.',
);
push('');
push('<details>');
push(`<summary>Expand the license distribution of ${crates.length} crates</summary>`);
push('');
push('| License | Crates |');
push('| --- | --- |');
for (const [license, count] of summarize(crates, 'license')) {
  push(`| ${license} | ${count} |`);
}
push('');
push('</details>');
push('');
push('<details>');
push(`<summary>Expand all ${crates.length} crates</summary>`);
push('');
push('| Crate | Version | License |');
push('| --- | --- | --- |');
for (const crate of crates) {
  push(`| ${crate.name} | ${crate.version} | ${crate.license} |`);
}
push('');
push('</details>');
if (unresolved) {
  push('');
  push(
    `> The licenses of ${unresolved} crates could not be read from the local registry cache (common for dependencies not yet unpacked).`,
  );
  push(
    '> Running `pnpm license:check:rust` re-checks with `cargo-deny` over the full dependency graph; trust that result.',
  );
}
push('');

push('## 6. Full license texts');
push('');
push(
  'Each package ships its `LICENSE` / `LICENSE.md` unchanged. Full texts of the common licenses are available at:',
);
push('');
push('| License | URL |');
push('| --- | --- |');
push('| MIT | https://opensource.org/license/mit |');
push('| ISC | https://opensource.org/license/isc-license-txt |');
push('| Apache-2.0 | https://www.apache.org/licenses/LICENSE-2.0 |');
push('| BSD-2-Clause / BSD-3-Clause | https://opensource.org/license/bsd-2-clause |');
push('| MPL-2.0 | https://mozilla.org/MPL/2.0/ |');
push('| SIL OFL-1.1 | https://openfontlicense.org/open-font-license-official-text/ |');
push('| CC0-1.0 | https://creativecommons.org/publicdomain/zero/1.0/ |');
push('| Zlib | https://opensource.org/license/zlib |');
push('| AGPL-3.0 (this project) | https://www.gnu.org/licenses/agpl-3.0.txt |');
push('');

writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(
  `Wrote THIRD-PARTY-NOTICES.md: ${npm.length} npm packages, ${crates.length} Rust crates${
    unresolved ? ` (${unresolved} unresolved)` : ''
  }`,
);
