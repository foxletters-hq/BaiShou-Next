import { describe, it, expect, vi } from 'vitest';
import { OpenAIProvider } from '../providers/openai.provider';
import { AIProviderConfig } from '../types';

// Mock @ai-sdk/openai
vi.mock('@ai-sdk/openai', () => {
  return {
    createOpenAI: vi.fn().mockImplementation((config) => {
      return function mockModel(modelId: string) {
        return {
          modelId,
          config,
          provider: 'openai.mock',
        };
      };
    })
  };
});

describe('OpenAIProvider', () => {
  const mockConfig: AIProviderConfig = {
    apiKey: 'test-api-key',
    baseURL: 'https://api.openai.custom.com/v1',
    customHeaders: { 'X-Custom-Header': 'test' }
  };

  it('should initialize successfully with valid config', () => {
    const provider = new OpenAIProvider(mockConfig);
    expect(provider).toBeDefined();
  });

  it('should return a LanguageModelV1 instance for a given modelId', () => {
    const provider = new OpenAIProvider(mockConfig);
    const model = provider.getModel('gpt-4o');
    
    // We mocked the model to return its id and config for easier testing
    expect((model as any).modelId).toBe('gpt-4o');
    expect((model as any).config.apiKey).toBe('test-api-key');
    expect((model as any).config.baseURL).toBe('https://api.openai.custom.com/v1');
    expect((model as any).config.headers).toEqual({ 'X-Custom-Header': 'test' });
  });

  it('should return true for any modelId in supportsModel (OpenAI dynamic check)', () => {
    const provider = new OpenAIProvider(mockConfig);
    expect(provider.supportsModel('gpt-4o')).toBe(true);
    expect(provider.supportsModel('o1-mini')).toBe(true);
  });
});
