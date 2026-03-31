import { describe, it, expect } from 'vitest';
import { ProviderType, WebSearchMode, getDefaultWebSearchMode, createAiProvider } from '../types/ai-provider.types';

describe('AI Provider Types & Utils', () => {
  it('should return default WebSearchMode as Tool for any provider type', () => {
    expect(getDefaultWebSearchMode(ProviderType.OpenAI)).toBe(WebSearchMode.Tool);
    expect(getDefaultWebSearchMode(ProviderType.Gemini)).toBe(WebSearchMode.Tool);
  });

  it('should create AI provider with default values', () => {
    const provider = createAiProvider({
      id: 'test-id',
      name: 'Test Gemini',
      type: ProviderType.Gemini
    });

    expect(provider).toEqual({
      id: 'test-id',
      name: 'Test Gemini',
      type: ProviderType.Gemini,
      apiKey: '',
      baseUrl: '',
      models: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      isEnabled: true,
      enabledModels: [],
      isSystem: true,
      sortOrder: 0,
      webSearchMode: WebSearchMode.Tool,
    });
  });

  it('should override default values when provided', () => {
    const provider = createAiProvider({
      id: 'custom-1',
      name: 'Custom Provider',
      type: ProviderType.Custom,
      apiKey: 'sk-12345',
      webSearchMode: WebSearchMode.Off,
      isSystem: false,
    });

    expect(provider.apiKey).toBe('sk-12345');
    expect(provider.webSearchMode).toBe(WebSearchMode.Off);
    expect(provider.isSystem).toBe(false);
  });
});
