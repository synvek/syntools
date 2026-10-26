import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { routedLangFromPath, withLangPrefix } from '@/core/i18n/routing';

/**
 * 站内跳转的路径构造函数：按**当前所在的路径树**补语言前缀。
 *
 * 为什么用「路径树」而不是「界面语言」：
 * 只有 en 与 zh 有独立 URL，其余 7 种语言是在无前缀树里切换的。若按界面语言算，
 * 一个把界面切成日语的用户点「全部工具」会掉回 `/zh/`（因为他上一站在中文树），
 * 而他应该继续待在自己所在的那棵树里。
 *
 * 用法：
 *   const lp = useLocalizedPath();
 *   <Link to={lp('/pricing')}>…           // 英文树 → /pricing，中文树 → /zh/pricing
 *   navigate(lp(`/tools/${id}`))
 */
export function useLocalizedPath(): (path: string) => string {
  const { pathname } = useLocation();
  const lang = routedLangFromPath(pathname);
  return useCallback((path: string) => withLangPrefix(path, lang), [lang]);
}
