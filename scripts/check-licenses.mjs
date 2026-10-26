#!/usr/bin/env node
/**
 * 依赖许可门禁：出现 GPL / AGPL / SSPL 等强 copyleft 许可时直接失败。
 *
 * 为什么需要它：本项目计划以「AGPL-3.0（社区） + 商业许可（付费）」双轨发布，而随包分发的
 * GPL/AGPL 组件会让商业许可版本背上源码开放义务。这类问题在安装一个包时悄无声息地发生，
 * 只有在发布前被门禁挡住才可控（历史上就是这么混进 `@ffmpeg/core-mt` 与 `ua-parser-js@2` 的）。
 *
 * 判定基于 SPDX 表达式：
 * - `A OR B`：任一侧可接受即通过（并提示在 NOTICES 里声明选择了哪一侧）；
 * - `A AND B`：两侧都必须可接受；
 * - 单许可：必须在白名单内。
 * LGPL 不直接失败，标记为「需人工复核」—— 静态链接进 wasm/JS 产物时义务会变重。
 *
 * 用法：
 *   pnpm license:check           # 含 devDependencies（更严格，能提早发现）
 *   pnpm license:check --prod    # 仅运行时依赖（即真正随产物发布的包）
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** 允许的许可（均为宽松许可、文件级 copyleft、字体/数据许可或公共领域声明） */
export const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'Apache-2.0 WITH LLVM-exception',
  'BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'BSL-1.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'CDLA-Permissive-2.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MIT/X11',
  'MPL-2.0',
  'NCSA',
  'OFL-1.1',
  'OpenSSL',
  'Python-2.0',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'Unlicense',
  'WTFPL',
  'Zlib',
]);

/** 强 copyleft / 非自由许可：命中即失败 */
const FORBIDDEN = [
  { re: /^AGPL/i, why: 'AGPL 会传染到网络服务，商业许可版本无法承受' },
  { re: /^GPL/i, why: 'GPL 要求随分发提供源码，商业许可版本无法承受' },
  { re: /^SSPL/i, why: 'SSPL 比 AGPL 更严格，不属于开源许可' },
  { re: /Commons-Clause/i, why: '禁止商业使用' },
  { re: /BUSL/i, why: '商业使用受限的时间锁许可' },
  { re: /Elastic-2\.0/i, why: '禁止作为托管服务提供' },
  { re: /CC-BY-NC/i, why: '禁止商业使用' },
  { re: /NonCommercial/i, why: '禁止商业使用' },
  { re: /^(?:OSL|RPL|QPL|Sleepycat|JSON)-?/i, why: '与 AGPL 不兼容或含字段使用限制' },
];

/** LGPL 单列：不失败，但要求人工确认链接方式 */
const REVIEW = [{ re: /^LGPL/i, why: 'LGPL：确认是否动态链接；静态链接进产物需提供重链接手段' }];

/**
 * package.json 未声明许可、但已人工核实的包。
 * 新增条目必须写清依据，不允许「先放行再说」。
 */
export const KNOWN_UNKNOWN = new Map([
  ['buffers', '包内 LICENSE 为 MIT，仅 package.json 缺字段'],
  ['khroma', '包内 LICENSE 为 MIT，仅 package.json 缺字段'],
  ['@univerjs/telemetry', '只存在于 lockfile 的 peer 条目，未安装、不进产物'],
]);

/**
 * 把 SPDX 表达式切成 token：`(MIT OR GPL-3.0-or-later)` → `( MIT OR GPL-3.0-or-later )`。
 * `WITH` 例外条款并入前一个标识符（如 `Apache-2.0 WITH LLVM-exception`）。
 * `A/B` 这种非 SPDX 写法（多见于 Rust crate）等价于 `A OR B`。
 */
function tokenize(expression) {
  const spaced = expression.replace(/([()])/g, ' $1 ').trim();
  const parts = spaced.split(/\s+/).filter(Boolean);

  const tokens = [];
  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i];
    if (token === '(' || token === ')') {
      tokens.push(token);
      continue;
    }
    if (token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR') {
      tokens.push(token.toUpperCase());
      continue;
    }
    if (parts[i + 1]?.toUpperCase() === 'WITH' && parts[i + 2]) {
      tokens.push(`${token} WITH ${parts[i + 2]}`);
      i += 2;
      continue;
    }
    if (token.includes('/') && !ALLOWED.has(token)) {
      const alternatives = token
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);
      alternatives.forEach((alt, index) => {
        if (index > 0) tokens.push('OR');
        tokens.push(alt);
      });
      continue;
    }
    tokens.push(token);
  }
  return tokens;
}

