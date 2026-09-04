import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadButton, OptionBar, SwapButton } from './ActionButtons';

describe('SwapButton', () => {
  it('点击触发 onSwap 回调', async () => {
    const onSwap = vi.fn();
    render(<SwapButton onSwap={onSwap} />);
    await userEvent.click(screen.getByRole('button', { name: '交换' }));
    expect(onSwap).toHaveBeenCalledTimes(1);
  });
});

describe('DownloadButton', () => {
  afterEach(() => vi.restoreAllMocks());

  it('内容为空时禁用', () => {
    render(<DownloadButton content="" filename="a.txt" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('点击触发下载并释放对象 URL', async () => {
    // jsdom 未实现 URL.createObjectURL，直接定义 stub
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DownloadButton content="data" filename="out.txt" />);
    await userEvent.click(screen.getByRole('button', { name: '下载' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

describe('OptionBar', () => {
  it('渲染子元素', () => {
    render(
      <OptionBar>
        <span>选项 A</span>
      </OptionBar>,
    );
    expect(screen.getByText('选项 A')).toBeInTheDocument();
  });
});
