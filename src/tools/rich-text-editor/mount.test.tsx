import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 挂载冒烟测试（渲染期顺序回归防护）。
 *
 * 背景：`useEditor` 会在**渲染期同步构造**编辑器，随即执行各扩展插件的
 * `state.init`。因此任何被插件 init 调用的 getter，其内部读取的 ref/state
 * 都必须在 `useEditor` 之前完成声明，否则会抛
 * `ReferenceError: Cannot access 'xxx' before initialization`。
 *
 * 这类错误 tsc 与 eslint 都抓不到（闭包内引用后声明变量属合法语法），
 * 只有真实挂载才会暴露，故用本测试兜住。
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh', changeLanguage: () => Promise.resolve() },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('文字处理器挂载', () => {
  it('渲染出编辑区，且渲染期不抛 TDZ 之类的顺序错误', async () => {
    // jsdom 未实现这两个 API，而工具在挂载后立刻使用它们
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }));

    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });

    const { default: RichTextEditorTool } = await import('./RichTextEditorTool');
    let thrown: unknown = null;
    try {
      const { container } = render(<RichTextEditorTool />);
      expect(container.querySelector('.rte-surface')).toBeTruthy();
      expect(container.querySelector('[contenteditable="true"]')).toBeTruthy();
    } catch (error) {
      thrown = error;
    }

    const joined = `${errors.join('\n')}\n${String(thrown)}`;
    expect(joined).not.toContain('before initialization');
    expect(thrown).toBeNull();
    spy.mockRestore();
  });
});
