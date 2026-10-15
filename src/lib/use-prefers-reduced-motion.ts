import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * CSS handles the decorative animations, but a component that advances state on
 * a timer has to honour the same preference in JS — a moving highlight is
 * motion whether or not a keyframe drew it.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefers(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return prefers;
}
