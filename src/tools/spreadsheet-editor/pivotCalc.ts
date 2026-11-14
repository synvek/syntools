/**
 * 计算字段（P1-7 ③）：四则运算 + 字段引用 + 数字常量。
 *
 * 刻意不做完整表达式引擎：没有函数调用、没有字符串运算、没有条件判断。
 * 理由与计划一致——透视表里的计算字段在 Excel 里也只有这点能力，
 * 真要做公式就该用工作表公式，而不是再造一套语法。
 *
 * 字段引用写成 `[列名]`（列名可含空格与运算符）；引号外的裸名字一律当语法错误，
 * 这样 "金额-成本" 不会被误当成一个字段名。
 */

/** 计算字段的配置形态：`PivotConfig.calcFields` 里存的就是这个 */
export interface CalcFieldSpec {
  /** 面板用的稳定 id（`calc-1..n`），表达式与展示名都可改 */
  id: string;
  /** 展示名（值区标签、数据字段名） */
  name: string;
  /** 表达式，字段引用写 `[列名]` */
  expression: string;
}

export type CalcErrorCode =
  | 'emptyName'
  | 'emptyExpression'
  | 'syntax'
  | 'unknownField'
  | 'duplicateName'
  | 'cycle'
  | 'dependency';

/** 错误码 → i18n key（9 语言都必须有，`pivotStrings.ts` 里注册） */
export const CALC_ERROR_LABEL_KEY: Record<CalcErrorCode, string> = {
  emptyName: 'tools.sheet.pivotCalcEmptyName',
  emptyExpression: 'tools.sheet.pivotCalcEmptyExpression',
  syntax: 'tools.sheet.pivotCalcSyntax',
  unknownField: 'tools.sheet.pivotCalcUnknownField',
  duplicateName: 'tools.sheet.pivotCalcDuplicateName',
  cycle: 'tools.sheet.pivotCalcCycle',
  dependency: 'tools.sheet.pivotCalcDependency',
};

export type CalcNode =
  | { kind: 'number'; value: number }
  | { kind: 'field'; name: string }
  | { kind: 'neg'; operand: CalcNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: CalcNode; right: CalcNode };

export interface CompiledCalc {
  /** 计算字段 id → 语法树（解析失败的字段不在里面） */
  nodes: Map<string, CalcNode>;
  /** 计算字段名 → id（解析名字用） */
  idsByName: Map<string, string>;
  /** 源字段标签 → 列号（名字重复时取第一列，与面板展示一致） */
  fieldIndex: Map<string, number>;
  /** 计算字段 id → 错误；没有错误的字段不会出现在里面 */
  errors: Map<string, CalcErrorCode>;
  /** 求值顺序：依赖先于被依赖（有环的字段已被标错，不在顺序里） */
  order: string[];
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'field'; name: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1;
      continue;
    }
    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'op', value: char as '+' | '-' | '*' | '/' });
      index += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }
    if (char === '[') {
      const close = expression.indexOf(']', index + 1);
      if (close < 0) return null;
      tokens.push({ type: 'field', name: expression.slice(index + 1, close).trim() });
      index = close + 1;
      continue;
    }
    if (char >= '0' && char <= '9') {
      let end = index;
      let sawDot = false;
      while (end < expression.length) {
        const next = expression[end];
        if (next >= '0' && next <= '9') {
          end += 1;
          continue;
        }
        // 小数点只能出现一次，且不能是最后一个字符
        if (next === '.' && !sawDot) {
          sawDot = true;
          end += 1;
          continue;
        }
        break;
      }
      const text = expression.slice(index, end);
      const value = Number(text);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'number', value });
      index = end;
      continue;
    }
    // 裸名字 / 全角符号 / 其他一切字符：交给语法错误处理，不猜用户想写什么
    return null;
  }
  return tokens;
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): CalcNode | null {
    if (this.tokens.length === 0) return null;
    const node = this.parseAdd();
    if (!node || this.position !== this.tokens.length) return null;
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private parseAdd(): CalcNode | null {
    let left = this.parseMul();
    if (!left) return null;
    for (;;) {
      const token = this.peek();
      if (token?.type !== 'op' || (token.value !== '+' && token.value !== '-')) return left;
      this.position += 1;
      const right = this.parseMul();
      if (!right) return null;
      left = { kind: 'binary', op: token.value, left, right };
    }
  }

  private parseMul(): CalcNode | null {
    let left = this.parseUnary();
    if (!left) return null;
    for (;;) {
      const token = this.peek();
      if (token?.type !== 'op' || (token.value !== '*' && token.value !== '/')) return left;
      this.position += 1;
      const right = this.parseUnary();
      if (!right) return null;
      left = { kind: 'binary', op: token.value, left, right };
    }
  }

  private parseUnary(): CalcNode | null {
    const token = this.peek();
    if (token?.type === 'op' && token.value === '-') {
      this.position += 1;
      const operand = this.parseUnary();
      return operand ? { kind: 'neg', operand } : null;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): CalcNode | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'number') {
      this.position += 1;
      return { kind: 'number', value: token.value };
    }
    if (token.type === 'field') {
      this.position += 1;
      return { kind: 'field', name: token.name };
    }
    if (token.type === 'paren' && token.value === '(') {
      this.position += 1;
      const inner = this.parseAdd();
      const close = this.peek();
      if (!inner || close?.type !== 'paren' || close.value !== ')') return null;
      this.position += 1;
      return inner;
    }
    return null;
  }
}

