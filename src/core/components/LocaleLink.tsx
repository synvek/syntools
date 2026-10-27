import { forwardRef } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom';
import { useLocalizedPath } from '@/core/i18n/useLocalizedPath';

/**
 * `Link` / `NavLink` that add the locale prefix themselves.
 *
 * The site has two route trees (no prefix = en, `/zh` = zh). If every page wrote
 * `to={lp('/pricing')}` itself, one miss becomes a link that drops Chinese users back into the English tree —
 * a bug only visible after clicking and unlikely to be covered. So swap once at the import layer:
 *
 *   import { Link } from 'react-router-dom'        // old
 *   import { Link } from '@/app/layout/LocaleLink' // new
 *
 * Everything else is unchanged; object `to` (`{ pathname, search }`) and external URLs pass through as-is.
 */

/** Handles internal absolute path strings only; other forms go back to the caller */
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
