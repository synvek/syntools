import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { NamedRange } from '../namedRanges';
import type { SheetProtectionState } from '../sheetProtection';
import { NameManagerPanel } from './NameManagerPanel';
import { ProtectDialog } from './ProtectDialog';

/** P2-S7.1 / S7.2 面板：名称增删改、校验提示、保护开关与"允许的操作" */

const SHEETS = [
  { id: 'sheet-1', name: 'Data' },
  { id: 'sheet-2', name: 'Report' },
];

function renderNames(names: NamedRange[], onChange = vi.fn()) {
  render(
    <NameManagerPanel
      names={names}
      sheets={SHEETS}
      activeSheetId="sheet-1"
      selectionRef="A1:B2"
      onChange={onChange}
      onClose={() => {}}
    />,
  );
  return onChange;
}

describe('名称管理器面板', () => {
  it('空列表给出提示', () => {
    renderNames([]);
    expect(screen.getByText('tools.sheet.namesEmpty')).toBeTruthy();
  });

  it('新增时用当前选区预填引用', () => {
    const onChange = renderNames([]);
    fireEvent.click(screen.getByText('tools.sheet.namesAdd'));
    const next = onChange.mock.calls[0][0] as NamedRange[];
    expect(next).toHaveLength(1);
    expect(next[0].ref).toBe('A1:B2');
  });

  it('空名与非法引用分别给出提示', () => {
    renderNames([
      { id: 'name-1', name: '', ref: 'A1' },
      { id: 'name-2', name: 'A1', ref: 'nope' },
    ]);
    expect(screen.getAllByText('tools.sheet.namesErrorEmpty').length).toBe(1);
    expect(screen.getAllByText('tools.sheet.namesErrorInvalid').length).toBe(1);
  });

  it('改作用域会写入 sheetId，改回工作簿级则清掉', () => {
    const onChange = renderNames([{ id: 'name-1', name: 'Total', ref: 'A1' }]);
    const scope = screen.getByLabelText('tools.sheet.namesScope') as HTMLSelectElement;
    fireEvent.change(scope, { target: { value: 'sheet-2' } });
    expect((onChange.mock.calls[0][0] as NamedRange[])[0].sheetId).toBe('sheet-2');

    fireEvent.change(scope, { target: { value: '' } });
    expect((onChange.mock.calls[1][0] as NamedRange[])[0].sheetId).toBeUndefined();
  });

  it('删除只移除目标行', () => {
    const onChange = renderNames([
      { id: 'name-1', name: 'A', ref: 'A1' },
      { id: 'name-2', name: 'B', ref: 'B1' },
    ]);
    const buttons = screen.getAllByLabelText('tools.sheet.namesDelete');
    fireEvent.click(buttons[0]);
    const next = onChange.mock.calls[0][0] as NamedRange[];
    expect(next.map((item) => item.id)).toEqual(['name-2']);
  });
});

function renderProtect(state: SheetProtectionState | null, onApply = vi.fn()) {
  render(<ProtectDialog sheetName="Data" state={state} onApply={onApply} onClose={() => {}} />);
  return onApply;
}

describe('工作表保护对话框', () => {
  it('未保护时提供密码输入，提交开启并带上勾选的允许项', () => {
    const onApply = renderProtect(null);
    fireEvent.change(screen.getByLabelText('tools.sheet.protectPassword'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByLabelText('tools.sheet.protectAllowFormat'));
    fireEvent.click(screen.getByText('tools.sheet.protectEnable'));

    const input = onApply.mock.calls[0][0] as {
      enabled: boolean;
      flags: Record<string, boolean>;
      password: string;
    };
    expect(input.enabled).toBe(true);
    expect(input.password).toBe('pw');
    expect(input.flags.formatCells).toBe(true);
    // 默认允许选择单元格（Excel 的保护默认值）
    expect(input.flags.selectLockedCells).toBe(true);
  });

  it('已保护时不再显示密码框，动作变成取消保护', () => {
    const onApply = renderProtect({ sheetId: 'sheet-1', enabled: true, flags: {} });
    expect(screen.queryByLabelText('tools.sheet.protectPassword')).toBeNull();
    fireEvent.click(screen.getByText('tools.sheet.protectDisable'));
    expect((onApply.mock.calls[0][0] as { enabled: boolean }).enabled).toBe(false);
  });
});
