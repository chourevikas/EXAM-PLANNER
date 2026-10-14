import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a function with a stable identity that always calls the latest `fn`.
 *
 * Lets a memoized child skip re-renders caused by unrelated parent state (e.g. a ticking timer)
 * without ever running a stale handler.
 */
export function useLatestCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
