import { useState, useEffect, useRef } from 'react';

/**
 * Ensures a loading state remains true for a minimum amount of time.
 * Prevents UI flicker when data fetches resolve extremely quickly.
 * 
 * @param isFetching The actual loading state from your data fetching library
 * @param minimumTimeMs The minimum time the loading state should be true (default: 400ms)
 * @returns boolean representing if the skeleton should still be shown
 */
export function useMinimumLoadingTime(isFetching: boolean, minimumTimeMs: number = 0) {
  const [isMinimumLoading, setIsMinimumLoading] = useState(isFetching);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (minimumTimeMs <= 0) {
      setIsMinimumLoading(isFetching);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    if (isFetching) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      setIsMinimumLoading(true);
    } else {
      const elapsed = startTimeRef.current !== null ? Date.now() - startTimeRef.current : 0;
      const remainingTime = Math.max(0, minimumTimeMs - elapsed);

      timeoutId = setTimeout(() => {
        setIsMinimumLoading(false);
        startTimeRef.current = null;
      }, remainingTime);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isFetching, minimumTimeMs]);

  if (minimumTimeMs <= 0) {
    return isFetching;
  }

  return isFetching || isMinimumLoading;
}
