import { describe, expect, it } from 'vitest';
import { evaluate } from './check-licenses.mjs';

/**
 * 许可门禁的判定逻辑。这些用例的作用不是覆盖率，而是把「哪些许可可以随商业许可版本发布」
 * 这条规则钉死：放松任何一条，都应该有测试先红。
 */
describe('evaluate', () => {
  it('接受常见宽松许可', () => {
    for (const license of ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Zlib']) {
      expect(evaluate(license).verdict, license).toBe('ok');
    }
  });

  it('拒绝 GPL / AGPL / SSPL 与商业限制类许可', () => {
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

  it('OR 表达式只需一侧可接受（双许可包可以选宽松一侧）', () => {
    expect(evaluate('(MIT OR GPL-3.0-or-later)').verdict).toBe('ok');
    expect(evaluate('(MPL-2.0 OR Apache-2.0)').verdict).toBe('ok');
    expect(evaluate('MIT OR GPL-3.0-or-later').verdict).toBe('ok');
    expect(evaluate('(GPL-3.0-only OR AGPL-3.0-only)').verdict).toBe('forbidden');
  });

  it('AND 表达式要求全部可接受', () => {
    expect(evaluate('(MIT AND Zlib)').verdict).toBe('ok');
    expect(evaluate('MIT AND GPL-3.0-or-later').verdict).toBe('forbidden');
    expect(evaluate('Apache-2.0 WITH LLVM-exception').verdict).toBe('ok');
  });

  it('括号与优先级按 SPDX 语义处理', () => {
    // GPL 只挂在括号内的 OR 分支上，整条表达式仍可通过 MIT 满足
    expect(evaluate('(GPL-3.0-or-later OR MIT)').verdict).toBe('ok');
    // 括号外的 GPL 与括号内的 OR 是 AND 关系，无法绕开
    expect(evaluate('GPL-3.0-only AND (MIT OR Apache-2.0)').verdict).toBe('forbidden');
  });

  it('Rust 侧 `A/B` 旧写法按 OR 处理', () => {
    expect(evaluate('MIT/Apache-2.0').verdict).toBe('ok');
    expect(evaluate('MIT OR Apache-2.0 OR LGPL-2.1-or-later').verdict).toBe('ok');
  });

  it('LGPL 只提示复核，不直接失败', () => {
    expect(evaluate('LGPL-3.0-only').verdict).toBe('review');
    expect(evaluate('LGPL-2.1-or-later AND MIT').verdict).toBe('review');
  });

  it('未声明的许可判为无法判定', () => {
    expect(evaluate('').verdict).toBe('unknown');
    expect(evaluate(undefined).verdict).toBe('unknown');
    expect(evaluate('WTFPL-2').verdict).toBe('unknown');
  });
});
