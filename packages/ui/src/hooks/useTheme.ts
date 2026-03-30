import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // TODO: [Agent2-Dependency] 未来在此处订阅 settings.store 的 themeMode
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actualDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);
    setIsDark(actualDark);

    if (typeof document !== 'undefined') {
      if (actualDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (themeMode === 'system') {
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(sysDark);
        if (sysDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { themeMode, setThemeMode, isDark, toggleTheme };
}
