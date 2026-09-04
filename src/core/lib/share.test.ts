import { describe, expect, it } from 'vitest';
import {
  SHARE_LIMIT,
  SHARE_PARAM,
  buildShareUrl,
  decodeShareState,
  encodeShareState,
  readSharedState,
} from './share';

describe('encodeShareState / decodeShareState', () => {
  it('往返编解码保持一致（含 Unicode）', () => {
    const state = { i: '你好，SynTools 😀', n: 4, u: true };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  it('参数值使用 base64url 字符集且无填充', () => {
    const param = encodeShareState({ i: '??>>~~' });
    expect(param).not.toMatch(/[+/=]/);
  });

  it('非法输入返回 null 而非抛异常', () => {
    expect(decodeShareState('!!!not-base64!!!')).toBeNull();
    // base64 合法但 JSON 非法
    expect(decodeShareState(btoa('not json'))).toBeNull();
    // JSON 合法但非对象
    expect(decodeShareState(btoa('[1,2]'))).toBeNull();
  });

  it('丢弃非原始类型字段', () => {
    const param = btoa(JSON.stringify({ a: 1, b: { nested: true }, c: [1] }));
    expect(decodeShareState(param)).toEqual({ a: 1 });
  });
});

describe('readSharedState', () => {
  it('无 ?s= 时返回默认值', () => {
    window.history.replaceState(null, '', '/tools/base64');
    expect(readSharedState({ i: '', d: 'encode' })).toEqual({ i: '', d: 'encode' });
  });

  it('合并 ?s= 中与默认值同类型的字段', () => {
    const param = encodeShareState({ i: 'abc', d: 'decode', x: '多余字段' });
    window.history.replaceState(null, '', `/tools/base64?${SHARE_PARAM}=${param}`);
    expect(readSharedState({ i: '', d: 'encode' })).toEqual({ i: 'abc', d: 'decode' });
  });

  it('类型不匹配的字段被忽略', () => {
    const param = encodeShareState({ n: '12' });
    window.history.replaceState(null, '', `/tools/x?${SHARE_PARAM}=${param}`);
    expect(readSharedState({ n: 2 })).toEqual({ n: 2 });
  });

  it('非法 ?s= 回退默认值', () => {
    window.history.replaceState(null, '', `/tools/x?${SHARE_PARAM}=%%%`);
    expect(readSharedState({ i: 'd' })).toEqual({ i: 'd' });
  });
});

describe('buildShareUrl', () => {
  it('生成带 ?s= 的完整链接', () => {
    const result = buildShareUrl('/tools/base64', { i: 'hi' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('/tools/base64?s=');
      const param = result.value.split('?s=')[1];
      expect(decodeShareState(param)).toEqual({ i: 'hi' });
    }
  });

  it('超过 2KB 降级返回错误', () => {
    const result = buildShareUrl('/tools/text-diff', { o: 'x'.repeat(SHARE_LIMIT + 100) });
    expect(result).toEqual({ ok: false, error: 'TOO_LONG' });
  });
});
