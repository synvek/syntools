import { describe, expect, it } from 'vitest';
import { createExtensions } from './extensions';

/**
 * 扩展组合的门禁：拖动图片 / 文本块时必须有落点光标，否则用户看不出会插到哪个文字前面。
 * StarterKit 自带的 dropcursor 在本项目里始终没显示，因此改用自己注册的插件（可配颜色 / 粗细）。
 */
describe('编辑器扩展组合', () => {
  it('注册落点光标扩展，并关闭 StarterKit 自带的那条', () => {
    const extensions = createExtensions({ placeholder: '输入内容…' });
    const names = extensions.map((ext) => ext.name);

    expect(names).toContain('dropIndicator');
    const starterKit = extensions.find((ext) => ext.name === 'starterKit');
    expect(starterKit?.options.dropcursor).toBe(false);
  });
});
