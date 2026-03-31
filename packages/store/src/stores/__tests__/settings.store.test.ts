import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings.store';
import type { 
  AIProviderConfig, 
  RagConfig 
} from '@baishou/shared';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Mock IPC
    (global as any).window = {
      api: {
        settings: {
          getProviders: vi.fn(),
          setProviders: vi.fn(),
          getGlobalModels: vi.fn(),
          setGlobalModels: vi.fn(),
          getAgentBehaviorConfig: vi.fn(),
          setAgentBehaviorConfig: vi.fn(),
          getRagConfig: vi.fn(),
          setRagConfig: vi.fn(),
          getWebSearchConfig: vi.fn(),
          setWebSearchConfig: vi.fn(),
          getSummaryConfig: vi.fn(),
          setSummaryConfig: vi.fn(),
          getToolManagementConfig: vi.fn(),
          setToolManagementConfig: vi.fn(),
          getMcpServerConfig: vi.fn(),
          setMcpServerConfig: vi.fn(),
        }
      }
    };
    
    // reset store state
    useSettingsStore.setState({
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
      isLoading: false
    });
  });

  it('should initialize empty configurations', () => {
    const state = useSettingsStore.getState();
    expect(state.providers).toEqual([]);
    expect(state.ragConfig).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should load all domain configs correctly via IPC', async () => {
    const mockProviders: AIProviderConfig[] = [
      { id: 'openai', name: 'OpenAI', isEnabled: true, apiKey: 'mock-key', baseUrl: '', models: [], enabledModels: [], defaultDialogueModel: '', defaultNamingModel: '', isSystem: false, sortOrder: 0 }
    ];
    const mockRag: RagConfig = { ragEnabled: true, ragTopK: 15, ragSimilarityThreshold: 0.5 };
    
    (global as any).window.api.settings.getProviders.mockResolvedValue(mockProviders);
    (global as any).window.api.settings.getRagConfig.mockResolvedValue(mockRag);

    await useSettingsStore.getState().loadConfig();

    const state = useSettingsStore.getState();
    expect(state.providers.length).toBe(1);
    expect(state.providers[0].apiKey).toBe('mock-key');
    expect(state.ragConfig?.ragTopK).toBe(15);
  });

  it('should update provider and sync to IPC', async () => {
    useSettingsStore.setState({
      providers: [
        { id: 'gemini', name: 'Gemini', isEnabled: true, apiKey: 'old-key', baseUrl: '', models: [], enabledModels: [], defaultDialogueModel: '', defaultNamingModel: '', isSystem: false, sortOrder: 0 }
      ]
    });

    const updatedProvider: AIProviderConfig = { 
      id: 'gemini', name: 'Gemini', isEnabled: true, apiKey: 'new-key', baseUrl: '', models: [], enabledModels: [], defaultDialogueModel: '', defaultNamingModel: '', isSystem: false, sortOrder: 0 
    };

    await useSettingsStore.getState().updateProvider(updatedProvider);

    const state = useSettingsStore.getState();
    expect(state.providers[0].apiKey).toBe('new-key');
    expect((global as any).window.api.settings.setProviders).toHaveBeenCalledWith(state.providers);
  });

  it('should call corresponding IPC set method when updating a domain config', async () => {
    const newRag: RagConfig = { ragEnabled: false, ragTopK: 10, ragSimilarityThreshold: 0.8 };
    
    await useSettingsStore.getState().setRagConfig(newRag);
    
    const state = useSettingsStore.getState();
    expect(state.ragConfig?.ragEnabled).toBe(false);
    expect((global as any).window.api.settings.setRagConfig).toHaveBeenCalledWith(newRag);
  });

  it('should toggle provider enable flag safely', async () => {
    useSettingsStore.setState({
      providers: [
        { id: 'anthropic', name: 'Anthropic', isEnabled: true, apiKey: '', baseUrl: '', models: [], enabledModels: [], defaultDialogueModel: '', defaultNamingModel: '', isSystem: false, sortOrder: 0 }
      ]
    });

    await useSettingsStore.getState().toggleProvider('anthropic', false);

    const state = useSettingsStore.getState();
    expect(state.providers[0].isEnabled).toBe(false);
  });
});
