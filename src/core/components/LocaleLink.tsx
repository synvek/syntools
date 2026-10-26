import { forwardRef } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom';
import { useLocalizedPath } from '@/core/i18n/useLocalizedPath';

/**
 * 会自己补语言前缀的 `Link` / `NavLink`。
 *
 * 站点有两棵路由树（无前缀 = en，`/zh` = zh）。如果每个页面各写一遍
 * `to={lp('/pricing')}`，那么漏一处就是一条把中文用户甩回英文树的死链——
 * 而这种链接只有点下去才会发现，测试也未必覆盖。所以在导入层做一次替换：
 *
 *   import { Link } from 'react-router-dom'        // 旧
 *   import { Link } from '@/app/layout/LocaleLink' // 新
 *
 * 其余用法完全不变，`to` 为对象（`{ pathname, search }`）或外部地址时原样透传。
 */

/** 只处理「站内绝对路径字符串」，其余形态交给调用方 */
function localize(to: LinkProps['to'], lp: (path: string) => string): LinkProps['to'] {
  return typeof to === 'string' ? lp(to) : to;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...rest }, ref) {
  const lp = useLocalizedPath();
  return <RouterLink ref={ref} to={localize(to, lp)} {...rest} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, ...rest },
  ref,
) {
  const lp = useLocalizedPath();
  return <RouterNavLink ref={ref} to={localize(to, lp)} {...rest} />;
});