/** 表达式 → 语法树；只做语法，不校验字段是否存在（那是 `compileCalcFields` 的事） */
export function parseCalcExpression(
  expression: string,
): { ok: true; node: CalcNode; refs: string[] } | { ok: false; error: CalcErrorCode } {
  if (expression.trim() === '') return { ok: false, error: 'emptyExpression' };
  const tokens = tokenize(expression);
  if (!tokens) return { ok: false, error: 'syntax' };
  const node = new Parser(tokens).parse();
  if (!node) return { ok: false, error: 'syntax' };
  const refs = new Set<string>();
  collectRefs(node, refs);
  return { ok: true, node, refs: [...refs] };
}

function collectRefs(node: CalcNode, into: Set<string>): void {
  switch (node.kind) {
    case 'field':
      into.add(node.name);
      return;
    case 'neg':
      collectRefs(node.operand, into);
      return;
    case 'binary':
      collectRefs(node.left, into);
      collectRefs(node.right, into);
      return;
    default:
      return;
  }
}

/**
 * 编译整组计算字段：解析语法、解析字段引用、查重名、查循环依赖。
 *
 * 一次把全部错误收齐（不是遇到第一个就抛），面板才能把"哪个字段错在哪"一次说清楚。
 */
export function compileCalcFields(
  specs: readonly CalcFieldSpec[],
  fieldLabels: readonly string[],
): CompiledCalc {
  const fieldIndex = new Map<string, number>();
  fieldLabels.forEach((label, column) => {
    if (!fieldIndex.has(label)) fieldIndex.set(label, column);
  });

  const idsByName = new Map<string, string>();
  const errors = new Map<string, CalcErrorCode>();
  const nodes = new Map<string, CalcNode>();
  const refs = new Map<string, string[]>();

  // 第一遍：名字与语法。先建全部名字表，引用解析才能前向引用（A 用 B，B 在后面定义）
  for (const spec of specs) {
    const name = spec.name.trim();
    if (!name) {
      errors.set(spec.id, 'emptyName');
    } else if (idsByName.has(name) || fieldIndex.has(name)) {
      // 与源字段同名会让 `[名称]` 有歧义，直接判错而不是"猜你指哪一个"
      errors.set(spec.id, 'duplicateName');
    } else {
      idsByName.set(name, spec.id);
    }

    const parsed = parseCalcExpression(spec.expression);
    if (!parsed.ok) {
      if (!errors.has(spec.id)) errors.set(spec.id, parsed.error);
      continue;
    }
    nodes.set(spec.id, parsed.node);
    refs.set(spec.id, parsed.refs);
  }

  // 第二遍：引用解析（引用别的计算字段时，该字段自己不能是错的）
  for (const [id, names] of refs) {
    for (const name of names) {
      const target = idsByName.get(name);
      if (target !== undefined) {
        const targetError = errors.get(target);
        if (targetError === 'cycle' || targetError === 'duplicateName') {
          errors.set(id, 'duplicateName');
          break;
        }
        continue;
      }
      if (!fieldIndex.has(name)) {
        errors.set(id, 'unknownField');
        break;
      }
    }
  }

  // 第三遍：环检测（只走计算字段之间的边），顺带排出一个依赖在前的求值顺序
  const state = new Map<string, 'visiting' | 'done'>();
  const order: string[] = [];
  /** 返回值区分"自己坏了"和"成环"，否则依赖错误的字段会被错标成循环 */
  const visit = (id: string): 'ok' | 'broken' | 'cycle' => {
    if (errors.has(id)) return 'broken';
    const current = state.get(id);
    if (current === 'done') return 'ok';
    if (current === 'visiting') return 'cycle';
    state.set(id, 'visiting');
    let status: 'ok' | 'broken' | 'cycle' = 'ok';
    for (const name of refs.get(id) ?? []) {
      const target = idsByName.get(name);
      if (target === undefined) continue;
      const result = visit(target);
      if (result === 'cycle') status = 'cycle';
      else if (result === 'broken' && status === 'ok') status = 'broken';
    }
    if (status === 'ok') {
      state.set(id, 'done');
      order.push(id);
      return 'ok';
    }
    // 出错的不标 done：它可能还在环里，别的路径访问到时要继续判环
    errors.set(id, status === 'cycle' ? 'cycle' : 'dependency');
    return status;
  };
  for (const spec of specs) visit(spec.id);

  return { nodes, idsByName, fieldIndex, errors, order };
}

