import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { routedLangFromPath, withLangPrefix } from '@/core/i18n/routing';

/**
 * Path builder for internal links: prefixes with the **tree the user is currently in**.
 *
 * Why the tree and not the UI language:
 * only en and zh have their own URLs and the other 7 switch inside the unprefixed tree. Keying on UI language,
 * a user who switched the UI to Japanese would drop back to `/zh/` (their previous stop was the Chinese tree)
 * when they should stay in the tree they are already in.
 *
 * Usage:
 *   const lp = useLocalizedPath();
 *   <Link to={lp('/pricing')}>…           // English tree → /pricing, Chinese tree → /zh/pricing
 *   navigate(lp(`/tools/${id}`))
 */
export function useLocalizedPath(): (path: string) => string {
  const { pathname } = useLocation();
  const lang = routedLangFromPath(pathname);
  return useCallback((path: string) => withLangPrefix(path, lang), [lang]);
}
