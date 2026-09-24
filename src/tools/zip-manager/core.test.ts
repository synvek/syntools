import { describe, expect, it } from 'vitest';
import { createZip, extractZipEntry, listZip } from './core';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('zip-manager', () => {
  it('创建 zip 后可列出条目', async () => {
    const zip = await createZip([
      { name: 'a.txt', data: bytes('hello') },
      { name: 'b.txt', data: bytes('world') },
    ]);
    expect(zip.ok).toBe(true);
    if (!zip.ok) return;
    const list = await listZip(zip.value);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
    expect(list.value[0].size).toBe(5);
  });

  it('解压单个条目内容正确', async () => {
    const zip = await createZip([{ name: 'note.txt', data: bytes('内容 content') }]);
    expect(zip.ok).toBe(true);
    if (!zip.ok) return;
    const entry = await extractZipEntry(zip.value, 'note.txt');
    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    expect(new TextDecoder().decode(entry.value)).toBe('内容 content');
  });

  it('空文件列表报错', async () => {
    expect(await createZip([])).toEqual({ ok: false, error: 'NO_FILES' });
  });

  it('非法 zip 报错', async () => {
    const r = await listZip(bytes('not a zip'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_ZIP');
  });

  it('不存在的条目报错', async () => {
    const zip = await createZip([{ name: 'x.txt', data: bytes('x') }]);
    expect(zip.ok).toBe(true);
    if (!zip.ok) return;
    expect(await extractZipEntry(zip.value, 'missing.txt')).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });
});
