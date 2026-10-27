import { describe, expect, it } from 'vitest';
import { countUnsupportedLatex, isOmmlSupported, latexToAst, type LatexNode } from './latex';

/**
 * LaTeX subset parser tests:
 * The parse result decides whether Word export uses a native equation or the image fallback,
 * so these tests cover both the structures that parse and the syntax that must be rejected.
 */

/** Take the first node for easier assertions */
function first(latex: string): LatexNode {
  const ast = latexToAst(latex);
  expect(ast).not.toBeNull();
  return (ast as LatexNode[])[0];
}

describe('latexToAst: supported syntax', () => {
  it('splits plain text and digits into separate nodes', () => {
    const ast = latexToAst('a1');
    expect(ast?.map((node) => (node.kind === 'text' ? node.value : node.kind))).toEqual(['a', '1']);
  });

  it('parses fractions as frac', () => {
    const node = first('\\frac{a}{b}');
    expect(node.kind).toBe('frac');
    if (node.kind !== 'frac') return;
    expect(node.numerator[0]).toEqual({ kind: 'text', value: 'a' });
    expect(node.denominator[0]).toEqual({ kind: 'text', value: 'b' });
  });

  it('parses radicals and root indices', () => {
    const plain = first('\\sqrt{x}');
    expect(plain.kind).toBe('sqrt');
    if (plain.kind === 'sqrt') expect(plain.degree).toBeNull();

    const withDegree = first('\\sqrt[3]{x}');
    expect(withDegree.kind).toBe('sqrt');
    if (withDegree.kind === 'sqrt') {
      expect(withDegree.degree).toEqual([{ kind: 'text', value: '3' }]);
    }
  });

  it('attaches sub/superscripts to the base, and both can coexist', () => {
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

  it('attaches limits of large operators to nary', () => {
    const node = first('\\sum_{i=1}^{n} a_i');
    expect(node.kind).toBe('nary');
    if (node.kind !== 'nary') return;
    expect(node.char).toBe('∑');
    expect(node.sub).not.toBeNull();
    expect(node.sup).not.toBeNull();
  });

  it('parses \\left..\\right as delimiter pairs', () => {
    const node = first('\\left( a + b \\right)');
    expect(node.kind).toBe('brackets');
    if (node.kind === 'brackets') {
      expect(node.open).toBe('(');
      expect(node.close).toBe(')');
    }
  });

  it('maps Greek letters and math symbols to Unicode', () => {
    expect(first('\\alpha')).toEqual({ kind: 'text', value: 'α' });
    expect(first('\\infty')).toEqual({ kind: 'text', value: '∞' });
    expect(first('\\times')).toEqual({ kind: 'text', value: '×' });
  });

  it('keeps \\text literal and emits function names as-is', () => {
    expect(first('\\text{当 x > 0}')).toEqual({ kind: 'text', value: '当 x > 0' });
    expect(first('\\sin')).toEqual({ kind: 'text', value: 'sin' });
  });

  it('turns spacing commands into spacing', () => {
    expect(first('\\,')).toEqual({ kind: 'text', value: ' ' });
    expect(first('\\quad')).toEqual({ kind: 'text', value: '\u2003' });
  });

  it('parses a full sample formula', () => {
    expect(isOmmlSupported('\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1')).toBe(true);
    expect(isOmmlSupported('\\int_a^b f(x)\\,dx')).toBe(true);
    expect(isOmmlSupported('\\left( a + b \\right)^2')).toBe(true);
  });
});

describe('latexToAst: unsupported syntax (image fallback)', () => {
  it('rejects unknown commands', () => {
    expect(isOmmlSupported('\\begin{matrix} a \\end{matrix}')).toBe(false);
    expect(isOmmlSupported('\\overbrace{x}')).toBe(false);
    expect(isOmmlSupported('\\color{red}{x}')).toBe(false);
  });

  it('rejects empty formulas and special characters', () => {
    expect(latexToAst('')).toBeNull();
    expect(latexToAst('   ')).toBeNull();
    expect(isOmmlSupported('a % b')).toBe(false);
    expect(isOmmlSupported('a & b')).toBe(false);
  });

  it('rejects scripts without a base and unbalanced braces', () => {
    expect(isOmmlSupported('^2')).toBe(false);
    expect(isOmmlSupported('\\frac{a}{b')).toBe(false);
    expect(isOmmlSupported('\\frac{a}')).toBe(false);
    expect(isOmmlSupported('{a')).toBe(false);
  });

  it('falls back when \\text contains commands (upright semantics cannot be guaranteed)', () => {
    expect(isOmmlSupported('\\text{a \\alpha}')).toBe(false);
  });

  it('falls back for unsupported delimiters', () => {
    expect(isOmmlSupported('\\left\\{ \\frac{a}{b} \\right\\}')).toBe(true);
    expect(isOmmlSupported('\\left( a \\right]')).toBe(false);
  });
});

describe('countUnsupportedLatex', () => {
  it('counts only formulas OMML cannot express (an empty string counts as inexpressible)', () => {
    expect(
      countUnsupportedLatex(['\\frac{a}{b}', '\\begin{matrix} a \\end{matrix}', '', 'x^2']),
    ).toBe(2);
    // Callers usually filter blank formulas before counting fallbacks
    expect(
      countUnsupportedLatex(
        ['\\frac{a}{b}', '\\begin{matrix} a \\end{matrix}', '   ', 'x^2'].filter((latex) =>
          latex.trim(),
        ),
      ),
    ).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countUnsupportedLatex([])).toBe(0);
  });
});
