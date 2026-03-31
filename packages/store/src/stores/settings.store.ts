import { createStore } from '../create-store';
import type { AIProviderConfig, GlobalModelsConfig, FeatureSettingsConfig } from '@baishou/shared';

export type AppThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
  themeMode: AppThemeMode;
  useGlassmorphism: boolean;
  locale: string;
  providers: AIProviderConfig[];
  globalModels: GlobalModelsConfig | null;
  features: FeatureSettingsConfig | null;
  isLoading: boolean;
}

export interface SettingsActions {
  setThemeMode: (mode: AppThemeMode) => void;
  toggleGlassmorphism: (enabled: boolean) => void;
  setLocale: (locale: string) => void;

  // AI 设定异步操作
  loadConfig: () => Promise<void>;
  updateProvider: (provider: AIProviderConfig) => Promise<void>;
  toggleProvider: (id: string, isEnabled: boolean) => Promise<void>;
  setGlobalModels: (config: GlobalModelsConfig) => Promise<void>;
  setFeatureSettings: (config: FeatureSettingsConfig) => Promise<void>;
}

export const useSettingsStore = createStore<SettingsState & SettingsActions>('SettingsStore', (set, get: any) => ({
  themeMode: 'system',
  useGlassmorphism: true,
  locale: 'zh',
  providers: [],
  globalModels: null,
  features: null,
  isLoading: false,

  setThemeMode: (themeMode) => set({ themeMode }),
  toggleGlassmorphism: (useGlassmorphism) => set({ useGlassmorphism }),
  setLocale: (locale) => set({ locale }),

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      if (typeof window !== 'undefined' && (window as any).api?.settings) {
        const { settings } = (window as any).api;
        const [providers, globalModels, features] = await Promise.all([
          settings.getProviders(),
          settings.getGlobalModels(),
          settings.getFeatures()
        ]);
        set({ providers, globalModels, features });
      }
    } catch (e) {
      console.error('[SettingsStore] Failed to load config from IPC', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateProvider: async (provider) => {
    const { providers } = get() as SettingsState;
    const exists = providers.some(p => p.id === provider.id);
    const newProviders = exists 
      ? providers.map(p => p.id === provider.id ? provider : p)
      : [...providers, provider];
    
    set({ providers: newProviders });

    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setProviders(newProviders);
    }
  },

  toggleProvider: async (id, isEnabled) => {
    const { providers, updateProvider } = get() as SettingsState & SettingsActions;
    const provider = providers.find(p => p.id === id);
    if (provider) {
      await updateProvider({ ...provider, isEnabled });
    }
  },

  setGlobalModels: async (config) => {
    set({ globalModels: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setGlobalModels(config);
    }
  },

  setFeatureSettings: async (config) => {
    set({ features: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setFeatures(config);
    }
  }
}));
