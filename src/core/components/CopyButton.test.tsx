import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('点击写入剪贴板并显示成功反馈', async () => {
    render(<CopyButton text="hello" />);
    await userEvent.click(screen.getByRole('button', { name: /复制/ }));
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('文本为空时禁用', () => {
    render(<CopyButton text="" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('Clipboard API 失败时降级到 execCommand', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    render(<CopyButton text="fallback" />);
    await userEvent.click(screen.getByRole('button'));
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });
});
