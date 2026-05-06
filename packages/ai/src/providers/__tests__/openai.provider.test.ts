import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdaptedProvider } from '../openai.provider';
import { ProviderType, createAiProvider } from '@baishou/shared';
// 模拟 @ai-sdk/openai
import * as openaiSdk from '@ai-sdk/openai';

vi.mock('@ai-sdk/openai', () => {
  const dummyModel = {};
  const dummyEmbedModel = {};
  const chatFn = vi.fn().mockReturnValue(dummyModel);
  const mockProvider = {
    chat: chatFn,
    textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel),
  };

  return {
    createOpenAI: vi.fn().mockReturnValue(mockProvider),
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

    // 触发 SDK 创建以验证参数
    provider.getLanguageModel();

    expect(openaiSdk.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com/v1',
        fetch: expect.any(Function),
      })
    );
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
    // 验证 chat 方法以正确的模型 ID 被调用
    const mockProvider = vi.mocked(openaiSdk.createOpenAI).mock.results[0].value;
    expect(mockProvider.chat).toHaveBeenCalledWith('gpt-4o');
  });
});
