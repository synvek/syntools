import { describe, expect, it } from 'vitest';
import {
  compileCalcFields,
  evalCalcNode,
  evaluateRecord,
  nextCalcId,
  parseCalcExpression,
  type CalcFieldSpec,
} from './pivotCalc';
import { pivotNumber } from './pivot';

/** 计算字段（P1-7 ③）：解析 / 引用解析 / 环检测 / 求值 */

const toNumber = (value: unknown) => pivotNumber(value);

function evalExpression(expression: string, values: Record<string, unknown>): number | null {
  const parsed = parseCalcExpression(expression);
  if (!parsed.ok) throw new Error(`unexpected parse error: ${parsed.error}`);
  return evalCalcNode(parsed.node, (name) => (name in values ? toNumber(values[name]) : null));
}

describe('parseCalcExpression', () => {
  it('respects precedence, parentheses and unary minus', () => {
    // 1 + 2 * 3 = 7（不是 9），括号与一元负号都要生效
    expect(evalExpression('1 + 2 * 3', {})).toBe(7);
    expect(evalExpression('(1 + 2) * 3', {})).toBe(9);
    expect(evalExpression('-2 * 3', {})).toBe(-6);
    expect(evalExpression('10 / 4', {})).toBe(2.5);
  });

  it('reads bracketed field references, including names with spaces', () => {
    const parsed = parseCalcExpression('[销售 金额] - [成本]');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.refs).toEqual(['销售 金额', '成本']);
    expect(evalExpression('[销售 金额] - [成本]', { '销售 金额': 100, 成本: 60 })).toBe(40);
  });

  it('rejects empty expressions, bare names and unbalanced brackets', () => {
    expect(parseCalcExpression('   ')).toEqual({ ok: false, error: 'emptyExpression' });
    // 裸名字不做猜测：字段必须写 [列名]
    expect(parseCalcExpression('金额-成本')).toEqual({ ok: false, error: 'syntax' });
    expect(parseCalcExpression('[金额 - 成本')).toEqual({ ok: false, error: 'syntax' });
    expect(parseCalcExpression('[金额] - ')).toEqual({ ok: false, error: 'syntax' });
  });

  it('divides by zero to null instead of Infinity', () => {
    expect(evalExpression('[金额] / [数量]', { 金额: 100, 数量: 0 })).toBeNull();
    // 缺字段 / 非数字同样给 null：静态值里留空，而不是写 0 混进合计
    expect(evalExpression('[金额] - [成本]', { 金额: 'abc', 成本: 1 })).toBeNull();
    expect(evalExpression('[金额] - [缺失]', { 金额: 10 })).toBeNull();
  });
});

describe('compileCalcFields', () => {
  const labels = ['区域', '金额', '成本'];

  it('accepts forward references between calculated fields', () => {
    const specs: CalcFieldSpec[] = [
      { id: 'calc-1', name: '毛利', expression: '[利润] + 10' },
      { id: 'calc-2', name: '利润', expression: '[金额] - [成本]' },
    ];
    const compiled = compileCalcFields(specs, labels);
    expect([...compiled.errors]).toEqual([]);
    // 依赖在前：先算利润，再算毛利
    expect(compiled.order).toEqual(['calc-2', 'calc-1']);
    expect(evaluateRecord(compiled, [0, 100, 60], toNumber).get('calc-1')).toBe(50);
  });

  it('reports unknown fields, duplicate names and empty names', () => {
    const compiled = compileCalcFields(
      [
        { id: 'calc-1', name: '利润', expression: '[金额] - [不存在]' },
        { id: 'calc-2', name: '金额', expression: '[金额] * 2' },
        { id: 'calc-3', name: '  ', expression: '1 + 1' },
        { id: 'calc-4', name: '利润', expression: '1 + 1' },
      ],
      labels,
    );
    expect(compiled.errors.get('calc-1')).toBe('unknownField');
    // 与源字段同名 → 引用有歧义，直接判重名而不是猜
    expect(compiled.errors.get('calc-2')).toBe('duplicateName');
    expect(compiled.errors.get('calc-3')).toBe('emptyName');
    expect(compiled.errors.get('calc-4')).toBe('duplicateName');
  });

  it('detects cycles and marks dependants separately', () => {
    const compiled = compileCalcFields(
      [
        { id: 'a', name: 'A', expression: '[B] + 1' },
        { id: 'b', name: 'B', expression: '[A] + 1' },
        { id: 'c', name: 'C', expression: '[A] + 1' },
      ],
      labels,
    );
    expect(compiled.errors.get('a')).toBe('cycle');
    expect(compiled.errors.get('b')).toBe('cycle');
    // 依赖了坏字段的字段不是"成环"，给一个能区分的错误码
    expect(compiled.errors.get('c')).toBe('dependency');
    expect(compiled.order).toEqual([]);
  });
});

describe('nextCalcId', () => {
  it('finds the first free number and reuses holes', () => {
    expect(nextCalcId([])).toBe('calc-1');
    expect(nextCalcId([{ id: 'calc-1', name: 'A', expression: '1' }])).toBe('calc-2');
    expect(
      nextCalcId([
        { id: 'calc-1', name: 'A', expression: '1' },
        { id: 'calc-3', name: 'C', expression: '1' },
      ]),
    ).toBe('calc-2');
  });
});
