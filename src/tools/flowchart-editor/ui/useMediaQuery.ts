import { useEffect, useState } from 'react';

/**
 * Subscribe to a media query (degrades to false under SSR / without matchMedia).
 * Used for the narrow-screen drawer layout and the touch-related responsive branches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Coarse-pointer devices such as touch / stylus: enlarge hit areas and enable touch gestures */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Narrow-screen breakpoint (aligned with Tailwind's lg): three columns become drawers */
export const NARROW_QUERY = '(max-width: 1023px)';
