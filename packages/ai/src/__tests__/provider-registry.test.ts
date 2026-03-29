import { describe, it, expect } from 'vitest';
import { AIProviderRegistry } from '../provider-registry';
import { OpenAIProvider } from '../providers/openai.provider';

describe('AIProviderRegistry & Providers', () => {
  it('should register and retrieve a provider successfully', () => {
    const registry = new AIProviderRegistry();
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    
    registry.register('openai', provider);
    
    expect(registry.hasProvider('openai')).toBe(true);
    expect(registry.getProvider('openai')).toBe(provider);
  });

  it('should throw an error when retrieving an unknown provider', () => {
    const registry = new AIProviderRegistry();
    
    expect(() => registry.getProvider('unknown')).toThrowError('Provider unknown not found');
  });

  it('should throw an error when registering a duplicate provider', () => {
    const registry = new AIProviderRegistry();
    const provider = new OpenAIProvider({ apiKey: 'test' });
    
    registry.register('openai', provider);
    expect(() => registry.register('openai', provider)).toThrowError('Provider openai is already registered');
  });

  it('OpenAIProvider应该返回一个有效的LanguageModelV1实例', () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key', baseURL: 'http://localhost/v1' });
    const model = provider.getModel('gpt-4');
    
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4');
    expect(model.provider).toContain('openai');
    expect(provider.supportsModel('gpt-4')).toBe(true);
  });
});
