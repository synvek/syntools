import type { ReactNode } from 'react';
import { Link } from '@/core/components/LocaleLink';
import { Icon } from '@/core/components/Icon';

/**
 * 营销与信任页共用的展示件。
 *
 * 这四页（定价 / 安全 / 隐私 / 关于）是给人「读」的，不是给工具用的，
 * 所以排版比工具页更松：正文 15px、行高 1.7、单栏最大 720px，
 * 与预渲染的 `.seo-shell` 骨架保持同一套视觉，避免 JS 加载完成瞬间跳版。
 */

export function PageShell({
  title,
  lead,
  aside,
  wide,
  children,
}: {
  title: string;
  lead: string;
  aside?: ReactNode;
  /** 定价页有五档对比表，需要比正文阅读宽度更宽；其余页保持 720px */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="w-full px-6 py-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{lead}</p>
        {aside}
      </div>
      <div className={`mt-8 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>{children}</div>
    </div>
  );
}

export function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-8 first:mt-0">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  );
}

/** 勾选列表：用于「这一档包含什么」 */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Icon
            name="check"
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 段落型说明（安全页大量使用） */
export function Paragraphs({ items }: { items: string[] }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
      {items.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </div>
  );
}

/** 定义列表：左窄右宽，适合「策略项 → 它到底限制了谁」 */
export function DefinitionList({ items }: { items: { term: string; desc: string }[] }) {
  return (
    <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
      {items.map((item) => (
        <div key={item.term} className="grid gap-1 p-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <dt className="font-mono text-xs text-gray-900 dark:text-gray-100">{item.term}</dt>
          <dd className="text-gray-600 dark:text-gray-300">{item.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface PriceTier {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  bullets: string[];
  cta: { label: string; href: string; external?: boolean };
  note?: string;
  highlight?: boolean;
  badge?: string;
}

export function PriceCard({ tier }: { tier: PriceTier }) {
  const ctaClass = tier.highlight
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : 'border border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800';
  return (
    <div
      className={`flex flex-col rounded-lg border bg-white p-5 dark:bg-gray-900 ${
        tier.highlight
          ? 'border-blue-300 ring-1 ring-blue-200 dark:border-blue-700 dark:ring-blue-900'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{tier.name}</h3>
        {tier.badge && (
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {tier.badge}
          </span>
        )}
      </div>
      <p className="mt-2">
        <span className="text-2xl font-bold tracking-tight">{tier.price}</span>
        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{tier.unit}</span>
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tier.tagline}</p>
      <div className="mt-4 flex-1">
        <CheckList items={tier.bullets} />
      </div>
      {tier.cta.external ? (
        <a
          href={tier.cta.href}
          target="_blank"
          rel="noreferrer"
          className={`mt-5 block rounded-md px-3 py-2 text-center text-sm font-medium ${ctaClass}`}
        >
          {tier.cta.label}
        </a>
      ) : (
        <Link
          to={tier.cta.href}
          className={`mt-5 block rounded-md px-3 py-2 text-center text-sm font-medium ${ctaClass}`}
        >
          {tier.cta.label}
        </Link>
      )}
      {tier.note && (
        <p className="mt-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">{tier.note}</p>
      )}
    </div>
  );
}

/**
 * 档位对比表。
 *
 * 定价页暂时不渲染它 —— 付费档的功能范围仍在规划中，先摆一张「谁有谁没有」的表
 * 等于把没定的差异提前写死。组件留在这里，等差异定稿后重新挂回去即可。
 */
export function CompareTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-left dark:bg-gray-900">
            {columns.map((col, i) => (
              <th
                key={col}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 font-medium ${
                  i === 0 ? '' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td
                  key={`${row[0]}-${i}`}
                  className={`px-3 py-2 ${
                    i === 0
                      ? 'text-gray-700 dark:text-gray-200'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
      {items.map((item) => (
        <details key={item.q} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:content-none">
            <span className="flex items-start justify-between gap-3">
              {item.q}
              <Icon
                name="chevronRight"
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90"
              />
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** 页脚式提示条（与 /download 页的隐私条同款） */
export function NoteBar({ icon = 'shield', children }: { icon?: string; children: ReactNode }) {
  return (
    <p className="mt-6 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
