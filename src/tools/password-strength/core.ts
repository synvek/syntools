export type StrengthLabel = 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
export type StrengthIssue =
  | 'too_short'
  | 'no_lower'
  | 'no_upper'
  | 'no_digit'
  | 'no_symbol'
  | 'sequential'
  | 'repeated'
  | 'common';

export interface StrengthReport {
  score: 0 | 1 | 2 | 3 | 4;
  entropy: number;
  length: number;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  label: StrengthLabel;
  issues: StrengthIssue[];
}

const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'abc123',
  'password1',
  '111111',
  'iloveyou',
  'admin',
  'welcome',
  'letmein',
  'monkey',
  'dragon',
  '123123',
  'sunshine',
  'princess',
  'football',
  'qwerty123',
]);

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

function hasSequential(pw: string): boolean {
  const lower = pw.toLowerCase();
  const windows = [
    ALPHA,
    '0123456789',
    'abcdefghijklmnopqrstuvwxyz'.split('').reverse().join(''),
    '9876543210',
  ];
  for (const w of windows) {
    for (let i = 0; i + 3 <= w.length; i += 1) {
      const run = w.slice(i, i + 3);
      if (lower.includes(run)) return true;
    }
  }
  return false;
}

function hasRepeated(pw: string): boolean {
  return /(.)\1\1/.test(pw);
}

/** 估算密码强度：基于字符集熵，并对常见弱模式进行惩罚（零依赖）。 */
export function estimateStrength(password: string): StrengthReport {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  let pool = 0;
  if (hasLower) pool += 26;
  if (hasUpper) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSymbol) pool += 33;
  if (pool === 0) pool = 1;

  const issues: StrengthIssue[] = [];
  if (length < 8) issues.push('too_short');
  if (length > 0 && !hasLower) issues.push('no_lower');
  if (length > 0 && !hasUpper) issues.push('no_upper');
  if (length > 0 && !hasDigit) issues.push('no_digit');
  if (length > 0 && !hasSymbol) issues.push('no_symbol');
  if (hasSequential(password)) issues.push('sequential');
  if (hasRepeated(password)) issues.push('repeated');

  let entropy = length * Math.log2(pool);
  if (hasSequential(password)) entropy *= 0.6;
  if (hasRepeated(password)) entropy *= 0.8;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    issues.push('common');
    entropy = Math.min(entropy, 10);
  }
  entropy = Math.max(0, Math.round(entropy));

  let score: StrengthReport['score'];
  let label: StrengthLabel;
  if (length === 0) {
    score = 0;
    label = 'very_weak';
  } else if (issues.includes('common') || entropy < 28) {
    score = 0;
    label = 'very_weak';
  } else if (entropy < 40) {
    score = 1;
    label = 'weak';
  } else if (entropy < 60) {
    score = 2;
    label = 'fair';
  } else if (entropy < 80) {
    score = 3;
    label = 'strong';
  } else {
    score = 4;
    label = 'very_strong';
  }

  return {
    score,
    entropy,
    length,
    hasLower,
    hasUpper,
    hasDigit,
    hasSymbol,
    label,
    issues,
  };
}
