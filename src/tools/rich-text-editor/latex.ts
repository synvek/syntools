/**
 * LaTeX 子集解析（纯逻辑，不含 KaTeX / docx 等重依赖）：
 *
 * 编辑器只保存 LaTeX 源码，导出时需要知道「这条公式能否用 Word 原生公式表达」。
 * 因此把解析独立出来：`latexToAst` 返回抽象语法树，返回 null 表示含
 * OMML 表达不了的语法，导出层据此降级为图片。
 *
 * 支持的语法：分组、\frac、\sqrt[..]{..}、^/_ 上下标、\sum/\int 等大运算符、
 * \left..\right 定界对、常用希腊字母与数学符号、\text{..}、常用函数名与空白命令。
 */

export type LatexNode =
  | { kind: 'text'; value: string }
  | { kind: 'group'; body: LatexNode[] }
  | { kind: 'frac'; numerator: LatexNode[]; denominator: LatexNode[] }
  | { kind: 'sqrt'; degree: LatexNode[] | null; body: LatexNode[] }
  | { kind: 'scripts'; base: LatexNode[]; sub: LatexNode[] | null; sup: LatexNode[] | null }
  | {
      kind: 'nary';
      char: string;
      sub: LatexNode[] | null;
      sup: LatexNode[] | null;
      /** \sum / \int 右侧的被运算对象 */
      body: LatexNode[] | null;
    }
  | { kind: 'brackets'; open: string; close: string; body: LatexNode[] };

/** LaTeX 命令 → Unicode 符号（覆盖常用数学符号，未收录的一律视为不支持） */
const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  cdot: '⋅',
  cdots: '⋯',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  propto: '∝',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  circ: '∘',
  bullet: '∙',
  oplus: '⊕',
  otimes: '⊗',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  land: '∧',
  lor: '∨',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  mapsto: '↦',
  ldots: '…',
  dots: '…',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  therefore: '∴',
  prime: '′',
  degree: '°',
  percent: '%',
};

/** 大运算符：上下限挂在求和 / 积分组件上 */
const NARY: Record<string, string> = {
  sum: '∑',
  prod: '∏',
  coprod: '∐',
  int: '∫',
  iint: '∬',
  iiint: '∭',
  oint: '∮',
  bigcup: '⋃',
  bigcap: '⋂',
  bigoplus: '⨁',
  bigotimes: '⨂',
};

/** 函数名（Word 中以正体显示） */
const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'det',
  'dim',
  'gcd',
  'sup',
  'inf',
  'min',
  'max',
  'lim',
]);

/** 空白与间距命令 */
const SPACES: Record<string, string> = {
  ',': ' ',
  ';': ' ',
  '!': '',
  ' ': ' ',
  quad: '\u2003',
  qquad: '\u2003\u2003',
};

/** \left...\right 支持的定界符对（其余一律视为不支持，走图片降级） */
const DELIMITERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '\\{': '\\}',
  '|': '|',
  '\\langle': '\\rangle',
  '\\lvert': '\\rvert',
  '.': '.',
};

/** 可作为 \right 后定界符的记号（闭合侧也要校验，避免 \left( … \right] 这类不匹配） */
const CLOSING_DELIMS = new Set([')', ']', '\\}', '|', '\\rangle', '\\rvert', '.']);

/** 定界符 → 实际字符（`.` 表示单边定界，输出空串） */
const DELIM_CHAR: Record<string, string> = {
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  '\\{': '{',
  '\\}': '}',
  '|': '|',
  '\\langle': '⟨',
  '\\rangle': '⟩',
  '\\lvert': '|',
  '\\rvert': '|',
  '.': '',
};

/** 这些字符在公式中有特殊含义，无法直接表达 */
const UNSUPPORTED_CHARS = new Set(['%', '&', '#', '$', '~']);

interface Cursor {
  src: string;
  pos: number;
}

