import { describe, expect, it } from 'vitest';
import {
  auditFormulas,
  extractFunctionNames,
  FUNCTION_GROUPS,
  SUPPORTED_FUNCTION_COUNT,
  SUPPORTED_FUNCTIONS,
} from './sheetFunctions';

/**
 * Function catalogue + audit (P1-10).
 *
 * The catalogue is derived from the engine's export map, so the tests assert *properties* (a known
 * function is present, the total is plausible) rather than a frozen number — a frozen count would
 * fail on every dependency bump and teach people to update the test without looking.
 */

describe('catalogue', () => {
  it('包含基础函数与现代函数', () => {
    for (const name of ['SUM', 'VLOOKUP', 'XLOOKUP', 'TEXTJOIN', 'FILTER']) {
      expect(SUPPORTED_FUNCTIONS.has(name), name).toBe(true);
    }
  });

  it('规模与逐组统计一致', () => {
    const grouped = FUNCTION_GROUPS.reduce((total, group) => total + group.count, 0);
    expect(SUPPORTED_FUNCTION_COUNT).toBeGreaterThan(400);
    // 组内去重后可能小于总数（同一函数出现在多组），但不应小于总数的一半
    expect(grouped).toBeGreaterThan(SUPPORTED_FUNCTION_COUNT / 2);
  });

  it('分组里没有空组（空组说明导出改名了）', () => {
    expect(FUNCTION_GROUPS.filter((group) => group.count === 0)).toEqual([
      { id: 'univer', count: 0 },
    ]);
  });
});

describe('extractFunctionNames', () => {
  it('取出调用名并大写', () => {
    expect(extractFunctionNames('=sum(A1:A3)+if(B1>0,1,0)')).toEqual(['SUM', 'IF']);
  });

  it('忽略字符串字面量里的内容', () => {
    expect(extractFunctionNames('="SUM(" & CONCAT(A1)')).toEqual(['CONCAT']);
  });

  it('处理 Excel 的 _xlfn 前缀', () => {
    expect(extractFunctionNames('=_xlfn.XLOOKUP(A1,B:B,C:C)')).toEqual(['XLOOKUP']);
  });

  it('非公式文本不产生调用', () => {
    expect(extractFunctionNames('总计')).toEqual([]);
    expect(extractFunctionNames('')).toEqual([]);
  });

  it('嵌套与连续调用都能取到（保留重复，去重交给审计）', () => {
    expect(extractFunctionNames('=IF(AND(A1,B1),SUM(C1:C2),SUM(D1:D2))')).toEqual([
      'IF',
      'AND',
      'SUM',
      'SUM',
    ]);
  });
});

describe('auditFormulas', () => {
  it('全部受支持时没有 unsupported', () => {
    expect(auditFormulas(['=SUM(A1:A2)', '=IF(A1>0,"y","n")'])).toEqual({
      formulas: 2,
      unsupported: [],
    });
  });

  it('不支持的函数去重并排序', () => {
    expect(auditFormulas(['=FAKE1(A1)+FAKE2(B1)', '=FAKE2(C1)'])).toEqual({
      formulas: 2,
      unsupported: ['FAKE1', 'FAKE2'],
    });
  });

  it('空格子与纯文本不算公式', () => {
    expect(auditFormulas(['', '   ', 'hello'])).toEqual({ formulas: 0, unsupported: [] });
  });

  it('一个公式里的多个未知函数都会报告', () => {
    expect(auditFormulas(['=WEBSERVICE(A1)&FILTERXML(B1,"//x")']).unsupported).toEqual([]);
  });
});
