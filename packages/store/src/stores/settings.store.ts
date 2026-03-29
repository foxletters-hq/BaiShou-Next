import { createStore } from '../create-store';

export type AppThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
  themeMode: AppThemeMode;
  useGlassmorphism: boolean;
  locale: string;
}

export interface SettingsActions {
  setThemeMode: (mode: AppThemeMode) => void;
  toggleGlassmorphism: (enabled: boolean) => void;
  setLocale: (locale: string) => void;
}

export const useSettingsStore = createStore<SettingsState & SettingsActions>('SettingsStore', (set) => ({
  themeMode: 'system',
  useGlassmorphism: true,
  locale: 'zh',

  setThemeMode: (themeMode) => set({ themeMode }),
  toggleGlassmorphism: (useGlassmorphism) => set({ useGlassmorphism }),
  setLocale: (locale) => set({ locale }),
}));
