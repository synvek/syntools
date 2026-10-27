#!/usr/bin/env node
/**
 * Dependency license gate: fails as soon as a strong copyleft license (GPL / AGPL / SSPL) appears.
 *
 * Why it exists: the project ships on two tracks, "AGPL-3.0 (community) + commercial license (paid)",
 * and bundling GPL/AGPL components would saddle the commercial build with source-disclosure duties.
 * Such problems sneak in silently when installing a package; only a gate before release keeps them
 * manageable (that is how `@ffmpeg/core-mt` and `ua-parser-js@2` slipped in historically).
 *
 * Verdicts follow SPDX expressions:
 * - `A OR B`: passes if either side is acceptable (and asks you to state the choice in NOTICES);
 * - `A AND B`: both sides must be acceptable;
 * - single license: must be on the allowlist.
 * LGPL does not fail outright but is marked "needs manual review" — linking it statically into a
 * wasm/JS artifact increases the obligations.
 *
 * Usage:
 *   pnpm license:check           # includes devDependencies (stricter, catches issues earlier)
 *   pnpm license:check --prod    # runtime dependencies only (what actually ships)
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Allowed licenses (all permissive, file-level copyleft, font/data licenses, or public-domain statements) */
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

/** Strong copyleft / non-free licenses: a match fails the gate */
const FORBIDDEN = [
  { re: /^AGPL/i, why: 'AGPL spreads to network services; the commercial build cannot take it' },
  {
    re: /^GPL/i,
    why: 'GPL requires shipping sources with distribution; the commercial build cannot take it',
  },
  { re: /^SSPL/i, why: 'SSPL is stricter than AGPL and is not an open-source license' },
  { re: /Commons-Clause/i, why: 'prohibits commercial use' },
  { re: /BUSL/i, why: 'time-locked license that restricts commercial use' },
  { re: /Elastic-2\.0/i, why: 'cannot be offered as a hosted service' },
  { re: /CC-BY-NC/i, why: 'prohibits commercial use' },
  { re: /NonCommercial/i, why: 'prohibits commercial use' },
  {
    re: /^(?:OSL|RPL|QPL|Sleepycat|JSON)-?/i,
    why: 'incompatible with AGPL or restricts fields of use',
  },
];

/** LGPL is separate: no failure, but the linking mode needs manual confirmation */
const REVIEW = [
  { re: /^LGPL/i, why: 'LGPL: confirm dynamic linking; static linking needs a relinking option' },
];

/**
 * Packages that declare no license in package.json but were verified by hand.
 * Every new entry must state the evidence; "let it through for now" is not allowed.
 */
export const KNOWN_UNKNOWN = new Map([
  ['buffers', 'the bundled LICENSE is MIT; only the package.json field is missing'],
  ['khroma', 'the bundled LICENSE is MIT; only the package.json field is missing'],
  ['@univerjs/telemetry', 'a lockfile-only peer entry; not installed and not bundled'],
]);

/**
 * Splits an SPDX expression into tokens: `(MIT OR GPL-3.0-or-later)` → `( MIT OR GPL-3.0-or-later )`.
 * A `WITH` exception is folded into the preceding identifier (e.g. `Apache-2.0 WITH LLVM-exception`).
 * The non-SPDX `A/B` form (common in Rust crates) is equivalent to `A OR B`.
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

/** Recursive descent: AND binds tighter than OR; returns a syntax tree */
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
 * Evaluates an SPDX expression, returning 'ok' | 'review' | 'unknown' | 'forbidden'.
 * AND keeps the worst result (all obligations apply), OR keeps the best (any one suffices).
 */
export function evaluate(license) {
  if (!license || !license.trim()) return { verdict: 'unknown', reason: 'no license declared' };
  let tree;
  try {
    tree = parse(tokenize(license));
  } catch {
    return { verdict: 'unknown', reason: 'unparseable license expression' };
  }
  return evaluateNode(tree);
}

function evaluateNode(node) {
  if (!node) return { verdict: 'unknown', reason: 'empty expression' };
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
  return { verdict: 'unknown', reason: `not on the allowlist: ${id}` };
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

  const scope = prodOnly ? 'runtime dependencies' : 'all dependencies (incl. dev)';
  console.log(`License gate: checking ${rows.length} packages (${scope})`);

  if (review.length) {
    console.log('\nNeeds manual review (does not block the build):');
    for (const row of review)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}: ${row.reason}`);
  }

  if (unknown.length) {
    console.log('\nUndeterminable licenses:');
    for (const row of unknown)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}：${row.reason}`);
    console.log(
      '  Once verified, add the package and its evidence to KNOWN_UNKNOWN in scripts/check-licenses.mjs.',
    );
  }

  if (forbidden.length) {
    console.log('\nForbidden licenses:');
    for (const row of forbidden)
      console.log(`  · ${row.name}@${row.versions} — ${row.license}：${row.reason}`);
    console.log(
      '\nLicense gate failed: strong copyleft / non-free components cannot ship in the commercial build.',
    );
    console.log('See plan/license-audit.md (replace, downgrade or remove — not loosen the gate).');
    process.exit(1);
  }

  if (unknown.length) {
    console.log('\nLicense gate failed: some licenses cannot be determined.');
    process.exit(1);
  }

  console.log(
    `\nLicense gate passed: no GPL / AGPL / SSPL licenses among ${rows.length} packages.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
