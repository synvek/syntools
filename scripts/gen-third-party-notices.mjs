#!/usr/bin/env node
/**
 * 生成 THIRD-PARTY-NOTICES.md（第三方组件与许可声明）。
 *
 * 数据来源：
 * - 运行时 npm 依赖：`pnpm licenses ls --prod --json`（只含会随产物发布的包，不含 devDependencies）
 * - Rust crate：`src-tauri/Cargo.lock` + 本地 ~/.cargo/registry 的 Cargo.toml
 *
 * 为什么要有这个文件：AGPL-3.0 与 Apache-2.0 / MPL-2.0 / OFL-1.1 都要求随分发保留声明。
 * 商业许可版本（桌面专业版、企业服务器版）同样需要它 —— 买方法务一定会要。
 *
 * 用法：pnpm notices
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');

/** 双许可包的取值声明：明确选宽松一侧，避免歧义 */
const DUAL_CHOICE = {
  jszip: { choose: 'MIT', from: 'MIT OR GPL-3.0-or-later' },
  dompurify: { choose: 'Apache-2.0', from: 'MPL-2.0 OR Apache-2.0' },
};

/** package.json 里没写 license、但源码里带 MIT 声明的包 */
const UNKNOWN_ANNOTATION = {
  buffers: '包内 LICENSE 为 MIT（package.json 未填写 license 字段）',
  khroma: '包内 LICENSE 为 MIT（package.json 未填写 license 字段）',
  '@univerjs/telemetry': '仅出现在 lockfile 的 peer 条目中，未安装、未进入产物',
};

