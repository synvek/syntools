import { describe, expect, it } from 'vitest';
import { countUnsupportedLatex, isOmmlSupported, latexToAst, type LatexNode } from './latex';

/**
 * LaTeX 子集解析测试：
 * 解析结果直接决定 Word 导出走「原生公式」还是「图片降级」，
 * 因此这里既验证能解析的结构，也验证必须拒绝的语法。
 */

/** 取第一个节点，便于断言 */
function first(latex: string): LatexNode {
  const ast = latexToAst(latex);
  expect(ast).not.toBeNull();
  return (ast as LatexNode[])[0];
}

describe('latexToAst：支持的语法', () => {
  it('普通文本与数字拆成独立节点', () => {
    const ast = latexToAst('a1');
    expect(ast?.map((node) => (node.kind === 'text' ? node.value : node.kind))).toEqual(['a', '1']);
  });

  it('分数解析为 frac', () => {
    const node = first('\\frac{a}{b}');
    expect(node.kind).toBe('frac');
    if (node.kind !== 'frac') return;
    expect(node.numerator[0]).toEqual({ kind: 'text', value: 'a' });
    expect(node.denominator[0]).toEqual({ kind: 'text', value: 'b' });
  });

  it('根号与根指数', () => {
    const plain = first('\\sqrt{x}');
    expect(plain.kind).toBe('sqrt');
    if (plain.kind === 'sqrt') expect(plain.degree).toBeNull();

    const withDegree = first('\\sqrt[3]{x}');
    expect(withDegree.kind).toBe('sqrt');
    if (withDegree.kind === 'sqrt') {
      expect(withDegree.degree).toEqual([{ kind: 'text', value: '3' }]);
    }
  });

  it('上下标挂在基座上，且可同时存在', () => {
    const sub = first('x_i');
    expect(sub.kind).toBe('scripts');
    if (sub.kind === 'scripts') {
      expect(sub.sub).toEqual([{ kind: 'text', value: 'i' }]);
      expect(sub.sup).toBeNull();
    }

    const both = first('x_i^2');
    expect(both.kind).toBe('scripts');
    if (both.kind === 'scripts') {
      expect(both.sub).toEqual([{ kind: 'text', value: 'i' }]);
      expect(both.sup).toEqual([{ kind: 'text', value: '2' }]);
    }
  });

  it('大运算符的上下限挂在 nary 上', () => {
    const node = first('\\sum_{i=1}^{n} a_i');
    expect(node.kind).toBe('nary');
    if (node.kind !== 'nary') return;
    expect(node.char).toBe('∑');
    expect(node.sub).not.toBeNull();
    expect(node.sup).not.toBeNull();
  });

  it('\\left..\\right 解析为定界对', () => {
    const node = first('\\left( a + b \\right)');
    expect(node.kind).toBe('brackets');
    if (node.kind === 'brackets') {
      expect(node.open).toBe('(');
      expect(node.close).toBe(')');
    }
  });

  it('希腊字母与数学符号映射为 Unicode', () => {
    expect(first('\\alpha')).toEqual({ kind: 'text', value: 'α' });
    expect(first('\\infty')).toEqual({ kind: 'text', value: '∞' });
    expect(first('\\times')).toEqual({ kind: 'text', value: '×' });
  });

  it('\\text 保留字面文本，函数名按原样输出', () => {
    expect(first('\\text{当 x > 0}')).toEqual({ kind: 'text', value: '当 x > 0' });
    expect(first('\\sin')).toEqual({ kind: 'text', value: 'sin' });
  });

  it('空白命令产生间距', () => {
    expect(first('\\,')).toEqual({ kind: 'text', value: ' ' });
    expect(first('\\quad')).toEqual({ kind: 'text', value: '\u2003' });
  });

  it('示例公式整体可解析', () => {
    expect(isOmmlSupported('\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1')).toBe(true);
    expect(isOmmlSupported('\\int_a^b f(x)\\,dx')).toBe(true);
    expect(isOmmlSupported('\\left( a + b \\right)^2')).toBe(true);
  });
});

describe('latexToAst：不支持的语法（应走图片降级）', () => {
  it('未收录的命令', () => {
    expect(isOmmlSupported('\\begin{matrix} a \\end{matrix}')).toBe(false);
    expect(isOmmlSupported('\\overbrace{x}')).toBe(false);
    expect(isOmmlSupported('\\color{red}{x}')).toBe(false);
  });

  it('空公式与特殊字符', () => {
    expect(latexToAst('')).toBeNull();
    expect(latexToAst('   ')).toBeNull();
    expect(isOmmlSupported('a % b')).toBe(false);
    expect(isOmmlSupported('a & b')).toBe(false);
  });

  it('缺少脚本基座或括号不匹配', () => {
    expect(isOmmlSupported('^2')).toBe(false);
    expect(isOmmlSupported('\\frac{a}{b')).toBe(false);
    expect(isOmmlSupported('\\frac{a}')).toBe(false);
    expect(isOmmlSupported('{a')).toBe(false);
  });

  it('\\text 内出现命令时降级（无法保证正体语义）', () => {
    expect(isOmmlSupported('\\text{a \\alpha}')).toBe(false);
  });

  it('不支持的定界符降级', () => {
    expect(isOmmlSupported('\\left\\{ \\frac{a}{b} \\right\\}')).toBe(true);
    expect(isOmmlSupported('\\left( a \\right]')).toBe(false);
  });
});

describe('countUnsupportedLatex', () => {
  it('只统计无法用 OMML 表达的公式（空串同样视为不可表达）', () => {
    expect(
      countUnsupportedLatex(['\\frac{a}{b}', '\\begin{matrix} a \\end{matrix}', '', 'x^2']),
    ).toBe(2);
    // 调用方通常先过滤空白公式，再统计降级数量
    expect(
      countUnsupportedLatex(
        ['\\frac{a}{b}', '\\begin{matrix} a \\end{matrix}', '   ', 'x^2'].filter((latex) =>
          latex.trim(),
        ),
      ),
    ).toBe(1);
  });

  it('空列表返回 0', () => {
    expect(countUnsupportedLatex([])).toBe(0);
  });
});
