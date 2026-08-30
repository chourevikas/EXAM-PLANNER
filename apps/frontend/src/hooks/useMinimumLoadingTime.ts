import { useState, useEffect } from 'react';

/**
 * Ensures a loading state remains true for a minimum amount of time.
 * Prevents UI flicker when data fetches resolve extremely quickly.
 * 
 * @param isFetching The actual loading state from your data fetching library
 * @param minimumTimeMs The minimum time the loading state should be true (default: 400ms)
 * @returns boolean representing if the skeleton should still be shown
 */
export function useMinimumLoadingTime(isFetching: boolean, minimumTimeMs: number = 400) {
  const [isMinimumLoading, setIsMinimumLoading] = useState(isFetching);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (isFetching) {
      // When fetch starts, immediately show loader
      setIsMinimumLoading(true);
    } else {
      // When fetch finishes, enforce the minimum loading time
      // We don't have a reliable start time here, so we just delay the "false" transition
      // A better approach tracks the actual start time, but a simple delay is usually enough
      // to prevent flicker.
      timeoutId = setTimeout(() => {
        setIsMinimumLoading(false);
      }, minimumTimeMs);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isFetching, minimumTimeMs]);

  // If either the actual fetch is true, or our minimum timer hasn't finished, show loading
  return isFetching || isMinimumLoading;
}
