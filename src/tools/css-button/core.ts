/**
 * CSS 按钮生成器：根据选项输出 CSS / HTML 片段。
 */

export interface ButtonStyleOptions {
  label: string;
  bg: string;
  color: string;
  hoverBg: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  fontWeight: number;
  shadow: boolean;
  fullWidth: boolean;
}

export const DEFAULT_BUTTON_OPTIONS: ButtonStyleOptions = {
  label: 'Button',
  bg: '#3b82f6',
  color: '#ffffff',
  hoverBg: '#2563eb',
  borderColor: '#3b82f6',
  borderWidth: 0,
  radius: 8,
  paddingX: 20,
  paddingY: 10,
  fontSize: 14,
  fontWeight: 600,
  shadow: true,
  fullWidth: false,
};

export function buildButtonCss(options: ButtonStyleOptions, className = 'btn'): string {
  const shadow = options.shadow
    ? '  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(59, 130, 246, 0.25);\n'
    : '';
  const width = options.fullWidth ? '  width: 100%;\n' : '';
  return [
    `.${className} {`,
    `  display: inline-flex;`,
    `  align-items: center;`,
    `  justify-content: center;`,
    `  gap: 0.5rem;`,
    `  padding: ${options.paddingY}px ${options.paddingX}px;`,
    `  font-size: ${options.fontSize}px;`,
    `  font-weight: ${options.fontWeight};`,
    `  line-height: 1.25;`,
    `  color: ${options.color};`,
    `  background: ${options.bg};`,
    `  border: ${options.borderWidth}px solid ${options.borderColor};`,
    `  border-radius: ${options.radius}px;`,
    `  cursor: pointer;`,
    `  text-decoration: none;`,
    `  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;`,
    shadow.trimEnd() ? shadow.trimEnd() : null,
    width.trimEnd() ? width.trimEnd() : null,
    `}`,
    ``,
    `.${className}:hover {`,
    `  background: ${options.hoverBg};`,
    `}`,
    ``,
    `.${className}:active {`,
    `  transform: translateY(1px);`,
    `}`,
    ``,
    `.${className}:focus-visible {`,
    `  outline: 2px solid ${options.hoverBg};`,
    `  outline-offset: 2px;`,
    `}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function buildButtonHtml(options: ButtonStyleOptions, className = 'btn'): string {
  const safe = options.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<button type="button" class="${className}">${safe}</button>`;
}

export function buildButtonInlineStyle(options: ButtonStyleOptions): Record<string, string | number | undefined> {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${options.paddingY}px ${options.paddingX}px`,
    fontSize: `${options.fontSize}px`,
    fontWeight: options.fontWeight,
    lineHeight: 1.25,
    color: options.color,
    background: options.bg,
    border: `${options.borderWidth}px solid ${options.borderColor}`,
    borderRadius: `${options.radius}px`,
    cursor: 'pointer',
    width: options.fullWidth ? '100%' : undefined,
    boxShadow: options.shadow
      ? '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(59,130,246,0.25)'
      : undefined,
  };
}
