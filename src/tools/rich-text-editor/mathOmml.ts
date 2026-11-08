import {
  attr,
  childOf,
  childrenOf,
  localNameOf,
  textOf,
  type XmlNode,
} from '../../core/drawing/xmlNode';
import { latexToAst, type LatexNode } from './latex';

/**
 * LaTeX → native Word equations (OMML).
 *
 * Only covers syntax the AST can express (see latexToAst in math.ts);
 * One inexpressible child returns null for the whole formula, and the caller falls back to an image.
 * Never emit a partially correct formula: a wrong formula is harder to spot than an image.
 */

type DocxNs = typeof import('docx');
type MathComponent = import('docx').MathComponent;

/** AST → OMML component; null means it cannot be expressed */
function nodesToOmml(D: DocxNs, nodes: readonly LatexNode[]): MathComponent[] | null {
  const out: MathComponent[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    // Large operators such as \sum / \int apply to the expression that follows,
    // so the remaining siblings become the operand as a whole.
    if (node.kind === 'nary' && node.body === null) {
      const rest = nodesToOmml(D, nodes.slice(index + 1));
      if (!rest) return null;
      const built = buildNary(D, node, rest);
      if (!built) return null;
      out.push(built);
      return out;
    }

    const built = nodeToOmml(D, node);
    if (!built) return null;
    out.push(...built);
  }
  return out;
}

function buildNary(
  D: DocxNs,
  node: Extract<LatexNode, { kind: 'nary' }>,
  children: MathComponent[],
): MathComponent | null {
  const subScript = node.sub ? nodesToOmml(D, node.sub) : undefined;
  const superScript = node.sup ? nodesToOmml(D, node.sup) : undefined;
  if (node.sub && !subScript) return null;
  if (node.sup && !superScript) return null;

  const options = {
    children,
    ...(subScript ? { subScript } : {}),
    ...(superScript ? { superScript } : {}),
  };
  switch (node.char) {
    case '∑':
    case '∏':
    case '∐':
    case '⋃':
    case '⋂':
    case '⨁':
    case '⨂':
      return new D.MathSum(options);
    default:
      return new D.MathIntegral(options);
  }
}

function nodeToOmml(D: DocxNs, node: LatexNode): MathComponent[] | null {
  switch (node.kind) {
    case 'text':
      return [new D.MathRun(node.value)];

    case 'group':
      return nodesToOmml(D, node.body);

    case 'frac': {
      const numerator = nodesToOmml(D, node.numerator);
      const denominator = nodesToOmml(D, node.denominator);
      if (!numerator || !denominator) return null;
      return [new D.MathFraction({ numerator, denominator })];
    }

    case 'sqrt': {
      const children = nodesToOmml(D, node.body);
      if (!children) return null;
      if (!node.degree) return [new D.MathRadical({ children })];
      const degree = nodesToOmml(D, node.degree);
      if (!degree) return null;
      return [new D.MathRadical({ children, degree })];
    }

    case 'scripts': {
      const base = nodesToOmml(D, node.base);
      if (!base) return null;
      const subScript = node.sub ? nodesToOmml(D, node.sub) : null;
      const superScript = node.sup ? nodesToOmml(D, node.sup) : null;
      if (node.sub && !subScript) return null;
      if (node.sup && !superScript) return null;
      if (subScript && superScript) {
        return [new D.MathSubSuperScript({ children: base, subScript, superScript })];
      }
      if (subScript) return [new D.MathSubScript({ children: base, subScript })];
      if (superScript) return [new D.MathSuperScript({ children: base, superScript })];
      return base;
    }

    case 'brackets': {
      const children = nodesToOmml(D, node.body);
      if (!children) return null;
      const pair = `${node.open}${node.close}`;
      if (pair === '()') return [new D.MathRoundBrackets({ children })];
      if (pair === '[]') return [new D.MathSquareBrackets({ children })];
      if (pair === '{}') return [new D.MathCurlyBrackets({ children })];
      if (pair === '⟨⟩') return [new D.MathAngledBrackets({ children })];
      // Other delimiters (| |, one-sided, ...) use plain characters plus content, which stays correct
      return [
        ...(node.open ? [new D.MathRun(node.open)] : []),
        ...children,
        ...(node.close ? [new D.MathRun(node.close)] : []),
      ];
    }

    case 'nary': {
      const children = node.body ? nodesToOmml(D, node.body) : [];
      if (!children) return null;
      const built = buildNary(D, node, children);
      return built ? [built] : null;
    }

    default:
      return null;
  }
}

