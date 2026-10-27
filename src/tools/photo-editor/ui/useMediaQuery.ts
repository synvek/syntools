import { useEffect, useState } from 'react';

/**
 * Subscribe to a media query (degrades to false under SSR / without matchMedia).
 * Same convention as flowchart-editor: the narrow breakpoint matches Tailwind `lg`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    // Also listen to resize: some embedded browsers / device emulators change the viewport without firing MediaQueryList change
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [query]);

  return matches;
}

/** Narrow screen: the three columns stack vertically so the canvas is not squeezed into a sliver */
export const NARROW_QUERY = '(max-width: 1023px)';
