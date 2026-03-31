import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings.store';
import { AIProviderConfig } from '@baishou/shared';

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
          getFeatures: vi.fn(),
          setFeatures: vi.fn(),
        }
      }
    };
    
    useSettingsStore.setState({
      themeMode: 'system',
      useGlassmorphism: true,
      locale: 'zh',
      providers: [],
      globalModels: null,
      features: null,
      isLoading: false
    });
  });

  it('should initialize empty configurations', () => {
    const state = useSettingsStore.getState();
    expect(state.providers).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should load config correctly via IPC', async () => {
    const mockProviders: AIProviderConfig[] = [
      { id: 'openai', name: 'OpenAI', isEnabled: true, apiKey: 'mock-key', baseUrl: '', customModels: [] }
    ];
    
    (global as any).window.api.settings.getProviders.mockResolvedValue(mockProviders);

    await useSettingsStore.getState().loadConfig();

    const state = useSettingsStore.getState();
    expect(state.providers.length).toBe(1);
    expect(state.providers[0].apiKey).toBe('mock-key');
  });

  it('should update provider and sync to IPC', async () => {
    useSettingsStore.setState({
      providers: [
        { id: 'gemini', name: 'Gemini', isEnabled: true, apiKey: 'old-key', baseUrl: '', customModels: [] }
      ]
    });

    const updatedProvider: AIProviderConfig = { 
      id: 'gemini', name: 'Gemini', isEnabled: true, apiKey: 'new-key', baseUrl: '', customModels: [] 
    };

    await useSettingsStore.getState().updateProvider(updatedProvider);

    const state = useSettingsStore.getState();
    expect(state.providers[0].apiKey).toBe('new-key');
    expect((global as any).window.api.settings.setProviders).toHaveBeenCalledWith(state.providers);
  });

  it('should toggle provider enable flag safely', async () => {
    useSettingsStore.setState({
      providers: [
        { id: 'anthropic', name: 'Anthropic', isEnabled: true, apiKey: '', baseUrl: '', customModels: [] }
      ]
    });

    await useSettingsStore.getState().toggleProvider('anthropic', false);

    const state = useSettingsStore.getState();
    expect(state.providers[0].isEnabled).toBe(false);
  });
});