/** LaTeX → OMML equation object; null means the image fallback is required */
export function latexToOmml(D: DocxNs, latex: string): InstanceType<DocxNs['Math']> | null {
  const ast = latexToAst(latex);
  if (!ast) return null;
  const children = nodesToOmml(D, ast);
  if (!children || children.length === 0) return null;
  return new D.Math({ children });
}

/* ------------------------------------------------------------------ *
 * OMML XML → LaTeX (P0-2.3, import direction)
 * ------------------------------------------------------------------ */

const NARY_LATEX: Record<string, string> = {
  '∑': '\\sum',
  '∏': '\\prod',
  '∐': '\\coprod',
  '∫': '\\int',
  '∬': '\\iint',
  '∭': '\\iiint',
  '∮': '\\oint',
  '⋃': '\\bigcup',
  '⋂': '\\bigcap',
  '⨁': '\\bigoplus',
  '⨂': '\\bigotimes',
};

const ACCENT_LATEX: Record<string, string> = {
  '\u0302': '\\hat',
  '\u0303': '\\tilde',
  '\u0304': '\\bar',
  '\u0305': '\\overline',
  '\u0307': '\\dot',
  '\u0308': '\\ddot',
  '\u20d7': '\\vec',
};

const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\backslash ',
  '{': '\\{',
  '}': '\\}',
  _: '\\_',
  '^': '\\^{}',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  $: '\\$',
};

function escapeLatex(text: string): string {
  return Array.from(text)
    .map((char) => LATEX_ESCAPES[char] ?? char)
    .join('');
}

/** Property attribute (`m:chr m:val="∑"` / `m:pos m:val="top"`), namespace-tolerant. */
function ommlVal(node: XmlNode | undefined, fallback: string): string {
  if (!node) return fallback;
  return attr(node, 'm:val') ?? attr(node, 'val') ?? fallback;
}

function childrenLatex(node: XmlNode | undefined): string | null {
  if (!node) return '';
  let out = '';
  for (const child of childrenOf(node)) {
    const latex = nodeLatex(child);
    if (latex === null) return null;
    out += latex;
  }
  return out;
}

function delimiterLatex(value: string): string {
  if (value === '{') return '\\{';
  if (value === '}') return '\\}';
  return value;
}