function skipSpaces(cursor: Cursor): void {
  while (cursor.pos < cursor.src.length && /\s/.test(cursor.src[cursor.pos])) cursor.pos += 1;
}

/** 读取 `{...}` 分组；返回 null 表示括号不匹配 */
function parseBracedGroup(cursor: Cursor): LatexNode[] | null {
  skipSpaces(cursor);
  if (cursor.src[cursor.pos] !== '{') return null;
  cursor.pos += 1;
  const body = parseSequence(cursor, '}');
  if (!body || cursor.src[cursor.pos] !== '}') return null;
  cursor.pos += 1;
  return body;
}

/** 读取脚本参数：`{...}` / 单命令 / 单字符 */
function parseScriptArgument(cursor: Cursor): LatexNode[] | null {
  skipSpaces(cursor);
  if (cursor.pos >= cursor.src.length) return null;
  if (cursor.src[cursor.pos] === '{') return parseBracedGroup(cursor);
  const atom = parseAtom(cursor);
  return atom ? [atom] : null;
}

/** 读取命令名；单字符命令（如 `\,`）返回该字符 */
function readCommandName(cursor: Cursor): string {
  cursor.pos += 1;
  const start = cursor.pos;
  while (cursor.pos < cursor.src.length && /[a-zA-Z]/.test(cursor.src[cursor.pos])) cursor.pos += 1;
  if (cursor.pos === start) {
    const char = cursor.src[cursor.pos] ?? '';
    cursor.pos += 1;
    return char;
  }
  return cursor.src.slice(start, cursor.pos);
}

/** 解析 \left ... \right 定界对 */
function parseDelimited(cursor: Cursor): LatexNode | null {
  skipSpaces(cursor);
  const open = cursor.src.startsWith('\\{', cursor.pos) ? '\\{' : cursor.src[cursor.pos];
  if (!(open in DELIMITERS)) return null;
  cursor.pos += open.length;
  const expectedClose = DELIMITERS[open];
  const body: LatexNode[] = [];
  while (cursor.pos < cursor.src.length) {
    skipSpaces(cursor);
    if (cursor.src.startsWith('\\right', cursor.pos)) {
      cursor.pos += '\\right'.length;
      skipSpaces(cursor);
      const close = cursor.src.startsWith('\\}', cursor.pos) ? '\\}' : cursor.src[cursor.pos];
      if (!CLOSING_DELIMS.has(close)) return null;
      if (expectedClose !== '.' && close !== expectedClose) return null;
      cursor.pos += close.length;
      return {
        kind: 'brackets',
        open: DELIM_CHAR[open] ?? '',
        close: DELIM_CHAR[close] ?? '',
        body,
      };
    }
    const atom = parseAtom(cursor);
    if (!atom) return null;
    body.push(atom);
  }
  return null;
}

