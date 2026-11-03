import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RibbonComboBox } from './RibbonComboBox';
import type { RibbonSelectItem } from './types';

/**
 * The ribbon dropped the native `<select>` so options can be painted in their own font / style.
 * That means the keyboard and pointer contract is ours to keep: these cases lock it down.
 */

function item(overrides: Partial<RibbonSelectItem> = {}): RibbonSelectItem {
  return {
    kind: 'select',
    id: 'font-family',
    label: '字体',
    value: 'arial',
    options: [
      {
        value: 'arial',
        label: 'Arial',
        preview: { fontFamily: 'Arial', hint: 'AaBb 字' },
      },
      { value: 'georgia', label: 'Georgia', preview: { fontFamily: 'Georgia', hint: 'AaBb 字' } },
      { value: 'noto', label: 'Noto Sans' },
    ],
    onChange: vi.fn(),
    ...overrides,
  };
}

describe('RibbonComboBox', () => {
  it('shows the active option label in the trigger, styled with its preview', () => {
    render(<RibbonComboBox item={item()} accent="blue" testId="ribbon-font-font-family" />);
    const trigger = screen.getByRole('combobox', { name: '字体' });
    expect(trigger.textContent).toContain('Arial');
    // The preview is what makes the box Office-like instead of a plain label
    expect((trigger.firstElementChild as HTMLElement).style.fontFamily).toBe('Arial');
  });

  it('previews every option in its own font and marks the current one', () => {
    render(<RibbonComboBox item={item()} accent="blue" testId="ribbon-font-font-family" />);
    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));

    const listbox = screen.getByRole('listbox', { name: '字体' });
    expect(listbox).toBeTruthy();
    const georgia = screen.getByRole('option', { name: /Georgia/ });
    expect((georgia.firstElementChild as HTMLElement).style.fontFamily).toBe('Georgia');
    expect(screen.getByRole('option', { name: /Arial/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(georgia.getAttribute('aria-selected')).toBe('false');
  });

  it('commits the clicked option, closes and reports the value', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox item={item({ onChange })} accent="blue" testId="ribbon-font-font-family" />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));
    fireEvent.click(screen.getByRole('option', { name: /Noto Sans/ }));

    expect(onChange).toHaveBeenCalledWith('noto');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('walks the list with the arrow keys and picks with Enter', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox item={item({ onChange })} accent="blue" testId="ribbon-font-font-family" />,
    );
    const trigger = screen.getByRole('combobox', { name: '字体' });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('georgia');
  });

  it('closes on Escape without changing the value', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox item={item({ onChange })} accent="blue" testId="ribbon-font-font-family" />,
    );
    const trigger = screen.getByRole('combobox', { name: '字体' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when the pointer goes down outside', () => {
    render(<RibbonComboBox item={item()} accent="blue" testId="ribbon-font-font-family" />);
    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lets an editable box take a typed value and maps it back to the stored form', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox
        item={item({
          label: '字号',
          value: '15px',
          options: [
            { value: '14px', label: '14' },
            { value: '15px', label: '15' },
          ],
          editable: true,
          toDraft: (value) => value.replace(/px$/, ''),
          fromDraft: (draft) => `${draft}px`,
          onChange,
        })}
        accent="blue"
        testId="ribbon-font-font-size"
      />,
    );
    const input = screen.getByRole('combobox', { name: '字号' });
    // The stored '15px' is shown as '15' — the unit belongs to the document, not the input
    expect((input as HTMLInputElement).value).toBe('15');

    fireEvent.change(input, { target: { value: '18' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('18px');
  });

  it('does not open or call back when disabled', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox
        item={item({ onChange, disabled: true })}
        accent="blue"
        testId="ribbon-font-font-family"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: '字体' });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('paints section headings without letting them be selected', () => {
    const onChange = vi.fn();
    render(
      <RibbonComboBox
        item={item({
          onChange,
          options: [
            { value: 'common', label: '常用', heading: true },
            { value: 'arial', label: 'Arial' },
          ],
        })}
        accent="blue"
        testId="ribbon-font-font-family"
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));
    expect(screen.getByText('常用')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
