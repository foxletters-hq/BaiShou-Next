import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel, EmbeddingModel, generateText } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { getRotatedApiKey } from './provider.utils';

export class AnthropicAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  constructor(config: AiProviderModel) {
    this.config = config;
  }

  private _getSdk() {
    const rotatedKey = getRotatedApiKey(this.config);
    return createAnthropic({
      apiKey: rotatedKey || this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'claude-3-opus-20240229';
    return this._getSdk()(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(_modelId?: string): EmbeddingModel {
    // Anthropic 官方目前未提供 embedding_model 对应 @ai-sdk/anthropic 的原生支持
    throw new Error('Embedding is not supported natively by Anthropic adapted provider yet');
  }

  async fetchAvailableModels(): Promise<string[]> {
    return [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022', 
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }

  async testConnection(testModelId?: string): Promise<void> {
    const modelToTest = testModelId || this.config.defaultDialogueModel || 'claude-3-haiku-20240307';

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort('Connection timeout'), 15000);

      await generateText({
        model: this.getLanguageModel(modelToTest),
        prompt: 'test',
        maxOutputTokens: 1,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);
    } catch (e: any) {
      console.error(`Test connection error for ${this.config.name}:`, e);
      throw new Error(`Connection test failed: ${e.message || 'Unknown network error'}`);
    }
  }
}
