import type { ToolResult } from '@/core/types';

/**
 * 安全表达式计算器：仅支持数字与 + - * / % ^ () 及常用函数，不使用 eval。
 */

export type CalcError = 'EMPTY' | 'SYNTAX' | 'DIV_ZERO';

const FUNCS: Record<string, (n: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parse(): number {
    this.skip();
    const v = this.expr();
    this.skip();
    if (this.i < this.s.length) throw new Error('SYNTAX');
    return v;
  }

  private peek(): string {
    return this.s[this.i] ?? '';
  }

  private skip() {
    while (/\s/.test(this.peek())) this.i += 1;
  }

  private expr(): number {
    let v = this.term();
    for (;;) {
      this.skip();
      const op = this.peek();
      if (op === '+') {
        this.i += 1;
        v += this.term();
      } else if (op === '-') {
        this.i += 1;
        v -= this.term();
      } else break;
    }
    return v;
  }

  private term(): number {
    let v = this.power();
    for (;;) {
      this.skip();
      const op = this.peek();
      if (op === '*') {
        this.i += 1;
        v *= this.power();
      } else if (op === '/') {
        this.i += 1;
        const d = this.power();
        if (d === 0) throw new Error('DIV_ZERO');
        v /= d;
      } else if (op === '%') {
        this.i += 1;
        const d = this.power();
        if (d === 0) throw new Error('DIV_ZERO');
        v %= d;
      } else break;
    }
    return v;
  }

  private power(): number {
    let v = this.unary();
    this.skip();
    if (this.peek() === '^') {
      this.i += 1;
      const exp = this.power(); // 右结合
      v = v ** exp;
    }
    return v;
  }

  private unary(): number {
    this.skip();
    if (this.peek() === '+') {
      this.i += 1;
      return this.unary();
    }
    if (this.peek() === '-') {
      this.i += 1;
      return -this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    this.skip();
    const ch = this.peek();
    if (ch === '(') {
      this.i += 1;
      const v = this.expr();
      this.skip();
      if (this.peek() !== ')') throw new Error('SYNTAX');
      this.i += 1;
      return v;
    }
    if (/[0-9.]/.test(ch)) return this.number();
    if (/[a-zA-Z_]/.test(ch)) return this.ident();
    throw new Error('SYNTAX');
  }

  private number(): number {
    const start = this.i;
    while (/[0-9]/.test(this.peek())) this.i += 1;
    if (this.peek() === '.') {
      this.i += 1;
      while (/[0-9]/.test(this.peek())) this.i += 1;
    }
    if (/[eE]/.test(this.peek())) {
      this.i += 1;
      if (this.peek() === '+' || this.peek() === '-') this.i += 1;
      if (!/[0-9]/.test(this.peek())) throw new Error('SYNTAX');
      while (/[0-9]/.test(this.peek())) this.i += 1;
    }
    const n = Number(this.s.slice(start, this.i));
    if (!Number.isFinite(n)) throw new Error('SYNTAX');
    return n;
  }

  private ident(): number {
    const start = this.i;
    while (/[a-zA-Z_]/.test(this.peek())) this.i += 1;
    const name = this.s.slice(start, this.i).toLowerCase();
    this.skip();
    if (this.peek() === '(') {
      const fn = FUNCS[name];
      if (!fn) throw new Error('SYNTAX');
      this.i += 1;
      const arg = this.expr();
      this.skip();
      if (this.peek() !== ')') throw new Error('SYNTAX');
      this.i += 1;
      const v = fn(arg);
      if (!Number.isFinite(v)) throw new Error('SYNTAX');
      return v;
    }
    const c = CONSTS[name];
    if (c === undefined) throw new Error('SYNTAX');
    return c;
  }
}

export function evaluateExpression(input: string): ToolResult<number> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  try {
    const value = new Parser(text).parse();
    if (!Number.isFinite(value)) return { ok: false, error: 'SYNTAX' };
    return { ok: true, value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'SYNTAX';
    if (msg === 'DIV_ZERO') return { ok: false, error: 'DIV_ZERO' };
    return { ok: false, error: 'SYNTAX' };
  }
}

export function formatCalcResult(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return String(Number(n.toPrecision(12)));
}
