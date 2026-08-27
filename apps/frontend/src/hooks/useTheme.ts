import { useEffect } from 'react';

export type Theme = 'light';

export function useTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  return {
    theme: 'light' as const,
    toggleTheme: () => {},
    isDark: false,
  };
}
