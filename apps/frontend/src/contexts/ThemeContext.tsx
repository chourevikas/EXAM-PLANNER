import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchActiveTheme } from '../services/siteSettingsService';

const THEME_STORAGE_KEY = 'site_theme';

interface ThemeContextValue {
  themeName: string;
  applyThemeOptimistically: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(themeName: string) {
  document.documentElement.setAttribute('data-theme', themeName);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  } catch (e) {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<string>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'crimson';
    } catch (e) {
      return 'crimson';
    }
  });

  useEffect(() => {
    fetchActiveTheme()
      .then(({ theme_name }) => {
        setThemeName(theme_name);
        applyTheme(theme_name);
      })
      .catch(() => {
        // Backend unreachable or not yet migrated — keep whatever theme is
        // already applied (cached value or the default :root palette).
      });
  }, []);

  const applyThemeOptimistically = (name: string) => {
    setThemeName(name);
    applyTheme(name);
  };

  return (
    <ThemeContext.Provider value={{ themeName, applyThemeOptimistically }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return ctx;
}