/**
 * 求值一个节点。
 *
 * `resolve` 负责把字段名换成数字：源字段给出单元格的值，计算字段会递归求值（编译期已排除环）。
 * 任何一环拿不到数字就返回 `null` —— 透视表里显示为空格，而不是 0 或 `#DIV/0!`：
 * 0 会被当成真实数据参与合计，"看起来有值"比空着更误导。
 */
export function evalCalcNode(
  node: CalcNode,
  resolve: (name: string) => number | null,
): number | null {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'field':
      return resolve(node.name);
    case 'neg': {
      const value = evalCalcNode(node.operand, resolve);
      return value === null ? null : -value;
    }
    case 'binary': {
      const left = evalCalcNode(node.left, resolve);
      if (left === null) return null;
      const right = evalCalcNode(node.right, resolve);
      if (right === null) return null;
      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        default:
          // 除零 → 空单元格（Excel 里是 #DIV/0!，静态值里写错误字符串会污染合计）
          return right === 0 ? null : left / right;
      }
    }
    default:
      return null;
  }
}

/**
 * 一条记录上求值全部计算字段。
 *
 * 依赖顺序由 `compileCalcFields` 给出，`memo` 兜底成环时不会无限递归；
 * `toNumber` 由调用方注入（`pivotNumber`），避免计算层与透视层互相 import。
 */
export function evaluateRecord(
  compiled: CompiledCalc,
  values: readonly unknown[],
  toNumber: (value: unknown) => number | null,
): Map<string, number | null> {
  const memo = new Map<string, number | null>();

  const resolveName = (name: string): number | null => {
    const id = compiled.idsByName.get(name);
    if (id !== undefined) return resolveId(id);
    const column = compiled.fieldIndex.get(name);
    return column === undefined ? null : toNumber(values[column]);
  };

  const resolveId = (id: string): number | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    const node = compiled.nodes.get(id);
    // 语法/引用/环有错的字段不参与求值：结果整列为空，错误由面板显示
    if (!node || compiled.errors.has(id)) return null;
    memo.set(id, null);
    const value = evalCalcNode(node, resolveName);
    memo.set(id, value);
    return value;
  };

  for (const id of compiled.order) resolveId(id);
  return memo;
}

/** 新计算字段 id：`calc-1..n`，跳过已占用的（面板"新建"用） */
export function nextCalcId(specs: readonly CalcFieldSpec[]): string {
  const taken = new Set(specs.map((spec) => spec.id));
  for (let index = 1; index <= specs.length + 1; index += 1) {
    const id = `calc-${index}`;
    if (!taken.has(id)) return id;
  }
  return `calc-${specs.length + 1}`;
}
