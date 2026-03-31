import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdaptedProvider } from '../openai.provider';
import { ProviderType, createAiProvider } from '@baishou/shared';
// 模拟 @ai-sdk/openai
import * as openaiSdk from '@ai-sdk/openai';

vi.mock('@ai-sdk/openai', () => {
  const dummyModel = {};
  const dummyEmbedModel = {};
  const mockFactory = vi.fn().mockImplementation((id: string) => dummyModel);
  (mockFactory as any).textEmbeddingModel = vi.fn().mockReturnValue(dummyEmbedModel);
  
  return {
    createOpenAI: vi.fn().mockReturnValue(mockFactory),
  };
});

describe('OpenAIAdaptedProvider', () => {
  it('should initialize with correct custom baseURL and API key', () => {
    const config = createAiProvider({
      id: ProviderType.DeepSeek,
      name: 'DeepSeek',
      type: ProviderType.DeepSeek,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com/v1',
    });

    const provider = new OpenAIAdaptedProvider(config);
    expect(provider.config.id).toBe(ProviderType.DeepSeek);
    
    // 验证底层工厂被调用的参数
    expect(openaiSdk.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com/v1',
    });
  });

  it('should fallback to default parameters when executing getLanguageModel', () => {
    const config = createAiProvider({
      id: ProviderType.OpenAI,
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      defaultDialogueModel: 'gpt-4o',
    });

    const provider = new OpenAIAdaptedProvider(config);
    const model = provider.getLanguageModel();
    expect(model).toBeDefined();
    // 需要断言底层工厂拿到了 gpt-4o
    const factory = vi.mocked(openaiSdk.createOpenAI).mock.results[0].value;
    expect(factory).toHaveBeenCalledWith('gpt-4o');
  });
});
