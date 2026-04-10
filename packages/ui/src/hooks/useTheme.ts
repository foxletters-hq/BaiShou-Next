import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [seedColor, setSeedColor] = useState<string>('#5BA8F5');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const el = document.documentElement;
      
      const updateState = () => {
        setIsDark(el.getAttribute('data-theme') === 'dark');
        const computedColor = getComputedStyle(el).getPropertyValue('--color-primary').trim();
        if (computedColor) {
          setSeedColor(computedColor);
        }
      };

      // Initial read
      updateState();

      // Passively observe DOM mutations from the Host App (e.g. desktop/mobi App shell)
      const observer = new MutationObserver(() => {
        updateState();
      });
      observer.observe(el, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });

      return () => observer.disconnect();
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Stubbed. Host apps should handle theme toggling natively.
  }, []);

  return { themeMode, setThemeMode, isDark, toggleTheme, seedColor, setSeedColor };
}