/** 解析一个原子（分组 / 命令 / 单字符） */
function parseAtom(cursor: Cursor): LatexNode | null {
  if (cursor.pos >= cursor.src.length) return null;
  const char = cursor.src[cursor.pos];

  if (char === '{') {
    const body = parseBracedGroup(cursor);
    return body ? { kind: 'group', body } : null;
  }

  if (char === '\\') {
    const name = readCommandName(cursor);

    if (name === 'frac') {
      const numerator = parseBracedGroup(cursor);
      const denominator = parseBracedGroup(cursor);
      if (!numerator || !denominator) return null;
      return { kind: 'frac', numerator, denominator };
    }

    if (name === 'sqrt') {
      skipSpaces(cursor);
      let degree: LatexNode[] | null = null;
      if (cursor.src[cursor.pos] === '[') {
        cursor.pos += 1;
        const start = cursor.pos;
        while (cursor.pos < cursor.src.length && cursor.src[cursor.pos] !== ']') cursor.pos += 1;
        if (cursor.src[cursor.pos] !== ']') return null;
        const raw = cursor.src.slice(start, cursor.pos).trim();
        cursor.pos += 1;
        const inner = parseSequence({ src: raw, pos: 0 }, null);
        if (!inner || inner.length === 0) return null;
        degree = inner;
      }
      const body = parseBracedGroup(cursor);
      if (!body) return null;
      return { kind: 'sqrt', degree, body };
    }

    if (name === 'left') return parseDelimited(cursor);

    if (name in NARY) return { kind: 'nary', char: NARY[name], sub: null, sup: null, body: null };

    if (name === 'text' || name === 'mathrm' || name === 'operatorname') {
      const start = cursor.pos;
      const body = parseBracedGroup(cursor);
      if (!body) return null;
      const raw = cursor.src.slice(start, cursor.pos);
      const literal = raw.slice(raw.indexOf('{') + 1, raw.lastIndexOf('}'));
      // \text{} 内出现命令或上下标时无法保证正体语义，交给图片降级
      if (/[\\^_$]/.test(literal)) return null;
      return { kind: 'text', value: literal };
    }

    if (name in SPACES) return { kind: 'text', value: SPACES[name] };
    if (FUNCTIONS.has(name)) return { kind: 'text', value: name };
    if (name in SYMBOLS) return { kind: 'text', value: SYMBOLS[name] };
    if (name === '{' || name === '}' || name === '|') return { kind: 'text', value: name };
    return null;
  }

  if (UNSUPPORTED_CHARS.has(char)) return null;
  cursor.pos += 1;
  return { kind: 'text', value: char };
}

/** 解析序列；`stop` 为结束字符（`}`），null 表示解析到结尾 */
function parseSequence(cursor: Cursor, stop: string | null): LatexNode[] | null {
  const nodes: LatexNode[] = [];
  while (cursor.pos < cursor.src.length) {
    const char = cursor.src[cursor.pos];
    if (char === '}' && stop === null) return null;
    if (stop !== null && char === '}') break;
    if (/\s/.test(char)) {
      cursor.pos += 1;
      continue;
    }

    if (char === '^' || char === '_') {
      if (nodes.length === 0) return null;
      cursor.pos += 1;
      const argument = parseScriptArgument(cursor);
      if (!argument) return null;
      const base = nodes.pop() as LatexNode;
      const merged = base.kind === 'nary' ? base : null;
      const sub = char === '_' ? argument : (merged?.sub ?? null);
      const sup = char === '^' ? argument : (merged?.sup ?? null);
      if (merged) {
        // \sum_{i=1}^{n}：上下限直接挂在求和组件上
        nodes.push({ ...merged, sub, sup });
      } else if (base.kind === 'scripts') {
        nodes.push({ ...base, sub: base.sub ?? sub, sup: base.sup ?? sup });
      } else {
        nodes.push({
          kind: 'scripts',
          base: base.kind === 'group' ? base.body : [base],
          sub,
          sup,
        });
      }
      continue;
    }

    const atom = parseAtom(cursor);
    if (!atom) return null;
    nodes.push(atom);
  }
  if (stop !== null && cursor.src[cursor.pos] !== '}') return null;
  return nodes;
}

/** LaTeX → 抽象语法树；返回 null 表示含 OMML 表达不了的语法（应走图片降级） */
export function latexToAst(latex: string): LatexNode[] | null {
  const source = latex.trim();
  if (!source) return null;
  const nodes = parseSequence({ src: source, pos: 0 }, null);
  return nodes && nodes.length > 0 ? nodes : null;
}

/** 该公式能否用 Word 原生公式（OMML）表达 */
export function isOmmlSupported(latex: string): boolean {
  return latexToAst(latex) !== null;
}

/** 统计无法用 OMML 表达、将降级为图片的公式数量 */
export function countUnsupportedLatex(latexList: readonly string[]): number {
  return latexList.filter((latex) => !isOmmlSupported(latex)).length;
}
