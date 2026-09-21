import { useSyncExternalStore, useCallback } from 'react';

/**
 * Responsive breakpoint boundaries (min-width, inclusive).
 * Matches the CSS breakpoints defined in index.css / styles/index.css.
 *
 * ┌──────────────┬──────────┐
 * │ Name         │ Min-width│
 * ├──────────────┼──────────┤
 * │ xs           │ 0        │  (small phones 320–390)
 * │ sm           │ 391      │  (large phones 391–480)
 * │ md           │ 481      │  (small tablets / phablets)
 * │ tablet       │ 640      │  (tablets portrait 600–834)
 * │ lg           │ 835      │  (tablets landscape 835–1024)
 * │ laptop       │ 1025     │  (small laptops 1024–1366)
 * │ xl           │ 1367     │  (large desktops 1367+)
 * └──────────────┴──────────┘
 */
export type BreakpointName = 'xs' | 'sm' | 'md' | 'tablet' | 'lg' | 'laptop' | 'xl';

const BREAKPOINTS: { name: BreakpointName; minWidth: number }[] = [
  { name: 'xl',     minWidth: 1367 },
  { name: 'laptop', minWidth: 1025 },
  { name: 'lg',     minWidth: 835  },
  { name: 'tablet', minWidth: 640  },
  { name: 'md',     minWidth: 481  },
  { name: 'sm',     minWidth: 391  },
  { name: 'xs',     minWidth: 0    },
];

function getCurrentBreakpoint(): BreakpointName {
  const w = window.innerWidth;
  for (const bp of BREAKPOINTS) {
    if (w >= bp.minWidth) return bp.name;
  }
  return 'xs';
}

function getWidth(): number {
  return window.innerWidth;
}

// Shared external store for breakpoint — single resize listener for ALL consumers
let listeners: Set<() => void> = new Set();
let cachedBreakpoint = typeof window !== 'undefined' ? getCurrentBreakpoint() : 'lg' as BreakpointName;
let cachedWidth = typeof window !== 'undefined' ? getWidth() : 1024;

if (typeof window !== 'undefined') {
  const handleResize = () => {
    const newBp = getCurrentBreakpoint();
    const newWidth = getWidth();
    if (newBp !== cachedBreakpoint || newWidth !== cachedWidth) {
      cachedBreakpoint = newBp;
      cachedWidth = newWidth;
      listeners.forEach(fn => fn());
    }
  };

  window.addEventListener('resize', handleResize, { passive: true });
  // Also listen for orientation change on mobile
  window.addEventListener('orientationchange', () => {
    // Small delay to let the browser finish rotation
    setTimeout(handleResize, 100);
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getBreakpointSnapshot(): BreakpointName {
  return cachedBreakpoint;
}

function getWidthSnapshot(): number {
  return cachedWidth;
}

function getServerSnapshot(): BreakpointName {
  return 'lg'; // SSR default
}

function getServerWidthSnapshot(): number {
  return 1024;
}

export interface BreakpointResult {
  /** Current named breakpoint */
  breakpoint: BreakpointName;

  /** Raw viewport width in px */
  width: number;

  /** True if viewport <= 390px (small phones) */
  isXs: boolean;

  /** True if viewport <= 480px (all phones) */
  isMobile: boolean;

  /** True if viewport <= 640px (phones + small tablets portrait) */
  isSmallScreen: boolean;

  /** True if viewport <= 834px (includes tablets portrait) */
  isTabletOrBelow: boolean;

  /** True if viewport <= 1024px (includes tablets landscape) */
  isLaptopOrBelow: boolean;

  /** True if viewport >= 1025px (laptop and larger) */
  isDesktop: boolean;

  /** True if the device has a coarse pointer (touch). Updated on mount only. */
  isTouchDevice: boolean;
}

/**
 * Shared responsive breakpoint hook.
 *
 * Replaces all scattered `window.addEventListener('resize')` calls.
 * Uses `useSyncExternalStore` so only components whose breakpoint
 * actually changed will re-render.
 *
 * @example
 * const { isMobile, isDesktop, breakpoint, width } = useBreakpoint();
 */
export function useBreakpoint(): BreakpointResult {
  const breakpoint = useSyncExternalStore(subscribe, getBreakpointSnapshot, getServerSnapshot);
  const width = useSyncExternalStore(subscribe, getWidthSnapshot, getServerWidthSnapshot);

  const isTouchDevice = typeof window !== 'undefined'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  return {
    breakpoint,
    width,
    isXs: width <= 390,
    isMobile: width <= 480,
    isSmallScreen: width <= 640,
    isTabletOrBelow: width <= 834,
    isLaptopOrBelow: width <= 1024,
    isDesktop: width >= 1025,
    isTouchDevice,
  };
}

/**
 * Utility to apply responsive inline styles.
 * Returns the style object for the current breakpoint from highest
 * matching breakpoint downward (mobile-first).
 *
 * @example
 * const styles = useResponsiveStyle({
 *   base: { padding: 16 },
 *   sm:   { padding: 20 },
 *   lg:   { padding: 32 },
 * });
 */
export function useResponsiveStyle(
  breakpointStyles: Partial<Record<'base' | BreakpointName, React.CSSProperties>>
): React.CSSProperties {
  const { breakpoint } = useBreakpoint();

  const order: ('base' | BreakpointName)[] = ['base', 'xs', 'sm', 'md', 'tablet', 'lg', 'laptop', 'xl'];
  const currentIdx = order.indexOf(breakpoint);

  let merged: React.CSSProperties = {};
  for (let i = 0; i <= currentIdx; i++) {
    const key = order[i];
    if (breakpointStyles[key]) {
      merged = { ...merged, ...breakpointStyles[key] };
    }
  }

  return merged;
}
