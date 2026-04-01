import { describe, it, expect } from 'vitest';
import { ProviderFactory } from '../provider.factory';
import { OpenAIAdaptedProvider } from '../openai.provider';
import { GeminiAdaptedProvider } from '../gemini.provider';
import { AnthropicAdaptedProvider } from '../anthropic.provider';

describe('ProviderFactory', () => {
  it('should instantiate OpenAIAdaptedProvider when config type is openai', () => {
    const config = { 
      id: 'openai_1', 
      type: 'openai',
      name: 'OpenAI', 
      apiKey: 'test-key', 
      baseUrl: 'http://localhost', 
      models: [], 
      isSystem: true, 
      isEnabled: true, 
      sortOrder: 0, 
      enabledModels: [], 
      defaultDialogueModel: '', 
      defaultNamingModel: '' 
    };
    const provider = ProviderFactory.createProviderFromConfig(config as any);
    expect(provider).toBeInstanceOf(OpenAIAdaptedProvider);
    expect(provider.config.apiKey).toBe('test-key');
  });

  it('should instantiate GeminiAdaptedProvider when config type is gemini', () => {
    const config = { 
      id: 'gemini_1', 
      type: 'gemini',
      name: 'Gemini', 
      apiKey: 'test-key', 
      baseUrl: 'http://localhost', 
      models: [], 
      isSystem: true, 
      isEnabled: true, 
      sortOrder: 0, 
      enabledModels: [], 
      defaultDialogueModel: '', 
      defaultNamingModel: '' 
    };
    const provider = ProviderFactory.createProviderFromConfig(config as any);
    expect(provider).toBeInstanceOf(GeminiAdaptedProvider);
  });

  it('should instantiate AnthropicAdaptedProvider when config type is anthropic', () => {
    const config = { 
      id: 'anthropic_1', 
      type: 'anthropic',
      name: 'Anthropic', 
      apiKey: 'test-key', 
      baseUrl: 'http://localhost', 
      models: [], 
      isSystem: true, 
      isEnabled: true, 
      sortOrder: 0, 
      enabledModels: [], 
      defaultDialogueModel: '', 
      defaultNamingModel: '' 
    };
    const provider = ProviderFactory.createProviderFromConfig(config as any);
    expect(provider).toBeInstanceOf(AnthropicAdaptedProvider);
  });

  it('should throw Error for unsupported provider types', () => {
    const config = { 
      id: 'unknown_provider_123', 
      type: 'unsupported_type',
      name: 'Unknown', 
      apiKey: 'test-key', 
      baseUrl: 'http://localhost', 
      models: [], 
      isSystem: false, 
      isEnabled: true, 
      sortOrder: 0, 
      enabledModels: [], 
      defaultDialogueModel: '', 
      defaultNamingModel: '' 
    };
    expect(() => ProviderFactory.createProviderFromConfig(config as any)).toThrow('Unsupported AI Provider Type');
  });
});
