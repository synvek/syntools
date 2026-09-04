import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IOTextArea } from './IOTextArea';

describe('IOTextArea', () => {
  it('渲染标签与字符/字节统计', () => {
    render(<IOTextArea label="输入" value="hi" />);
    expect(screen.getByText('输入')).toBeInTheDocument();
    expect(screen.getByText('2 字符 / 2 字节')).toBeInTheDocument();
  });

  it('多字节字符按 UTF-8 统计字节数', () => {
    render(<IOTextArea label="输入" value="中" />);
    expect(screen.getByText('1 字符 / 3 字节')).toBeInTheDocument();
  });

  it('输入时回调新值', () => {
    const onChange = vi.fn();
    render(<IOTextArea label="输入" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('只读模式不可编辑', () => {
    render(<IOTextArea label="输出" value="fixed" readOnly />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  it('超过 5MB 的输入被拒绝并提示', () => {
    const onChange = vi.fn();
    render(<IOTextArea label="输入" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a'.repeat(5 * 1024 * 1024 + 1) },
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/已超过 5MB 上限/)).toBeInTheDocument();
  });

  it('超过 500KB 时给出性能预警', () => {
    render(<IOTextArea label="输入" value={'a'.repeat(500 * 1024 + 1)} onChange={() => {}} />);
    expect(screen.getByText(/输入较大/)).toBeInTheDocument();
  });

  it('渲染右侧操作区', () => {
    render(<IOTextArea label="输入" value="" actions={<button type="button">复制</button>} />);
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument();
  });
});
