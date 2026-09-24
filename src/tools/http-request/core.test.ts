import { describe, expect, it } from 'vitest';
import {
  formatBody,
  formatBytes,
  formatDuration,
  parseCurlCommand,
  parseHeaderLines,
  statusCategory,
  toCurl,
} from './core';

describe('parseHeaderLines', () => {
  it('解析多行请求头', () => {
    expect(parseHeaderLines('Accept: application/json\nX-Token: abc\n')).toEqual([
      { name: 'Accept', value: 'application/json' },
      { name: 'X-Token', value: 'abc' },
    ]);
  });

  it('跳过空行与非法行', () => {
    expect(parseHeaderLines('\nnot-a-header\n: novalue')).toEqual([]);
  });
});

describe('parseCurlCommand', () => {
  it('还原方法、URL、请求头与请求体', () => {
    const result = parseCurlCommand(
      `curl -X POST 'https://api.example.com/v1' -H 'Content-Type: application/json' -d '{"a":1}'`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.method).toBe('POST');
    expect(result.value.url).toBe('https://api.example.com/v1');
    expect(result.value.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
    expect(result.value.body).toBe('{"a":1}');
  });

  it('带 -d 时默认推断为 POST', () => {
    const result = parseCurlCommand(`curl https://example.com -d 'a=1'`);
    expect(result.ok && result.value.method).toBe('POST');
  });

  it('拒绝非 curl 或无 URL 输入', () => {
    expect(parseCurlCommand('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseCurlCommand('wget https://example.com')).toEqual({ ok: false, error: 'NOT_CURL' });
    expect(parseCurlCommand('curl -X GET')).toEqual({ ok: false, error: 'NO_URL' });
  });
});

describe('statusCategory', () => {
  it('按首位归类', () => {
    expect(statusCategory(101)).toBe('info');
    expect(statusCategory(204)).toBe('success');
    expect(statusCategory(301)).toBe('redirect');
    expect(statusCategory(404)).toBe('client');
    expect(statusCategory(503)).toBe('server');
    expect(statusCategory(0)).toBe('unknown');
  });
});

describe('格式化辅助', () => {
  it('formatBytes 逐级进位', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.00 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formatDuration 超过 1s 用秒', () => {
    expect(formatDuration(120)).toBe('120 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
  });

  it('formatBody 美化 JSON，非 JSON 原样返回', () => {
    expect(formatBody('{"a":1}').ok && formatBody('{"a":1}').ok).toBe(true);
    const json = formatBody('{"a":1}');
    expect(json.ok && json.value).toBe('{\n  "a": 1\n}');
    const plain = formatBody('hello');
    expect(plain.ok && plain.value).toBe('hello');
  });
});

describe('toCurl', () => {
  it('生成可复制的 curl 命令', () => {
    const cmd = toCurl({
      method: 'GET',
      url: 'https://example.com',
      headers: [{ name: 'Accept', value: '*/*' }],
      body: '',
    });
    expect(cmd).toContain('curl -X GET');
    expect(cmd).toContain("-H 'Accept: */*'");
  });
});
