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