function nodeLatex(node: XmlNode): string | null {
  const name = localNameOf(node);
  // Property containers (`m:rPr`, `m:fPr`, `m:ctrlPr`, …) carry no math content.
  if (name.endsWith('Pr')) return '';

  switch (name) {
    case 'r': {
      let out = '';
      for (const child of childrenOf(node)) {
        if (localNameOf(child) === 't') out += escapeLatex(textOf(child));
      }
      return out;
    }
    case 'f': {
      const numerator = childrenLatex(childOf(node, 'num'));
      const denominator = childrenLatex(childOf(node, 'den'));
      if (numerator === null || denominator === null) return null;
      return `\\frac{${numerator}}{${denominator}}`;
    }
    case 'sSup': {
      const base = childrenLatex(childOf(node, 'e'));
      const sup = childrenLatex(childOf(node, 'sup'));
      if (base === null || sup === null) return null;
      return `{${base}}^{${sup}}`;
    }
    case 'sSub': {
      const base = childrenLatex(childOf(node, 'e'));
      const sub = childrenLatex(childOf(node, 'sub'));
      if (base === null || sub === null) return null;
      return `{${base}}_{${sub}}`;
    }
    case 'sSubSup': {
      const base = childrenLatex(childOf(node, 'e'));
      const sub = childrenLatex(childOf(node, 'sub'));
      const sup = childrenLatex(childOf(node, 'sup'));
      if (base === null || sub === null || sup === null) return null;
      return `{${base}}_{${sub}}^{${sup}}`;
    }
    case 'rad': {
      const body = childrenLatex(childOf(node, 'e'));
      const degree = childrenLatex(childOf(node, 'deg'));
      if (body === null || degree === null) return null;
      return degree ? `\\sqrt[${degree}]{${body}}` : `\\sqrt{${body}}`;
    }
    case 'd': {
      const parts = childrenOf(node).filter((child) => localNameOf(child) === 'e');
      const values: string[] = [];
      for (const part of parts) {
        const latex = childrenLatex(part);
        if (latex === null) return null;
        values.push(latex);
      }
      const properties = childOf(node, 'dPr');
      const open = delimiterLatex(ommlVal(childOf(properties, 'begChr'), '('));
      const close = delimiterLatex(ommlVal(childOf(properties, 'endChr'), ')'));
      return `\\left${open}${values.join(',')}\\right${close}`;
    }
    case 'nary': {
      const properties = childOf(node, 'naryPr');
      const character = ommlVal(childOf(properties, 'chr'), '∫');
      const sub = childrenLatex(childOf(node, 'sub'));
      const sup = childrenLatex(childOf(node, 'sup'));
      const body = childrenLatex(childOf(node, 'e'));
      if (sub === null || sup === null || body === null) return null;
      const operator = NARY_LATEX[character] ?? character;
      return `${operator}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${body}`;
    }
    case 'func': {
      const fName = childrenLatex(childOf(node, 'fName'));
      const body = childrenLatex(childOf(node, 'e'));
      if (fName === null || body === null) return null;
      return `${fName}(${body})`;
    }
    case 'acc': {
      const properties = childOf(node, 'accPr');
      const character = ommlVal(childOf(properties, 'chr'), '\u0302');
      const body = childrenLatex(childOf(node, 'e'));
      if (body === null) return null;
      return `${ACCENT_LATEX[character] ?? '\\hat'}{${body}}`;
    }
    case 'bar': {
      const properties = childOf(node, 'barPr');
      const position = ommlVal(childOf(properties, 'pos'), 'bot');
      const body = childrenLatex(childOf(node, 'e'));
      if (body === null) return null;
      return position === 'top' ? `\\overline{${body}}` : `\\underline{${body}}`;
    }
    case 'eqArr': {
      const rows: string[] = [];
      for (const row of childrenOf(node).filter((child) => localNameOf(child) === 'e')) {
        const latex = childrenLatex(row);
        if (latex === null) return null;
        rows.push(latex);
      }
      return `\\begin{aligned}${rows.join(' \\\\ ')}\\end{aligned}`;
    }
    case 'm': {
      const rows: string[] = [];
      for (const row of childrenOf(node).filter((child) => localNameOf(child) === 'mr')) {
        const cells: string[] = [];
        for (const cell of childrenOf(row).filter((child) => localNameOf(child) === 'e')) {
          const latex = childrenLatex(cell);
          if (latex === null) return null;
          cells.push(latex);
        }
        rows.push(cells.join(' & '));
      }
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }
    default:
      return null;
  }
}

/**
 * OMML → LaTeX for the import direction. `null` means the formula uses a construct outside the
 * supported subset, so the caller records a loss instead of emitting a partially wrong formula.
 * Tests round-trip the output through `latexToAst`, keeping both directions on one grammar.
 */
export function ommlToLatex(node: XmlNode | undefined): string | null {
  if (!node) return null;
  const name = localNameOf(node);
  const latex = name === 'oMath' || name === 'oMathPara' ? childrenLatex(node) : nodeLatex(node);
  if (latex === null) return null;
  const trimmed = latex.trim();
  return trimmed.length > 0 ? trimmed : null;
}
