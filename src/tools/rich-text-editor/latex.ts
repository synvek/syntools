/**
 * LaTeX subset parser (pure logic, no heavy KaTeX / docx dependencies):
 *
 * The editor stores only LaTeX source, and export needs to know whether a formula can be expressed as
 * a native Word equation. Parsing is therefore kept separate: `latexToAst` returns an AST, and null
 * means the syntax can't be expressed in OMML, so the export layer degrades to an image.
 *
 * Supported syntax: groups, \frac, \sqrt[..]{..}, ^/_ scripts, n-ary operators like \sum/\int,
 * \left..\right delimiter pairs, common Greek letters and math symbols, \text{..}, common function
 * names and spacing commands.
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
      /** Operand to the right of \sum / \int */
      body: LatexNode[] | null;
    }
  | { kind: 'brackets'; open: string; close: string; body: LatexNode[] };

/** LaTeX command -> Unicode symbol (common math symbols; anything unlisted counts as unsupported) */
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

/** N-ary operators: limits attach to the sum / integral component */
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

/** Function names (shown upright in Word) */
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

/** Spacing commands */
const SPACES: Record<string, string> = {
  ',': ' ',
  ';': ' ',
  '!': '',
  ' ': ' ',
  quad: '\u2003',
  qquad: '\u2003\u2003',
};

/** Delimiter pairs supported by \left...\right (anything else counts as unsupported and degrades to an image) */
const DELIMITERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '\\{': '\\}',
  '|': '|',
  '\\langle': '\\rangle',
  '\\lvert': '\\rvert',
  '.': '.',
};

/** Tokens allowed after \right (the closing side is validated too, catching mismatches like \left( … \right]) */
const CLOSING_DELIMS = new Set([')', ']', '\\}', '|', '\\rangle', '\\rvert', '.']);

/** Delimiter -> actual character (`.` means a one-sided delimiter and emits an empty string) */
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

/** These characters have special meaning in formulas and can't be expressed directly */
const UNSUPPORTED_CHARS = new Set(['%', '&', '#', '$', '~']);

interface Cursor {
  src: string;
  pos: number;
}

function skipSpaces(cursor: Cursor): void {
  while (cursor.pos < cursor.src.length && /\s/.test(cursor.src[cursor.pos])) cursor.pos += 1;
}

/** Read a `{...}` group; null means the braces don't match */
function parseBracedGroup(cursor: Cursor): LatexNode[] | null {
  skipSpaces(cursor);
  if (cursor.src[cursor.pos] !== '{') return null;
  cursor.pos += 1;
  const body = parseSequence(cursor, '}');
  if (!body || cursor.src[cursor.pos] !== '}') return null;
  cursor.pos += 1;
  return body;
}

/** Read a script argument: `{...}` / single command / single character */
function parseScriptArgument(cursor: Cursor): LatexNode[] | null {
  skipSpaces(cursor);
  if (cursor.pos >= cursor.src.length) return null;
  if (cursor.src[cursor.pos] === '{') return parseBracedGroup(cursor);
  const atom = parseAtom(cursor);
  return atom ? [atom] : null;
}

/** Read a command name; single-character commands (e.g. `\,`) return that character */
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

/** Parse a \left ... \right delimiter pair */
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

/** Parse one atom (group / command / single character) */
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
      // Commands or scripts inside \text{} can't guarantee upright semantics, so fall back to an image
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

/** Parse a sequence; `stop` is the terminator (`}`), null means parse to the end */
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
        // \sum_{i=1}^{n}: limits attach directly to the sum component
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

/** LaTeX -> AST; null means the syntax can't be expressed in OMML (use an image fallback) */
export function latexToAst(latex: string): LatexNode[] | null {
  const source = latex.trim();
  if (!source) return null;
  const nodes = parseSequence({ src: source, pos: 0 }, null);
  return nodes && nodes.length > 0 ? nodes : null;
}

/** Whether the formula can be expressed as a native Word equation (OMML) */
export function isOmmlSupported(latex: string): boolean {
  return latexToAst(latex) !== null;
}

/** Count formulas that can't be expressed in OMML and will degrade to images */
export function countUnsupportedLatex(latexList: readonly string[]): number {
  return latexList.filter((latex) => !isOmmlSupported(latex)).length;
}