/** 递归下降：AND 优先级高于 OR，返回语法树 */
function parse(tokens) {
  let index = 0;
  const peek = () => tokens[index];

  const parseAtom = () => {
    const token = tokens[index];
    if (token === '(') {
      index += 1;
      const node = parseOr();
      if (tokens[index] === ')') index += 1;
      return node;
    }
    index += 1;
    return { type: 'leaf', id: token };
  };

  const parseAnd = () => {
    let node = parseAtom();
    while (peek() === 'AND') {
      index += 1;
      node = { type: 'and', children: [node, parseAtom()] };
    }
    return node;
  };

  function parseOr() {
    let node = parseAnd();
    while (peek() === 'OR') {
      index += 1;
      node = { type: 'or', children: [node, parseAnd()] };
    }
    return node;
  }

  return parseOr();
}

/**
 * 评估一个 SPDX 表达式，返回 'ok' | 'review' | 'unknown' | 'forbidden'。
 * AND 取最差结果（全部义务都要满足），OR 取最好结果（任选其一即可）。
 */
export function evaluate(license) {
  if (!license || !license.trim()) return { verdict: 'unknown', reason: '未声明许可' };
  let tree;
  try {
    tree = parse(tokenize(license));
  } catch {
    return { verdict: 'unknown', reason: '无法解析的许可表达式' };
  }
  return evaluateNode(tree);
}

function evaluateNode(node) {
  if (!node) return { verdict: 'unknown', reason: '空表达式' };
  if (node.type === 'leaf') return evaluateSingle(node.id);

  const results = node.children.map(evaluateNode);
  if (node.type === 'and') {
    return results.reduce((worst, item) =>
      rank(item.verdict) > rank(worst.verdict) ? item : worst,
    );
  }
  return results.reduce((best, item) => (rank(item.verdict) < rank(best.verdict) ? item : best));
}

function rank(verdict) {
  return { ok: 0, review: 1, unknown: 2, forbidden: 3 }[verdict] ?? 3;
}

function evaluateSingle(token) {
  const id = token.replace(/\s+WITH\s+/i, ' WITH ');
  if (ALLOWED.has(id)) return { verdict: 'ok', reason: '' };

  for (const rule of FORBIDDEN) {
    if (rule.re.test(id)) return { verdict: 'forbidden', reason: rule.why };
  }
  for (const rule of REVIEW) {
    if (rule.re.test(id)) return { verdict: 'review', reason: rule.why };
  }
  return { verdict: 'unknown', reason: `不在允许清单内：${id}` };
}

function collect(prodOnly) {
  const args = ['licenses', 'ls', '--json'];
  if (prodOnly) args.splice(1, 0, '--prod');
  const raw = execSync(`pnpm ${args.join(' ')}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const byLicense = JSON.parse(raw);

  const rows = [];
  for (const [license, packages] of Object.entries(byLicense)) {
    for (const pkg of packages) {
      const paths = Array.isArray(pkg.paths) ? pkg.paths : [];
      rows.push({
        name: pkg.name,
        versions: (pkg.versions ?? []).join(','),
        license,
        installed: paths.length > 0,
      });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function main(argv = process.argv) {
  const prodOnly = argv.includes('--prod');
  const rows = collect(prodOnly);

  const forbidden = [];
  const unknown = [];
  const review = [];

  for (const row of rows) {
    if (!row.installed && KNOWN_UNKNOWN.has(row.name)) continue;
    const { verdict, reason } = evaluate(row.license);
    if (verdict === 'forbidden') forbidden.push({ ...row, reason });
    else if (verdict === 'unknown') {
      const known = KNOWN_UNKNOWN.get(row.name);
      if (!known) unknown.push({ ...row, reason });
    } else if (verdict === 'review') review.push({ ...row, reason });
  }

  const scope = prodOnly ? '运行时依赖' : '全部依赖（含 dev）';
  console.log(`许可门禁：检查 ${rows.length} 个包（${scope}）`);

  if (review.length) {
    console.log('\n需人工复核（不阻断构建）：');
    for (const row of review)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}：${row.reason}`);
  }

  if (unknown.length) {
    console.log('\n无法判定的许可：');
    for (const row of unknown)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}：${row.reason}`);
    console.log('  核实后把包名与依据加入 scripts/check-licenses.mjs 的 KNOWN_UNKNOWN。');
  }

  if (forbidden.length) {
    console.log('\n禁止的许可：');
    for (const row of forbidden)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}：${row.reason}`);
    console.log('\n许可门禁失败：存在强 copyleft / 非自由许可组件，商业许可版本无法合规发布。');
    console.log('处理方式见 plan/license-audit.md（替换、降级或移除，而不是放宽门禁）。');
    process.exit(1);
  }

  if (unknown.length) {
    console.log('\n许可门禁失败：存在无法判定的许可。');
    process.exit(1);
  }

  console.log(`\n许可门禁通过：${rows.length} 个包均无 GPL / AGPL / SSPL 类许可。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
