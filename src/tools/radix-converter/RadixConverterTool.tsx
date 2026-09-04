import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/core/components/CopyButton';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';
import { ShareButton } from '@/core/components/ShareButton';
import { readSharedState } from '@/core/lib/share';
import {
  applyBitOperator,
  BIT_OPERATORS,
  detectRadix,
  formatRadix,
  groupBits,
  parseInteger,
  RADIXES,
  toBitPattern,
  type BitOperator,
  type Radix,
} from './core';

// 分享状态白名单校验：进制为数字型，直接解析归一化
const parseRadixState = (v: string): 'auto' | Radix =>
  RADIXES.includes(Number(v) as Radix) ? (Number(v) as Radix) : 'auto';
const isOperator = (v: string): v is BitOperator => BIT_OPERATORS.includes(v as BitOperator);

const RADIX_LABELS: Record<Radix, string> = { 2: 'BIN', 8: 'OCT', 10: 'DEC', 16: 'HEX' };

/** 进制转换 / 位运算可视化（Tasks T40）：文案全部走 i18n（T29 约定） */
export default function RadixConverterTool() {
  const { t } = useTranslation();
  // 从分享链接 ?s= 还原初始状态（T28）
  const init = useMemo(() => readSharedState({ i: '', r: 'auto', o: 'and', b: '' }), []);
  const [input, setInput] = useState(init.i);
  const [radix, setRadix] = useState<'auto' | Radix>(parseRadixState(init.r));
  const [operator, setOperator] = useState<BitOperator>(isOperator(init.o) ? init.o : 'and');
  const [operandB, setOperandB] = useState(init.b);

  const effectiveRadix: Radix = radix === 'auto' ? detectRadix(input) : radix;
  const parsed = useMemo(
    () => (input.trim() ? parseInteger(input, effectiveRadix) : null),
    [input, effectiveRadix],
  );
  const value = parsed?.ok ? parsed.value : null;

  // 位运算：操作数 A 复用主输入，操作数 B 按十进制/前缀解析
  const bRadix: Radix = detectRadix(operandB);
  const parsedB = useMemo(
    () => (operandB.trim() ? parseInteger(operandB, bRadix) : null),
    [operandB, bRadix],
  );
  const bValue = parsedB?.ok ? parsedB.value : null;
  const needsB = operator !== 'not';
  const opResult = useMemo(() => {
    if (value === null) return null;
    if (needsB && bValue === null) return null;
    return applyBitOperator(operator, value, needsB ? (bValue ?? undefined) : undefined);
  }, [value, bValue, operator, needsB]);

  const formats = value !== null ? formatRadix(value) : null;
  const bitPattern = value !== null ? groupBits(toBitPattern(value)) : '';

  return (
    <div className="flex flex-col gap-4">
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('tools.radix.radix')}
          <select
            value={String(radix)}
            onChange={(e) =>
              setRadix(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as Radix))
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="auto">{t('tools.radix.auto')}</option>
            {RADIXES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <ClearButton onClick={() => setInput('')} disabled={!input} />
        <ShareButton getState={() => ({ i: input, r: String(radix), o: operator, b: operandB })} />
      </OptionBar>

      <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
        {t('tools.radix.input')}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('tools.radix.placeholder')}
          spellCheck={false}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      {parsed && !parsed.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t(`tools.radix.err.${parsed.error}`)}
        </p>
      )}

      {formats && value !== null && (
        <div className="flex flex-col gap-2">
          {(Object.keys(RADIX_LABELS) as unknown as (keyof typeof formats)[]).map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="w-10 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                {RADIX_LABELS[Number(key) as Radix]}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
                {formats[key]}
              </code>
              <CopyButton text={formats[key]} />
            </div>
          ))}

          {/* 64 位补码位模式可视化 */}
          <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('tools.radix.bitPattern')}（i64 {t('tools.radix.twosComplement')}）
            </p>
            <code className="block break-all font-mono text-xs leading-5 text-gray-700 dark:text-gray-200">
              {bitPattern}
            </code>
          </div>
        </div>
      )}

      {/* 位运算区 */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('tools.radix.bitOps')}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as BitOperator)}
            aria-label={t('tools.radix.operator')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            {BIT_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {t(`tools.radix.ops.${op}`)}
              </option>
            ))}
          </select>
          {needsB && (
            <input
              type="text"
              value={operandB}
              onChange={(e) => setOperandB(e.target.value)}
              placeholder={t('tools.radix.operandB')}
              spellCheck={false}
              aria-label={t('tools.radix.operandB')}
              className="w-40 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
          )}
        </div>
        {opResult && opResult.ok ? (
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-gray-800 dark:text-gray-100">
              {formatRadix(opResult.value).dec}（{formatRadix(opResult.value).hex}）
            </code>
            <CopyButton text={formatRadix(opResult.value).dec} />
          </div>
        ) : (
          opResult &&
          !opResult.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t(`tools.radix.err.${opResult.error}`)}
            </p>
          )
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('tools.radix.opHint')}</p>
      </div>
    </div>
  );
}
