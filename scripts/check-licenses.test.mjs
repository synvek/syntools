import { describe, expect, it } from 'vitest';
import { evaluate } from './check-licenses.mjs';

/**
 * Verdict logic of the license gate. These cases are not about coverage but about
 * pinning down "which licenses may ship with the commercial build": loosening any
 * one of them should turn a test red first.
 */
describe('evaluate', () => {
  it('accepts common permissive licenses', () => {
    for (const license of ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Zlib']) {
      expect(evaluate(license).verdict, license).toBe('ok');
    }
  });

  it('rejects GPL / AGPL / SSPL and commercially restricted licenses', () => {
    for (const license of [
      'GPL-3.0-only',
      'GPL-2.0-or-later',
      'AGPL-3.0-or-later',
      'AGPL-3.0-only',
      'SSPL-1.0',
      'CC-BY-NC-4.0',
      'BUSL-1.1',
      'Elastic-2.0',
      'JSON',
    ]) {
      expect(evaluate(license).verdict, license).toBe('forbidden');
    }
  });

  it('OR expressions need only one acceptable side (dual-licensed packages can pick the permissive side)', () => {
    expect(evaluate('(MIT OR GPL-3.0-or-later)').verdict).toBe('ok');
    expect(evaluate('(MPL-2.0 OR Apache-2.0)').verdict).toBe('ok');
    expect(evaluate('MIT OR GPL-3.0-or-later').verdict).toBe('ok');
    expect(evaluate('(GPL-3.0-only OR AGPL-3.0-only)').verdict).toBe('forbidden');
  });

  it('AND expressions require every side to be acceptable', () => {
    expect(evaluate('(MIT AND Zlib)').verdict).toBe('ok');
    expect(evaluate('MIT AND GPL-3.0-or-later').verdict).toBe('forbidden');
    expect(evaluate('Apache-2.0 WITH LLVM-exception').verdict).toBe('ok');
  });

  it('parentheses and precedence follow SPDX semantics', () => {
    // GPL only sits on the parenthesised OR branch, so the whole expression is still satisfied by MIT
    expect(evaluate('(GPL-3.0-or-later OR MIT)').verdict).toBe('ok');
    // The GPL outside the parentheses is ANDed with the inner OR, so it cannot be avoided
    expect(evaluate('GPL-3.0-only AND (MIT OR Apache-2.0)').verdict).toBe('forbidden');
  });

  it('treats the legacy Rust `A/B` form as OR', () => {
    expect(evaluate('MIT/Apache-2.0').verdict).toBe('ok');
    expect(evaluate('MIT OR Apache-2.0 OR LGPL-2.1-or-later').verdict).toBe('ok');
  });

  it('flags LGPL for review instead of failing', () => {
    expect(evaluate('LGPL-3.0-only').verdict).toBe('review');
    expect(evaluate('LGPL-2.1-or-later AND MIT').verdict).toBe('review');
  });

  it('marks an undeclared license as unknown', () => {
    expect(evaluate('').verdict).toBe('unknown');
    expect(evaluate(undefined).verdict).toBe('unknown');
    expect(evaluate('WTFPL-2').verdict).toBe('unknown');
  });
});
