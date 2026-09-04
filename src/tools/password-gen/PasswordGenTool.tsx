import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IOTextArea } from '@/core/components/IOTextArea';
import { CopyButton } from '@/core/components/CopyButton';
import { OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  entropyBits,
  generatePassword,
  MAX_LENGTH,
  MIN_LENGTH,
  poolFor,
  strengthOf,
  type Strength,
} from './core';

const clampLength = (n: number) =>
  Math.min(Math.max(Math.floor(n) || MIN_LENGTH, MIN_LENGTH), MAX_LENGTH);

const STRENGTH_CLASS: Record<Strength, string> = {
  weak: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  strong: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

/** 随机密码生成器（Tasks T38）：文案全部走 i18n（T29 约定） */
export default function PasswordGenTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(
    () => readSharedState({ l: 16, a: true, b: true, c: true, d: true, e: false, f: true }),
    [],
  );
  const [length, setLength] = useState(clampLength(init.l));
  const [lowercase, setLowercase] = useState(init.a !== false);
  const [uppercase, setUppercase] = useState(init.b !== false);
  const [digits, setDigits] = useState(init.c !== false);
  const [symbols, setSymbols] = useState(init.d !== false);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(init.e === true);
  const [ensureEach, setEnsureEach] = useState(init.f !== false);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = { length, lowercase, uppercase, digits, symbols, excludeAmbiguous, ensureEach };

  const generate = () => {
    const result = generatePassword(options);
    if (result.ok) {
      setPassword(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
  };

  // 强度按当前选项的字符池实时估算
  const strength = useMemo(() => {
    if (!password) return null;
    const poolSize = poolFor(options).join('').length;
    const bits = entropyBits(password.length, poolSize);
    return { level: strengthOf(bits), bits };
  }, [password, length, lowercase, uppercase, digits, symbols, excludeAmbiguous]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.password.length')}
          <input
            type="number"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            onBlur={() => setLength(clampLength(length))}
            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {t('tools.password.generate')}
        </button>
        <ShareButton
          getState={() => ({
            l: length,
            a: lowercase,
            b: uppercase,
            c: digits,
            d: symbols,
            e: excludeAmbiguous,
            f: ensureEach,
          })}
        />
      </OptionBar>

      <div className="grid gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:grid-cols-2">
        {(
          [
            ['tools.password.lowercase', lowercase, setLowercase],
            ['tools.password.uppercase', uppercase, setUppercase],
            ['tools.password.digits', digits, setDigits],
            ['tools.password.symbols', symbols, setSymbols],
            ['tools.password.excludeAmbiguous', excludeAmbiguous, setExcludeAmbiguous],
            ['tools.password.ensureEach', ensureEach, setEnsureEach],
          ] as const
        ).map(([key, value, setValue]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => setValue(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t(key)}
          </label>
        ))}
      </div>

      <IOTextArea
        label={t('tools.password.output')}
        value={password}
        readOnly
        rows={2}
        placeholder={t('tools.password.outputPlaceholder')}
        actions={<CopyButton text={password} disabled={!password} />}
      />

      {strength && (
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${STRENGTH_CLASS[strength.level]}`}
          >
            {t(`tools.password.strength.${strength.level}`)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('tools.password.entropy', { bits: Math.round(strength.bits) })}
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.password.err.${error}`)}
        </p>
      )}
    </div>
  );
}
