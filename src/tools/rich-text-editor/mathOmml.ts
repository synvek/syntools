import { latexToAst, type LatexNode } from './latex';

/**
 * LaTeX → Word 原生公式（OMML）。
 *
 * 只覆盖 AST 能表达的语法（见 math.ts 的 latexToAst）；
 * 任一子节点无法表达即整体返回 null，由调用方降级为图片，
 * 绝不输出「部分正确」的公式——错误公式比图片更难发现。
 */

type DocxNs = typeof import('docx');
type MathComponent = import('docx').MathComponent;

/** AST → OMML 组件；null 表示无法表达 */
function nodesToOmml(D: DocxNs, nodes: readonly LatexNode[]): MathComponent[] | null {
  const out: MathComponent[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    // \sum / \int 等大运算符：LaTeX 语义是「作用于其后的表达式」，
    // 因此把剩余兄弟节点整体作为被运算对象。
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
      // 其余定界符（| |、单边等）用普通字符 + 内容表达，语义仍正确
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

/** LaTeX → OMML 公式对象；null 表示需要用图片降级 */
export function latexToOmml(D: DocxNs, latex: string): InstanceType<DocxNs['Math']> | null {
  const ast = latexToAst(latex);
  if (!ast) return null;
  const children = nodesToOmml(D, ast);
  if (!children || children.length === 0) return null;
  return new D.Math({ children });
}
