import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel, EmbeddingModel } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';

export class AnthropicAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  private sdkInstance: ReturnType<typeof createAnthropic>;

  constructor(config: AiProviderModel) {
    this.config = config;

    this.sdkInstance = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'claude-3-opus-20240229';
    return this.sdkInstance(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(_modelId?: string): EmbeddingModel<string> {
    // Anthropic 官方目前未提供 embedding_model 对应 @ai-sdk/anthropic 的原生支持
    throw new Error('Embedding is not supported natively by Anthropic adapted provider yet');
  }

  async fetchAvailableModels(): Promise<string[]> {
    return ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
  }

  async testConnection(): Promise<void> {
    return Promise.resolve();
  }
}
