import { createStore } from '../create-store';
import { i18n } from '@baishou/shared';
import type { 
  AIProviderConfig, 
  GlobalModelsConfig, 
  AgentBehaviorConfig, 
  RagConfig, 
  WebSearchConfig, 
  SummaryConfig, 
  ToolManagementConfig, 
  McpServerConfig,
  HotkeyConfig
} from '@baishou/shared';

export type AppThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
  // --- UI Preferences ---
  themeMode: AppThemeMode;
  useGlassmorphism: boolean;
  locale: string;

  // --- Domain Config Blocks ---
  providers: AIProviderConfig[];
  globalModels: GlobalModelsConfig | null;
  agentBehavior: AgentBehaviorConfig | null;
  ragConfig: RagConfig | null;
  webSearchConfig: WebSearchConfig | null;
  summaryConfig: SummaryConfig | null;
  toolManagementConfig: ToolManagementConfig | null;
  mcpServerConfig: McpServerConfig | null;
  hotkeyConfig: HotkeyConfig | null;

  isLoading: boolean;
}

export interface SettingsActions {
  setThemeMode: (mode: AppThemeMode) => void;
  toggleGlassmorphism: (enabled: boolean) => void;
  setLocale: (locale: string) => void;

  // AI 设定异步操作
  loadConfig: () => Promise<void>;
  
  // Provider Configs
  setProviders: (providers: AIProviderConfig[]) => Promise<void>;
  updateProvider: (provider: AIProviderConfig) => Promise<void>;
  toggleProvider: (id: string, isEnabled: boolean) => Promise<void>;

  // Domain Config Actions
  setGlobalModels: (config: GlobalModelsConfig) => Promise<void>;
  setAgentBehaviorConfig: (config: AgentBehaviorConfig) => Promise<void>;
  setRagConfig: (config: RagConfig) => Promise<void>;
  setWebSearchConfig: (config: WebSearchConfig) => Promise<void>;
  setSummaryConfig: (config: SummaryConfig) => Promise<void>;
  setToolManagementConfig: (config: ToolManagementConfig) => Promise<void>;
  setMcpServerConfig: (config: McpServerConfig) => Promise<void>;
  setHotkeyConfig: (config: HotkeyConfig) => Promise<void>;
}

export const useSettingsStore = createStore<SettingsState & SettingsActions>('SettingsStore', (set, get: any) => ({
  themeMode: 'system',
  useGlassmorphism: true,
  locale: 'zh',
  
  providers: [],
  globalModels: null,
  agentBehavior: null,
  ragConfig: null,
  webSearchConfig: null,
  summaryConfig: null,
  toolManagementConfig: null,
  mcpServerConfig: null,
  hotkeyConfig: null,
  
  isLoading: false,

  setThemeMode: (themeMode) => set({ themeMode }),
  toggleGlassmorphism: (useGlassmorphism) => set({ useGlassmorphism }),
  setLocale: (locale) => {
    set({ locale });
    // 同步更新 i18next 语言，确保所有使用 useTranslation() 的组件立即重渲染
    i18n.changeLanguage(locale === 'system' ? navigator.language.split('-')[0] : locale);
  },

  loadConfig: async () => {
    set({ isLoading: true });
    try {
      if (typeof window !== 'undefined' && (window as any).api?.settings) {
        const { settings } = (window as any).api;
        const [
          providers, globalModels, agentBehavior, ragConfig, 
          webSearchConfig, summaryConfig, toolManagementConfig, mcpServerConfig, hotkeyConfig
        ] = await Promise.all([
          settings.getProviders(),
          settings.getGlobalModels(),
          settings.getAgentBehaviorConfig(),
          settings.getRagConfig(),
          settings.getWebSearchConfig(),
          settings.getSummaryConfig(),
          settings.getToolManagementConfig(),
          settings.getMcpServerConfig(),
          settings.getHotkeyConfig()
        ]);
        
        const defaultGlobalModels: GlobalModelsConfig = {
          globalDialogueProviderId: '',
          globalDialogueModelId: '',
          globalNamingProviderId: '',
          globalNamingModelId: '',
          globalSummaryProviderId: '',
          globalSummaryModelId: '',
          globalEmbeddingProviderId: '',
          globalEmbeddingModelId: '',
          monthlySummarySource: 'weeklies'
        };

        const defaultAgentBehavior: AgentBehaviorConfig = {
          agentContextWindowSize: 20,
          companionCompressTokens: 8000,
          companionTruncateTokens: 4000,
          agentPersona: '',
          agentGuidelines: '',
          pinnedAssistantIds: []
        };

        const defaultRagConfig: RagConfig = {
          ragEnabled: true,
          ragTopK: 20,
          ragSimilarityThreshold: 0.4
        };

        const defaultWebSearchConfig: WebSearchConfig = {
          webSearchEngine: 'duckduckgo',
          webSearchMaxResults: 5,
          webSearchRagEnabled: false,
          tavilyApiKey: '',
          webSearchRagMaxChunks: 12,
          webSearchRagChunksPerSource: 4,
          webSearchPlainSnippetLength: 3000
        };

        const defaultSummaryConfig: SummaryConfig = {
          instructions: {}
        };

        const defaultToolManagementConfig: ToolManagementConfig = {
          disabledToolIds: [],
          customConfigs: {}
        };

        const defaultMcpServerConfig: McpServerConfig = {
          mcpEnabled: false,
          mcpPort: 31004
        };

        const defaultHotkeyConfig: HotkeyConfig = {
          hotkeyEnabled: false,
          hotkeyModifier: 'Alt',
          hotkeyKey: 'Space'
        };
        
        set({ 
          providers: providers || [], 
          globalModels: globalModels || defaultGlobalModels, 
          agentBehavior: agentBehavior || defaultAgentBehavior, 
          ragConfig: ragConfig || defaultRagConfig, 
          webSearchConfig: webSearchConfig || defaultWebSearchConfig, 
          summaryConfig: summaryConfig || defaultSummaryConfig, 
          toolManagementConfig: toolManagementConfig || defaultToolManagementConfig, 
          mcpServerConfig: mcpServerConfig || defaultMcpServerConfig, 
          hotkeyConfig: hotkeyConfig || defaultHotkeyConfig 
        });
      }
    } catch (e) {
      console.error('[SettingsStore] Failed to load config from IPC', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setProviders: async (providers) => {
    set({ providers });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setProviders(providers);
    }
  },

  updateProvider: async (provider) => {
    const { providers, setProviders } = get() as SettingsState & SettingsActions;
    const exists = providers.some(p => p.id === provider.id);
    const newProviders = exists 
      ? providers.map(p => p.id === provider.id ? provider : p)
      : [...providers, provider];
    await setProviders(newProviders);
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

  setAgentBehaviorConfig: async (config) => {
    set({ agentBehavior: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setAgentBehaviorConfig(config);
    }
  },

  setRagConfig: async (config) => {
    set({ ragConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setRagConfig(config);
    }
  },

  setWebSearchConfig: async (config) => {
    set({ webSearchConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setWebSearchConfig(config);
    }
  },

  setSummaryConfig: async (config) => {
    set({ summaryConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setSummaryConfig(config);
    }
  },

  setToolManagementConfig: async (config) => {
    set({ toolManagementConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setToolManagementConfig(config);
    }
  },

  setMcpServerConfig: async (config) => {
    set({ mcpServerConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setMcpServerConfig(config);
    }
  },

  setHotkeyConfig: async (config) => {
    set({ hotkeyConfig: config });
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      await (window as any).api.settings.setHotkeyConfig(config);
    }
  }
}));