/** 随包分发的字体与数据文件需要在正文里单独说明 */
const SPECIAL_NOTES = [
  {
    title: 'mediabunny — MPL-2.0（文件级 copyleft）',
    body: [
      '音视频工具用 mediabunny 做容器解封装/封装。MPL-2.0 的义务只落在**被修改的文件**上：',
      '本项目未修改其源码，因此闭源分发无需公开任何代码；一旦修改，必须公开该文件的改动。',
      '许可证全文：https://mozilla.org/MPL/2.0/',
    ],
  },
  {
    title: 'KaTeX 字体 — SIL OFL-1.1',
    body: [
      '数学公式工具随包分发 KaTeX 的 59 个字体文件（woff/woff2/ttf），许可为 SIL Open Font License 1.1。',
      'OFL 允许商用、嵌入与再分发，但**不得单独售卖字体本身**，且不得在修改后继续使用保留字体名（Reserved Font Name）。',
      '本项目原样分发、未做任何字形修改，字体名保持不变。',
      '许可证全文：https://openfontlicense.org/open-font-license-official-text/',
    ],
  },
  {
    title: 'Apache-2.0 组件',
    body: [
      'Apache-2.0 要求保留版权与许可声明，并附带专利授权（第 3 条）。分发时保留各包的 NOTICE 内容即可。',
      '许可证全文：https://www.apache.org/licenses/LICENSE-2.0',
    ],
  },
  {
    title: '已移除的组件（许可原因）',
    body: [
      '| 组件 | 原许可 | 处理 | 原因 |',
      '| --- | --- | --- | --- |',
      '| `@ffmpeg/core-mt` / `@ffmpeg/ffmpeg` | GPL-2.0-or-later（发布的是带 `--enable-gpl --enable-libx264 --enable-libx265` 的构建） | 已移除，媒体处理改为 WebCodecs + mediabunny | 随闭源的商业版本分发会触发 GPL 的源码开放义务 |',
      '| `ua-parser-js@2` | AGPL-3.0-or-later | 降级到 `1.0.41`（MIT） | 同上；该工具只用到 v1 就有的 API |',
      '',
      '当前依赖树中**不存在 GPL / AGPL / SSPL / Commons Clause / 非商业许可**组件，由 `pnpm license:check` 与 `cargo deny` 在 CI 中强制校验。',
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

push('# 第三方组件与许可声明（Third-Party Notices）');
push('');
push(`本文件列出 **SynTools ${pkg.version}** 随附或随包发布的第三方组件及其许可，`);
push('适用于网页版产物、桌面安装包（Tauri）与企业服务器版的部署包。');
push('');
push('本项目自身以 **AGPL-3.0-only** 发布（见 `LICENSE`）。如果你购买的是商业许可版本，');
push('本文件中的声明依然适用：它们约束的是第三方组件，不因本项目如何授权而改变。');
push('');
push('> 本文件由 `pnpm notices` 生成，请勿手工修改。数据来源：');
push(
  '> 运行时 npm 依赖（`pnpm licenses ls --prod --json`，不含 devDependencies）与 `src-tauri/Cargo.lock`。',
);
push('');

push('## 一、总览');
push('');
push(`| 范围 | 组件数 | 说明 |`);
push('| --- | --- | --- |');
push(`| 运行时 npm 依赖 | ${npm.length} | 会随构建产物发布的包（去重后按包名统计） |`);
push(
  `| Rust crate（桌面版） | ${crates.length}${unresolved ? ` + ${unresolved} 个本地未缓存` : ''} | Tauri 应用二进制中包含的 crate |`,
);
push('');
push(
  '所有组件的许可均属于宽松许可、文件级 copyleft 或字体许可，**没有 GPL / AGPL / SSPL / 非商业许可**。',
);
push('CI 用 `pnpm license:check`（npm）与 `cargo deny check licenses`（Rust）守这条线。');
push('');

push('## 二、npm 运行时依赖的许可分布');
push('');
push('| 许可 | 包数 |');
push('| --- | --- |');
for (const [license, count] of summarize(npm, 'license')) {
  push(`| ${license} | ${count} |`);
}
push('');

push('## 三、需要特别说明的义务');
push('');
for (const note of SPECIAL_NOTES) {
  push(`### ${note.title}`);
  push('');
  push(...note.body);
  push('');
}

const dualRows = Object.entries(DUAL_CHOICE);
if (dualRows.length) {
  push('### 双许可组件的取值声明');
  push('');
  push('| 组件 | 声明许可 | 本项目选择的许可 |');
  push('| --- | --- | --- |');
  for (const [name, choice] of dualRows) {
    push(`| ${name} | ${choice.from} | **${choice.choose}** |`);
  }
  push('');
  push(
    '`pako` 声明为 `MIT AND Zlib`，两者义务同类且均为宽松许可，随包附带的 LICENSE 同时满足两条。',
  );
  push('');
}

push('### package.json 未声明许可的包');
push('');
push('| 组件 | 处理 |');
push('| --- | --- |');
for (const [name, note] of Object.entries(UNKNOWN_ANNOTATION)) {
  push(`| ${name} | ${note} |`);
}
push('');

push('## 四、npm 运行时依赖清单');
push('');
push('<details>');
push(`<summary>展开全部 ${npm.length} 个包</summary>`);
push('');
push('| 包 | 版本 | 许可 | 声明选择 |');
push('| --- | --- | --- | --- |');
for (const entry of npm) {
  const choice = DUAL_CHOICE[entry.name]?.choose ?? '';
  const annotation = UNKNOWN_ANNOTATION[entry.name] ? '（见上表）' : '';
  push(
    `| ${entry.name} | ${entry.versions.join(', ')} | ${entry.license}${annotation} | ${choice} |`,
  );
}
push('');
push('</details>');
push('');

push('## 五、Rust crate 清单（桌面版）');
push('');
push('仅桌面版（Tauri）二进制包含这些 crate；网页版与企业服务器版不包含。');
push('');
push('<details>');
push(`<summary>展开 ${crates.length} 个 crate 的许可分布</summary>`);
push('');
push('| 许可 | crate 数 |');
push('| --- | --- |');
for (const [license, count] of summarize(crates, 'license')) {
  push(`| ${license} | ${count} |`);
}
push('');
push('</details>');
push('');
push('<details>');
push(`<summary>展开全部 ${crates.length} 个 crate</summary>`);
push('');
push('| crate | 版本 | 许可 |');
push('| --- | --- | --- |');
for (const crate of crates) {
  push(`| ${crate.name} | ${crate.version} | ${crate.license} |`);
}
push('');
push('</details>');
if (unresolved) {
  push('');
  push(
    `> 另有 ${unresolved} 个 crate 的许可未能在本地 registry 缓存中读取（常见于尚未展开的依赖）。`,
  );
  push(
    '> 运行 `pnpm license:check:rust` 会用 `cargo-deny` 在完整依赖图上重新校验，结论以那次为准。',
  );
}
push('');

push('## 六、许可全文');
push('');
push(
  '各包随源码分发的 `LICENSE` / `LICENSE.md` 文件保持原样，未做任何修改。通用许可全文可从以下地址获取：',
);
push('');
push('| 许可 | 地址 |');
push('| --- | --- |');
push('| MIT | https://opensource.org/license/mit |');
push('| ISC | https://opensource.org/license/isc-license-txt |');
push('| Apache-2.0 | https://www.apache.org/licenses/LICENSE-2.0 |');
push('| BSD-2-Clause / BSD-3-Clause | https://opensource.org/license/bsd-2-clause |');
push('| MPL-2.0 | https://mozilla.org/MPL/2.0/ |');
push('| SIL OFL-1.1 | https://openfontlicense.org/open-font-license-official-text/ |');
push('| CC0-1.0 | https://creativecommons.org/publicdomain/zero/1.0/ |');
push('| Zlib | https://opensource.org/license/zlib |');
push('| AGPL-3.0（本项目） | https://www.gnu.org/licenses/agpl-3.0.txt |');
push('');

writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(
  `已生成 THIRD-PARTY-NOTICES.md：npm ${npm.length} 个包，Rust ${crates.length} 个 crate${
    unresolved ? `（${unresolved} 个未解析）` : ''
  }`,
);
